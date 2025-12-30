// order-service.js - MS6 FIX
// Pola keamanan: Trust Gateway via x-user-id, fallback ke Auth /verify

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http'); // Digunakan untuk keepAlive agent
const axios = require('axios');
const { randomUUID } = require('crypto'); // Digunakan untuk Order ID (tidak terlihat di kode ini, tapi ada di require)

const app = express();
app.use(cors());
app.use(express.json());

// ====== Konfigurasi ======
const PORT = process.env.PORT || 5002;
const AUTH_URL = process.env.AUTH_URL || 'http://localhost:4001';
const PRODUCT_URL = process.env.PRODUCT_URL || 'http://localhost:5001';

// Menggunakan KeepAlive agent untuk koneksi yang efisien
const keepAliveAgent = new http.Agent({ keepAlive: true });

// Membuat instance axios untuk Auth Service
const axiosAuth = axios.create({
  baseURL: AUTH_URL,
  timeout: 12000, // 12 detik
  httpAgent: keepAliveAgent,
  validateStatus: () => true, // Menerima semua kode status tanpa melempar error
});

// Membuat instance axios untuk Product Service
const axiosProd = axios.create({
  baseURL: PRODUCT_URL,
  timeout: 12000, // 12 detik
  httpAgent: keepAliveAgent,
  validateStatus: () => true,
});


// ====== Logger ======
app.use((req, res, next) => {
  // Log request dengan mencantumkan Authorization header dan user ID dari header
  console.log(`[ORDER] REQ: ${req.method} ${req.url}, auth='${req.headers.authorization || ''}', x-user-id='${req.headers['x-user-id'] || ''}'`);
  next();
});

// ====== In-memory store (demo) ======
/** @type {Record<string, any>[]} */
const ORDERS = []; // Array untuk menyimpan data pesanan


// ====== Auth Middleware: trust gateway -> fallback verify ke auth-service ======
async function verify(req, res, next) {
  // 1) Trust Gateway (paling cepat)
  const userIdFromGateway = req.headers['x-user-id'];

  if (userIdFromGateway) {
    // Jika header 'x-user-id' ada, asumsikan sudah diverifikasi oleh Gateway
    req.user = { id: String(userIdFromGateway), via: 'gateway' };
    return next();
  }

  // 2) Fallback: verifikasi ke Auth-Service (delegasi)
  const authHeader = req.headers.authorization || '';

  // Cek apakah header 'Authorization' ada
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({ message: 'Authorization Bearer <token> wajib' });
  }

  try {
    // Memanggil endpoint verifikasi di Auth Service
    const r = await axiosAuth.get('/verify', {
      headers: { 'Authorization': authHeader }
    });

    // Jika status 2xx dari Auth Service
    if (r.status >= 200 && r.status < 300) {
      // Menyimpan data user dari Auth Service ke req.user
      req.user = r.data.user || r.data || { id: 'unknown', via: 'auth-verify' };
      return next(); // Lanjut
    }

    // Jika status bukan 2xx (misal 401, 403)
    return res.status(401).json({ message: 'Token tidak valid/expired (verify failed)', detail: r.data });

  } catch (e) {
    // Menangani error koneksi ke Auth Service
    return res.status(401).json({ 
        message: 'Token tidak valid/expired (auth-service unreachable)', 
        error: e.response?.data || e.message 
    });
  }
}

// ====== Health ======
app.get('/', (_req, res) => {
    res.json({ service: 'order-service', ok: true });
});

// ====== Helper: Ambil produk (opsional) ======
/**
 * Fungsi untuk mengambil detail produk dari Product Service.
 * @param {string | number} productId - ID produk yang akan dicari.
 * @param {string} authHeader - Header Authorization (e.g., "Bearer <token>").
 * @param {Record<string, string>} userHeaders - Header informasi user dari gateway (x-user-id, dll.).
 * @returns {Promise<object | null>} Detail produk atau null jika gagal.
 */
async function getProduct(productId, authHeader, userHeaders) {
    try {
        // Encode URI Component untuk memastikan ID produk aman dalam URL
        const r = await axiosProd.get(`/products/${encodeURIComponent(productId)}`, {
            headers: {
                // Meneruskan header Authorization jika ada
                ...(authHeader ? { Authorization: authHeader } : {}), 
                // Meneruskan header user dari gateway
                ...userHeaders, 
            },
        });

        // Jika respons berhasil (status 2xx)
        if (r.status >= 200 && r.status < 300) {
            return r.data;
        }
        
        // Jika status bukan 2xx (misal 404), kembalikan null
        return null; 
    } catch (_e) {
        // Tangani error koneksi/timeout, kembalikan null
        return null;
    }
}


