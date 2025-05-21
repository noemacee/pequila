import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { UltraHonkBackend } from '@aztec/bb.js';
import { Noir } from '@noir-lang/noir_js';
import { generateInputs } from '../utils/jwtProof';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import proofConfig from '../config/proofConfig.json';
import { sessionManager } from '../utils/session';

let noir = null;
let backend = null;

function ProofCreator() {
  const navigate = useNavigate();
  const jwt = localStorage.getItem('idToken');
  const [inputs, setInputs] = useState({
    merkle_root: proofConfig.merkle_root,
    proof_siblings: JSON.stringify(proofConfig.proof_siblings),
    proof_index: proofConfig.proof_index,
  });
  const [proofVerify, setProofVerify] = useState(null);
  const [publicInputs, setPublicInputs] = useState(null);
  const [error, setError] = useState('');
  const [circuitLoaded, setCircuitLoaded] = useState(false);
  const [pubkey, setPubkey] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [status, setStatus] = useState('initializing');
  const [userEmail, setUserEmail] = useState('');

  // Load circuit on mount
  useEffect(() => {
    const loadCircuit = async () => {
      try {
        const response = await fetch('/zuitzpass.json');
        const circuit = await response.json();
        
        // Initialize Noir and backend
        noir = new Noir(circuit);
        backend = new UltraHonkBackend(circuit.bytecode);
        
        setCircuitLoaded(true);
        console.log('Circuit loaded successfully');
        console.log(backend)
        
        setStatus('ready');
      } catch (err) {
        console.error('Error loading circuit:', err);
        setError('Error loading circuit: ' + err.message);
        setStatus('error');
      }
    };

    loadCircuit();
  }, []);

  // Fetch Google JWK for the JWT's kid
  useEffect(() => {
    if (!jwt) return;
    
    const fetchPubkey = async () => {
      try {
        const header = JSON.parse(atob(jwt.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')));
        const response = await fetch('https://www.googleapis.com/oauth2/v3/certs');

        console.log('Fetching Google public key...')
        
        const jwks = await response.json();
        const key = jwks.keys.find(k => k.kid === header.kid);
        if (!key) throw new Error('Google public key not found for JWT');
        setPubkey(key);
        console.log(key)
        
        // Set user email from JWT
        const decoded = jwtDecode(jwt);

        console.log('JWT decoded:', decoded)
        setUserEmail(decoded.email);
      } catch (err) {
        console.error('Error fetching Google public key:', err);
        setError('Error fetching Google public key: ' + err.message);
        setStatus('error');
      }
    };

    fetchPubkey();
  }, [jwt]);

  // Auto-generate and verify proof when everything is ready
  useEffect(() => {
    if (status === 'ready' && circuitLoaded && pubkey && jwt) {
      handleGenerateProof();
    }
  }, [status, circuitLoaded, pubkey, jwt]);

  // Handle successful verification and redirect
  useEffect(() => {
    if (verificationResult?.isValid) {
      const timer = setTimeout(() => {
        navigate('/apps', { replace: true });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [verificationResult, navigate]);

  const handleChange = (e) => {
    setInputs({ ...inputs, [e.target.name]: e.target.value });
  };

  const handleGenerateProof = async () => {
    setError('');
    setProofVerify(null);
    setPublicInputs(null);
    setVerificationResult(null);
    setIsGenerating(true);
    setStatus('generating');

    try {
      if (!noir || !backend) {
        throw new Error('Circuit not loaded yet. Please wait.');
      }
      if (!pubkey) {
        throw new Error('Google public key not loaded yet.');
      }
      if (!jwt) {
        throw new Error('No JWT found in localStorage.');
      }

      const maxSignedDataLength = 910;

      const circuitInputs = await generateInputs({
        jwt,
        pubkey,
        maxSignedDataLength,
        merkle_root: inputs.merkle_root,
        proof_siblings: JSON.parse(inputs.proof_siblings),
        proof_index: Number(inputs.proof_index),
      });
      console.log('Inputs generated')
      console.log(circuitInputs)

      const { witness } = await noir.execute(circuitInputs);
      console.log('Witness generated');
      console.log(witness)

      const proof = await backend.generateProof(witness);
      console.log('Proof generated');
      console.log(proof)
      const proofVerify = proof.proof
      const publicInputs = proof.publicInputs

      setProofVerify(proofVerify);
      setPublicInputs(publicInputs);
      setStatus('verifying');

      
      // Automatically verify the proof
      await handleVerifyProof(proofVerify, publicInputs);

    } catch (err) {
      console.error('Proof generation failed:', err);
      setError('Proof generation failed: ' + err.message);
      setStatus('error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVerifyProof = async (proofToVerify = proofVerify, inputsToVerify = publicInputs) => {
    setError('');
    setVerificationResult(null);
    setIsVerifying(true);

    try {
      if (!proofToVerify || !inputsToVerify) {
        throw new Error('No proof to verify. Please generate a proof first.');
      }

      const response = await axios.post('http://localhost:4000/api/verify-jwt-proof', {
        proofVerify: JSON.stringify(Array.from(proofToVerify)),
        publicInputs: JSON.stringify(inputsToVerify, null, 2)
      });

      console.log('Verification resulte:', response.data);
      console.log('Session data in response:', response.data.session);

      // Store the session token using session manager
      if (response.data.session?.token) {
        console.log('Setting up session with token:', response.data.session.token);
        console.log('Session expires at:', response.data.session.expiresAt);
        
        sessionManager.setupSession(
          response.data.session.token,
          response.data.session.expiresAt
        );

        console.log('sessionToken in localStorage:', localStorage.getItem('sessionToken'));
        console.log('sessionExpiresAt in localStorage:', localStorage.getItem('sessionExpiresAt'));
        
        // Verify the token was stored
        const storedToken = sessionManager.getToken();
        console.log('Stored token:', storedToken);
        console.log('Session valid:', sessionManager.isSessionValid());
        
        // Set default Authorization header for future requests
        axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        console.log('Set Authorization header:', axios.defaults.headers.common['Authorization']);
      } else {
        console.warn('No session token in response:', response.data);
      }

      setVerificationResult({
        isValid: response.data.verified,
        message: response.data.message
      });
      setStatus('complete');
    } catch (err) {
      console.error('Verification failed:', err);
      if (err.response?.data) {
        console.error('Server error details:', err.response.data);
      }
      const errorMessage = err.response?.data?.message || err.message;
      setError(`Verification failed: ${errorMessage}`);
      setStatus('error');
    } finally {
      setIsVerifying(false);
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'initializing':
        return 'Initializing proof system...';
      case 'ready':
        return 'Ready to generate proof...';
      case 'generating':
        return 'Generating proof for your JWT...';
      case 'verifying':
        return 'Verifying proof with the server...';
      case 'complete':
        return 'Proof process completed! Redirecting to home...';
      case 'error':
        return 'An error occurred during the process.';
      default:
        return '';
    }
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
        overflow: 'hidden',
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
            position: 'absolute',
            top: '20px',
            right: '20px',
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
          Creating Zauth Proof
        </Typography>

        {userEmail && (
          <Typography
            variant="subtitle1"
            sx={{
              opacity: 0.8,
              maxWidth: '400px',
              lineHeight: 1.6,
              fontWeight: 400,
            }}
          >
            Generating proof for account: {userEmail}
          </Typography>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
          {(status === 'generating' || status === 'verifying') && (
            <CircularProgress size={24} sx={{ color: 'white' }} />
          )}
          <Typography variant="subtitle1">
            {getStatusMessage()}
          </Typography>
        </Box>

        {error && (
          <Typography
            sx={{
              color: '#ff6b6b',
              mt: 2,
              p: 2,
              borderRadius: 1,
              backgroundColor: 'rgba(255, 107, 107, 0.1)',
            }}
          >
            {error}
          </Typography>
        )}

        {verificationResult && (
          <Typography
            sx={{
              color: verificationResult.isValid ? '#4caf50' : '#ff6b6b',
              mt: 2,
              p: 2,
              borderRadius: 1,
              backgroundColor: verificationResult.isValid 
                ? 'rgba(76, 175, 80, 0.1)' 
                : 'rgba(255, 107, 107, 0.1)',
            }}
          >
            {verificationResult.message}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export default ProofCreator;