const express = require('express');
const router = express.Router();
const { getDB } = require('../config/database');

router.get('/', (req, res) => {
  const db = getDB();
  const { type, transaction, location, minPrice, maxPrice, bedrooms } = req.query;
  
  try {
    let sql = `
      SELECT p.*, 
             (SELECT url FROM property_images WHERE property_id = p.id AND is_primary = 1 LIMIT 1) as image,
             u.name as owner_name
      FROM properties p
      LEFT JOIN users u ON p.owner_id = u.id
      WHERE p.status = 'active'
    `;
    
    const params = [];
    
    if (type) { sql += ` AND p.property_type = ?`; params.push(type); }
    if (transaction) { sql += ` AND p.transaction_type = ?`; params.push(transaction); }
    if (location) {
      sql += ` AND (p.city LIKE ? OR p.district LIKE ? OR p.address LIKE ?)`;
      const loc = `%${location}%`;
      params.push(loc, loc, loc);
    }
    if (minPrice) { sql += ` AND p.price >= ?`; params.push(parseFloat(minPrice)); }
    if (maxPrice) { sql += ` AND p.price <= ?`; params.push(parseFloat(maxPrice)); }
    if (bedrooms) { sql += ` AND p.bedrooms >= ?`; params.push(parseInt(bedrooms)); }
    
    sql += ` ORDER BY p.created_at DESC`;
    
    const properties = db.prepare(sql).all(params);
    
    res.render('pages/properties/index', { 
      title: 'Properties - INZU360', 
      properties: properties || [],
      filters: req.query
    });
  } catch (err) {
    console.error('Error loading properties:', err.message);
    res.render('pages/properties/index', { 
      title: 'Properties - INZU360', 
      properties: [],
      filters: req.query
    });
  }
});

router.get('/:id', (req, res) => {
  const db = getDB();
  const propertyId = req.params.id;
  
  try {
    const property = db.prepare(`
      SELECT p.*, 
             u.name as owner_name, u.email as owner_email, u.phone as owner_phone
      FROM properties p
      LEFT JOIN users u ON p.owner_id = u.id
      WHERE p.id = ?
    `).get(propertyId);
    
    if (!property) {
      return res.status(404).render('pages/404', { title: 'Property Not Found' });
    }
    
    db.prepare(`UPDATE properties SET views = views + 1 WHERE id = ?`).run(propertyId);
    
    const images = db.prepare(`SELECT * FROM property_images WHERE property_id = ? ORDER BY is_primary DESC`).all(propertyId);
    const virtualTour = db.prepare(`SELECT * FROM virtual_tours WHERE property_id = ? ORDER BY created_at DESC LIMIT 1`).get(propertyId);
    const amenities = db.prepare(`SELECT a.name FROM amenities a JOIN property_amenities pa ON a.id = pa.amenity_id WHERE pa.property_id = ?`).all(propertyId);
    const relatedProperties = db.prepare(`
      SELECT p.*, (SELECT url FROM property_images WHERE property_id = p.id AND is_primary = 1 LIMIT 1) as image
      FROM properties p WHERE p.property_type = ? AND p.id != ? AND p.status = 'active' LIMIT 4
    `).all(property.property_type, propertyId);
    
    res.render('pages/properties/detail', {
      title: property.title,
      property,
      images: images || [],
      virtualTour: virtualTour || null,
      amenities: amenities ? amenities.map(a => a.name) : [],
      relatedProperties: relatedProperties || []
    });
  } catch (err) {
    console.error('Error loading property detail:', err.message);
    res.status(404).render('pages/404', { title: 'Property Not Found' });
  }
});

module.exports = router;
