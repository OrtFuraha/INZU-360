const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('pages/property-marketing/index', { title: 'Property Marketing - INZU360' });
});

module.exports = router;
