// notification-service.js (FINAL MS7)

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ====== In-Memory Storage ======
// Array untuk menyimpan notifikasi
let notifications = [];

// ====== Health Check ======
app.get('/', (_req, res) => res.send('Notification Service OK'));

// ====== GET /notifications ======
// Mengambil semua notifikasi
app.get('/notifications', (_req, res) => {
  res.json({ data: notifications, total: notifications.length });
});

// ====== GET /notifications/my ======
// Mengambil notifikasi berdasarkan user (yang diteruskan dari API Gateway)
app.get('/notifications/my', (req, res) => {
  // Ambil user dari header 'x-user-username' atau 'x-user-id'
  const user = req.headers['x-user-username'] || req.headers['x-user-id'] || 'unknown';
  
  // Filter notifikasi milik user
  const myNotif = notifications.filter(n => n.to === user);
  
  res.json({ data: myNotif, total: myNotif.length });
});

// ====== POST /notify ======
// Membuat notifikasi baru
app.post('/notify', (req, res) => {
  // Destructuring body, menyediakan fallback objek kosong
  const { to, type, title, message, payload } = req.body || {};

  // Validasi sederhana
  if (!to || !type) {
    return res.status(400).json({ message: 'to & type wajib' });
  }

  // Membuat objek notifikasi
  const notif = {
    id: notifications.length + 1, // ID sederhana
    to: to,
    type: type,
    // Nilai default jika properti opsional tidak ada
    title: title || 'New Notification',
    message: message || '',
    payload: payload || {},
    ts: new Date().toISOString(),
  };

  // Menyimpan dan logging
  notifications.push(notif);
  console.log(`[NOTIF] + ${to}: ${notif.title}`);
  
  // 201 Created
  res.status(201).json({ message: 'Notification created', notification: notif });
});

// ====== Start ======
// Menggunakan PORT dari .env atau default 5003
const PORT = process.env.PORT || 5003;
app.listen(PORT, () => console.log(`✅ Notification Service Jalan di http://localhost:${PORT}`));
