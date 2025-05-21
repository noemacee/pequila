const path = require('path');

module.exports = {
  port: process.env.PORT || 4000,
  circuitPath: path.join(__dirname, '../zuitzpass.json'),
  bodyParserLimit: '50mb',
  discourseConnectSecret: process.env.DISCOURSE_CONNECT_SECRET || 'your-discourse-secret-key'
}; 