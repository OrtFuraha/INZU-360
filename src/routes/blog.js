const express = require('express');
const router = express.Router();
const { getDB } = require('../config/database');

router.get('/', (req, res) => {
  const db = getDB();
  const posts = db.prepare(`SELECT * FROM blog_posts WHERE status = 'published' ORDER BY created_at DESC`).all();
  res.render('pages/blog/index', { title: 'Real Estate Insights', posts: posts || [] });
});

module.exports = router;
