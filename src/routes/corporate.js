const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('pages/corporate/index', { title: 'Corporate Real Estate - INZU360' });
});

module.exports = router;
