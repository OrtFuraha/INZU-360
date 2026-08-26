const express = require('express');
const router = express.Router();
const { getDB } = require('../config/database');

router.get('/', (req, res) => {
  const db = getDB();
  
  try {
    const featuredProperties = db.prepare(`
      SELECT p.*, 
             (SELECT url FROM property_images WHERE property_id = p.id AND is_primary = 1 LIMIT 1) as image
      FROM properties p 
      WHERE p.is_featured = 1 AND p.status = 'active'
      ORDER BY p.created_at DESC LIMIT 6
    `).all();

    const propertiesCount = db.prepare("SELECT COUNT(*) as count FROM properties WHERE status = 'active'").get();
    const agentsCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'agent' AND is_verified = 1").get();
    const usersCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'customer'").get();

    const testimonials = db.prepare(`
      SELECT * FROM testimonials WHERE is_approved = 1 ORDER BY created_at DESC LIMIT 3
    `).all();

    res.render('pages/index', {
      title: 'INZU360 - Experience Properties Before You Visit',
      featuredProperties: featuredProperties || [],
      stats: { properties: propertiesCount || { count: 0 }, agents: agentsCount || { count: 0 }, users: usersCount || { count: 0 } },
      testimonials: testimonials || []
    });
  } catch (err) {
    console.error('Error loading homepage:', err.message);
    res.render('pages/index', {
      title: 'INZU360 - Experience Properties Before You Visit',
      featuredProperties: [],
      stats: { properties: { count: 0 }, agents: { count: 0 }, users: { count: 0 } },
      testimonials: []
    });
  }
});

router.get('/about', (req, res) => {
  res.render('pages/about', { title: 'About INZU360' });
});

router.get('/contact', (req, res) => {
  res.render('pages/contact', { title: 'Contact Us' });
});

router.post('/subscribe', (req, res) => {
  const { email } = req.body;
  const db = getDB();
  
  try {
    db.prepare('INSERT INTO subscribers (email) VALUES (?)').run(email);
    req.flash('success_msg', 'Successfully subscribed to our newsletter!');
  } catch (err) {
    req.flash('error_msg', 'Email already subscribed or invalid.');
  }
  
  res.redirect('/');
});

module.exports = router;
