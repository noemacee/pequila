import { UltraHonkBackend } from '@aztec/bb.js';
import { Noir } from '@noir-lang/noir_js';
import { 
  generateInputs, 
  extractEmailMetadata, 
  verifyEmailDKIM,
  prepareEmailForCircuit 
} from '../utils/jwtProof';
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

  /**
   * Generate zkEmail proof from raw email content
   */
  async generateProof(emailRaw, merkleRoot, proofSiblings, proofIndex, options = {}) {
    if (!this.noir || !this.backend) {
      throw new Error('Circuit not initialized');
    }

    try {
      const zkEmailOptions = {
        maxHeadersLength: options.maxHeadersLength || 1408,
        maxBodyLength: options.maxBodyLength || 1280,
        ignoreBodyHashCheck: options.ignoreBodyHashCheck || false,
        shaPrecomputeSelector: options.shaPrecomputeSelector,
        extractFrom: options.extractFrom !== false,
        extractTo: options.extractTo !== false,
        ...options
      };

      const circuitInputs = await generateInputs({
        emailRaw,
        merkle_root: merkleRoot,
        proof_siblings: proofSiblings,
        proof_index: proofIndex,
        ...zkEmailOptions
      });

      const { witness } = await this.noir.execute(circuitInputs);
      const proof = await this.backend.generateProof(witness);

      return {
        proofVerify: proof.proof,
        publicInputs: proof.publicInputs
      };
    } catch (error) {
      console.error('Error generating zkEmail proof:', error);
      throw new Error('Failed to generate zkEmail proof: ' + error.message);
    }
  }

  /**
   * Generate zkEmail proof with full preparation and metadata
   */
  async generateEmailProof(emailRaw, merkleRoot, proofSiblings, proofIndex, options = {}) {
    try {
      const prepared = await prepareEmailForCircuit(emailRaw, {
        merkle_root: merkleRoot,
        proof_siblings: proofSiblings,
        proof_index: proofIndex,
        ...options
      });
      
      const { witness } = await this.noir.execute(prepared.inputs);
      const proof = await this.backend.generateProof(witness);

      return {
        proof: {
          proofVerify: proof.proof,
          publicInputs: proof.publicInputs
        },
        metadata: prepared.metadata,
        verified: true
      };
    } catch (error) {
      console.error('Error in generateEmailProof:', error);
      throw error;
    }
  }

  /**
   * Verify zkEmail proof
   */
  async verifyProof(proofVerify, publicInputs) {
    try {
      // verify endpoint 
      const response = await axios.post(`${this.apiBaseUrl}/api/verify/verify-zkemail-proof`, {
        proofVerify: JSON.stringify(Array.from(proofVerify)),
        publicInputs: JSON.stringify(publicInputs, null, 2)
      });

      return {
        isValid: response.data.verified,
        message: response.data.message
      };
    } catch (error) {
      console.error('Error verifying zkEmail proof:', error);
      throw new Error(error.response?.data?.message || error.message);
    }
  }

  /**
   * Extract user email from raw email content
   */
  getUserEmail(emailRaw) {
    try {
      const metadata = extractEmailMetadata(emailRaw);
      return metadata.from;
    } catch (error) {
      console.error('Error extracting email:', error);
      throw new Error('Failed to extract email: ' + error.message);
    }
  }

  /**
   * Get full email metadata
   */
  getEmailMetadata(emailRaw) {
    try {
      return extractEmailMetadata(emailRaw);
    } catch (error) {
      console.error('Error extracting email metadata:', error);
      throw new Error('Failed to extract email metadata: ' + error.message);
    }
  }

  /**
   * Verify DKIM signature of an email
   */
  async verifyEmailDKIM(emailRaw) {
    try {
      const result = await verifyEmailDKIM(emailRaw);
      if (!result.verified) {
        throw new Error('Email DKIM verification failed');
      }
      return result;
    } catch (error) {
      console.error('Error verifying email DKIM:', error);
      throw new Error('Failed to verify email DKIM: ' + error.message);
    }
  }

  /**
   * Check if an email is valid for proof generation
   */
  async isValidEmail(emailRaw) {
    try {
      const dkimResult = await verifyEmailDKIM(emailRaw);
      const metadata = extractEmailMetadata(emailRaw);
      
      return {
        isValid: dkimResult.verified && metadata.from !== null,
        dkimVerified: dkimResult.verified,
        hasFromAddress: metadata.from !== null,
        metadata,
        dkimInfo: {
          signingDomain: dkimResult.signingDomain,
          selector: dkimResult.selector
        }
      };
    } catch (error) {
      return {
        isValid: false,
        error: error.message
      };
    }
  }
}

export const proofService = new ProofService(); 