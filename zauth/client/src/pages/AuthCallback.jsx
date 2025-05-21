import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Container } from '@mui/material';

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const processCallback = async () => {
      try {
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const idToken = params.get('id_token');

        if (!idToken) {
          throw new Error('No ID token found');
        }

        localStorage.setItem('idToken', idToken);
        navigate('/create-proof', { replace: true });
      } catch (error) {
        console.error('Error in auth callback:', error);
        navigate('/', { replace: true });
      }
    };

    processCallback();
  }, [navigate]);

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