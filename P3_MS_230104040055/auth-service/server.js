// auth-service/server.js

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

// Data User In-Memory (Demo)
const users = [
  { id: 1, username: 'mhs1', password: '123456', role: 'student' },
  { id: 2, username: 'mhs2', password: '654321', role: 'student' },
];

// Health Check
app.get('/', (_req, res) => res.send('Auth Service OK'));


// POST /login
app.post('/login', (req, res) => {
  try {
    const { username, password } = req.body || {};
    
    // 1. Validasi Input
    if (!username || !password) {
      return res.status(400).json({ message: 'username & password wajib' });
    }

    // 2. Cari User
    const user = users.find(u => u.username === username && u.password === password);
    
    // 3. Autentikasi Gagal
    if (!user) {
      return res.status(401).json({ message: 'Login gagal, username/password salah' });
    }

    // 4. Cek Konfigurasi JWT_SECRET
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'Konfigurasi JWT_SECRET belum di-set di .env' });
    }

    // 5. Buat Payload dan Token JWT
    const payload = { 
      sub: user.id, 
      username: user.username, 
      role: user.role 
    };
    
    const token = jwt.sign(
      payload, 
      process.env.JWT_SECRET, 
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' } // Menggunakan durasi dari .env atau default '1h'
    );
    
    // 6. Respon Sukses
    return res.json({ 
      message: 'Login sukses', 
      token: token, 
      expiresIn: process.env.JWT_EXPIRES_IN || '1h' 
    });
  
  } catch (e) {
    console.error(`[AUTH:/login] error:`, e);
    return res.status(500).json({ message: 'Gagal membuat token', error: e.message });
  }
});


// GET /verify
app.get('/verify', (req, res) => {
  const auth = req.headers.authorization || '';
  
  // Ekstrak token dari header "Bearer <token>"
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  
  // 1. Validasi Token
  if (!token) {
    return res.status(401).json({ valid: false, message: 'Token tidak ada' });
  }
  
  try {
    // 2. Verifikasi Token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 3. Respon Sukses
    // Mengembalikan status valid: true dan payload token (decoded data)
    return res.json({ valid: true, user: decoded }); 
  } catch (err) {
    // 4. Verifikasi Gagal (expired, signature invalid, dll)
    return res.status(401).json({ valid: false, error: err.message });
  }
});


// Start Server
const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`📡 Auth Service listening on http://localhost:${PORT}`);
});
