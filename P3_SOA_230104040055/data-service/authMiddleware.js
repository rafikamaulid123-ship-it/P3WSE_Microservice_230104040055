// authMiddleware.js

// Import dotenv dan konfigurasikan untuk membaca file .env
require('dotenv').config();

// Import library jsonwebtoken
const jwt = require('jsonwebtoken');

/**
 * Middleware untuk memverifikasi JWT dari header Authorization.
 * @param {object} req - Objek request Express.
 * @param {object} res - Objek response Express.
 * @param {function} next - Fungsi untuk melanjutkan ke handler berikutnya.
 */
function authMiddleware(req, res, next) {
    // Ambil header 'Authorization', default ke string kosong jika tidak ada
    const auth = req.headers.authorization || '';

    // Wajib format: Authorization: Bearer <token>
    if (!auth.startsWith('Bearer ')) {
        return res.status(401).json({ 
            message: 'Header Authorization harus dalam format Bearer <token>' 
        });
    }

    // Ambil token dengan menghapus "Bearer " (7 karakter)
    const token = auth.slice(7);

    try {
        // Verifikasi token menggunakan JWT_SECRET dari .env
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Simpan info user (payload token) di objek request untuk dipakai oleh handler berikutnya
        req.user = decoded; 
        
        // Lanjutkan ke handler/route berikutnya
        next();
        
    } catch (err) {
        // Jika verifikasi gagal (token tidak valid, expired, dll.)
        return res.status(401).json({ 
            message: 'Token tidak valid atau kadaluarsa', 
            error: err.message // Menampilkan pesan error spesifik dari JWT
        });
    }
}

// Ekspor middleware agar bisa digunakan di file server utama
module.exports = authMiddleware;