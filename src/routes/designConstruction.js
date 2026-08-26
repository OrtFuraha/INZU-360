const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('pages/design-construction/index', { title: 'Design & Construction - INZU360' });
});

module.exports = router;
