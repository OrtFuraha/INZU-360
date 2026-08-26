const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  const plans = [
    { name: 'Basic', price: 'Free', features: ['1 Property Listing', 'Basic Photos', 'Email Support'] },
    { name: 'Pro', price: '$29/mo', features: ['10 Properties', 'Virtual Tours', 'Analytics', 'Priority Support'] },
    { name: 'Enterprise', price: 'Custom', features: ['Unlimited Properties', 'AI Features', 'Dedicated Support', 'API Access'] }
  ];
  
  res.render('pages/pricing', { title: 'Pricing - INZU360', plans });
});

module.exports = router;
