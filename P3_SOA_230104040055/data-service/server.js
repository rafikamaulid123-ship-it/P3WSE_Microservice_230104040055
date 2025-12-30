// server.js

// Import library yang dibutuhkan
require('dotenv').config(); // Konfigurasi dotenv
const express = require('express');
const cors = require('cors'); // <--- PERBAIKAN: Mengganti 'require' dengan 'cors'
// Import middleware autentikasi yang telah dibuat
const authMiddleware = require('./authMiddleware'); 

// Inisialisasi Express
const app = express();
app.use(cors());
app.use(express.json()); // Agar bisa membaca body JSON dari request

// Data dummy: setiap item punya owner (username) yang berhak akses
const items = [
    { id: 1, name: 'Data Rahasia A', owner: 'mhs1' },
    { id: 2, name: 'Data Rahasia B', owner: 'mhs2' }
];

// ------------------------------------------------------------------
// --- ENDPOINT UNTUK DATA SERVICE ---

// Cek service (Health Check)
app.get('/', (req, res) => {
    res.send("Data Service OK (protected routes: /data)");
});

// GET /data (TERLINDUNGI) - Ambil data milik user pemegang token
app.get('/data', authMiddleware, (req, res) => {
    // req.user berisi payload token yang sudah didekode (dari authMiddleware)
    const username = req.user.username; 
    
    // Filter data hanya untuk user yang bersangkutan
    const filtered = items.filter(i => i.owner === username);

    // Kirim respons
    res.json({
        message: `Halo ${username}, berikut data yang dapat kamu akses`,
        data: filtered
    });
});

// POST /data (TERLINDUNGI) - Tambah item milik user pemegang token
app.post('/data', authMiddleware, (req, res) => {
    // 1. Ambil username dari token yang sudah diverifikasi oleh authMiddleware
    const username = req.user.username; 
    
    // 2. Ambil data yang dikirim (nama item)
    const { name } = req.body;
    
    // 3. Validasi: pastikan 'name' tidak kosong
    if (!name) {
        return res.status(400).json({ message: 'Field "name" wajib diisi' });
    }

    // 4. Generate ID baru secara sederhana
    // Jika array kosong, ID = 1. Jika tidak, ID = ID item terakhir + 1.
    const id = items.length ? items[items.length - 1].id + 1 : 1;
    
    // 5. Buat objek item baru
    const newItem = { 
        id, 
        name, 
        owner: username // Tetapkan owner item berdasarkan user pemegang token
    };

    // 6. Simpan item baru ke data in-memory
    items.push(newItem);
    
    // 7. Kirim respons sukses 201 (Created)
    res.status(201).json({ message: 'Item dibuat', item: newItem });
});

// ------------------------------------------------------------------
// --- START SERVER (Hanya satu kali) ---

// Menggunakan PORT 4001 agar tidak bentrok dengan Auth Service
const PORT = process.env.PORT || 4001; 

app.listen(PORT, () => {
    console.log(`Data Service berjalan di http://localhost:${PORT}`);
});