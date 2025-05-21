import React, { useState, useEffect } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

function Login() {
  const [nonce] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Load Google Identity Services Script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleGoogleLogin = async () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const redirectUri = import.meta.env.VITE_REDIRECT_URI;

    console.log('clientId:', import.meta.env.VITE_GOOGLE_CLIENT_ID);
    console.log('redirectUri:', import.meta.env.VITE_REDIRECT_URI);
    const scope = 'openid email profile';
    const finalNonce = nonce.trim() !== '' ? nonce : Math.random().toString(36).substring(2);
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=id_token token&` +
      `scope=${encodeURIComponent(scope)}&` +
      `nonce=${finalNonce}&` +
      `prompt=select_account`;

    window.location.href = authUrl;
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
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
          maxWidth: '400px',
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
            width: '120px',
            height: '120px',
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
          Welcome to Zauth
        </Typography>

        <Typography
          variant="subtitle1"
          sx={{
            opacity: 0.8,
            maxWidth: '400px',
            lineHeight: 1.6,
            fontWeight: 400,
          }}
        >
          Sign in with your Google account to create your Zauth proof
        </Typography>

        <Button
          variant="contained"
          onClick={handleGoogleLogin}
          sx={{
            backgroundColor: '#0E8388',
            color: '#CBE4DE',
            padding: '12px 40px',
            fontSize: '1.1rem',
            borderRadius: '50px',
            textTransform: 'none',
            '&:hover': {
              backgroundColor: '#2E4F4F',
            },
            transition: 'all 0.3s ease',
          }}
        >
          Sign in with Google
        </Button>
      </Box>
    </Box>
  );
}

export default Login; 