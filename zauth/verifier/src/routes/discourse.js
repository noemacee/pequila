const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const config = require('../config');
const { pendingSSORequests } = require('../session');

// Helper function to validate SSO signature
function validateSSOSignature(payload, signature) {
  const hmac = crypto.createHmac('sha256', config.discourseConnectSecret);
  hmac.update(payload);
  return hmac.digest('hex') === signature;
}

// Helper function to decode SSO payload
function decodeSSOPayload(payload) {
  const decoded = Buffer.from(payload, 'base64').toString();
  const params = new URLSearchParams(decoded);
  return {
    nonce: params.get('nonce'),
    return_sso_url: params.get('return_sso_url')
  };
}

// Initial SSO request from Discourse
router.get('/sso', (req, res) => {
  console.log('\n=== [SERVER] SSO Request Received ===');
  console.log('[SERVER] Query parameters:', req.query);
  
  const { sso, sig } = req.query;

  if (!sso || !sig) {
    console.log('[SERVER] ❌ Missing SSO parameters:', { sso: !!sso, sig: !!sig });
    return res.status(400).json({ error: 'Missing SSO parameters' });
  }

  if (!validateSSOSignature(sso, sig)) {
    console.log('[SERVER] ❌ Invalid signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    const { nonce, return_sso_url } = decodeSSOPayload(sso);
    console.log('[SERVER] ✓ Decoded SSO payload:', { nonce, return_sso_url });
    
    // Clean up any existing nonce
    if (pendingSSORequests.has(nonce)) {
      console.log('[SERVER] Cleaning up existing nonce:', nonce);
      pendingSSORequests.delete(nonce);
    }
    
    // Store the request
    pendingSSORequests.set(nonce, {
      return_sso_url,
      timestamp: Date.now(),
      used: false
    });
    console.log('[SERVER] ✓ Stored SSO request for nonce:', nonce);

    // Send initial response with loading page
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: radial-gradient(circle at center, #2C3333 0%, #3a4242 50%, #4d5757 100%);
            }
            .spinner {
              border: 4px solid #f3f3f3;
              border-top: 4px solid #3498db;
              border-radius: 50%;
              width: 40px;
              height: 40px;
              animation: spin 1s linear infinite;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
        </head>
        <body>
          <div class="spinner"></div>
          <script>
            console.log('[CLIENT] Redirecting to login page...');
            window.location.href = "/?nonce=${nonce}";
          </script>
        </body>
      </html>
    `;

    console.log('[SERVER] Sending HTML response with spinner');
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('[SERVER] ❌ Error processing SSO request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check if a nonce is valid and get its return URL
router.get('/check-nonce', (req, res) => {
  console.log('\n=== [SERVER] Checking Nonce ===');
  const { nonce } = req.query;
  if (!nonce) {
    console.log('[SERVER] ❌ No nonce provided');
    return res.status(404).json({ error: 'No SSO request found' });
  }

  const ssoRequest = pendingSSORequests.get(nonce);
  if (!ssoRequest) {
    console.log('[SERVER] ❌ Invalid nonce:', nonce);
    return res.status(404).json({ error: 'Invalid or expired nonce' });
  }

  // Check if nonce is too old (10 minutes)
  const nonceAge = Date.now() - ssoRequest.timestamp;
  if (nonceAge > 10 * 60 * 1000) {
    console.log('[SERVER] ❌ Nonce expired:', nonce, 'Age:', nonceAge);
    pendingSSORequests.delete(nonce);
    return res.status(404).json({ error: 'Nonce expired' });
  }

  console.log('[SERVER] ✓ Valid nonce found:', nonce);
  res.json({ valid: true, returnUrl: ssoRequest.return_sso_url });
});

// Complete SSO after verification
router.post('/complete-sso', async (req, res) => {
  console.log('\n=== [SERVER] Complete SSO Request ===');
  console.log('[SERVER] Request body:', req.body);
  
  const { nonce } = req.body;
  if (!nonce) {
    console.log('[SERVER] ❌ Missing nonce in request');
    return res.status(400).json({ error: 'Missing nonce' });
  }

  const ssoRequest = pendingSSORequests.get(nonce);
  if (!ssoRequest) {
    console.log('[SERVER] ❌ No SSO request found for nonce:', nonce);
    return res.status(400).json({ error: 'Invalid or expired nonce' });
  }

  // Check if nonce is too old (10 minutes)
  const nonceAge = Date.now() - ssoRequest.timestamp;
  if (nonceAge > 10 * 60 * 1000) {
    console.log('[SERVER] ❌ Nonce expired:', nonce, 'Age:', nonceAge);
    pendingSSORequests.delete(nonce);
    return res.status(400).json({ error: 'Nonce expired' });
  }

  // Check if this nonce has already been used
  if (ssoRequest.used) {
    console.log('[SERVER] ❌ Nonce already used:', nonce);
    return res.status(400).json({ error: 'Nonce already used' });
  }

  try {
    // Generate random identifier
    const identifier = crypto.randomBytes(16).toString('hex');
    const randomNumber = Math.floor(Math.random() * 1000000);
    console.log('[SERVER] Generated identifier:', identifier);
    
    // Create the response payload
    const params = new URLSearchParams();
    params.append('nonce', nonce);
    params.append('email', identifier + '@example.com');
    params.append('external_id', identifier);
    params.append('username', 'anonymous' + randomNumber);
    params.append('name', 'Satoshi Nakamoto');
    params.append('require_activation', 'false');
    params.append('suppress_welcome_message', 'true');

    // Create and sign the payload
    const payload = params.toString();
    const base64Payload = Buffer.from(payload).toString('base64');
    const hmac = crypto.createHmac('sha256', config.discourseConnectSecret);
    hmac.update(base64Payload);
    const signature = hmac.digest('hex');

    // Create the final URL
    const redirectUrl = `${ssoRequest.return_sso_url}?sso=${encodeURIComponent(base64Payload)}&sig=${signature}`;
    console.log('[SERVER] ✓ Generated redirect URL');
    
    // Mark the nonce as used AFTER successful payload creation
    ssoRequest.used = true;
    pendingSSORequests.set(nonce, ssoRequest);
    
    // Clean up the nonce after a longer delay (5 minutes)
    setTimeout(() => {
      console.log('[SERVER] Cleaning up used nonce:', nonce);
      if (pendingSSORequests.has(nonce)) {
        pendingSSORequests.delete(nonce);
      }
    }, 5 * 60 * 1000); // 5 minutes
    
    // Return the redirect URL in the expected format
    res.json({
      success: true,
      redirectUrl: redirectUrl
    });
  } catch (error) {
    console.error('[SERVER] ❌ Error completing SSO:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: error.message 
    });
  }
});

module.exports = router; 