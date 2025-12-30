// server.js (API Gateway - FINAL fix GET /api/notifications)

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http'); // Digunakan untuk keepAlive agent
const https = require('https'); // Tidak digunakan di sini, tapi mungkin diperlukan untuk URL HTTPS
const axios = require('axios');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
app.use(cors());
app.use(express.json());

// ====== Logger ======
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Menggunakan KeepAlive agent untuk koneksi yang efisien
const keepAliveAgent = new http.Agent({ keepAlive: true });

// ====== Targets (URL Microservices) ======
// Mengambil dari .env atau menggunakan fallback localhost
const AUTH_URL    = process.env.AUTH_URL    || 'http://localhost:4001';
const PRODUCT_URL = process.env.PRODUCT_URL || 'http://localhost:5001';
const ORDER_URL   = process.env.ORDER_URL   || 'http://localhost:5002';
const NOTIF_URL   = process.env.NOTIF_URL   || 'http://localhost:5003';

// Membuat instance axios untuk setiap service
const axiosAuth = axios.create({
  baseURL: AUTH_URL,
  timeout: 12000, // 12 detik
  httpAgent: keepAliveAgent,
  validateStatus: () => true // Menerima semua kode status tanpa melempar error
});

const axiosProd = axios.create({
  baseURL: PRODUCT_URL,
  timeout: 15000, // 15 detik
  httpAgent: keepAliveAgent,
  validateStatus: () => true
});

const axiosOrder = axios.create({
  baseURL: ORDER_URL,
  timeout: 15000, // 15 detik
  httpAgent: keepAliveAgent,
  validateStatus: () => true
});

const axiosNotif = axios.create({
  baseURL: NOTIF_URL,
  timeout: 15000, // 15 detik
  httpAgent: keepAliveAgent,
  validateStatus: () => true
});


// ====== Health Check ======
app.get('/', (_req, res) => {
  res.send('API Gateway OK (MSI-H57)');
});

// ====== Auth Endpoints (Proxy/Custom Request) ======

// POST /auth/login
app.post('/auth/login', async (req, res) => {
  try {
    // Meneruskan permintaan login ke Auth Service
    const r = await axiosAuth.post('/login', req.body, {
      headers: { 'Content-Type': 'application/json' }
    });
    // Meneruskan respons dari Auth Service
    return res.status(r.status).json(r.data);
  } catch (e) {
    // Menangani error koneksi atau timeout
    if (e.response?.status) {
        return res.status(e.response.status).json({ message: 'Login via gateway gagal', error: e.response.data || e.message });
    }
    // Menangani error umum
    return res.status(502).json({ message: 'Login via gateway gagal', error: e.message });
  }
});

// GET /auth/verify
app.get('/auth/verify', async (req, res) => {
  try {
    // Mengambil header Authorization
    const auth = req.headers.authorization || '';
    
    // Meneruskan permintaan verifikasi ke Auth Service
    const r = await axiosAuth.get('/verify', {
      headers: { 'Authorization': auth }
    });
    
    // Meneruskan respons dari Auth Service
    return res.status(r.status).json(r.data);
  } catch (e) {
    // Menangani error koneksi atau timeout
    if (e.response?.status) {
        return res.status(e.response.status).json({ message: 'Verify via gateway gagal', error: e.response.data || e.message });
    }
    // Menangani error umum
    return res.status(502).json({ message: 'Verify via gateway gagal', error: e.message });
  }
});

// ... (Kode proxy middleware lainnya akan ditambahkan di sini,
// seperti untuk /api/products, /api/orders, dan /api/notifications)

// ... (Pengaturan port untuk menjalankan server)
// ====== Auth Middleware (Delegated / Verify) ======
const auth = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  
  // Pastikan header Authorization ada dan berformat 'Bearer <token>'
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({ message: 'Authorization Bearer <token> wajib' });
  }

  try {
    // Memanggil endpoint verifikasi di Auth Service
    const r = await axiosAuth.get('/verify', {
      headers: { 'Authorization': authHeader } // Meneruskan header Auth ke Auth Service
    });

    // Jika verifikasi berhasil (status 2xx)
    if (r.status >= 200 && r.status < 300) {
      const userData = r.data.user || r.data; // Asumsi data user ada di r.data.user atau r.data
      
      // Menyimpan data user ke objek request
      if (userData.id) req.headers['x-user-id'] = String(userData.id);
      if (userData.username) req.headers['x-user-username'] = String(userData.username);
      if (userData.role) req.headers['x-user-role'] = String(userData.role);
      
      return next(); // Lanjut ke handler berikutnya (atau proxy)
    }

    // Jika status bukan 2xx (misal 401, 403 dari Auth Service)
    return res.status(401).json({ message: 'Token tidak valid', detail: r.data });

  } catch (e) {
    // Menangani error koneksi atau timeout
    return res.status(401).json({ message: 'Auth Verify gagal', error: e.message });
  }
};

