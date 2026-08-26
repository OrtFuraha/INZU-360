require('dotenv').config();
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const path = require('path');
const { connectDB } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3601;

// Trust proxy for Render
app.set('trust proxy', 1);

// Connect to SQLite
connectDB();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/main');
app.use(expressLayouts);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration for Render
app.use(session({
  secret: process.env.SESSION_SECRET || 'inzu360-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// Flash messages
app.use(flash());

// Global variables
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.session.user || null;
  res.locals.currentUrl = req.url;
  next();
});

// Routes
app.use('/', require('./routes/index'));
app.use('/properties', require('./routes/properties'));
app.use('/auth', require('./routes/auth'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/search', require('./routes/search'));
app.use('/virtual-tour', require('./routes/virtualTour'));
app.use('/corporate', require('./routes/corporate'));
app.use('/design-construction', require('./routes/designConstruction'));
app.use('/facility-management', require('./routes/facilityManagement'));
app.use('/property-marketing', require('./routes/propertyMarketing'));
app.use('/agents', require('./routes/agents'));
app.use('/developers', require('./routes/developers'));
app.use('/pricing', require('./routes/pricing'));
app.use('/blog', require('./routes/blog'));
app.use('/admin', require('./routes/admin'));

// 404 handler
app.use((req, res) => {
  res.status(404).render('pages/404', { title: 'Page Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).render('pages/500', { title: 'Server Error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 INZU360 Premium running on http://localhost:${PORT}`);
  console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🎨 Brand: Luxury - Charcoal Black | Copper Bronze | Emerald Green`);
});
