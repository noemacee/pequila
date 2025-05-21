const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const config = require('../config');
const { pendingSSORequests } = require('../session');

// Helper function to validate SSO signature
function validateSSOSignature(payload, signature) {
  const hmac = crypto.createHmac('sha256', config.discourseConnectSecret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');
  return expectedSignature === signature;
}

// Helper function to decode SSO payload
function decodeSSOPayload(payload) {
  console.log('Decoding SSO payload:', payload);
  const decoded = Buffer.from(payload, 'base64').toString();
  console.log('Decoded payload:', decoded);
  const params = new URLSearchParams(decoded);
  const result = {
    nonce: params.get('nonce'),
    return_sso_url: params.get('return_sso_url')
  };
  console.log('Extracted parameters:', result);
  return result;
}

// Helper function to create SSO response
function createSSOResponse(nonce) {
  const params = new URLSearchParams();
  // Required fields
  params.append('nonce', nonce);
  params.append('email', 'anyone@zuitzerland.com');
  params.append('external_id', '1');
  
  // Additional fields
  params.append('username', 'anonymous');
  params.append('name', 'anonymous');
  
  // Security: Force email validation since we're not validating emails
  params.append('require_activation', 'true');
  
  // Optional: Suppress welcome message
  params.append('suppress_welcome_message', 'true');

  const payload = params.toString();
  const base64Payload = Buffer.from(payload).toString('base64');
  const hmac = crypto.createHmac('sha256', config.discourseConnectSecret);
  hmac.update(base64Payload);
  const signature = hmac.digest('hex');

  return {
    payload: base64Payload,
    signature
  };
}

// Initial SSO request from Discourse
router.get('/sso', (req, res) => {
  console.log('Received SSO request');
  console.log('Query parameters:', req.query);
  
  const { sso, sig } = req.query;

  if (!sso || !sig) {
    console.log('Missing SSO parameters:', { sso: !!sso, sig: !!sig });
    return res.status(400).json({ error: 'Missing SSO parameters' });
  }

  // Validate signature
  if (!validateSSOSignature(sso, sig)) {
    console.log('Invalid signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    // Decode and store SSO request
    const { nonce, return_sso_url } = decodeSSOPayload(sso);
    console.log('Decoded SSO payload:', { nonce, return_sso_url });
    
    pendingSSORequests.set(nonce, {
      return_sso_url,
      timestamp: Date.now()
    });
    console.log('Stored SSO request. Current pending requests:', Array.from(pendingSSORequests.keys()));
    

    // Wait 10 seconds and then redirect to the login page
    setTimeout(() => {
      const redirectUrl = `/?nonce=${nonce}`;
      console.log('Redirecting to:', redirectUrl);
      res.redirect(redirectUrl);
    }, 10000);

  } catch (error) {
    console.error('Error processing SSO request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check if a nonce is valid and get its return URL
router.get('/check-nonce', (req, res) => {
  const { nonce } = req.query;
  if (!nonce) {
    return res.status(404).json({ error: 'No SSO request found' });
  }

  const ssoRequest = pendingSSORequests.get(nonce);
  if (!ssoRequest) {
    return res.status(404).json({ error: 'Invalid or expired nonce' });
  }

  res.json({ valid: true, returnUrl: ssoRequest.return_sso_url });
});

// Complete SSO after verification
router.post('/complete-sso', async (req, res) => {
  const { nonce } = req.body;

  if (!nonce) {
    return res.status(400).json({ error: 'Missing nonce' });
  }

  const ssoRequest = pendingSSORequests.get(nonce);
  if (!ssoRequest) {
    return res.status(400).json({ error: 'Invalid or expired nonce' });
  }

  // Clean up pending request
  pendingSSORequests.delete(nonce);

  try {
    // Create SSO response
    const { payload, signature } = createSSOResponse(nonce);
    
    // Redirect back to Discourse
    const redirectUrl = `${ssoRequest.return_sso_url}?sso=${encodeURIComponent(payload)}&sig=${signature}`;
    res.json({ redirectUrl });
  } catch (error) {
    console.error('Error completing SSO:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 