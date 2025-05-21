const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const circuitManager = require('./circuit');
const verifyRoutes = require('./routes/verify');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: config.bodyParserLimit }));
app.use(bodyParser.urlencoded({ limit: config.bodyParserLimit, extended: true }));

// API Routes
app.use('/api', verifyRoutes);

// Serve static files from the client build directory
app.use(express.static(path.join(__dirname, '../../client/dist')));

// For any other route, serve the index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

// Initialize server
async function startServer() {
  try {
    await circuitManager.initialize();
    app.listen(config.port, () => {
      console.log(`Verifier server running on port ${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

module.exports = app; 