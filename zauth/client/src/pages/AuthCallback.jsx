import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Container } from '@mui/material';
import { handleGoogleCallback } from '../utils/auth';

function AuthCallback({ setIsAuthenticated }) {
  const navigate = useNavigate();

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Get the ID token from the URL hash
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const idToken = params.get('id_token');

        if (!idToken) {
          throw new Error('No ID token found');
        }

        // Handle the Google callback and wait for it to complete
        await handleGoogleCallback(idToken);
        setIsAuthenticated(true);
        navigate('/create-proof', { replace: true });
      } catch (error) {
        console.error('Error in auth callback:', error);
        setIsAuthenticated(false);
        navigate('/login', { replace: true });
      }
    };

    // Execute immediately
    processCallback();
  }, [navigate, setIsAuthenticated]);

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <CircularProgress />
      </Box>
    </Container>
  );
}

export default AuthCallback; 