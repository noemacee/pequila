import React, { useEffect, useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';

function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasStoredNonce, setHasStoredNonce] = useState(false);

  useEffect(() => {
    const nonce = searchParams.get('nonce');
    
    // Only process if we have a nonce and haven't stored it yet
    if (nonce && !isProcessing && !hasStoredNonce) {
      console.log('[CLIENT] Processing SSO request with nonce:', nonce);
      
      // Check if nonce is already stored
      const existingNonce = localStorage.getItem('discourse_nonce');
      if (existingNonce === nonce) {
        console.log('[CLIENT] Nonce already stored:', nonce);
        setHasStoredNonce(true);
        return;
      }

      // Store the new nonce
      localStorage.setItem('discourse_nonce', nonce);
      const storedNonce = localStorage.getItem('discourse_nonce');
      
      if (storedNonce === nonce) {
        console.log('[CLIENT] ✓ Nonce stored successfully:', nonce);
        setHasStoredNonce(true);
      } else {
        console.error('[CLIENT] ❌ Failed to store nonce');
      }
      
      setIsProcessing(true);
    }
  }, [searchParams, isProcessing, hasStoredNonce]);

  const handleGoogleLogin = () => {
    console.log('[CLIENT] Initiating Google login...');
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const redirectUri = import.meta.env.VITE_REDIRECT_URI;
    const scope = 'openid email profile';
    const nonce = Math.random().toString(36).substring(2);
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=id_token token&` +
      `scope=${encodeURIComponent(scope)}&` +
      `nonce=${nonce}&` +
      `prompt=select_account`;

    console.log('[CLIENT] Redirecting to Google OAuth...');
    window.location.href = authUrl;
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
          ZuitzAnon Login
        </Typography>

        <Button
          variant="contained"
          onClick={handleGoogleLogin}
          sx={{
            backgroundColor: '#fff',
            color: '#2C3333',
            '&:hover': {
              backgroundColor: '#f0f0f0',
            },
          }}
        >
          Login with Google
        </Button>
      </Box>
    </Box>
  );
}

export default Login; 