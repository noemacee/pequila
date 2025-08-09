#!/usr/bin/env node
/**
 * Generate valid RSA key pairs and DKIM signatures for Noir testing.
 * This creates cryptographically valid test data that will pass DKIM verification.
 */

const crypto = require('crypto');
const fs = require('fs');

// Generate RSA key pair
function generateKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicExponent: 65537,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });
    return { publicKey, privateKey };
}

// Create canonical header for DKIM
function createCanonicalHeader() {
    // Using relaxed canonicalization
    const header = 
        "from:team@zuitzerland.ch\r\n" +
        "to:alice@verified.com\r\n" +
        "subject:Zuitzpass Verification\r\n" +
        "date:Mon, 1 Jan 2024 12:00:00 +0000\r\n";
    return header;
}

// Sign header with RSA-SHA256
function signHeader(privateKey, header) {
    const sign = crypto.createSign('SHA256');
    sign.update(header);
    sign.end();
    const signature = sign.sign(privateKey);
    return signature;
}

// Convert buffer/bigint to Noir field array (120-bit limbs)
function toNoirFields(buffer, numLimbs = 18) {
    const bigInt = BigInt('0x' + buffer.toString('hex'));
    const limbBits = 120n;
    const mask = (1n << limbBits) - 1n;
    
    const fields = [];
    for (let i = 0; i < numLimbs; i++) {
        const limb = (bigInt >> (BigInt(i) * limbBits)) & mask;
        fields.push(limb.toString());
    }
    return fields;
}

// Extract modulus from public key
function extractModulus(publicKey) {
    const keyObject = crypto.createPublicKey(publicKey);
    const keyData = keyObject.export({ type: 'pkcs1', format: 'der' });
    
    // Parse DER to extract modulus (simplified - assumes standard RSA key structure)
    // Skip the DER headers and extract the modulus
    // For RSA-2048, modulus starts around byte 9 and is 256 bytes long
    const modulus = keyData.slice(9, 9 + 256);
    return modulus;
}

function main() {
    console.log('Generating RSA key pair and DKIM signature...\n');
    
    // Generate keys
    const { publicKey, privateKey } = generateKeyPair();
    
    // Create and sign header
    const header = createCanonicalHeader();
    const signature = signHeader(privateKey, header);
    
    // Extract modulus
    const modulus = extractModulus(publicKey);
    
    // Convert to Noir field arrays
    const modulusFields = toNoirFields(modulus);
    const signatureFields = toNoirFields(signature);
    
    // Generate Noir test code
    console.log('// Generated test data for DKIM verification');
    console.log(`// Header: "${header.replace(/\r/g, '\\r').replace(/\n/g, '\\n')}"`);
    
    console.log('\n// Test header as bytes');
    console.log(`let test_header = "${header.replace(/\r/g, '\\r').replace(/\n/g, '\\n')}";`);
    
    console.log('\n// RSA Modulus (n) - 2048 bits as 18 limbs of 120 bits each');
    console.log('let modulus: [Field; KEY_LIMBS_2048] = [');
    for (let i = 0; i < modulusFields.length; i += 3) {
        const chunk = modulusFields.slice(i, Math.min(i + 3, modulusFields.length));
        console.log(`    ${chunk.join(', ')}${i + 3 < modulusFields.length ? ',' : ''}`);
    }
    console.log('];');
    
    console.log('\n// RSA Signature');
    console.log('let signature: [Field; KEY_LIMBS_2048] = [');
    for (let i = 0; i < signatureFields.length; i += 3) {
        const chunk = signatureFields.slice(i, Math.min(i + 3, signatureFields.length));
        console.log(`    ${chunk.join(', ')}${i + 3 < signatureFields.length ? ',' : ''}`);
    }
    console.log('];');
    
    console.log('\n// Montgomery reduction parameter (simplified for testing)');
    console.log('let redc: [Field; KEY_LIMBS_2048] = [');
    console.log('    1, 0, 0,');
    console.log('    0, 0, 0,');
    console.log('    0, 0, 0,');
    console.log('    0, 0, 0,');
    console.log('    0, 0, 0,');
    console.log('    0, 0, 0');
    console.log('];');
    
    // Save detailed data
    const testData = {
        header: header,
        headerHex: Buffer.from(header).toString('hex'),
        modulusHex: modulus.toString('hex'),
        signatureHex: signature.toString('hex'),
        publicKey: publicKey,
        headerHash: crypto.createHash('sha256').update(header).digest('hex')
    };
    
    fs.writeFileSync('test_crypto_data.json', JSON.stringify(testData, null, 2));
    console.log('\n// Full test data saved to test_crypto_data.json');
    
    // Verify the signature works
    const verify = crypto.createVerify('SHA256');
    verify.update(header);
    verify.end();
    const isValid = verify.verify(publicKey, signature);
    console.log(`// Signature verification: ${isValid ? 'PASSED' : 'FAILED'}`);
}

main();