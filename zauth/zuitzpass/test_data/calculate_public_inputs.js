#!/usr/bin/env node
/**
 * Calculate the public inputs (nullifier and merkle_root) for the main function
 */

const crypto = require('crypto');

// Pedersen hash simulation (using SHA256 as placeholder)
// In production, this would use the actual pedersen hash from the circuit
function pedersenHash(data) {
    const hash = crypto.createHash('sha256');
    if (Array.isArray(data)) {
        data.forEach(d => hash.update(Buffer.from(d.toString())));
    } else {
        hash.update(Buffer.from(data.toString()));
    }
    return BigInt('0x' + hash.digest('hex'));
}

// Calculate nullifier from signature
function calculateNullifier(signatureLimbs) {
    // The nullifier is pedersen_hash(signature)
    // For testing, we'll use a simplified hash
    return pedersenHash(signatureLimbs);
}

// Build merkle tree and calculate root
function calculateMerkleRoot(email, proofSiblings) {
    // Convert email to fields (simplified)
    const emailBytes = Buffer.from(email);
    const leaf = pedersenHash(emailBytes);
    
    // Calculate merkle root with proof siblings
    let currentHash = leaf;
    for (let i = 0; i < proofSiblings.length; i++) {
        const sibling = BigInt(proofSiblings[i]);
        // In actual merkle tree, order depends on index bit
        // For simplicity, we'll just hash them together
        currentHash = pedersenHash([currentHash, sibling]);
    }
    
    return currentHash;
}

// Our test data
const signatureLimbs = [
    "533299345943082310492026669257854520", "76139925656148444134665051133484852", "530712354544094288002188946951889913",
    "526499079439166980587674341145806764", "470392202716961562241059827486873151", "798355882495784720515188969786540669",
    "1070795943439421028845712981567857713", "1222667765357996599458304831642256069", "577995419400389995051739871005101473",
    "484968266818867589747897734357203861", "732490196754365127458661481532229076", "593572998086973772069568992634530874",
    "401159759724702224081667365954571352", "932074691701068501970906952470866482", "239219302382986371463819359257971965",
    "844314789988777853073042954033232313", "1081005707438803779746638910280284770", "94"
];

const proofSiblings = ["1000", "2000", "3000", "4000", "5000", "6000", "7000", "8000"];
const toEmail = "alice@verified.com";

// Calculate values
const nullifier = calculateNullifier(signatureLimbs);
const merkleRoot = calculateMerkleRoot(toEmail, proofSiblings);

console.log('Calculated public inputs for main function:\n');
console.log(`nullifier = "${nullifier}"`);
console.log(`merkle_root_zuitz = "${merkleRoot}"`);

console.log('\nNote: These are placeholder calculations.');
console.log('The actual Noir circuit uses pedersen hash which will produce different values.');
console.log('To get the exact values, you would need to:');
console.log('1. Run the same pedersen hash implementation as used in Noir');
console.log('2. Or extract the values from a successful test run');