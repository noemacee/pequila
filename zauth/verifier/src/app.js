const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('./config');
const circuitManager = require('./circuit');
const verifyRoutes = require('./routes/verify');
const discourseRoutes = require('./routes/discourse');
const crypto = require('crypto');
const { pendingSSORequests } = require('./session');

const app = express();

// Middleware
app.use(cors());
app.use(cookieParser());
app.use(bodyParser.json({ limit: config.bodyParserLimit }));
app.use(bodyParser.urlencoded({ limit: config.bodyParserLimit, extended: true }));

// API Routes
app.use('/api/verify', verifyRoutes);
app.use('/api/discourse', discourseRoutes);

// Handle /sso route
app.get('/sso', (req, res) => {
  console.log('Received SSO request at /sso');
  console.log('Query parameters:', req.query);
  
  console.log('Waiting 10 seconds before processing SSO request...');
  
  // Send initial response
  res.writeHead(200, {
    'Content-Type': 'text/html'
  });
  res.write(`
    <html>
      <head>
        <title>Processing SSO Request</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: radial-gradient(circle at center, #2C3333 0%, #3a4242 50%, #4d5757 100%);
            color: white;
          }
          .container {
            text-align: center;
          }
          .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Processing SSO Request</h2>
          <div class="spinner"></div>
          <p>Please wait while we process your request...</p>
        </div>
      </body>
    </html>
  `);
  
  setTimeout(() => {
    const { sso, sig } = req.query;
    if (!sso || !sig) {
      console.log('Missing SSO parameters:', { sso: !!sso, sig: !!sig });
      res.end(JSON.stringify({ error: 'Missing SSO parameters' }));
      return;
    }

    // Validate signature according to Discourse documentation
    const hmac = crypto.createHmac('sha256', config.discourseConnectSecret);
    hmac.update(sso); // Use the raw sso parameter directly
    const expectedSignature = hmac.digest('hex');
    
    console.log('Signature validation details:', {
      receivedSignature: sig,
      expectedSignature,
      secretKey: config.discourseConnectSecret,
      rawPayload: sso,
      decodedPayload: Buffer.from(sso, 'base64').toString()
    });
    
    if (expectedSignature !== sig) {
      console.log('Invalid signature. Please check that discourse_connect_secret matches between Discourse and this server.');
      res.end(JSON.stringify({ 
        error: 'Invalid signature',
        details: {
          receivedSignature: sig,
          expectedSignature,
          secretKeyLength: config.discourseConnectSecret.length
        }
      }));
      return;
    }

    try {
      // Decode SSO payload
      const decoded = Buffer.from(sso, 'base64').toString();
      const params = new URLSearchParams(decoded);
      const nonce = params.get('nonce');
      const return_sso_url = params.get('return_sso_url');
      
      console.log('Decoded SSO payload:', { nonce, return_sso_url });
      
      // Store in pending requests
      if (nonce && return_sso_url) {
        pendingSSORequests.set(nonce, {
          return_sso_url,
          timestamp: Date.now()
        });
        console.log('Stored SSO request. Current pending requests:', Array.from(pendingSSORequests.keys()));
        
        // Redirect to the root path with the nonce
        const redirectUrl = `/?nonce=${nonce}`;
        console.log('Redirecting to:', redirectUrl);
        res.write(`
          <script>
            window.location.href = "${redirectUrl}";
          </script>
        `);
        res.end();
      } else {
        console.log('Missing nonce or return_sso_url in payload');
        res.end(JSON.stringify({ error: 'Invalid SSO payload' }));
      }
    } catch (error) {
      console.error('Error processing SSO request:', error);
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }, 10000);
});

// Debug route for root path
app.get('/', (req, res, next) => {
  console.log('Root path accessed');
  console.log('Query parameters:', req.query);
  
  const { sso, sig } = req.query;
  if (sso && sig) {
    // Validate signature
    const hmac = crypto.createHmac('sha256', config.discourseConnectSecret);
    hmac.update(sso);
    const expectedSignature = hmac.digest('hex');
    
    if (expectedSignature === sig) {
      try {
        // Decode SSO payload
        const decoded = Buffer.from(sso, 'base64').toString();
        const params = new URLSearchParams(decoded);
        const nonce = params.get('nonce');
        const return_sso_url = params.get('return_sso_url');
        
        console.log('Decoded SSO payload:', { nonce, return_sso_url });
        
        // Store in pending requests
        if (nonce && return_sso_url) {
          pendingSSORequests.set(nonce, {
            return_sso_url,
            timestamp: Date.now()
          });
          console.log('Stored SSO request. Current pending requests:', Array.from(pendingSSORequests.keys()));
        }
      } catch (error) {
        console.error('Error processing SSO request:', error);
      }
    }
  }
  
  next();
});

// Serve static files from the client build directory
app.use(express.static(path.join(__dirname, '../../client/dist')));

// For any other route, serve the index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
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