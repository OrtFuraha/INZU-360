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

// Additional placeholder routes
const placeholderViews = ['payments', 'subscriptions', 'reports', 'ai', 'media', 'notifications', 'marketing', 'support', 'integrations', 'api', 'security', 'audit', 'settings'];
placeholderViews.forEach(view => {
    router.get(`/${view}`, isAdmin, (req, res) => {
        res.render(`pages/admin/${view}`, { title: view.charAt(0).toUpperCase() + view.slice(1), user: req.session.user, layout: 'layouts/admin' });
    });
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

module.exports = router;
