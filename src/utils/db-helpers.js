const { getDB } = require('../config/database');

// Log admin actions
function logAdminAction(userId, action, details = '') {
    const db = getDB();
    try {
        db.prepare(`
            INSERT INTO audit_logs (user_id, action, details)
            VALUES (?, ?, ?)
        `).run(userId, action, details);
    } catch (err) {
        console.error('Error logging admin action:', err);
    }
}

// Create property with all related data
function createProperty(data, adminId) {
    const db = getDB();
    
    const {
        title, description, price, currency, property_type, transaction_type,
        bedrooms, bathrooms, area, address, city, district,
        furnished, parking, security, is_featured, status
    } = data;
    
    // Insert property
    const result = db.prepare(`
        INSERT INTO properties (
            title, description, price, currency, property_type, transaction_type,
            bedrooms, bathrooms, area, address, city, district,
            furnished, parking, security, is_featured, status, is_verified, owner_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        title.trim(), description || '', parseFloat(price) || 0, currency || 'RWF',
        property_type || 'house', transaction_type || 'sale',
        parseInt(bedrooms) || 0, parseInt(bathrooms) || 0, parseFloat(area) || 0,
        address || '', city || '', district || '',
        parseInt(furnished) || 0, parseInt(parking) || 0, parseInt(security) || 0,
        parseInt(is_featured) || 0, status || 'active', 1, adminId
    );
    
    const propertyId = result.lastInsertRowid;
    
    // Add default images
    const defaultImages = [
        'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
        'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80',
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80'
    ];
    
    defaultImages.forEach((url, index) => {
        db.prepare(`
            INSERT INTO property_images (property_id, url, is_primary)
            VALUES (?, ?, ?)
        `).run(propertyId, url, index === 0 ? 1 : 0);
    });
    
    // Log the action
    logAdminAction(adminId, 'created_property', `Property: ${title} (ID: ${propertyId})`);
    
    return propertyId;
}

// Update property
function updateProperty(propertyId, data, adminId) {
    const db = getDB();
    
    const {
        title, description, price, currency, property_type, transaction_type,
        bedrooms, bathrooms, area, address, city, district,
        furnished, parking, security, is_featured, status
    } = data;
    
    db.prepare(`
        UPDATE properties SET
            title = ?, description = ?, price = ?, currency = ?, 
            property_type = ?, transaction_type = ?,
            bedrooms = ?, bathrooms = ?, area = ?, 
            address = ?, city = ?, district = ?,
            furnished = ?, parking = ?, security = ?, is_featured = ?, status = ?
        WHERE id = ?
    `).run(
        title.trim(), description || '', parseFloat(price) || 0, currency || 'RWF',
        property_type || 'house', transaction_type || 'sale',
        parseInt(bedrooms) || 0, parseInt(bathrooms) || 0, parseFloat(area) || 0,
        address || '', city || '', district || '',
        parseInt(furnished) || 0, parseInt(parking) || 0, parseInt(security) || 0,
        parseInt(is_featured) || 0, status || 'active', propertyId
    );
    
    logAdminAction(adminId, 'updated_property', `Property ID: ${propertyId}`);
}

// Delete property and all related data
function deleteProperty(propertyId, adminId) {
    const db = getDB();
    
    // Get property title for logging
    const property = db.prepare("SELECT title FROM properties WHERE id = ?").get(propertyId);
    
    // Delete related data
    db.prepare("DELETE FROM property_images WHERE property_id = ?").run(propertyId);
    db.prepare("DELETE FROM virtual_tours WHERE property_id = ?").run(propertyId);
    db.prepare("DELETE FROM floor_plans WHERE property_id = ?").run(propertyId);
    db.prepare("DELETE FROM property_amenities WHERE property_id = ?").run(propertyId);
    db.prepare("DELETE FROM property_reviews WHERE property_id = ?").run(propertyId);
    db.prepare("DELETE FROM favorites WHERE property_id = ?").run(propertyId);
    db.prepare("DELETE FROM bookings WHERE property_id = ?").run(propertyId);
    db.prepare("DELETE FROM properties WHERE id = ?").run(propertyId);
    
    logAdminAction(adminId, 'deleted_property', `Property: ${property ? property.title : 'Unknown'} (ID: ${propertyId})`);
}

// Update featured properties
function updateFeaturedProperties(adminId) {
    const db = getDB();
    
    // Reset all featured
    db.prepare("UPDATE properties SET is_featured = 0").run();
    
    // Set random 6 properties as featured
    const featuredIds = db.prepare(`
        SELECT id FROM properties WHERE status = 'active' ORDER BY RANDOM() LIMIT 6
    `).all();
    
    featuredIds.forEach(p => {
        db.prepare("UPDATE properties SET is_featured = 1 WHERE id = ?").run(p.id);
    });
    
    logAdminAction(adminId, 'updated_featured', `Selected ${featuredIds.length} featured properties`);
    
    return featuredIds.length;
}

module.exports = {
    logAdminAction,
    createProperty,
    updateProperty,
    deleteProperty,
    updateFeaturedProperties
};
