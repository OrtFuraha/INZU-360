const express = require('express');
const router = express.Router();
const { getDB } = require('../config/database');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for image uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../public/uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'property-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only images are allowed'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Admin middleware
function isAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    req.flash('error_msg', 'Access denied. Admin only.');
    res.redirect('/auth/login');
}

// Admin dashboard
router.get('/', isAdmin, (req, res) => {
    const db = getDB();
    
    const stats = {
        users: db.prepare("SELECT COUNT(*) as count FROM users").get(),
        properties: db.prepare("SELECT COUNT(*) as count FROM properties").get(),
        agents: db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'agent'").get(),
        bookings: db.prepare("SELECT COUNT(*) as count FROM bookings").get(),
        messages: db.prepare("SELECT COUNT(*) as count FROM messages").get(),
        subscribers: db.prepare("SELECT COUNT(*) as count FROM subscribers").get()
    };
    
    const recentUsers = db.prepare("SELECT * FROM users ORDER BY created_at DESC LIMIT 5").all();
    const recentProperties = db.prepare(`
        SELECT p.*, u.name as owner_name 
        FROM properties p 
        LEFT JOIN users u ON p.owner_id = u.id 
        ORDER BY p.created_at DESC LIMIT 5
    `).all();
    
    res.render('pages/admin/index', {
        title: 'Dashboard',
        user: req.session.user,
        stats,
        recentUsers,
        recentProperties,
        layout: 'layouts/admin'
    });
});

// Users management
router.get('/users', isAdmin, (req, res) => {
    const db = getDB();
    const { role } = req.query;
    let sql = "SELECT * FROM users";
    let params = [];
    
    if (role) {
        sql += " WHERE role = ?";
        params.push(role);
    }
    sql += " ORDER BY created_at DESC";
    
    const users = db.prepare(sql).all(params);
    res.render('pages/admin/users', { title: 'Manage Users', user: req.session.user, users, layout: 'layouts/admin' });
});

router.post('/users/:id/role', isAdmin, (req, res) => {
    const db = getDB();
    const { role } = req.body;
    db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, req.params.id);
    req.flash('success_msg', 'User role updated successfully');
    res.redirect('/admin/users');
});

router.post('/users/:id/verify', isAdmin, (req, res) => {
    const db = getDB();
    db.prepare("UPDATE users SET is_verified = 1 WHERE id = ?").run(req.params.id);
    req.flash('success_msg', 'User verified successfully');
    res.redirect('/admin/users');
});

router.post('/users/:id/delete', isAdmin, (req, res) => {
    const db = getDB();
    db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
    req.flash('success_msg', 'User deleted successfully');
    res.redirect('/admin/users');
});

// Properties management
router.get('/properties', isAdmin, (req, res) => {
    const db = getDB();
    const { status, featured } = req.query;
    let sql = `
        SELECT p.*, u.name as owner_name,
               (SELECT url FROM property_images WHERE property_id = p.id AND is_primary = 1 LIMIT 1) as image
        FROM properties p 
        LEFT JOIN users u ON p.owner_id = u.id 
        WHERE 1=1
    `;
    let params = [];
    
    if (status) {
        sql += " AND p.status = ?";
        params.push(status);
    }
    if (featured !== undefined) {
        sql += " AND p.is_featured = ?";
        params.push(parseInt(featured));
    }
    sql += " ORDER BY p.created_at DESC";
    
    const properties = db.prepare(sql).all(params);
    res.render('pages/admin/properties', { title: 'Manage Properties', user: req.session.user, properties, layout: 'layouts/admin' });
});

// Add Property - GET
router.get('/add-property', isAdmin, (req, res) => {
    res.render('pages/admin/add-property', { title: 'Add Property', user: req.session.user, layout: 'layouts/admin' });
});

