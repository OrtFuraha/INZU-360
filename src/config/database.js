const sqlite3 = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../inzu360.db');
let db;

function connectDB() {
  try {
    db = new sqlite3(DB_PATH);
    console.log('✅ Connected to SQLite database');
    createTables();
    seedData();
    createAdminUser();
    return db;
  } catch (err) {
    console.error('❌ Database connection error:', err.message);
    process.exit(1);
  }
}

function createTables() {
  try {
    // Users table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        role TEXT DEFAULT 'customer',
        is_verified BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Properties table
    db.exec(`
      CREATE TABLE IF NOT EXISTS properties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        currency TEXT DEFAULT 'RWF',
        property_type TEXT NOT NULL,
        transaction_type TEXT DEFAULT 'sale',
        status TEXT DEFAULT 'active',
        bedrooms INTEGER DEFAULT 0,
        bathrooms INTEGER DEFAULT 0,
        area REAL,
        address TEXT,
        city TEXT,
        district TEXT,
        country TEXT DEFAULT 'Rwanda',
        latitude REAL,
        longitude REAL,
        is_featured BOOLEAN DEFAULT 0,
        is_verified BOOLEAN DEFAULT 0,
        has_virtual_tour BOOLEAN DEFAULT 0,
        views INTEGER DEFAULT 0,
        year_built INTEGER,
        furnished BOOLEAN DEFAULT 0,
        parking BOOLEAN DEFAULT 0,
        security BOOLEAN DEFAULT 0,
        owner_id INTEGER,
        agent_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES users (id),
        FOREIGN KEY (agent_id) REFERENCES users (id)
      )
    `);

    // Property images
    db.exec(`
      CREATE TABLE IF NOT EXISTS property_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        property_id INTEGER NOT NULL,
        url TEXT NOT NULL,
        room_type TEXT,
        room_name TEXT,
        is_primary BOOLEAN DEFAULT 0,
        type TEXT DEFAULT 'image',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE
      )
    `);

    // Virtual tours
    db.exec(`
      CREATE TABLE IF NOT EXISTS virtual_tours (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        property_id INTEGER NOT NULL,
        model_url TEXT,
        thumbnail_url TEXT,
        matterport_id TEXT,
        status TEXT DEFAULT 'processing',
        views INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE
      )
    `);

    // Floor plans
    db.exec(`
      CREATE TABLE IF NOT EXISTS floor_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        property_id INTEGER NOT NULL,
        url TEXT NOT NULL,
        floor TEXT,
        area REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE
      )
    `);

    // Amenities
    db.exec(`
      CREATE TABLE IF NOT EXISTS amenities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        icon TEXT,
        category TEXT
      )
    `);

    // Property amenities
    db.exec(`
      CREATE TABLE IF NOT EXISTS property_amenities (
        property_id INTEGER NOT NULL,
        amenity_id INTEGER NOT NULL,
        PRIMARY KEY (property_id, amenity_id),
        FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE,
        FOREIGN KEY (amenity_id) REFERENCES amenities (id) ON DELETE CASCADE
      )
    `);

    // Bookings
    db.exec(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        property_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        booking_type TEXT NOT NULL,
        date DATE NOT NULL,
        time TIME NOT NULL,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (property_id) REFERENCES properties (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    // Favorites
    db.exec(`
      CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        property_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, property_id),
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE
      )
    `);

    // Messages
    db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        property_id INTEGER,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users (id),
        FOREIGN KEY (receiver_id) REFERENCES users (id),
        FOREIGN KEY (property_id) REFERENCES properties (id)
      )
    `);

    // Testimonials
    db.exec(`
      CREATE TABLE IF NOT EXISTS testimonials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        rating INTEGER DEFAULT 5,
        is_approved BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    // Subscribers
    db.exec(`
      CREATE TABLE IF NOT EXISTS subscribers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Property reviews
    db.exec(`
      CREATE TABLE IF NOT EXISTS property_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        property_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        rating INTEGER CHECK(rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (property_id) REFERENCES properties (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    // Audit logs
    db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        details TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    console.log('✅ Database tables created/verified');
  } catch (err) {
    console.error('❌ Error creating tables:', err.message);
  }
}

function seedData() {
  try {
    const amenities = [
      'Swimming Pool', 'Gym', 'Parking', 'Security', 'Garden', 
      'Balcony', 'Elevator', 'Air Conditioning', 'Furnished', 
      'Solar Panels', 'Backup Generator', 'Water Tank', 'Playground'
    ];

    amenities.forEach(amenity => {
      db.prepare('INSERT OR IGNORE INTO amenities (name) VALUES (?)').run(amenity);
    });

    console.log('✅ Seed data inserted');
  } catch (err) {
    console.error('❌ Error seeding data:', err.message);
  }
}

function createAdminUser() {
  try {
    // Check if admin exists
    const admin = db.prepare("SELECT * FROM users WHERE email = 'admin@inzu360.com'").get();
    
    if (!admin) {
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      db.prepare(`
        INSERT INTO users (name, email, password, role, is_verified)
        VALUES (?, ?, ?, ?, ?)
      `).run('Admin', 'admin@inzu360.com', hashedPassword, 'admin', 1);
      console.log('✅ Admin user created successfully!');
      console.log('📧 Email: admin@inzu360.com');
      console.log('🔑 Password: admin123');
    } else {
      // Ensure admin is verified and has correct role
      db.prepare("UPDATE users SET role = 'admin', is_verified = 1 WHERE email = 'admin@inzu360.com'").run();
    }
  } catch (err) {
    console.error('❌ Error creating admin user:', err.message);
  }
}

function getDB() {
  return db;
}

module.exports = { connectDB, getDB };
