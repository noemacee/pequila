const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const config = require('./config');
const circuitManager = require('./circuit');
const verifyRoutes = require('./routes/verify');
const merkleRoutes = require('./routes/merkle');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: config.bodyParserLimit }));
app.use(bodyParser.urlencoded({ limit: config.bodyParserLimit, extended: true }));

// Routes
app.use('/api', verifyRoutes);
app.use('/api/merkle', merkleRoutes);

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