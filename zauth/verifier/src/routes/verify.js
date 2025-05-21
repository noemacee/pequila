const express = require('express');
const router = express.Router();
const circuitManager = require('../circuit');
const { sessionManager } = require('../session');

router.post('/verify-jwt-proof', async (req, res) => {
  try {
    console.log('Received request body:', JSON.stringify(req.body, null, 2));

    const { proofVerify, publicInputs } = req.body;

    if (!proofVerify || !publicInputs) {
      console.error('Missing required fields:', {
        hasProof: !!proofVerify,
        hasPublicInputs: !!publicInputs,
        body: req.body
      });
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Missing required fields: proof and publicInputs'
      });
    }

    // Ensure proof is an array
    const proofArray = Array.isArray(proofVerify) ? proofVerify : JSON.parse(proofVerify);
    const publicInputsArray = Array.isArray(publicInputs) ? publicInputs : JSON.parse(publicInputs);

    const verified = await circuitManager.verifyProof(proofArray, publicInputsArray);
    
    if (!verified) {
      console.error('Proof verification failed');
      return res.status(400).json({
        error: 'Verification failed',
        message: 'Invalid ZK proof'
      });
    }

    // Create a new session after successful verification
    const session = sessionManager.createSession({
      verifiedAt: Date.now(),
      // Add any other user data you want to store in the session
    });

    console.log('Created session:', session);

    res.status(200).json({
      message: 'Zauth proof verified successfully!',
      verified: true,
      session: {
        token: session.sessionToken,
        expiresAt: session.expiresAt
      }
    });

  } catch (err) {
    console.error('Error during proof verification:', err);
    return res.status(500).json({
      error: 'Internal server error',
      message: err.message,
      details: err.stack
    });
  }
});

module.exports = router; 