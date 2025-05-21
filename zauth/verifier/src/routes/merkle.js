const express = require('express');
const router = express.Router();

// TODO: Implement Merkle root creation and verification endpoints
router.post('/create-root', async (req, res) => {
  res.status(501).json({
    error: 'Not implemented',
    message: 'Merkle root creation endpoint is not yet implemented'
  });
});

router.post('/verify-inclusion', async (req, res) => {
  res.status(501).json({
    error: 'Not implemented',
    message: 'Merkle proof verification endpoint is not yet implemented'
  });
});

module.exports = router; 