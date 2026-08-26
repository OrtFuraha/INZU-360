const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('pages/developers/index', { title: 'Developers - INZU360' });
});

module.exports = router;
