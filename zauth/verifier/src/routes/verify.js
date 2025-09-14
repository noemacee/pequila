const express = require('express');
const router = express.Router();
const circuitManager = require('../circuit');
const { sessionManager } = require('../session');

router.post('/verify-zkemail-proof', async (req, res) => {
  try {
    console.log('\n=== [SERVER] zkEmail Proof Verification Request ===');
    console.log('[SERVER] Received zkEmail proof verification request');

    const { proofVerify, publicInputs } = req.body;

    if (!proofVerify || !publicInputs) {
      console.error('[SERVER] ❌ Missing required fields:', {
        hasProof: !!proofVerify,
        hasPublicInputs: !!publicInputs
      });
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: proof and publicInputs'
      });
    }

    console.log('[SERVER] ✓ zkEmail proof and public inputs received');
    console.log('[SERVER] Public inputs:', publicInputs);
    console.log('[SERVER] Proof data:', {
      proofLength: proofVerify.length,
      proofData: proofVerify
    });

    // Ensure proof is an array
    const proofArray = Array.isArray(proofVerify) ? proofVerify : JSON.parse(proofVerify);
    const publicInputsArray = Array.isArray(publicInputs) ? publicInputs : JSON.parse(publicInputs);

    console.log('[SERVER] Starting zkEmail proof verification...');
    console.log('[SERVER] Parsed proof:', {
      proofLength: proofArray.length,
      proofData: proofArray
    });
    console.log('[SERVER] Parsed public inputs:', publicInputsArray);
    
    const verified = await circuitManager.verifyProof(proofArray, publicInputsArray);
    
    if (!verified) {
      console.error('[SERVER] ❌ zkEmail proof verification failed');
      return res.status(400).json({
        error: 'Verification failed',
        message: 'Invalid zkEmail proof'
      });
    }

    console.log('[SERVER] ✓ zkEmail proof verified successfully!');
    console.log('[SERVER] Creating session...');

    // Create a new session after successful verification
    const session = sessionManager.createSession({
      verifiedAt: Date.now(),
      verificationMethod: 'zkemail',
      // Add any other user data you want to store in the session
    });

    console.log('[SERVER] ✓ Session created successfully');
    console.log('[SERVER] Session details:', {
      token: session.sessionToken,
      expiresAt: new Date(session.expiresAt).toISOString()
    });

    res.status(200).json({
      message: 'zkEmail proof verified successfully!',
      verified: true,
      session: {
        token: session.sessionToken,
        expiresAt: session.expiresAt
      }
    });

  } catch (err) {
    console.error('[SERVER] ❌ Error during zkEmail proof verification:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: err.message,
      details: err.stack
    });
  }
});

module.exports = router; 