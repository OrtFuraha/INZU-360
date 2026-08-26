const express = require('express');
const router = express.Router();
const { getDB } = require('../config/database');

router.get('/', (req, res) => {
  const db = getDB();
  const agents = db.prepare(`SELECT * FROM users WHERE role = 'agent' AND is_verified = 1`).all();
  res.render('pages/agents/index', { title: 'Real Estate Agents', agents: agents || [] });
});

router.get('/:id', (req, res) => {
  const db = getDB();
  const agentId = req.params.id;
  
  const agent = db.prepare(`SELECT * FROM users WHERE id = ? AND role = 'agent'`).get(agentId);
  if (!agent) return res.status(404).render('pages/404', { title: 'Agent Not Found' });
  
  const properties = db.prepare(`
    SELECT p.*, (SELECT url FROM property_images WHERE property_id = p.id AND is_primary = 1 LIMIT 1) as image
    FROM properties p WHERE p.agent_id = ? AND p.status = 'active'
  `).all(agentId);
  
  res.render('pages/agents/detail', { title: agent.name, agent, properties: properties || [] });
});

module.exports = router;