// ====== Helper Proxy Options ======
function buildProxyOptions(target, pathRewrite) {
  return {
    target: target,
    changeOrigin: true,
    secure: false, // Set ke true jika target menggunakan HTTPS
    agent: keepAliveAgent, // Menggunakan agent KeepAlive
    timeout: 10000,
    ws: true, // Dukungan WebSocket
    
    // Rewrite path (misal dari /api/products/1 menjadi /products/1)
    pathRewrite: pathRewrite, 
    
    // Untuk method POST/PUT/PATCH, ubah body JSON kembali ke stream/buffer
    onProxyReq: (proxyReq, req, res) => {
      if (req.body && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
        // Konversi body JSON kembali ke string/buffer
        const body = JSON.stringify(req.body);
        proxyReq.setHeader('Content-Type', 'application/json');
        proxyReq.setHeader('Content-Length', Buffer.byteLength(body));
        proxyReq.write(body);
      }
    },

    // Menangani error proxy
    onError: (err, req, res) => {
      console.error('[HPM] Proxy ERROR:', err.code || err.message);
      if (!res.headersSent) {
        res.status(502).json({ 
            message: 'Upstream error, error code: ' + (err.code || err.message) 
        });
      }
    },
  };
}

// ====================== PRODUCTS (MS2) ======================

// POST /api/products (Custom via Axios)
app.post('/api/products', auth, async (req, res) => {
  try {
    // Meneruskan request ke Product Service
    const r = await axiosProd.post('/products', req.body, {
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': req.headers.authorization || '',
        'x-user-id': req.headers['x-user-id'] || '',
        'x-user-username': req.headers['x-user-username'] || ''
      }
    });
    return res.status(r.status).json(r.data);
  } catch (e) {
    // Menangani error
    const status = e.response?.status || 502;
    return res.status(status).json({ 
        message: 'Create product via gateway gagal', 
        error: e.response?.data || e.message, 
        code: status 
    });
  }
});

// GET/PUT/DELETE via Proxy
app.use('/api/products', auth, createProxyMiddleware(
  buildProxyOptions(PRODUCT_URL, { '^/api/products': '/products' }) // <-- PERBAIKAN DI SINI
));

// ====================== ORDERS (MS3) ======================

// POST /api/orders (Custom via Axios)
app.post('/api/orders', auth, async (req, res) => {
  try {
    // Meneruskan request ke Order Service
    const r = await axiosOrder.post('/orders', req.body, {
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': req.headers.authorization || '',
        'x-user-id': req.headers['x-user-id'] || '',
        'x-user-username': req.headers['x-user-username'] || ''
      }
    });
    return res.status(r.status).json(r.data);
  } catch (e) {
    // Menangani error
    const status = e.response?.status || 502;
    return res.status(status).json({ 
        message: 'Create order via gateway gagal', 
        error: e.response?.data || e.message, 
        code: status 
    });
  }
});

// GET/PUT/DELETE via Proxy
app.use('/api/orders', auth, createProxyMiddleware(
  buildProxyOptions(ORDER_URL, { '^/api/orders': '/api' }) // pathRewrite: ^/api/orders/ -> /api/
));

// ... (Bagian Notifikasi (MS4) mungkin berada di bawah ini)
/***************** NOTIFICATIONS (MS7) ************************/

// POST via Axios /api/notifications/notify
app.post('/api/notifications/notify', auth, async (req, res) => {
  try {
    // Meneruskan request ke Notif Service
    const r = await axiosNotif.post('/notify', req.body, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.authorization || '',
        'x-user-id': req.headers['x-user-id'] || '',
        'x-user-username': req.headers['x-user-username'] || '',
        'x-user-role': req.headers['x-user-role'] || ''
      }
    });
    return res.status(r.status).json(r.data);
  } catch (e) {
    // Menangani error
    const status = e.response?.status || 502;
    return res.status(status).json({
      message: 'Gateway -> Notification gagal',
      error: e.response?.data || e.message,
      code: status
    });
  }
});


/** *FIX UTAMA* **/
// 1) GET persist /api/notifications + axios ke /notifications
app.get('/api/notifications', auth, async (req, res) => {
  try {
    // Meneruskan request GET ke Notif Service untuk mengambil notifikasi
    const r = await axiosNotif.get('/notifications', {
      headers: {
        'Authorization': req.headers.authorization || '',
        'x-user-id': req.headers['x-user-id'] || '',
        'x-user-username': req.headers['x-user-username'] || '',
        'x-user-role': req.headers['x-user-role'] || ''
      }
    });
    return res.status(r.status).json(r.data);
  } catch (e) {
    // Menangani error
    const status = e.response?.status || 502;
    return res.status(status).json({
      message: 'Gateway -> Notification (GET) gagal',
      error: e.response?.data || e.message,
      code: status
    });
  }
});


// 2) Path lain /api/notifications/* -> proxy ke /notifications/*
app.use(
  '/api/notifications',
  auth,
  createProxyMiddleware({
    target: NOTIF_URL,
    changeOrigin: true,
    xfwd: true,
    pathRewrite: {
      '^/api/notifications': '/notifications'
    },
    // Menggunakan custom onError handler untuk error proxy
    onError: (err, req, res) => {
      console.error(' [HPM] Notifications Proxy Error:', err);
      res.status(502).json({
        message: 'Gateway -> Notification error',
        error: err.message
      });
    },
  })
);


// ====== Start ======
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`📡 API Gateway Jalan di http://localhost:${PORT}`);
});