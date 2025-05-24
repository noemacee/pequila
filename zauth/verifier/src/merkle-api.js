const path = require('path');
const fs = require('fs').promises;

const merkleDataDir = path.join(__dirname, 'merkle-data');

async function serveMerkleFile(fileName, res, next) {
  try {
    const filePath = path.join(merkleDataDir, fileName);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const jsonData = JSON.parse(fileContent);

    console.log(fileContent);
    res.json({ success: true, data: jsonData });
  } catch (err) {
    next(err); // will be caught by your global error middleware
  }
}

async function handleWhitelistMerkle(req, res, next) {
    console.log("something is happening");
  await serveMerkleFile('whitelist.json', res, next);
}

async function handleBlacklistMerkle(req, res, next) {
    console.log("something is happening");
  await serveMerkleFile('blacklist.json', res, next);
}

module.exports = {
  handleWhitelistMerkle,
  handleBlacklistMerkle
};
