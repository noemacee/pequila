import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Container } from '@mui/material';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import ProofCreator from './pages/ProofCreator';
import { GoogleOAuthProvider } from '@react-oauth/google';

function App() {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <Container maxWidth={false} disableGutters sx={{ mt: 8 }}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/create-proof" element={<ProofCreator />} />
        </Routes>
      </Container>
    </GoogleOAuthProvider>
  );
}

export default App; 