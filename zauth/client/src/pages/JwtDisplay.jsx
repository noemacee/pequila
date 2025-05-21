import React from 'react';
import { Box, Typography, Button, Avatar, Tooltip, IconButton } from '@mui/material';
import { jwtDecode } from 'jwt-decode';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import CheckIcon from '@mui/icons-material/Check';

function JwtDisplay() {
  const [copied, setCopied] = React.useState(false);
  const idToken = localStorage.getItem('idToken');
  let decoded = null;
  let error = null;

  if (idToken) {
    try {
      decoded = jwtDecode(idToken);
    } catch (e) {
      error = 'Invalid ID token';
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(idToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([idToken], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jwt-token.txt';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <Box
      sx={{
        minHeight: 'calc(100vh - 64px)',
        background: 'radial-gradient(circle at center, #2C3333 0%, #3a4242 50%, #4d5757 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        p: 3,
      }}
    >
      <Box
        sx={{
          maxWidth: '800px',
          width: '100%',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '20px',
          backdropFilter: 'blur(10px)',
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        {error && (
          <Typography color="error">{error}</Typography>
        )}
        
        {decoded && (
          <>
            {/* User Info Section */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 2 }}>
              <Avatar 
                src={decoded.picture} 
                sx={{ 
                  width: 80, 
                  height: 80,
                  border: '3px solid rgba(255, 255, 255, 0.2)',
                }}
              />
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
                  {decoded.name}
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.8 }}>
                  {decoded.email}
                </Typography>
              </Box>
            </Box>

            <Box sx={{ 
              display: 'flex', 
              gap: 2, 
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.03)',
              p: 2,
              borderRadius: '10px',
              mb: 3
            }}>
              <Box 
                component="img"
                src="/logo/logo.svg"
                sx={{ 
                  width: 24, 
                  height: 24,
                  filter: 'brightness(0) invert(1)',
                  opacity: 0.8
                }}
              />
              <Typography sx={{ opacity: 0.8 }}>
                Authenticated with Zauth
              </Typography>
            </Box>

            {/* JWT Token Section */}
            <Typography variant="h6" sx={{ mb: 2, opacity: 0.9 }}>
              Your JWT Token
            </Typography>
            
            <Box sx={{ 
              position: 'relative',
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '10px',
              p: 2,
            }}>
              <Box
                component="pre"
                sx={{
                  overflowX: 'auto',
                  fontSize: '0.875rem',
                  opacity: 0.8,
                  fontFamily: 'monospace',
                  m: 0,
                }}
              >
                {idToken}
              </Box>
              <Box sx={{ 
                position: 'absolute', 
                top: 8, 
                right: 8,
                display: 'flex',
                gap: 1
              }}>
                <Tooltip title={copied ? "Copied!" : "Copy to clipboard"}>
                  <IconButton 
                    size="small" 
                    onClick={handleCopy}
                    sx={{ 
                      color: 'white',
                      opacity: 0.7,
                      '&:hover': { opacity: 1 }
                    }}
                  >
                    {copied ? <CheckIcon /> : <ContentCopyIcon />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Download JWT">
                  <IconButton 
                    size="small" 
                    onClick={handleDownload}
                    sx={{ 
                      color: 'white',
                      opacity: 0.7,
                      '&:hover': { opacity: 1 }
                    }}
                  >
                    <DownloadIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* Decoded Token Section */}
            <Typography variant="h6" sx={{ mt: 3, mb: 2, opacity: 0.9 }}>
              Decoded Token
            </Typography>
            <Box
              sx={{
                background: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '10px',
                p: 2,
              }}
            >
              <pre style={{ 
                overflowX: 'auto',
                margin: 0,
                fontSize: '0.875rem',
                opacity: 0.8,
                fontFamily: 'monospace'
              }}>
                {JSON.stringify(decoded, null, 2)}
              </pre>
            </Box>
          </>
        )}

        {!idToken && !error && (
          <Typography sx={{ opacity: 0.7 }}>No ID token found.</Typography>
        )}
      </Box>
    </Box>
  );
}

export default JwtDisplay; 