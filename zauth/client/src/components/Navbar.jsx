import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';
import { verifyIdToken } from '../utils/auth';

function Navbar({ isAuthenticated, setIsAuthenticated }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('idToken');
    setIsAuthenticated(false);
    navigate('/login', { replace: true });
  };

  return (
    <AppBar 
      position="fixed" 
      sx={{ 
        backgroundColor: 'rgba(44, 51, 51, 0.8)',
        backdropFilter: 'blur(8px)',
        boxShadow: 'none',
        borderBottom: '1px solid rgba(203, 228, 222, 0.1)'
      }}
    >
      <Toolbar>
        <Typography 
          variant="h6" 
          component={Link} 
          to="/" 
          sx={{ 
            flexGrow: 1, 
            color: '#CBE4DE', 
            textDecoration: 'none',
            fontWeight: 600,
            letterSpacing: '0.5px',
            background: 'linear-gradient(to right, #CBE4DE, #0E8388)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Zauth
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {isAuthenticated ? (
            <>
              <Button 
                color="inherit" 
                component={Link} 
                to="/jwt"
                sx={{ 
                  color: '#CBE4DE',
                  '&:hover': { 
                    backgroundColor: 'rgba(14, 131, 136, 0.2)' 
                  }
                }}
              >
                JWT
              </Button>
              <Button 
                color="inherit" 
                component={Link} 
                to="/verify"
                sx={{ 
                  color: '#CBE4DE',
                  '&:hover': { 
                    backgroundColor: 'rgba(14, 131, 136, 0.2)' 
                  }
                }}
              >
                Verify
              </Button>
              <Button 
                color="inherit" 
                component={Link} 
                to="/create-proof"
                sx={{ 
                  color: '#CBE4DE',
                  '&:hover': { 
                    backgroundColor: 'rgba(14, 131, 136, 0.2)' 
                  }
                }}
              >
                Create Proof
              </Button>
              <Button 
                color="inherit" 
                component={Link} 
                to="/apps"
                sx={{ 
                  color: '#CBE4DE',
                  '&:hover': { 
                    backgroundColor: 'rgba(14, 131, 136, 0.2)' 
                  }
                }}
              >
                Apps
              </Button>
              <Button 
                color="inherit" 
                onClick={handleLogout}
                sx={{ 
                  color: '#CBE4DE',
                  '&:hover': { 
                    backgroundColor: 'rgba(14, 131, 136, 0.2)' 
                  }
                }}
              >
                Logout
              </Button>
            </>
          ) : (
            <Button 
              variant="contained"
              component={Link} 
              to="/login"
              sx={{ 
                backgroundColor: '#0E8388',
                color: '#CBE4DE',
                '&:hover': { 
                  backgroundColor: '#2E4F4F'
                }
              }}
            >
              Login
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default Navbar; 