// Create Property with image upload
router.post('/properties/create', isAdmin, upload.array('images', 10), (req, res) => {
    const db = getDB();
    
    console.log('📝 Form data received:', req.body);
    console.log('📸 Files uploaded:', req.files ? req.files.length : 0);
    
    // Get all form fields
    const title = req.body.title ? req.body.title.trim() : '';
    const price = req.body.price || 0;
    const currency = req.body.currency || 'RWF';
    const property_type = req.body.property_type || 'house';
    const transaction_type = req.body.transaction_type || 'sale';
    const bedrooms = parseInt(req.body.bedrooms) || 0;
    const bathrooms = parseInt(req.body.bathrooms) || 0;
    const area = parseFloat(req.body.area) || 0;
    const address = req.body.address || '';
    const city = req.body.city || '';
    const district = req.body.district || '';
    const description = req.body.description || '';
    const furnished = parseInt(req.body.furnished) || 0;
    const parking = parseInt(req.body.parking) || 0;
    const security = parseInt(req.body.security) || 0;
    const is_featured = parseInt(req.body.is_featured) || 0;
    const status = req.body.status || 'active';
    
    // Validate required fields
    if (!title || title === '') {
        req.flash('error_msg', 'Title is required');
        return res.redirect('/admin/add-property');
    }
    
    if (!price || isNaN(price) || parseFloat(price) <= 0) {
        req.flash('error_msg', 'Valid Price is required');
        return res.redirect('/admin/add-property');
    }
    
    try {
        // Insert property
        const result = db.prepare(`
            INSERT INTO properties (
                title, description, price, currency, property_type, transaction_type,
                bedrooms, bathrooms, area, address, city, district,
                furnished, parking, security, is_featured, status, is_verified, owner_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            title, description, parseFloat(price), currency,
            property_type, transaction_type,
            bedrooms, bathrooms, area,
            address, city, district,
            furnished, parking, security,
            is_featured, status, 1, req.session.user.id
        );
        
        const propertyId = result.lastInsertRowid;
        console.log('✅ Property created with ID:', propertyId);
        
        // Handle uploaded images
        if (req.files && req.files.length > 0) {
            console.log(`📸 Processing ${req.files.length} uploaded images`);
            req.files.forEach((file, index) => {
                const imageUrl = '/uploads/' + file.filename;
                db.prepare(`
                    INSERT INTO property_images (property_id, url, is_primary)
                    VALUES (?, ?, ?)
                `).run(propertyId, imageUrl, index === 0 ? 1 : 0);
                console.log(`   ✅ Image ${index + 1}: ${file.filename}`);
            });
        } else {
            // Add default placeholder images if no images uploaded
            console.log('📸 No images uploaded, using default placeholders');
            const placeholderImages = [
                'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
                'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80',
                'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80'
            ];
            
            placeholderImages.forEach((url, index) => {
                db.prepare(`
                    INSERT INTO property_images (property_id, url, is_primary)
                    VALUES (?, ?, ?)
                `).run(propertyId, url, index === 0 ? 1 : 0);
            });
        }
        
        req.flash('success_msg', `Property added successfully with ${req.files ? req.files.length : 0} images!`);
        res.redirect('/admin/properties');
    } catch (err) {
        console.error('❌ Error creating property:', err);
        req.flash('error_msg', 'Error creating property: ' + err.message);
        res.redirect('/admin/add-property');
    }
});

// Edit Property - GET
router.get('/properties/:id/edit', isAdmin, (req, res) => {
    const db = getDB();
    const property = db.prepare(`
        SELECT p.*, 
               (SELECT url FROM property_images WHERE property_id = p.id AND is_primary = 1 LIMIT 1) as image
        FROM properties p WHERE p.id = ?
    `).get(req.params.id);
    
    if (!property) {
        req.flash('error_msg', 'Property not found');
        return res.redirect('/admin/properties');
    }
    res.render('pages/admin/edit-property', { title: 'Edit Property', user: req.session.user, property, layout: 'layouts/admin' });
});

// Update Property
router.post('/properties/:id/update', isAdmin, upload.array('images', 10), (req, res) => {
    const db = getDB();
    
    const title = req.body.title ? req.body.title.trim() : '';
    const price = req.body.price || 0;
    const currency = req.body.currency || 'RWF';
    const property_type = req.body.property_type || 'house';
    const transaction_type = req.body.transaction_type || 'sale';
    const bedrooms = parseInt(req.body.bedrooms) || 0;
    const bathrooms = parseInt(req.body.bathrooms) || 0;
    const area = parseFloat(req.body.area) || 0;
    const address = req.body.address || '';
    const city = req.body.city || '';
    const district = req.body.district || '';
    const description = req.body.description || '';
    const furnished = parseInt(req.body.furnished) || 0;
    const parking = parseInt(req.body.parking) || 0;
    const security = parseInt(req.body.security) || 0;
    const is_featured = parseInt(req.body.is_featured) || 0;
    const status = req.body.status || 'active';
    
    if (!title || title === '') {
        req.flash('error_msg', 'Title is required');
        return res.redirect(`/admin/properties/${req.params.id}/edit`);
    }
    
    try {
        db.prepare(`
            UPDATE properties SET
                title = ?, description = ?, price = ?, currency = ?, 
                property_type = ?, transaction_type = ?,
                bedrooms = ?, bathrooms = ?, area = ?, 
                address = ?, city = ?, district = ?,
                furnished = ?, parking = ?, security = ?, is_featured = ?, status = ?
            WHERE id = ?
        `).run(
            title, description, parseFloat(price), currency,
            property_type, transaction_type,
            bedrooms, bathrooms, area,
            address, city, district,
            furnished, parking, security,
            is_featured, status, req.params.id
        );
        
        // Handle new images
        if (req.files && req.files.length > 0) {
            // Get current primary image status
            const currentImages = db.prepare(`
                SELECT id, is_primary FROM property_images WHERE property_id = ?
            `).all(req.params.id);
            
            const hasPrimary = currentImages.some(img => img.is_primary === 1);
            
            req.files.forEach((file, index) => {
                const imageUrl = '/uploads/' + file.filename;
                const isPrimary = (!hasPrimary && index === 0) ? 1 : 0;
                db.prepare(`
                    INSERT INTO property_images (property_id, url, is_primary)
                    VALUES (?, ?, ?)
                `).run(req.params.id, imageUrl, isPrimary);
            });
        }
        
        req.flash('success_msg', 'Property updated successfully!');
        res.redirect('/admin/properties');
    } catch (err) {
        console.error('Error updating property:', err);
        req.flash('error_msg', 'Error updating property: ' + err.message);
        res.redirect(`/admin/properties/${req.params.id}/edit`);
    }
});

// Feature Property
router.post('/properties/:id/feature', isAdmin, (req, res) => {
    const db = getDB();
    const { featured } = req.body;
    db.prepare("UPDATE properties SET is_featured = ? WHERE id = ?").run(featured, req.params.id);
    req.flash('success_msg', 'Property featured status updated');
    res.redirect('/admin/properties');
});

// Verify Property
router.post('/properties/:id/verify', isAdmin, (req, res) => {
    const db = getDB();
    db.prepare("UPDATE properties SET is_verified = 1, status = 'active' WHERE id = ?").run(req.params.id);
    req.flash('success_msg', 'Property verified successfully');
    res.redirect('/admin/properties');
});

// Update Property Status
router.post('/properties/:id/status', isAdmin, (req, res) => {
    const db = getDB();
    const { status } = req.body;
    db.prepare("UPDATE properties SET status = ? WHERE id = ?").run(status, req.params.id);
    req.flash('success_msg', 'Property status updated');
    res.redirect('/admin/properties');
});

// Delete Property
router.post('/properties/:id/delete', isAdmin, (req, res) => {
    const db = getDB();
    try {
        db.prepare("DELETE FROM property_images WHERE property_id = ?").run(req.params.id);
        db.prepare("DELETE FROM virtual_tours WHERE property_id = ?").run(req.params.id);
        db.prepare("DELETE FROM properties WHERE id = ?").run(req.params.id);
        req.flash('success_msg', 'Property deleted successfully!');
    } catch (err) {
        console.error('Error deleting property:', err);
        req.flash('error_msg', 'Error deleting property');
    }
    res.redirect('/admin/properties');
});

// Delete Property Image
router.post('/properties/:id/images/:imageId/delete', isAdmin, (req, res) => {
    const db = getDB();
    const { id, imageId } = req.params;
    
    // Check if the image is primary
    const image = db.prepare("SELECT is_primary FROM property_images WHERE id = ? AND property_id = ?").get(imageId, id);
    if (image && image.is_primary === 1) {
        req.flash('error_msg', 'Cannot delete the primary image. Set another image as primary first.');
        return res.redirect(`/admin/properties/${id}/edit`);
    }
    
    db.prepare("DELETE FROM property_images WHERE id = ? AND property_id = ?").run(imageId, id);
    req.flash('success_msg', 'Image deleted successfully');
    res.redirect(`/admin/properties/${id}/edit`);
});

// Set Primary Image
router.post('/properties/:id/images/:imageId/primary', isAdmin, (req, res) => {
    const db = getDB();
    const { id, imageId } = req.params;
    
    // Remove primary from all images of this property
    db.prepare("UPDATE property_images SET is_primary = 0 WHERE property_id = ?").run(id);
    // Set this image as primary
    db.prepare("UPDATE property_images SET is_primary = 1 WHERE id = ? AND property_id = ?").run(imageId, id);
    
    req.flash('success_msg', 'Primary image updated successfully');
    res.redirect(`/admin/properties/${id}/edit`);
});

// Auto-update featured properties
router.post('/properties/update-featured', isAdmin, (req, res) => {
    const db = getDB();
    try {
        db.prepare("UPDATE properties SET is_featured = 0").run();
        const featuredIds = db.prepare(`
            SELECT id FROM properties WHERE status = 'active' ORDER BY RANDOM() LIMIT 6
        `).all();
        featuredIds.forEach(p => {
            db.prepare("UPDATE properties SET is_featured = 1 WHERE id = ?").run(p.id);
        });
        req.flash('success_msg', 'Featured properties updated successfully!');
    } catch (err) {
        req.flash('error_msg', 'Error updating featured properties');
    }
    res.redirect('/admin/properties');
});

// Bookings
router.get('/bookings', isAdmin, (req, res) => {
    const db = getDB();
    const bookings = db.prepare(`
        SELECT b.*, p.title as property_title, u.name as user_name
        FROM bookings b
        JOIN properties p ON b.property_id = p.id
        JOIN users u ON b.user_id = u.id
        ORDER BY b.created_at DESC
    `).all();
    res.render('pages/admin/bookings', { title: 'Bookings', user: req.session.user, bookings, layout: 'layouts/admin' });
});

router.post('/bookings/:id/status', isAdmin, (req, res) => {
    const db = getDB();
    const { status } = req.body;
    db.prepare("UPDATE bookings SET status = ? WHERE id = ?").run(status, req.params.id);
    req.flash('success_msg', 'Booking status updated');
    res.redirect('/admin/bookings');
});

// Messages
router.get('/messages', isAdmin, (req, res) => {
    const db = getDB();
    const messages = db.prepare(`
        SELECT m.*, u1.name as sender_name, u2.name as receiver_name
        FROM messages m
        LEFT JOIN users u1 ON m.sender_id = u1.id
        LEFT JOIN users u2 ON m.receiver_id = u2.id
        ORDER BY m.created_at DESC
    `).all();
    res.render('pages/admin/messages', { title: 'Messages', user: req.session.user, messages, layout: 'layouts/admin' });
});

// Reviews
router.get('/reviews', isAdmin, (req, res) => {
    const db = getDB();
    try {
        const reviews = db.prepare(`
            SELECT pr.*, p.title as property_title, u.name as user_name
            FROM property_reviews pr
            JOIN properties p ON pr.property_id = p.id
            JOIN users u ON pr.user_id = u.id
            ORDER BY pr.created_at DESC
        `).all();
        res.render('pages/admin/reviews', { title: 'Reviews', user: req.session.user, reviews, layout: 'layouts/admin' });
    } catch (err) {
        res.render('pages/admin/reviews', { title: 'Reviews', user: req.session.user, reviews: [], layout: 'layouts/admin' });
    }
});

router.post('/reviews/:id/delete', isAdmin, (req, res) => {
    const db = getDB();
    db.prepare("DELETE FROM property_reviews WHERE id = ?").run(req.params.id);
    req.flash('success_msg', 'Review deleted');
    res.redirect('/admin/reviews');
});

// Analytics
router.get('/analytics', isAdmin, (req, res) => {
    const db = getDB();
    
    const analytics = {
        totalUsers: db.prepare("SELECT COUNT(*) as count FROM users").get(),
        totalProperties: db.prepare("SELECT COUNT(*) as count FROM properties").get(),
        totalBookings: db.prepare("SELECT COUNT(*) as count FROM bookings").get(),
        totalViews: db.prepare("SELECT SUM(views) as total FROM properties").get(),
        propertiesByType: db.prepare("SELECT property_type, COUNT(*) as count FROM properties GROUP BY property_type").all(),
        recentActivity: db.prepare(`
            SELECT 'user' as type, name as title, created_at FROM users 
            UNION ALL 
            SELECT 'property' as type, title, created_at FROM properties 
            ORDER BY created_at DESC LIMIT 10
        `).all()
    };
    
    res.render('pages/admin/analytics', { title: 'Analytics', user: req.session.user, analytics, layout: 'layouts/admin' });
});

// Virtual Tours
router.get('/virtual-tours', isAdmin, (req, res) => {
    const db = getDB();
    const tours = db.prepare(`
        SELECT vt.*, p.title as property_title 
        FROM virtual_tours vt 
        JOIN properties p ON vt.property_id = p.id 
        ORDER BY vt.created_at DESC
    `).all();
    res.render('pages/admin/virtual-tours', { title: 'Virtual Tours', user: req.session.user, tours, layout: 'layouts/admin' });
});

// Agents
router.get('/agents', isAdmin, (req, res) => {
    const db = getDB();
    const agents = db.prepare("SELECT * FROM users WHERE role = 'agent' ORDER BY created_at DESC").all();
    res.render('pages/admin/agents', { title: 'Agents', user: req.session.user, agents, layout: 'layouts/admin' });
});

router.post('/agents/:id/verify', isAdmin, (req, res) => {
    const db = getDB();
    db.prepare("UPDATE users SET is_verified = 1 WHERE id = ?").run(req.params.id);
    req.flash('success_msg', 'Agent verified successfully');
    res.redirect('/admin/agents');
});

// 3D Digital Twins sub-routes
router.get('/360-images', isAdmin, (req, res) => {
    res.render('pages/admin/360-images', { title: '360 Images', user: req.session.user, layout: 'layouts/admin' });
});

router.get('/3d-models', isAdmin, (req, res) => {
    res.render('pages/admin/3d-models', { title: '3D Models', user: req.session.user, layout: 'layouts/admin' });
});

router.get('/floor-plans', isAdmin, (req, res) => {
    res.render('pages/admin/floor-plans', { title: 'Floor Plans', user: req.session.user, layout: 'layouts/admin' });
});

router.get('/processing-queue', isAdmin, (req, res) => {
    res.render('pages/admin/processing-queue', { title: 'Processing Queue', user: req.session.user, layout: 'layouts/admin' });
});

// Marketplace sub-routes
router.get('/marketplace/:type', isAdmin, (req, res) => {
    const db = getDB();
    const { type } = req.params;
    const properties = db.prepare(`
        SELECT * FROM properties WHERE transaction_type = ? AND status = 'active'
    `).all(type);
    res.render('pages/admin/marketplace', { title: type.charAt(0).toUpperCase() + type.slice(1), user: req.session.user, properties, type, layout: 'layouts/admin' });
});

// Locations sub-routes
router.get('/locations/:type', isAdmin, (req, res) => {
    res.render('pages/admin/locations', { title: 'Locations', user: req.session.user, layout: 'layouts/admin' });
});

// Agent verification and performance
router.get('/agents/verification', isAdmin, (req, res) => {
    const db = getDB();
    const agents = db.prepare("SELECT * FROM users WHERE role = 'agent' AND is_verified = 0").all();
    res.render('pages/admin/agent-verification', { title: 'Agent Verification', user: req.session.user, agents, layout: 'layouts/admin' });
});

router.get('/agents/performance', isAdmin, (req, res) => {
    const db = getDB();
    const agents = db.prepare(`
        SELECT u.*, COUNT(p.id) as property_count 
        FROM users u 
        LEFT JOIN properties p ON u.id = p.agent_id 
        WHERE u.role = 'agent' 
        GROUP BY u.id 
        ORDER BY property_count DESC
    `).all();
    res.render('pages/admin/agent-performance', { title: 'Agent Performance', user: req.session.user, agents, layout: 'layouts/admin' });
});


// Dedicated Settings page
router.get('/settings', isAdmin, (req, res) => {
    res.render('pages/admin/settings', {
        user: req.session.user,
        title: 'Settings',
        activePage: 'settings'
    });
});



// ============================================================
// PREMIUM ADMIN SECTIONS
// ============================================================

// 3D Digital Twins
router.get('/3d-twins', isAdmin, (req, res) => {
    const db = getDB();
    try {
        const tours = db.prepare('SELECT * FROM virtual_tours ORDER BY id DESC').all();
        const scenes = db.prepare('SELECT * FROM tour_scenes ORDER BY id DESC').all();
        const hotspots = db.prepare('SELECT * FROM tour_hotspots ORDER BY id DESC').all();
        const views = db.prepare('SELECT * FROM tour_views ORDER BY id DESC').all();

        res.render('pages/admin/premium-section', {
            user: req.session.user,
            title: '3D Digital Twins',
            activePage: '3d-twins',
            subtitle: 'Manage immersive property tours and digital twin experiences.',
            stats: [
                { label: 'Virtual Tours', value: tours.length },
                { label: 'Scenes', value: scenes.length },
                { label: 'Hotspots', value: hotspots.length },
                { label: 'Tour Views', value: views.length }
            ],
            columns: ['ID', 'Tour', 'Status', 'Created'],
            rows: tours.map(t => [
                t.id,
                t.title || t.name || 'Virtual Tour',
                t.status || 'Active',
                t.created_at || '—'
            ]),
            info: 'Digital twin infrastructure is connected to the existing virtual tour database.',
            actions: []
        });
    } catch (error) {
        console.error('3D Digital Twins error:', error);
        res.status(500).send('Unable to load 3D Digital Twins: ' + error.message);
    }
});

// Locations
router.get('/locations', isAdmin, (req, res) => {
    const db = getDB();
    try {
        const locations = db.prepare(`
            SELECT
                city,
                district,
                COUNT(*) AS properties,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active
            FROM properties
            GROUP BY city, district
            ORDER BY properties DESC
        `).all();

        res.render('pages/admin/premium-section', {
            user: req.session.user,
            title: 'Locations',
            activePage: 'locations',
            subtitle: 'Manage property coverage by city and district.',
            stats: [
                { label: 'Cities', value: new Set(locations.map(x => x.city).filter(Boolean)).size },
                { label: 'Districts', value: new Set(locations.map(x => x.district).filter(Boolean)).size },
                { label: 'Location Groups', value: locations.length }
            ],
            columns: ['City', 'District', 'Properties', 'Active'],
            rows: locations.map(x => [
                x.city || '—',
                x.district || '—',
                x.properties,
                x.active || 0
            ]),
            info: 'Location data is generated directly from registered properties.',
            actions: []
        });
    } catch (error) {
        console.error('Locations error:', error);
        res.status(500).send('Unable to load Locations: ' + error.message);
    }
});

// Media Library
router.get('/media', isAdmin, (req, res) => {
    const db = getDB();
    try {
        const media = db.prepare(`
            SELECT
                pi.id,
                pi.property_id,
                pi.url,
                pi.is_primary,
                p.title
            FROM property_images pi
            LEFT JOIN properties p ON p.id = pi.property_id
            ORDER BY pi.id DESC
        `).all();

        res.render('pages/admin/premium-section', {
            user: req.session.user,
            title: 'Media Library',
            activePage: 'media',
            subtitle: 'Centralized property photography and media management.',
            stats: [
                { label: 'Total Media', value: media.length },
                { label: 'Primary Images', value: media.filter(x => x.is_primary).length },
                { label: 'Properties With Media', value: new Set(media.map(x => x.property_id)).size }
            ],
            columns: ['ID', 'Property', 'Media', 'Primary'],
            rows: media.map(x => [
                x.id,
                x.title || ('Property #' + x.property_id),
                x.url || '—',
                x.is_primary ? 'Yes' : 'No'
            ]),
            info: 'Images are loaded from the existing property_images table.',
            actions: []
        });
    } catch (error) {
        console.error('Media Library error:', error);
        res.status(500).send('Unable to load Media Library: ' + error.message);
    }
});

// Payments
router.get('/payments', isAdmin, (req, res) => {
    const db = getDB();
    try {
        const bookings = db.prepare(`
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled
            FROM bookings
        `).get();

        res.render('pages/admin/premium-section', {
            user: req.session.user,
            title: 'Payments',
            activePage: 'payments',
            subtitle: 'Monitor booking-related payment activity and financial readiness.',
            stats: [
                { label: 'Bookings', value: bookings.total || 0 },
                { label: 'Confirmed', value: bookings.confirmed || 0 },
                { label: 'Pending', value: bookings.pending || 0 },
                { label: 'Cancelled', value: bookings.cancelled || 0 }
            ],
            columns: ['Area', 'Status', 'Details'],
            rows: [
                ['Payment Provider', 'Not Connected', 'Connect a payment gateway before processing real transactions.'],
                ['Booking Records', 'Connected', 'Booking data is available in the database.']
            ],
            info: 'No fake transactions are displayed. Real payment processing should only be enabled after a payment provider is connected.',
            actions: []
        });
    } catch (error) {
        console.error('Payments error:', error);
        res.status(500).send('Unable to load Payments: ' + error.message);
    }
});

// Subscriptions
router.get('/subscriptions', isAdmin, (req, res) => {
    const db = getDB();
    try {
        const subscribers = db.prepare('SELECT * FROM subscribers ORDER BY id DESC').all();

        res.render('pages/admin/premium-section', {
            user: req.session.user,
            title: 'Subscriptions',
            activePage: 'subscriptions',
            subtitle: 'Manage newsletter and subscriber relationships.',
            stats: [
                { label: 'Subscribers', value: subscribers.length },
                { label: 'Active Records', value: subscribers.length }
            ],
            columns: ['ID', 'Email', 'Status', 'Created'],
            rows: subscribers.map(x => [
                x.id,
                x.email || '—',
                x.status || 'Subscribed',
                x.created_at || '—'
            ]),
            info: 'Subscriber information comes directly from the existing subscribers table.',
            actions: []
        });
    } catch (error) {
        console.error('Subscriptions error:', error);
        res.status(500).send('Unable to load Subscriptions: ' + error.message);
    }
});

// Reports
router.get('/reports', isAdmin, (req, res) => {
    const db = getDB();
    try {
        const users = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
        const properties = db.prepare('SELECT COUNT(*) AS count FROM properties').get().count;
        const bookings = db.prepare('SELECT COUNT(*) AS count FROM bookings').get().count;
        const messages = db.prepare('SELECT COUNT(*) AS count FROM messages').get().count;
        const reviews = db.prepare('SELECT COUNT(*) AS count FROM testimonials').get().count;

        res.render('pages/admin/premium-section', {
            user: req.session.user,
            title: 'Reports',
            activePage: 'reports',
            subtitle: 'High-level operational reports generated from INZU360 data.',
            stats: [
                { label: 'Users', value: users },
                { label: 'Properties', value: properties },
                { label: 'Bookings', value: bookings },
                { label: 'Messages', value: messages },
                { label: 'Reviews', value: reviews }
            ],
            columns: ['Report', 'Value', 'Source'],
            rows: [
                ['Users', users, 'users'],
                ['Properties', properties, 'properties'],
                ['Bookings', bookings, 'bookings'],
                ['Messages', messages, 'messages'],
                ['Reviews', reviews, 'testimonials']
            ],
            info: 'Reports are based on live records in the INZU360 SQLite database.',
            actions: []
        });
    } catch (error) {
        console.error('Reports error:', error);
        res.status(500).send('Unable to load Reports: ' + error.message);
    }
});

// Notifications
router.get('/notifications', isAdmin, (req, res) => {
    const db = getDB();
    try {
        const users = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
        const bookings = db.prepare('SELECT COUNT(*) AS count FROM bookings').get().count;
        const messages = db.prepare('SELECT COUNT(*) AS count FROM messages').get().count;

        res.render('pages/admin/premium-section', {
            user: req.session.user,
            title: 'Notifications',
            activePage: 'notifications',
            subtitle: 'Monitor notification-ready events across the platform.',
            stats: [
                { label: 'Users', value: users },
                { label: 'Bookings', value: bookings },
                { label: 'Messages', value: messages }
            ],
            columns: ['Event', 'Records', 'Status'],
            rows: [
                ['New Users', users, 'Ready'],
                ['Bookings', bookings, 'Ready'],
                ['Messages', messages, 'Ready']
            ],
            info: 'Notification infrastructure can be connected to email, SMS, or push providers when required.',
            actions: []
        });
    } catch (error) {
        console.error('Notifications error:', error);
        res.status(500).send('Unable to load Notifications: ' + error.message);
    }
});

// Marketing
router.get('/marketing', isAdmin, (req, res) => {
    const db = getDB();
    try {
        const subscribers = db.prepare('SELECT COUNT(*) AS count FROM subscribers').get().count;
        const properties = db.prepare('SELECT COUNT(*) AS count FROM properties').get().count;
        const featured = db.prepare("SELECT COUNT(*) AS count FROM properties WHERE is_featured = 1").get().count;
        const users = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;

        res.render('pages/admin/premium-section', {
            user: req.session.user,
            title: 'Marketing',
            activePage: 'marketing',
            subtitle: 'Manage audience growth and property promotion metrics.',
            stats: [
                { label: 'Subscribers', value: subscribers },
                { label: 'Properties', value: properties },
                { label: 'Featured', value: featured },
                { label: 'Users', value: users }
            ],
            columns: ['Marketing Area', 'Records', 'Status'],
            rows: [
                ['Subscribers', subscribers, 'Active'],
                ['Property Inventory', properties, 'Active'],
                ['Featured Properties', featured, 'Active'],
                ['Registered Users', users, 'Active']
            ],
            info: 'Marketing metrics are connected to existing INZU360 users, properties and subscriber data.',
            actions: []
        });
    } catch (error) {
        console.error('Marketing error:', error);
        res.status(500).send('Unable to load Marketing: ' + error.message);
    }
});

// Support
router.get('/support', isAdmin, (req, res) => {
    const db = getDB();
    try {
        const messages = db.prepare('SELECT COUNT(*) AS count FROM messages').get().count;
        const users = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
        const bookings = db.prepare('SELECT COUNT(*) AS count FROM bookings').get().count;
        const properties = db.prepare('SELECT COUNT(*) AS count FROM properties').get().count;

        res.render('pages/admin/premium-section', {
            user: req.session.user,
            title: 'Support',
            activePage: 'support',
            subtitle: 'Central support overview for users, bookings and property operations.',
            stats: [
                { label: 'Messages', value: messages },
                { label: 'Users', value: users },
                { label: 'Bookings', value: bookings },
                { label: 'Properties', value: properties }
            ],
            columns: ['Support Area', 'Records', 'Status'],
            rows: [
                ['Customer Messages', messages, 'Monitor'],
                ['Users', users, 'Available'],
                ['Bookings', bookings, 'Available'],
                ['Properties', properties, 'Available']
            ],
            info: 'Use the Messages and Bookings sections for detailed customer support workflows.',
            actions: []
        });
    } catch (error) {
        console.error('Support error:', error);
        res.status(500).send('Unable to load Support: ' + error.message);
    }
});

// Integrations
router.get('/integrations', isAdmin, (req, res) => {
    res.render('pages/admin/premium-section', {
        user: req.session.user,
        title: 'Integrations',
        activePage: 'integrations',
        subtitle: 'Monitor the systems connected to your INZU360 platform.',
        stats: [
            { label: 'Database', value: 'Connected' },
            { label: 'Authentication', value: 'Connected' },
            { label: 'Media', value: 'Connected' },
            { label: '3D Tours', value: 'Connected' }
        ],
        columns: ['Integration', 'Status', 'Purpose'],
        rows: [
            ['SQLite Database', 'Connected', 'Core application data'],
            ['Session Authentication', 'Connected', 'Admin and user authentication'],
            ['Property Media', 'Connected', 'Property images'],
            ['Virtual Tours', 'Connected', '3D digital experiences'],
            ['Payment Gateway', 'Not Connected', 'Real payment processing'],
            ['Email Provider', 'Not Connected', 'Transactional email']
        ],
        info: 'Only confirmed integrations are marked as connected. No unavailable services are represented as active.',
        actions: []
    });
});

// Security
router.get('/security', isAdmin, (req, res) => {
    const db = getDB();
    try {
        const total = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
        const admins = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get().count;
        const verified = db.prepare('SELECT COUNT(*) AS count FROM users WHERE is_verified = 1').get().count;

        res.render('pages/admin/premium-section', {
            user: req.session.user,
            title: 'Security',
            activePage: 'security',
            subtitle: 'Review account access and platform security indicators.',
            stats: [
                { label: 'Users', value: total },
                { label: 'Administrators', value: admins },
                { label: 'Verified Users', value: verified }
            ],
            columns: ['Security Check', 'Value', 'Status'],
            rows: [
                ['Admin Accounts', admins, 'Review regularly'],
                ['Verified Users', verified, 'Monitored'],
                ['Authentication', 'Session Based', 'Active'],
                ['Database', 'SQLite', 'Connected']
            ],
            info: 'Security controls should be extended with provider-specific protections before production payment or sensitive integrations are enabled.',
            actions: []
        });
    } catch (error) {
        console.error('Security error:', error);
        res.status(500).send('Unable to load Security: ' + error.message);
    }
});

// Audit Logs
router.get('/audit', isAdmin, (req, res) => {
    const db = getDB();
    try {
        const users = db.prepare(`
            SELECT 'User Created' AS action, name AS subject, created_at
            FROM users
            ORDER BY created_at DESC
            LIMIT 10
        `).all();

        const properties = db.prepare(`
            SELECT 'Property Created' AS action, title AS subject, created_at
            FROM properties
            ORDER BY created_at DESC
            LIMIT 10
        `).all();

        const activity = [...users, ...properties]
            .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
            .slice(0, 20);

        res.render('pages/admin/premium-section', {
            user: req.session.user,
            title: 'Audit Logs',
            activePage: 'audit',
            subtitle: 'Recent platform activity derived from recorded database events.',
            stats: [
                { label: 'Recent Events', value: activity.length },
                { label: 'User Events', value: users.length },
                { label: 'Property Events', value: properties.length }
            ],
            columns: ['Action', 'Subject', 'Date'],
            rows: activity.map(x => [
                x.action,
                x.subject || '—',
                x.created_at || '—'
            ]),
            info: 'This is a database-derived activity view. A dedicated immutable audit_events table can be added later for complete action-level auditing.',
            actions: []
        });
    } catch (error) {
        console.error('Audit error:', error);
        res.status(500).send('Unable to load Audit Logs: ' + error.message);
    }
});


/* ============================================================
 * MATTERPORT INTEGRATION
 * Canonical field: matterport_model_id
 * ============================================================ */

const { detectMatterport, buildEmbedUrl } = require('../utils/matterport');

router.post('/matterport/detect', isAdmin, (req, res) => {
    const { input } = req.body;
    const result = detectMatterport(input);
    if (!result.ok) return res.json({ ok: false, error: result.error });
    res.json({
        ok: true,
        modelId: result.modelId,
        canonicalUrl: result.canonicalUrl,
        embedUrl: buildEmbedUrl(result.modelId)
    });
});

router.get('/matterport', isAdmin, (req, res) => {
    const db = getDB();
    const tours = db.prepare(`
        SELECT vt.*, p.title as property_title
        FROM virtual_tours vt
        LEFT JOIN properties p ON vt.property_id = p.id
        ORDER BY vt.created_at DESC
    `).all();
    res.render('pages/admin/matterport-list', {
        title: 'Matterport Tours',
        user: req.session.user,
        tours: tours,
        layout: 'layouts/admin'
    });
});

router.get('/matterport/add', isAdmin, (req, res) => {
    const db = getDB();
    const properties = db.prepare('SELECT id, title FROM properties ORDER BY title ASC').all();
    res.render('pages/admin/matterport-add', {
        title: 'Add Matterport Tour',
        user: req.session.user,
        properties: properties,
        layout: 'layouts/admin'
    });
});

router.post('/matterport/create', isAdmin, (req, res) => {
    const db = getDB();
    const { property_id, matterport_input, is_published, featured_on_homepage } = req.body;

    if (!property_id) {
        req.flash('error_msg', 'Please select a property.');
        return res.redirect('/admin/matterport/add');
    }

    const result = detectMatterport(matterport_input);
    if (!result.ok) {
        req.flash('error_msg', result.error);
        return res.redirect('/admin/matterport/add');
    }

    const existing = db.prepare(
        'SELECT id FROM virtual_tours WHERE property_id = ? AND matterport_model_id = ?'
    ).get(property_id, result.modelId);
    if (existing) {
        req.flash('error_msg', 'This Matterport tour already exists for this property.');
        return res.redirect('/admin/matterport/add');
    }

    const published = (is_published === 'on' || is_published === '1') ? 1 : 0;
    const featured  = (featured_on_homepage === 'on' || featured_on_homepage === '1') ? 1 : 0;

    try {
        db.prepare(`
            INSERT INTO virtual_tours
                (property_id, provider, matterport_model_id, matterport_url, status,
                 is_published, featured_on_homepage, sort_order, created_at, updated_at)
            VALUES (?, 'matterport', ?, ?, 'active', ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(property_id, result.modelId, result.canonicalUrl, published, featured);

        db.prepare('UPDATE properties SET has_virtual_tour = 1 WHERE id = ?').run(property_id);

        req.flash('success_msg', 'Matterport tour added (Model ID: ' + result.modelId + ').');
        res.redirect('/admin/matterport');
    } catch (err) {
        console.error('Matterport create error:', err);
        req.flash('error_msg', 'Failed to save: ' + err.message);
        res.redirect('/admin/matterport/add');
    }
});

router.get('/matterport/:id/edit', isAdmin, (req, res) => {
    const db = getDB();
    const tour = db.prepare('SELECT * FROM virtual_tours WHERE id = ?').get(req.params.id);
    if (!tour) {
        req.flash('error_msg', 'Tour not found.');
        return res.redirect('/admin/matterport');
    }
    const properties = db.prepare('SELECT id, title FROM properties ORDER BY title ASC').all();
    res.render('pages/admin/matterport-edit', {
        title: 'Edit Matterport Tour',
        user: req.session.user,
        tour: tour,
        properties: properties,
        layout: 'layouts/admin'
    });
});

router.post('/matterport/:id/update', isAdmin, (req, res) => {
    const db = getDB();
    const { property_id, matterport_input, is_published, featured_on_homepage } = req.body;

    const result = detectMatterport(matterport_input);
    if (!result.ok) {
        req.flash('error_msg', result.error);
        return res.redirect('/admin/matterport/' + req.params.id + '/edit');
    }

    const published = (is_published === 'on' || is_published === '1') ? 1 : 0;
    const featured  = (featured_on_homepage === 'on' || featured_on_homepage === '1') ? 1 : 0;

    db.prepare(`
        UPDATE virtual_tours
        SET property_id = ?, provider = 'matterport',
            matterport_model_id = ?, matterport_url = ?,
            is_published = ?, featured_on_homepage = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(property_id, result.modelId, result.canonicalUrl, published, featured, req.params.id);

    req.flash('success_msg', 'Matterport tour updated.');
    res.redirect('/admin/matterport');
});

router.post('/matterport/:id/publish', isAdmin, (req, res) => {
    const db = getDB();
    const tour = db.prepare('SELECT is_published FROM virtual_tours WHERE id = ?').get(req.params.id);
    if (tour) {
        db.prepare('UPDATE virtual_tours SET is_published = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(tour.is_published ? 0 : 1, req.params.id);
    }
    res.redirect('/admin/matterport');
});

router.post('/matterport/:id/feature', isAdmin, (req, res) => {
    const db = getDB();
    const tour = db.prepare('SELECT featured_on_homepage FROM virtual_tours WHERE id = ?').get(req.params.id);
    if (tour) {
        db.prepare('UPDATE virtual_tours SET featured_on_homepage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(tour.featured_on_homepage ? 0 : 1, req.params.id);
    }
    res.redirect('/admin/matterport');
});

router.post('/matterport/:id/delete', isAdmin, (req, res) => {
    const db = getDB();
    const tour = db.prepare('SELECT property_id FROM virtual_tours WHERE id = ?').get(req.params.id);
    if (tour) {
        db.prepare('DELETE FROM virtual_tours WHERE id = ?').run(req.params.id);
        const remaining = db.prepare('SELECT COUNT(*) as c FROM virtual_tours WHERE property_id = ?').get(tour.property_id);
        if (remaining.c === 0) {
            db.prepare('UPDATE properties SET has_virtual_tour = 0 WHERE id = ?').run(tour.property_id);
        }
    }
    req.flash('success_msg', 'Matterport tour deleted.');
    res.redirect('/admin/matterport');
});

module.exports = router;
