const fs = require('fs');
const { Noir } = require('@noir-lang/noir_js');
const { UltraHonkBackend } = require('@aztec/bb.js');
const config = require('./config');

class CircuitManager {
  constructor() {
    this.noir = null;
    this.backend = null;
  }

  async initialize() {
    try {
      const circuit = JSON.parse(fs.readFileSync(config.circuitPath, 'utf8'));
      this.noir = new Noir(circuit);
      this.backend = new UltraHonkBackend(circuit.bytecode);
      console.log('Circuit loaded successfully');
    } catch (err) {
      console.error('Error loading circuit:', err);
      throw err;
    }
  }

  async verifyProof(proofVerify, publicInputs) {
    if (!this.backend) {
      throw new Error('Circuit not initialized');
    }

    try {
      const proofParsed = Array.isArray(proofVerify) 
        ? Uint8Array.from(proofVerify)
        : Uint8Array.from(JSON.parse(proofVerify));

      const publicInputsParsed = Array.isArray(publicInputs)
        ? publicInputs
        : JSON.parse(publicInputs);

      return await this.backend.verifyProof({
        proof: proofParsed,
        publicInputs: publicInputsParsed
      });
    } catch (err) {
      console.error('Error verifying proof:', err);
      throw err;
    }
  }
}

module.exports = new CircuitManager(); 