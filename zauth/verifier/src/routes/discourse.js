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


// Initial SSO request from Discourse
router.get('/sso', (req, res) => {
  console.log('=== SSO Request Received ===');
  console.log('Query parameters:', req.query);
  
  const { sso, sig } = req.query;

  if (!sso || !sig) {
    console.log('Missing SSO parameters:', { sso: !!sso, sig: !!sig });
    return res.status(400).json({ error: 'Missing SSO parameters' });
  }

  // Validate signature
  if (!validateSSOSignature(sso, sig)) {
    console.log('Invalid signature');
    console.log('Received signature:', sig);
    console.log('Expected signature:', crypto.createHmac('sha256', config.discourseConnectSecret).update(sso).digest('hex'));
    console.log('Using secret key:', config.discourseConnectSecret);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    // Decode and store SSO request
    const { nonce, return_sso_url } = decodeSSOPayload(sso);
    console.log('Decoded SSO payload:', { nonce, return_sso_url });
    
    // Clean up any existing nonce
    if (pendingSSORequests.has(nonce)) {
      console.log('Cleaning up existing nonce:', nonce);
      pendingSSORequests.delete(nonce);
    }
    
    // Store the request with a timestamp and used flag
    pendingSSORequests.set(nonce, {
      return_sso_url,
      timestamp: Date.now(),
      used: false
    });
    
    console.log('Stored SSO request:', {
      nonce,
      return_sso_url,
      timestamp: Date.now(),
      currentPendingRequests: Array.from(pendingSSORequests.entries())
    });

    // Redirect immediately to the login page
    const redirectUrl = `/?nonce=${nonce}`;
    console.log('Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);

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

  // Check if nonce is too old (10 minutes)
  const nonceAge = Date.now() - ssoRequest.timestamp;
  if (nonceAge > 10 * 60 * 1000) {
    console.log('Nonce too old:', nonce, 'age:', nonceAge);
    pendingSSORequests.delete(nonce);
    return res.status(404).json({ error: 'Nonce expired' });
  }

  res.json({ valid: true, returnUrl: ssoRequest.return_sso_url });
});

// Complete SSO after verification
router.post('/complete-sso', async (req, res) => {
  console.log('=== Completing SSO ===');
  console.log('Request body:', req.body);
  
  const { nonce } = req.body;
  console.log('Nonce from request:', nonce);
  console.log('Current pending requests:', Array.from(pendingSSORequests.entries()));

  if (!nonce) {
    console.log('Missing nonce in request');
    return res.status(400).json({ error: 'Missing nonce' });
  }

  const ssoRequest = pendingSSORequests.get(nonce);
  if (!ssoRequest) {
    console.log('Invalid or expired nonce:', nonce);
    return res.status(400).json({ error: 'Invalid or expired nonce' });
  }

  // Check if nonce is too old (10 minutes)
  const nonceAge = Date.now() - ssoRequest.timestamp;
  if (nonceAge > 10 * 60 * 1000) {
    console.log('Nonce too old:', nonce, 'age:', nonceAge);
    pendingSSORequests.delete(nonce);
    return res.status(400).json({ error: 'Nonce expired' });
  }

  // Check if this nonce has already been used
  if (ssoRequest.used) {
    console.log('Nonce already used:', nonce);
    return res.status(400).json({ error: 'Nonce already used' });
  }

  console.log('Found valid SSO request:', ssoRequest);

  // Mark the nonce as used immediately to prevent race conditions
  ssoRequest.used = true;
  pendingSSORequests.set(nonce, ssoRequest);

  try {
    // Create the response payload according to Discourse requirements
    const params = new URLSearchParams();

    // Generate random identifier
    const identifier = crypto.randomBytes(16).toString('hex');
    
    // Required fields
    params.append('nonce', nonce);
    params.append('email', identifier + '@example.com');
    params.append('external_id', identifier);
    
    // Additional fields
    params.append('username', identifier);
    params.append('name', 'Satoshi Nakamoto');
    
    // Security: Force email validation
    params.append('require_activation', 'false');
    
    // Optional: Suppress welcome message
    params.append('suppress_welcome_message', 'true');

    // Create the payload
    const payload = params.toString();
    console.log('Created raw payload:', payload);
    
    // Base64 encode the payload
    const base64Payload = Buffer.from(payload).toString('base64');
    console.log('Base64 encoded payload:', base64Payload);
    
    // Sign the payload
    const hmac = crypto.createHmac('sha256', config.discourseConnectSecret);
    hmac.update(base64Payload);
    const signature = hmac.digest('hex');
    console.log('Generated signature:', signature);
    console.log('Using secret key:', config.discourseConnectSecret);

    // Create the final URL
    const redirectUrl = `${ssoRequest.return_sso_url}?sso=${encodeURIComponent(base64Payload)}&sig=${signature}`;
    console.log('Final redirect URL:', redirectUrl);
    
    // Clean up the nonce after a longer delay to ensure redirect completes
    setTimeout(() => {
      pendingSSORequests.delete(nonce);
      console.log('Cleaned up used nonce:', nonce);
    }, 100000);
    
    // Send the redirect URL
    res.json({ redirectUrl });
  } catch (error) {
    console.error('Error completing SSO:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 