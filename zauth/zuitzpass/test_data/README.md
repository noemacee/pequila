# Test Data for ZuitzPass

This folder contains test data and utilities for testing DKIM verification with valid cryptographic parameters.

## Files

- **generate_test_data.js** - Generates valid RSA key pairs and DKIM signatures
- **calculate_montgomery.js** - Calculates the Montgomery reduction parameter for RSA modular arithmetic
- **calculate_public_inputs.js** - Calculates public inputs (nullifier and merkle root) for testing
- **generate_prover_toml.js** - Generates a complete Prover.toml file with valid test data
- **test_crypto_data.json** - Contains the generated RSA key pair and signature
- **montgomery_params.json** - Contains the calculated Montgomery parameters
- **Prover_example.toml** - Example Prover.toml with valid cryptographic data

## Usage

1. Generate test data:
   ```bash
   node test_data/generate_test_data.js
   ```

2. Calculate Montgomery parameters:
   ```bash
   node test_data/calculate_montgomery.js
   ```

3. Generate a complete Prover.toml:
   ```bash
   node test_data/generate_prover_toml.js
   cp Prover_example.toml ../Prover.toml
   ```

4. Run tests:
   ```bash
   nargo test test_with_valid_crypto_data
   ```

## Notes

- The RSA signature is valid and cryptographically correct
- The Montgomery reduction parameter is properly calculated as `-n^(-1) mod R`
- The test data works with the integration tests but requires exact pedersen hash values for full `main()` execution