// ====== Create Order ======
app.post('/orders', verify, async (req, res) => {
    // Menggunakan body request dan menyediakan fallback objek kosong
    const { productId, quantity, notes } = req.body || {}; 
    
    // Validasi input: productId wajib dan harus string/number
    if (!productId || (typeof productId !== 'string' && typeof productId !== 'number')) {
        return res.status(400).json({ message: 'productId wajib' });
    }

    // Validasi quantity: wajib dan harus berupa angka positif
    const qty = Number(quantity);
    if (Number.isNaN(qty) || qty <= 0) {
        return res.status(400).json({ message: 'quantity wajib (angka > 0)' });
    }

    // (opsional) lookup produk untuk mendapatkan price
    const product = await getProduct(
        String(productId), 
        req.headers.authorization || '',
        {
            'x-user-id': req.headers['x-user-id'] || '',
            'x-user-role': req.headers['x-user-role'] || '',
        }
    );

    // Dapatkan harga (price) dari produk, atau null
    const price = product?.price ?? null;
    
    // Hitung total amount: harga * kuantitas, atau null jika harga tidak ada
    const amount = price != null ? price * qty : null;

    // Persiapan data order
    const id = randomUUID(); // randomUUID() dari require('crypto')
    const now = new Date().toISOString();
    
    // Membuat objek order
    const order = {
        id,
        // Mengambil ID user dari req.user yang disuntikkan oleh middleware verify
        userId: req.user?.id || 'unknown',
        productId: String(productId),
        quantity: qty,
        notes: notes || null,
        price,      // Harga produk (dari lookup)
        amount,     // Total jumlah (harga * qty)
        status: 'CREATED',
        createdAt: now,
        updatedAt: now,
        // Menyimpan informasi verifikasi (gateway/auth-verify)
        verifiedBy: req.user?.via || 'unknown' 
    };

    // Menyimpan order ke dalam in-memory store (ORDERS)
    ORDERS[id] = order;

    // 201 Created
    return res.status(201).json(order);
});

// ====== List Own Orders ======
// GET /orders/
app.get('/orders', verify, (req, res) => {
    // Mendapatkan userId dari request
    const userId = req.user?.id || 'unknown';
    
    // Mengubah objek ORDERS menjadi array, lalu memfilter berdasarkan userId
    const list = Object.values(ORDERS).filter(o => o.userId === userId);
    
    return res.json({ data: list });
});


// ====== Detail Order ======
// GET /orders/:id
app.get('/orders/:id', verify, (req, res) => {
    // Mencari order berdasarkan ID dari params
    const o = ORDERS[req.params.id];
    
    // 1. Jika order tidak ditemukan
    if (!o) {
        return res.status(404).json({ message: 'Order tidak ditemukan' });
    }
    
    // 2. Jika order ditemukan, cek kepemilikan
    if (o.userId !== req.user?.id) {
        // Asumsi: jika bukan pemilik, maka Forbidden
        return res.status(403).json({ message: 'Forbidden' });
    }
    
    // 3. Jika pemilik, kirim data order
    return res.json(o);
});


// ====== Cancel Order ======
// PATCH /orders/:id/cancel
app.patch('/orders/:id/cancel', verify, (req, res) => {
    // Mencari order berdasarkan ID dari params
    const o = ORDERS[req.params.id];
    
    // 1. Jika order tidak ditemukan
    if (!o) {
        return res.status(404).json({ message: 'Order tidak ditemukan' });
    }
    
    // 2. Jika order ditemukan, cek kepemilikan
    if (o.userId !== req.user?.id) {
        // Asumsi: jika bukan pemilik, maka Forbidden
        return res.status(403).json({ message: 'Forbidden' });
    }
    
    // 3. Update status dan waktu update
    o.status = 'CANCELED';
    o.updatedAt = new Date().toISOString();
    
    return res.json(o);
});


// ====== 404 & Error Handler ======

// 404 Handler (Jika tidak ada route yang cocok)
app.use((req, res) => {
    return res.status(404).json({ 
        message: 'Route tidak ditemukan di order-service', 
        path: req.originalUrl 
    });
});

// Global Error Handler
app.use((err, req, res, next) => {
    // Log error lengkap
    console.error(`[ORDER] Error: ${err.stack || err.message || err}`); 
    
    // Mencegah mengirim respons jika header sudah terkirim
    if (!res.headersSent) { 
        return res.status(500).json({ 
            message: 'Kesalahan Internal order-service', 
            error: err.message || String(err) 
        });
    }
    next(err); 
});


// ====== Start ======
app.listen(PORT, () => console.log(`🚀 order-service listening on http://localhost:${PORT} [AUTH_URL=${AUTH_URL}]`));