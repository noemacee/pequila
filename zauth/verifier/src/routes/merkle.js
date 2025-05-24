// routes/merkle.js
const express = require('express');
const { handleWhitelistMerkle, handleBlacklistMerkle } = require('../merkle-api');

const router = express.Router();

router.get('/whitelist_merkle', handleWhitelistMerkle);
router.get('/blacklist_merkle', handleBlacklistMerkle);

module.exports = router;
