const express = require('express');
const router = express.Router();
const { getDB } = require('../config/database');

router.get('/', (req, res) => {
    const db = getDB();
    
    // Get featured developer projects
    const featuredProjects = db.prepare(`
        SELECT p.*, 
               (SELECT url FROM property_images WHERE property_id = p.id AND is_primary = 1 LIMIT 1) as image,
               u.name as developer_name,
               u.email as developer_email
        FROM properties p
        JOIN users u ON p.owner_id = u.id
        WHERE p.is_featured = 1 AND p.status = 'active'
        ORDER BY p.created_at DESC LIMIT 6
    `).all();
    
    // Get developer statistics
    const stats = {
        totalProperties: db.prepare("SELECT COUNT(*) as count FROM properties WHERE status = 'active'").get(),
        totalDevelopers: db.prepare("SELECT COUNT(DISTINCT owner_id) as count FROM properties").get(),
        totalProjects: db.prepare("SELECT COUNT(*) as count FROM properties WHERE property_type IN ('commercial', 'villa', 'apartment')").get(),
        totalLand: db.prepare("SELECT COUNT(*) as count FROM properties WHERE property_type = 'land'").get()
    };
    
    // Get top developers
    const topDevelopers = db.prepare(`
        SELECT u.id, u.name, u.email, u.phone, 
               COUNT(p.id) as project_count,
               SUM(p.views) as total_views,
               ROUND(AVG(p.price), 0) as avg_price,
               MAX(p.price) as max_price
        FROM users u
        JOIN properties p ON u.id = p.owner_id
        WHERE u.role IN ('owner', 'developer')
        GROUP BY u.id
        HAVING project_count > 0
        ORDER BY project_count DESC
        LIMIT 10
    `).all();
    
    // Get recent developments
    const recentDevelopments = db.prepare(`
        SELECT p.*, 
               (SELECT url FROM property_images WHERE property_id = p.id AND is_primary = 1 LIMIT 1) as image,
               u.name as developer_name
        FROM properties p
        JOIN users u ON p.owner_id = u.id
        WHERE p.status = 'active'
        ORDER BY p.created_at DESC
        LIMIT 8
    `).all();
    
    res.render('pages/developers/index', {
        title: 'Developers - INZU360',
        featuredProjects,
        stats,
        topDevelopers,
        recentDevelopments
    });
});

module.exports = router;
