import { UltraHonkBackend } from '@aztec/bb.js';
import { Noir } from '@noir-lang/noir_js';
import { generateInputs } from '../utils/jwtProof';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';

class ProofService {
  constructor() {
    this.noir = null;
    this.backend = null;
    this.circuitLoaded = false;
    this.apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
  }

  async initializeCircuit() {
    try {
      const response = await fetch('/zuitzpass.json');
      const circuit = await response.json();
      
      this.noir = new Noir(circuit);
      this.backend = new UltraHonkBackend(circuit.bytecode);
      this.circuitLoaded = true;
      
      return true;
    } catch (error) {
      console.error('Error initializing circuit:', error);
      throw new Error('Failed to initialize circuit: ' + error.message);
    }
  }

  async fetchGooglePubkey(jwt) {
    try {
      const header = JSON.parse(atob(jwt.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')));
      const response = await fetch('https://www.googleapis.com/oauth2/v3/certs');
      const jwks = await response.json();
      const key = jwks.keys.find(k => k.kid === header.kid);
      
      if (!key) throw new Error('Google public key not found for JWT');
      return key;
    } catch (error) {
      console.error('Error fetching Google public key:', error);
      throw new Error('Failed to fetch Google public key: ' + error.message);
    }
  }

  async generateProof(jwt, pubkey, merkleRoot, proofSiblings, proofIndex) {
    if (!this.noir || !this.backend) {
      throw new Error('Circuit not initialized');
    }

    try {
      const maxSignedDataLength = 910;
      const circuitInputs = await generateInputs({
        jwt,
        pubkey,
        maxSignedDataLength,
        merkle_root: merkleRoot,
        proof_siblings: proofSiblings,
        proof_index: proofIndex,
      });

      const { witness } = await this.noir.execute(circuitInputs);
      const proof = await this.backend.generateProof(witness);

      return {
        proofVerify: proof.proof,
        publicInputs: proof.publicInputs
      };
    } catch (error) {
      console.error('Error generating proof:', error);
      throw new Error('Failed to generate proof: ' + error.message);
    }
  }

  async verifyProof(proofVerify, publicInputs) {
    try {
      const response = await axios.post(`${this.apiBaseUrl}/api/verify-jwt-proof`, {
        proofVerify: JSON.stringify(Array.from(proofVerify)),
        publicInputs: JSON.stringify(publicInputs, null, 2)
      });

      return {
        isValid: response.data.verified,
        message: response.data.message
      };
    } catch (error) {
      console.error('Error verifying proof:', error);
      throw new Error(error.response?.data?.message || error.message);
    }
  }

  getUserEmail(jwt) {
    try {
      const decoded = jwtDecode(jwt);
      return decoded.email;
    } catch (error) {
      console.error('Error decoding JWT:', error);
      throw new Error('Failed to decode JWT: ' + error.message);
    }
  }
}

export const proofService = new ProofService(); 