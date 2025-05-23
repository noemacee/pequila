import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Container } from '@mui/material';

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('[CLIENT] Auth callback - Processing OAuth response...');
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const idToken = params.get('id_token');
        const accessToken = params.get('access_token');
        
        console.log('[CLIENT] Auth callback - Retrieved tokens:', {
          hasIdToken: !!idToken,
          hasAccessToken: !!accessToken
        });

        if (!idToken) {
          console.error('[CLIENT] Auth callback - No ID token found in response');
          setError('No ID token received from Google');
          return;
        }

        // Decode the ID token to get user info
        const tokenParts = idToken.split('.');
        const payload = JSON.parse(atob(tokenParts[1]));
        
        console.log('[CLIENT] Auth callback - Decoded user info:', {
          email: payload.email,
          name: payload.name,
          picture: payload.picture
        });

        // Store the tokens
        localStorage.setItem('id_token', idToken);
        if (accessToken) {
          localStorage.setItem('access_token', accessToken);
        }

        // Check if we have a nonce from SSO
        const nonce = localStorage.getItem('discourse_nonce');
        console.log('[CLIENT] Auth callback - Retrieved SSO nonce:', nonce);

        if (nonce) {
          console.log('[CLIENT] Auth callback - Redirecting to proof creation...');
          navigate(`/create-proof?nonce=${nonce}`);
        } else {
          console.log('[CLIENT] Auth callback - No SSO nonce found, redirecting to home...');
          navigate('/');
        }
      } catch (error) {
        console.error('[CLIENT] Auth callback - Error processing OAuth response:', error);
        setError('Error processing authentication response');
      }
    };

    handleCallback();
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
        {error && <p>{error}</p>}
        <CircularProgress />
      </Box>
    </Container>
  );
}

export default AuthCallback; 