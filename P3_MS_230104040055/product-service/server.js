// product-service/server.js

require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();

// --- Middleware dasar ---
app.use(cors());
app.use(express.json());

// (Opsional) Logger ringkas agar kelihatan request yang masuk
app.use((req, _res, next) => {
  console.log(`[PRODUCT] ${req.method} ${req.url}`);
  next();
});

// --- Data in-memory demo ---
let products = [
  { id: 1, name: 'Pulpen', price: 5000 },
  { id: 2, name: 'Buku Tulis', price: 12000 }
];

// --- GET list produk ---
app.get('/products', (_req, res) => {
  console.log('[PRODUCT] Mengirim data:', products);
  res.json(products);
});

// --- Health check ---
app.get('/', (_req, res) => res.send('Product Service OK'));

// --- GET detail produk by id ---
app.get('/products/:id', (req, res) => {
  const id = Number(req.params.id);
  // Mencari produk di array 'products' berdasarkan id
  const prod = products.find(p => p.id === id);

  // Jika produk tidak ditemukan
  if (!prod) {
    return res.status(404).json({ message: 'Product tidak ditemukan' });
  }

  res.json(prod);
});

// --- POST buat produk baru ---
app.post('/products', (req, res) => {
  // Destructuring body request, memberikan nilai default kosong jika body kosong
  const { name, price } = req.body || {};

  // Validasi sederhana: name harus ada dan price harus berupa angka valid
  if (!name || price == null || Number.isNaN(Number(price))) {
    return res.status(400).json({ message: 'name & price (angka) wajib' });
  }

  // Menentukan ID baru: ambil ID terakhir, tambahkan 1
  const newId = products.length ? products[products.length - 1].id + 1 : 1;
  
  // Membuat objek produk baru
  const prod = { id: newId, name, price: Number(price) };

  // Menambahkan produk ke array in-memory
  products.push(prod);

  // 201 Created
  res.status(201).json({ message: 'Product dibuat', product: prod });
});

// --- Start server ---
// Menggunakan PORT dari .env atau default 5001
const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`📡 Product Service listening on http://localhost:${PORT}`);
});