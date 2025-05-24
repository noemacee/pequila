const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('./config');
const circuitManager = require('./circuit');
const verifyRoutes = require('./routes/verify');
const discourseRoutes = require('./routes/discourse');
const merkleRoutes = require('./routes/merkle');

const app = express();

// Middleware setup
app.use(cors({
  origin: config.corsOrigin,
  credentials: true
}));
app.use(cookieParser());
app.use(bodyParser.json({ limit: config.bodyParserLimit }));
app.use(bodyParser.urlencoded({ limit: config.bodyParserLimit, extended: true }));


// API Routes
app.use('/api/verify', verifyRoutes);
app.use('/api/discourse', discourseRoutes);
app.use('/api', merkleRoutes);

// SSO route needs to be at root level
app.use('/', discourseRoutes);

// Serve static files from the client build directory
app.use(express.static(path.join(__dirname, '../../client/dist')));

// For any other route, serve the index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  res.status(err.status || 500).json({
    success: false,
    error: err.status === 500 ? 'Internal Server Error' : err.message,
    path: req.path
  });
});

// Initialize server
async function startServer() {
  try {
    await circuitManager.initialize();
    const server = app.listen(config.port, () => {
      console.log(`Verifier server running on port ${config.port}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Handle server shutdown gracefully
    process.on('SIGTERM', () => {
      console.log('SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

module.exports = app; 