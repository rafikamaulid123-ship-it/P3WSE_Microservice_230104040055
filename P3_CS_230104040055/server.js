// server.js - Client-Server: CRUD Mahasiswa (in-memory)

const express = require('express');
const app = express();

// --- CONFIG ---
const PORT = process.env.PORT || 3001; // default 3001 sesuai permintaan

// --- MIDDLEWARE ---
// agar body JSON bisa dibaca
app.use(express.json());

// --- DATA IN-MEMORY (UNTUK PRAKTIKUM) ---
// NOTE: akan hilang jika server restart (ini hanya simulasi)
const mahasiswa = [
    // Contoh awal (boleh dikosongkan):
    {
        nim: '2310511000',
        nama: 'Siti Aulia',
        prodi: 'Teknik Informatika',
        angkatan: 2023
    }
];

// --- HELPER VALIDATION ---

/**
 * Memvalidasi payload data mahasiswa.
 * @param {object} body - Objek data yang akan divalidasi.
 * @param {boolean} [allowPartial=false] - Jika true, hanya memvalidasi field yang ada. Jika false, memvalidasi semua field wajib.
 * @returns {string|null} Pesan error jika validasi gagal, atau null jika valid.
 */
function validateMahasiswaPayload(body, { allowPartial = false } = {}) {
    const required = ['nim', 'nama', 'prodi', 'angkatan'];

    // Validasi field wajib tidak boleh kosong (hanya jika allowPartial = false)
    if (!allowPartial) {
        for (const k of required) {
            // Periksa jika field tidak terdefinisi, null, atau string kosong
            if (body[k] === undefined || body[k] === null || body[k] === '') {
                return `Field '${k}' wajib diisi`;
            }
        }
    }

    // Validasi field 'angkatan' jika ada
    if (body.angkatan !== undefined) {
        const ang = Number(body.angkatan);
        
        // Periksa apakah 'angkatan' adalah bilangan bulat yang wajar (contoh: antara 1900 dan 3000)
        if (!Number.isInteger(ang) || ang < 1900 || ang > 3000) {
            return `Field 'angkatan' harus berupa angka masuk akal (contoh: 2023)`;
        }
    }

    // Jika semua validasi lolos
    return null; // valid
}

// Tambahkan route dan logic server lainnya di sini...

// app.listen(PORT, () => {
//     console.log(`Server berjalan di http://localhost:${PORT}`);
// });
// Catatan: Asumsikan kode 'express', 'app', array 'mahasiswa', dan fungsi 'validateMahasiswaPayload'
// sudah didefinisikan di bagian atas file (dari kode sebelumnya).

// --- HEALTH CHECK ---
app.get('/', (req, res) => {
    // Mengirim status OK dengan emoji roket 🚀
    res.send('Server Client-Server OK (Mahasiswa CRUD) 🚀');
});

// --- LIST SEMUA MAHASISWA ---
app.get('/mahasiswa', (req, res) => {
    // Mengembalikan seluruh array mahasiswa sebagai JSON
    res.json(mahasiswa);
});

// --- DETAIL MAHASISWA BERDASARKAN NIM ---
app.get('/mahasiswa/:nim', (req, res) => {
    const { nim } = req.params;

    // Mencari mahasiswa berdasarkan nim
    const m = mahasiswa.find((x) => x.nim === nim);

    // Jika mahasiswa tidak ditemukan, kirim status 404 (Not Found)
    if (!m) {
        return res.status(404).json({ message: 'Mahasiswa tidak ditemukan' });
    }

    // Jika ditemukan, kirim data mahasiswa tersebut
    res.json(m);
});

// --- TAMBAH MAHASISWA ---
app.post('/mahasiswa', (req, res) => {
    // Lakukan validasi payload
    const err = validateMahasiswaPayload(req.body, { allowPartial: false });
    
    // Jika ada error validasi, kirim status 400 (Bad Request)
    if (err) {
        return res.status(400).json({ message: err });
    }

    // Destrukturisasi data yang valid
    const { nim, nama, prodi, angkatan } = req.body;

    // Cek duplikasi NIM
    if (mahasiswa.some((x) => x.nim === nim)) {
        // Jika NIM sudah terdaftar, kirim status 409 (Conflict)
        return res.status(409).json({ message: 'NIM sudah terdaftar' });
    }

    // Membuat objek data baru dengan memastikan tipe data yang benar
    const data = {
        nim: String(nim),
        nama: String(nama),
        prodi: String(prodi),
        angkatan: Number(angkatan),
    };

    // Tambahkan data baru ke array in-memory
    mahasiswa.push(data);

    // Kirim status 201 (Created) dan data yang baru dibuat
    return res.status(201).json({ message: 'Mahasiswa dibuat', data });
});

// Catatan: Tambahkan kode app.listen(PORT, ...) untuk menjalankan server
// Catatan: Asumsikan kode 'express', 'app', array 'mahasiswa', fungsi 'validateMahasiswaPayload',
// dan 'PORT' sudah didefinisikan di bagian atas file.

// --- UPDATE DATA MAHASISWA (TIDAK MENGGANTI NIM) ---
app.put('/mahasiswa/:nim', (req, res) => {
    const { nim } = req.params;

    // Cari indeks mahasiswa berdasarkan NIM
    const idx = mahasiswa.findIndex((x) => x.nim === nim);

    // Jika tidak ditemukan, kirim status 404
    if (idx === -1) {
        return res.status(404).json({ message: 'Mahasiswa tidak ditemukan' });
    }

    // Validasi parsial: boleh kirim salah satu field
    // Gunakan allowPartial: true
    const err = validateMahasiswaPayload(req.body, { allowPartial: true });
    
    // Jika ada error validasi, kirim status 400 (Bad Request)
    if (err) {
        return res.status(400).json({ message: err });
    }

    // Destrukturisasi body request
    const { nama, prodi, angkatan } = req.body;

    // Lakukan update hanya pada field yang dikirim (tidak undefined)
    if (nama !== undefined) mahasiswa[idx].nama = String(nama);
    if (prodi !== undefined) mahasiswa[idx].prodi = String(prodi);
    
    // Konversi 'angkatan' menjadi Number jika ada, karena mungkin dikirim sebagai string
    if (angkatan !== undefined) mahasiswa[idx].angkatan = Number(angkatan);

    // Kirim respons sukses dengan data yang telah diperbarui
    return res.json({ message: 'Mahasiswa diupdate', data: mahasiswa[idx] });
});

// --- HAPUS MAHASISWA ---
app.delete('/mahasiswa/:nim', (req, res) => {
    const { nim } = req.params;

    // Cari indeks mahasiswa berdasarkan NIM
    const idx = mahasiswa.findIndex((x) => x.nim === nim);

    // Jika tidak ditemukan, kirim status 404
    if (idx === -1) {
        return res.status(404).json({ message: 'Mahasiswa tidak ditemukan' });
    }

    // Hapus satu elemen dari array di indeks yang ditemukan
    // splice mengembalikan array, jadi ambil elemen pertama [0]
    const removed = mahasiswa.splice(idx, 1)[0];

    // Kirim respons sukses dengan NIM mahasiswa yang dihapus
    return res.json({ message: 'Mahasiswa dihapus', nim: removed.nim });
});

// --- START SERVER ---
// Mulai mendengarkan koneksi pada port yang ditentukan
app.listen(PORT, () => {
    console.log(`Client-Server listening on http://localhost:${PORT}`);
});