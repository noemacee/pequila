import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import proofConfig from '../config/proofConfig.json';
import { proofService } from '../services/proofService';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';

function ProofCreator() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nonce = localStorage.getItem('discourse_nonce');
  const [hasRedirected, setHasRedirected] = useState(false);
  console.log('[CLIENT] ProofCreator - Current URL:', window.location.href);
  console.log('[CLIENT] ProofCreator - Retrieved nonce from localStorage:', nonce);
  console.log('[CLIENT] ProofCreator - All URL parameters:', Object.fromEntries(searchParams.entries()));
  
  const jwt = localStorage.getItem('idToken');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('initializing');
  const [userEmail, setUserEmail] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [discourseReturnUrl, setDiscourseReturnUrl] = useState(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        console.log('[CLIENT] Initializing circuit...');
        await proofService.initializeCircuit();
        console.log('[CLIENT] ✓ Circuit initialized successfully');
        setStatus('ready');
      } catch (err) {
        console.error('[CLIENT] ❌ Error initializing circuit:', err);
        setError(err.message);
        setStatus('error');
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    const processProof = async () => {
      if (status !== 'ready' || !jwt || hasRedirected) return;

      try {
        console.log('[CLIENT] Starting proof generation process...');
        setStatus('generating');
        
        console.log('[CLIENT] Fetching Google public key...');
        const pubkey = await proofService.fetchGooglePubkey(jwt);
        console.log('[CLIENT] ✓ Google public key fetched');
        
        const email = proofService.getUserEmail(jwt);
        setUserEmail(email);
        console.log('[CLIENT] User email:', email);

        console.log('[CLIENT] Generating ZK proof...');
        const { proofVerify, publicInputs } = await proofService.generateProof(
          jwt,
          pubkey,
          proofConfig.merkle_root,
          proofConfig.proof_siblings,
          proofConfig.proof_index
        );
        console.log('[CLIENT] ✓ ZK proof generated successfully');
        console.log('[CLIENT] Generated proof:', {
          proofLength: proofVerify.length,
          proofData: proofVerify,
          publicInputs: publicInputs
        });

        console.log('[CLIENT] Verifying proof with server...');
        setStatus('verifying');
        const result = await proofService.verifyProof(proofVerify, publicInputs);
        console.log('[CLIENT] Server verification response:', result);
        setVerificationResult(result);
        setStatus('complete');
        console.log('[CLIENT] ✓ Proof verification result:', result);

        if (result.isValid) {
          if (nonce) {
            try {
              console.log('[CLIENT] Starting SSO process with nonce:', nonce);
              // Check if nonce is valid and get return URL
              const { data: ssoCheck } = await axios.get(`/api/discourse/check-nonce?nonce=${nonce}`);
              console.log('[CLIENT] SSO check response:', ssoCheck);
              
              if (ssoCheck.valid) {
                console.log('[CLIENT] Nonce is valid, completing SSO...');
                setDiscourseReturnUrl(ssoCheck.returnUrl);
                // Complete SSO
                const { data: ssoResponse } = await axios.post('/api/discourse/complete-sso', {
                  nonce
                });
                console.log('[CLIENT] SSO completion response:', ssoResponse);
                
                if (ssoResponse.redirectUrl) {
                  console.log('[CLIENT] ✓ SSO process complete, redirecting to Discourse...');
                  // Set redirect flag before redirecting
                  setHasRedirected(true);
                  // Clear the nonce from localStorage
                  localStorage.removeItem('discourse_nonce');
                  // Redirect to Discourse
                  window.location.href = ssoResponse.redirectUrl;
                  return;
                } else {
                  throw new Error('No redirect URL in SSO response');
                }
              } else {
                throw new Error('Invalid or expired nonce');
              }
            } catch (err) {
              console.error('[CLIENT] ❌ Error handling Discourse SSO:', err);
              setError(err.response?.data?.error || err.message || 'Failed to complete SSO process');
              setStatus('error');
            }
          } else {
            console.error('[CLIENT] ❌ No SSO nonce found');
            setError('No SSO nonce found');
            setStatus('error');
          }
        }
      } catch (err) {
        console.error('[CLIENT] ❌ Error in proof process:', err);
        setError(err.message);
        setStatus('error');
      }
    };

    processProof();
  }, [status, jwt, nonce, hasRedirected]);

  const getStatusMessage = () => {
    switch (status) {
      case 'initializing':
        return 'Initializing proof system...';
      case 'ready':
        return 'Ready to generate proof...';
      case 'generating':
        return 'Generating proof for your JWT...';
      case 'verifying':
        return 'Verifying proof with the server...';
      case 'complete':
        return discourseReturnUrl 
          ? 'Proof verified! Redirecting to Discourse...'
          : 'Proof process completed! Redirecting...';
      case 'error':
        return 'An error occurred during the process.';
      default:
        return '';
    }
  };

  return (
    <Box
      sx={{
        height: '100vh',
        width: '100vw',
        margin: 0,
        padding: 0,
        position: 'fixed',
        top: 0,
        left: 0,
        background: 'radial-gradient(circle at center, #2C3333 0%, #3a4242 50%, #4d5757 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          maxWidth: '600px',
          width: '100%',
          textAlign: 'center',
          p: 3,
        }}
      >
        <Box
          component="img"
          src="/logo/logo.svg"
          alt="ZuitzAnon Logo"
          sx={{
            width: '100px',
            height: '100px',
            filter: 'drop-shadow(0 0 20px rgba(255, 255, 255, 0.1))',
            position: 'absolute',
            top: '20px',
            right: '20px',
          }}
        />

        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#fff',
            textShadow: '0 2px 10px rgba(0,0,0,0.2)',
          }}
        >
          Creating ZuitzAnon Proof
        </Typography>

        {userEmail && (
          <Typography
            variant="subtitle1"
            sx={{
              opacity: 0.8,
              maxWidth: '400px',
              lineHeight: 1.6,
              fontWeight: 400,
            }}
          >
            Generating proof for account: {userEmail}
          </Typography>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
          {(status === 'generating' || status === 'verifying') && (
            <CircularProgress size={24} sx={{ color: 'white' }} />
          )}
          <Typography variant="subtitle1">
            {getStatusMessage()}
          </Typography>
        </Box>

        {error && (
          <Typography
            sx={{
              color: '#ff6b6b',
              mt: 2,
              p: 2,
              borderRadius: 1,
              backgroundColor: 'rgba(255, 107, 107, 0.1)',
            }}
          >
            {error}
          </Typography>
        )}

        {verificationResult && (
          <Typography
            sx={{
              color: verificationResult.isValid ? '#4caf50' : '#ff6b6b',
              mt: 2,
              p: 2,
              borderRadius: 1,
              backgroundColor: verificationResult.isValid 
                ? 'rgba(76, 175, 80, 0.1)' 
                : 'rgba(255, 107, 107, 0.1)',
            }}
          >
            {verificationResult.message}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export default ProofCreator;