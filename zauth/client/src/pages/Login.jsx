import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, TextField, Paper, Alert } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import EmailIcon from '@mui/icons-material/Email';

function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasStoredNonce, setHasStoredNonce] = useState(false);
  const [emailContent, setEmailContent] = useState('');
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);

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

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFile = (file) => {
    if (file.type !== 'message/rfc822' && !file.name.endsWith('.eml')) {
      setError('Please upload a valid email file (.eml format)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setEmailContent(e.target.result);
      setError('');
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleEmailSubmit = () => {
    if (!emailContent) {
      setError('Please provide email content');
      return;
    }

    console.log('[CLIENT] Processing email for zkEmail verification...');
    
    // Store email content
    localStorage.setItem('email_content', emailContent);
    
    // Check if we have a nonce from SSO
    const nonce = localStorage.getItem('discourse_nonce');
    
    if (nonce) {
      console.log('[CLIENT] Redirecting to proof creation with SSO nonce...');
      navigate(`/create-proof?nonce=${nonce}`);
    } else {
      console.log('[CLIENT] Redirecting to proof creation...');
      navigate('/create-proof');
    }
  };

  const handlePasteEmail = () => {
    navigator.clipboard.readText().then(text => {
      setEmailContent(text);
      setError('');
    }).catch(() => {
      setError('Failed to read from clipboard');
    });
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
          ZuitzAnon zkEmail Login
        </Typography>

        <Typography variant="body1" sx={{ color: '#ccc', mb: 2 }}>
          Upload or paste your email (.eml file) to generate a zero-knowledge proof
        </Typography>

        {error && (
          <Alert severity="error" sx={{ width: '100%', mb: 2 }}>
            {error}
          </Alert>
        )}

        <Paper
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          sx={{
            p: 4,
            border: dragActive ? '2px dashed #4CAF50' : '2px dashed #666',
            borderRadius: 2,
            backgroundColor: dragActive ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 255, 255, 0.05)',
            width: '100%',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          <input
            type="file"
            id="email-upload"
            style={{ display: 'none' }}
            accept=".eml,message/rfc822"
            onChange={handleFileInput}
          />
          <label htmlFor="email-upload" style={{ cursor: 'pointer' }}>
            <CloudUploadIcon sx={{ fontSize: 48, color: '#999', mb: 2 }} />
            <Typography variant="h6" sx={{ color: '#fff', mb: 1 }}>
              {emailContent ? 'Email loaded' : 'Drag & Drop your email file here'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#999' }}>
              or click to browse (.eml format)
            </Typography>
          </label>
        </Paper>

        <TextField
          multiline
          rows={4}
          fullWidth
          placeholder="Or paste your raw email content here..."
          value={emailContent}
          onChange={(e) => setEmailContent(e.target.value)}
          sx={{
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            '& .MuiInputBase-input': {
              color: '#fff',
            },
            '& .MuiOutlinedInput-root': {
              '& fieldset': {
                borderColor: '#666',
              },
              '&:hover fieldset': {
                borderColor: '#999',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#4CAF50',
              },
            },
          }}
        />

        <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
          <Button
            variant="outlined"
            onClick={handlePasteEmail}
            sx={{
              flex: 1,
              borderColor: '#666',
              color: '#fff',
              '&:hover': {
                borderColor: '#999',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              },
            }}
          >
            Paste from Clipboard
          </Button>
          <Button
            variant="contained"
            onClick={handleEmailSubmit}
            disabled={!emailContent}
            startIcon={<EmailIcon />}
            sx={{
              flex: 1,
              backgroundColor: '#4CAF50',
              color: '#fff',
              '&:hover': {
                backgroundColor: '#45a049',
              },
              '&:disabled': {
                backgroundColor: '#333',
                color: '#666',
              },
            }}
          >
            Verify Email
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

export default Login; 