const express = require('express');
const router = express.Router();
const { getDB } = require('../config/database');

function isAuthenticated(req, res, next) {
  if (req.session.user) return next();
  req.flash('error_msg', 'Please login to access the dashboard');
  res.redirect('/auth/login');
}

router.get('/', isAuthenticated, (req, res) => {
  const db = getDB();
  const userId = req.session.user.id;
  
  const favorites = db.prepare(`SELECT COUNT(*) as count FROM favorites WHERE user_id = ?`).get(userId);
  const bookings = db.prepare(`SELECT b.*, p.title as property_title FROM bookings b JOIN properties p ON b.property_id = p.id WHERE b.user_id = ? ORDER BY b.created_at DESC LIMIT 5`).all(userId);
  
  res.render('pages/dashboard/index', {
    title: 'Dashboard',
    user: req.session.user,
    favoritesCount: favorites?.count || 0,
    bookings: bookings || []
  });
});

router.get('/saved', isAuthenticated, (req, res) => {
  const db = getDB();
  const userId = req.session.user.id;
  
  const properties = db.prepare(`
    SELECT p.*, (SELECT url FROM property_images WHERE property_id = p.id AND is_primary = 1 LIMIT 1) as image
    FROM favorites f JOIN properties p ON f.property_id = p.id WHERE f.user_id = ?
  `).all(userId);
  
  res.render('pages/dashboard/saved', { title: 'Saved Properties', properties: properties || [] });
});

router.get('/bookings', isAuthenticated, (req, res) => {
  const db = getDB();
  const userId = req.session.user.id;
  
  const bookings = db.prepare(`
    SELECT b.*, p.title as property_title, (SELECT url FROM property_images WHERE property_id = p.id AND is_primary = 1 LIMIT 1) as image
    FROM bookings b JOIN properties p ON b.property_id = p.id WHERE b.user_id = ? ORDER BY b.date DESC
  `).all(userId);
  
  res.render('pages/dashboard/bookings', { title: 'My Bookings', bookings: bookings || [] });
});

router.get('/profile', isAuthenticated, (req, res) => {
  const db = getDB();
  const userId = req.session.user.id;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  res.render('pages/dashboard/profile', { title: 'My Profile', user: user || req.session.user });
});

router.post('/profile', isAuthenticated, (req, res) => {
  const db = getDB();
  const userId = req.session.user.id;
  const { name, phone } = req.body;
  
  db.prepare(`UPDATE users SET name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(name, phone, userId);
  req.session.user.name = name;
  req.flash('success_msg', 'Profile updated successfully!');
  res.redirect('/dashboard/profile');
});

module.exports = router;
