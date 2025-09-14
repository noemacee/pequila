import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Container } from '@mui/material';
import Login from './pages/Login';
import ProofCreator from './pages/ProofCreator';

function App() {
  return (
    <Container maxWidth={false} disableGutters sx={{ mt: 8 }}>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/create-proof" element={<ProofCreator />} />
      </Routes>
    </Container>
  );
}

export default App; 