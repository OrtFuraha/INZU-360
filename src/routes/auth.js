const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDB } = require('../config/database');
const { body, validationResult } = require('express-validator');

// Login page
router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  res.render('pages/auth/login', { title: 'Login', formData: {} });
});

// Register page
router.get('/register', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  res.render('pages/auth/register', { title: 'Register', formData: {} });
});

// Register POST
router.post('/register', [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match');
    }
    return true;
  })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('pages/auth/register', {
      title: 'Register',
      errors: errors.array(),
      formData: req.body
    });
  }

  const { name, email, password, phone, role } = req.body;
  const db = getDB();

  // Check if user exists
  const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (existingUser) {
    req.flash('error_msg', 'Email already registered');
    return res.redirect('/auth/register');
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user
  try {
    db.prepare(`
      INSERT INTO users (name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)
    `).run(name, email, hashedPassword, phone || null, role || 'customer');

    req.flash('success_msg', 'Registration successful! Please login.');
    res.redirect('/auth/login');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Registration failed');
    res.redirect('/auth/register');
  }
});

// Login POST
router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('pages/auth/login', {
      title: 'Login',
      errors: errors.array(),
      formData: req.body
    });
  }

  const { email, password } = req.body;
  const db = getDB();

  console.log('🔍 Login attempt for:', email);

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    console.log('❌ User not found:', email);
    req.flash('error_msg', 'Invalid email or password');
    return res.redirect('/auth/login');
  }

  console.log('✅ User found:', user.email, 'Role:', user.role);

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    console.log('❌ Password mismatch for:', email);
    req.flash('error_msg', 'Invalid email or password');
    return res.redirect('/auth/login');
  }

  console.log('✅ Password matched for:', email);

  // Store user in session
  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    is_verified: user.is_verified
  };

  console.log('✅ Session created for:', user.name, 'Role:', user.role);

  req.flash('success_msg', 'Welcome back!');
  
  // Redirect to admin if admin, otherwise dashboard
  if (user.role === 'admin') {
    return res.redirect('/admin');
  }
  res.redirect('/dashboard');
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
    }
    res.redirect('/');
  });
});

module.exports = router;
