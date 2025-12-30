// Catatan: Pastikan Anda telah menjalankan 'npm install express jsonwebtoken dotenv cors'
// dan membuat file .env dengan variabel yang diperlukan (PORT, JWT_SECRET, JWT_EXPIRES_IN).

// 1. Import library yang dibutuhkan
const dotenv = require('dotenv'); // agar bisa baca file .env
const express = require('express'); // framework web
const jwt = require('jsonwebtoken'); // untuk buat token JWT
const cors = require('cors'); // agar API bisa diakses dari luar

dotenv.config();

// 2. Inisialisasi express
const app = express();
app.use(cors());
// agar bisa baca body JSON dari request
app.use(express.json());

// 3. Simulasi data user (seolah-olah database)
const users = [
    { username: 'mhs1', password: '123456' },
    { username: 'mhs2', password: '654321' }
];

// 4. Endpoint GET / - hanya untuk cek server
app.get('/', (req, res) => {
    res.send('Auth Service aktif 🧑‍💻');
});

// 5. Endpoint POST /login
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Cek input ada atau tidak
    if (!username || !password) {
        return res.status(400).json({ message: 'Username dan Password wajib diisi!' });
    }

    // Cari user di "database"
    const user = users.find(u => u.username === username && u.password === password);

    // Jika user tidak ditemukan (login gagal)
    if (!user) {
        return res.status(401).json({ message: 'Login gagal, username atau password salah!' });
    }

    // buat payload JWT (isi token)
    const payload = { username: user.username };

    // buat token (gunakan secret dari .env dan setting expired dari .env)
    const token = jwt.sign(
        payload,
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // kirim token ke client
    res.json({
        message: 'Login sukses',
        token
    });
});

// 6. Jalankan server
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
    console.log(`Auth Service berjalan di http://localhost:${PORT}`);
});