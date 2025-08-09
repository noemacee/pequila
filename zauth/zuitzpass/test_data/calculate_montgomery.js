#!/usr/bin/env node
/**
 * Calculate Montgomery reduction parameter for RSA modulus
 * 
 * For Montgomery multiplication, we need:
 * - redc = -n^(-1) mod R where R = 2^(limb_bits * num_limbs)
 * 
 * In our case:
 * - 18 limbs of 120 bits each for 2048-bit RSA
 * - R = 2^(120 * 18) = 2^2160
 */

const fs = require('fs');

// Extended Euclidean Algorithm to find modular inverse
function extendedGCD(a, b) {
    if (a === 0n) {
        return { gcd: b, x: 0n, y: 1n };
    }
    
    const result = extendedGCD(b % a, a);
    const x = result.y - (b / a) * result.x;
    const y = result.x;
    
    return { gcd: result.gcd, x, y };
}

// Calculate modular inverse of a mod m
function modInverse(a, m) {
    const result = extendedGCD(a, m);
    if (result.gcd !== 1n) {
        throw new Error('Modular inverse does not exist');
    }
    return ((result.x % m) + m) % m;
}

// Convert limbs array to BigInt
function limbsToBigInt(limbs, limbBits = 120n) {
    let result = 0n;
    for (let i = 0; i < limbs.length; i++) {
        result += BigInt(limbs[i]) << (limbBits * BigInt(i));
    }
    return result;
}

// Convert BigInt to limbs array
function bigIntToLimbs(value, numLimbs = 18, limbBits = 120n) {
    const mask = (1n << limbBits) - 1n;
    const limbs = [];
    
    for (let i = 0; i < numLimbs; i++) {
        const limb = (value >> (limbBits * BigInt(i))) & mask;
        limbs.push(limb.toString());
    }
    
    return limbs;
}

// Calculate Montgomery parameter redc
function calculateMontgomeryRedc(modulus, numLimbs = 18, limbBits = 120n) {
    // R = 2^(limbBits * numLimbs)
    const R = 1n << (limbBits * BigInt(numLimbs));
    
    // We need to calculate -n^(-1) mod R
    // First, find n^(-1) mod R
    const nInverse = modInverse(modulus, R);
    
    // Then calculate -n^(-1) mod R
    const redc = (R - nInverse) % R;
    
    return redc;
}

// Main function
function main() {
    // Read the test crypto data
    const cryptoData = JSON.parse(fs.readFileSync('test_crypto_data.json', 'utf8'));
    
    // Our modulus limbs from the generated test data
    const modulusLimbs = [
        "482951987534466074297120555718009823", "323154718872675072998077109015776731", "48269089706825861783414042211477117",
        "725677396535312129433903721860133938", "999862013022934454540784179216363733", "350544929254958267043060310455503613",
        "589415500614273128642141392819874982", "1160877783177516901880781959574487129", "984080749883211887931271083152040014",
        "806348113928699908903330020952283490", "1317120572264737716054964228958107300", "1285052210199459156714910844466448666",
        "1058362933626505500858745551164896238", "914506187156611350789536582937140704", "941973511891899614226328695772506674",
        "1137688477333809972935987655120710251", "593782832572870500797347478878466558", "185"
    ];
    
    // Convert modulus limbs to BigInt
    const modulus = limbsToBigInt(modulusLimbs);
    console.log('Modulus (as BigInt):', modulus.toString(16).substring(0, 64) + '...');
    
    try {
        // Calculate Montgomery reduction parameter
        console.log('\nCalculating Montgomery reduction parameter...');
        const redc = calculateMontgomeryRedc(modulus);
        
        // Convert redc to limbs
        const redcLimbs = bigIntToLimbs(redc);
        
        console.log('\n// Montgomery reduction parameter (redc) for Noir:');
        console.log('let redc: [Field; KEY_LIMBS_2048] = [');
        for (let i = 0; i < redcLimbs.length; i += 3) {
            const chunk = redcLimbs.slice(i, Math.min(i + 3, redcLimbs.length));
            console.log(`    ${chunk.join(', ')}${i + 3 < redcLimbs.length ? ',' : ''}`);
        }
        console.log('];');
        
        // Also output as a single line for Prover.toml
        console.log('\n// For Prover.toml [pub_key.redc] limbs:');
        console.log(`limbs = [${redcLimbs.map(l => `"${l}"`).join(', ')}]`);
        
        // Save to file
        const montgomeryData = {
            modulus_hex: modulus.toString(16),
            redc_hex: redc.toString(16),
            redc_limbs: redcLimbs
        };
        
        fs.writeFileSync('montgomery_params.json', JSON.stringify(montgomeryData, null, 2));
        console.log('\nMontgomery parameters saved to montgomery_params.json');
        
    } catch (error) {
        console.error('Error calculating Montgomery parameter:', error.message);
        console.log('\nNote: The modulus might not have an inverse mod R.');
        console.log('This can happen if gcd(n, R) != 1');
        
        // Check if modulus is even (which would make it not coprime with R = 2^k)
        if (modulus % 2n === 0n) {
            console.log('ERROR: Modulus is even, cannot calculate Montgomery parameter!');
        }
    }
}

main();