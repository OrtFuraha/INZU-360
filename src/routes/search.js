const express = require('express');
const router = express.Router();
const { getDB } = require('../config/database');

router.get('/', (req, res) => {
  const db = getDB();
  const { q, type, location, minPrice, maxPrice, bedrooms, transaction } = req.query;
  
  try {
    let sql = `SELECT p.*, (SELECT url FROM property_images WHERE property_id = p.id AND is_primary = 1 LIMIT 1) as image FROM properties p WHERE p.status = 'active'`;
    const params = [];
    
    if (q) {
      sql += ` AND (p.title LIKE ? OR p.description LIKE ? OR p.address LIKE ? OR p.city LIKE ?)`;
      const searchTerm = `%${q}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    if (type) { sql += ` AND p.property_type = ?`; params.push(type); }
    if (transaction) { sql += ` AND p.transaction_type = ?`; params.push(transaction); }
    if (location) {
      sql += ` AND (p.city LIKE ? OR p.district LIKE ? OR p.address LIKE ?)`;
      const locTerm = `%${location}%`;
      params.push(locTerm, locTerm, locTerm);
    }
    if (minPrice) { sql += ` AND p.price >= ?`; params.push(parseFloat(minPrice)); }
    if (maxPrice) { sql += ` AND p.price <= ?`; params.push(parseFloat(maxPrice)); }
    if (bedrooms) { sql += ` AND p.bedrooms >= ?`; params.push(parseInt(bedrooms)); }
    
    sql += ` ORDER BY p.created_at DESC`;
    
    const properties = db.prepare(sql).all(params);
    
    res.render('pages/search', { title: 'Search Properties', properties: properties || [], query: req.query });
  } catch (err) {
    console.error('Error searching properties:', err.message);
    res.render('pages/search', { title: 'Search Properties', properties: [], query: req.query });
  }
});

module.exports = router;
