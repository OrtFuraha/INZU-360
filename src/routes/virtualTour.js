const express = require('express');
const router = express.Router();
const { getDB } = require('../config/database');
const { buildEmbedUrl } = require('../utils/matterport');

router.get('/', (req, res) => {
  const db = getDB();
  
  const properties = db.prepare(`
    SELECT p.*, (SELECT url FROM property_images WHERE property_id = p.id AND is_primary = 1 LIMIT 1) as image
    FROM properties p JOIN virtual_tours vt ON p.id = vt.property_id
    WHERE p.has_virtual_tour = 1 AND p.status = 'active'
    ORDER BY vt.created_at DESC
  `).all();
  
  res.render('pages/virtual-tour/index', { title: 'Virtual Property Tours', properties: properties || [] });
});

router.get('/:id', (req, res) => {
  const db = getDB();
  const propertyId = req.params.id;

  const property = db.prepare(`
    SELECT p.*, u.name as owner_name, vt.*
    FROM properties p
    LEFT JOIN users u ON p.owner_id = u.id
    LEFT JOIN virtual_tours vt ON p.id = vt.property_id
    WHERE p.id = ? AND p.has_virtual_tour = 1
  `).get(propertyId);

  if (!property) return res.status(404).render('pages/404', { title: 'Tour Not Found' });

  try {
    db.prepare(`UPDATE virtual_tours SET views = views + 1 WHERE property_id = ?`).run(propertyId);
  } catch (e) { /* non-fatal */ }

  // Matterport provider — only when explicitly set on this tour
  if (property.provider === 'matterport' && property.matterport_model_id) {
    return res.render('pages/virtual-tour/player', {
      title: `3D Tour - ${property.title}`,
      property: property,
      embedUrl: buildEmbedUrl(property.matterport_model_id),
      provider: 'matterport'
    });
  }

  // Legacy fallback — existing behaviour preserved
  return res.render('pages/virtual-tour/player', {
    title: `360° Tour - ${property.title}`,
    property: property,
    embedUrl: null,
    provider: 'legacy'
  });
});

module.exports = router;
