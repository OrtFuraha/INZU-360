const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('pages/facility-management/index', { title: 'Facility Management - INZU360' });
});

module.exports = router;
