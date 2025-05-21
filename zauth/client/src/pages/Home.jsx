import React from 'react';
import { Box, Button, Container, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

function Home() {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'radial-gradient(circle at center, #2C3333 0%, #3a4242 50%, #4d5757 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Container 
        maxWidth="sm"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            transform: 'scale(1.1)',
          }}
        >
          <Box
            component="img"
            src="/logo/logo.svg"
            alt="Zauth Logo"
            sx={{
              width: '180px',
              height: '180px',
              filter: 'drop-shadow(0 0 30px rgba(255, 255, 255, 0.1))',
              marginBottom: 2,
            }}
          />
          
          <Typography
            variant="h2"
            component="h1"
            sx={{
              fontWeight: 700,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#fff',
              textShadow: '0 2px 10px rgba(0,0,0,0.2)',
              fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' },
            }}
          >
            Zauth
          </Typography>
          
          <Typography
            variant="h6"
            sx={{
              textAlign: 'center',
              opacity: 0.8,
              maxWidth: '500px',
              lineHeight: 1.6,
              fontSize: { xs: '1rem', sm: '1.1rem', md: '1.25rem' },
            }}
          >
            Secure, privacy-preserving authentication powered by zero-knowledge proofs
          </Typography>

          <Button
            variant="outlined"
            size="large"
            onClick={() => navigate('/login')}
            sx={{
              color: 'white',
              borderColor: 'white',
              fontSize: '1.1rem',
              padding: '12px 40px',
              borderRadius: '50px',
              textTransform: 'none',
              borderWidth: '2px',
              marginTop: 2,
              '&:hover': {
                borderColor: 'white',
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderWidth: '2px',
              },
              transition: 'all 0.3s ease',
            }}
          >
            Authenticate
          </Button>
        </Box>
      </Container>
    </Box>
  );
}

export default Home; 