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
  console.log('ProofCreator - Current URL:', window.location.href);
  console.log('ProofCreator - Retrieved nonce from localStorage:', nonce);
  console.log('ProofCreator - All URL parameters:', Object.fromEntries(searchParams.entries()));
  
  const jwt = localStorage.getItem('idToken');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('initializing');
  const [userEmail, setUserEmail] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [discourseReturnUrl, setDiscourseReturnUrl] = useState(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        await proofService.initializeCircuit();
        setStatus('ready');
      } catch (err) {
        setError(err.message);
        setStatus('error');
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    const processProof = async () => {
      if (status !== 'ready' || !jwt) return;

      try {
        setStatus('generating');
        const pubkey = await proofService.fetchGooglePubkey(jwt);
        setUserEmail(proofService.getUserEmail(jwt));

        const { proofVerify, publicInputs } = await proofService.generateProof(
          jwt,
          pubkey,
          proofConfig.merkle_root,
          proofConfig.proof_siblings,
          proofConfig.proof_index
        );

        setStatus('verifying');
        const result = await proofService.verifyProof(proofVerify, publicInputs);
        setVerificationResult(result);
        setStatus('complete');

        console.log(result);
        console.log("nonce: " + nonce);
        
        
        if (result.isValid) {

          if (nonce) {
            try {
              // Check if nonce is valid and get return URL
              const { data: ssoCheck } = await axios.get(`/api/discourse/check-nonce?nonce=${nonce}`);
              if (ssoCheck.valid) {
                setDiscourseReturnUrl(ssoCheck.returnUrl);
                // Complete SSO
                const { data: ssoResponse } = await axios.post('/api/discourse/complete-sso', {
                  nonce
                });
                
                // Redirect to Discourse
                window.location.href = ssoResponse.redirectUrl;
                return;
              }
            } catch (err) {
              console.error('Error handling Discourse SSO:', err);
              // Fall through to normal redirect if SSO fails
            }
          }

          // Wait 10 seconds and then redirect to the login page
          setTimeout(() => {
            window.location.href = '/';
          }, 10000);

        }
      } catch (err) {
        setError(err.message);
        setStatus('error');
      }
    };

    processProof();
  }, [status, jwt, navigate, nonce]);

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
          alt="Zauth Logo"
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
          Creating Zauth Proof
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