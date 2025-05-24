// routes/merkle.js
const express = require('express');
const { handleWhitelistMerkle, handleBlacklistMerkle } = require('../merkle-api');

const router = express.Router();

router.post('/whitelist_merkle', handleWhitelistMerkle);
router.post('/blacklist_merkle', handleBlacklistMerkle);

module.exports = router;
