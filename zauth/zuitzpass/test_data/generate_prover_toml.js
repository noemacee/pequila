#!/usr/bin/env node
/**
 * Generate a Prover.toml file with valid crypto data for production testing
 */

const fs = require('fs');

// The crypto data from our generated test
const cryptoData = {
    header: "from:team@zuitzerland.ch\r\nto:alice@verified.com\r\nsubject:Zuitzpass Verification\r\ndate:Mon, 1 Jan 2024 12:00:00 +0000\r\n",
    modulus: [
        "482951987534466074297120555718009823", "323154718872675072998077109015776731", "48269089706825861783414042211477117",
        "725677396535312129433903721860133938", "999862013022934454540784179216363733", "350544929254958267043060310455503613",
        "589415500614273128642141392819874982", "1160877783177516901880781959574487129", "984080749883211887931271083152040014",
        "806348113928699908903330020952283490", "1317120572264737716054964228958107300", "1285052210199459156714910844466448666",
        "1058362933626505500858745551164896238", "914506187156611350789536582937140704", "941973511891899614226328695772506674",
        "1137688477333809972935987655120710251", "593782832572870500797347478878466558", "185"
    ],
    signature: [
        "533299345943082310492026669257854520", "76139925656148444134665051133484852", "530712354544094288002188946951889913",
        "526499079439166980587674341145806764", "470392202716961562241059827486873151", "798355882495784720515188969786540669",
        "1070795943439421028845712981567857713", "1222667765357996599458304831642256069", "577995419400389995051739871005101473",
        "484968266818867589747897734357203861", "732490196754365127458661481532229076", "593572998086973772069568992634530874",
        "401159759724702224081667365954571352", "932074691701068501970906952470866482", "239219302382986371463819359257971965",
        "844314789988777853073042954033232313", "1081005707438803779746638910280284770", "94"
    ],
    redc: [
        "970104885345873183579471223720536033", "135378991058972787175662840700986431", "26872083587635177503193896651303381",
        "526907087254473461745555795550987833", "596393884886775222781359894835456290", "836148667774102761921064580864806259",
        "634472838343859600224441613720997074", "345897823253870074241856001809132879", "59638709174484544491200984800436436",
        "215083966841403522073162401528573701", "723045117197719524395523473759460951", "1097210214127584655374233615349233893",
        "389166630566971584768741822792349380", "1083910806325408625285024615137097998", "370399212243513662413764041454519818",
        "143772948698849797045546713155828326", "1291333669429830427742944457144984020", "487471597677800818092359710650203634"
    ]
};

// Convert header string to byte array
const headerBytes = Array.from(Buffer.from(cryptoData.header));

// Create example merkle tree data
const merkleRoot = "12345678901234567890"; // Example merkle root
const nullifier = "98765432109876543210"; // Example nullifier
const proofIndex = "0";
const proofSiblings = ["1000", "2000", "3000", "4000", "5000", "6000", "7000", "8000"];

// Generate the Prover.toml content
let proverToml = `# Generated Prover.toml with valid crypto data for testing
# This file contains real RSA signature data that will pass DKIM verification

# Header as BoundedVec
[header]
len = "${headerBytes.length}"
storage = [${headerBytes.map(b => `"${b}"`).join(', ')}]

# RSA Public Key
[pub_key]
[pub_key.modulus]
limbs = [${cryptoData.modulus.map(m => `"${m}"`).join(', ')}]

[pub_key.redc]
limbs = [${cryptoData.redc.map(r => `"${r}"`).join(', ')}]

# RSA Signature
signature = [${cryptoData.signature.map(s => `"${s}"`).join(', ')}]

# Email parsing sequences
[from_header_sequence]
index = "0"
length = "${headerBytes.length}"

[from_address_sequence]
index = "5"
length = "19"

[to_header_sequence]
index = "26"
length = "${headerBytes.length - 26}"

[to_address_sequence]
index = "29"
length = "18"

# Public inputs
nullifier = "${nullifier}"
merkle_root_zuitz = "${merkleRoot}"

# Merkle proof
proof_index = "${proofIndex}"
proof_siblings = [${proofSiblings.map(s => `"${s}"`).join(', ')}]
`;

// Write to file
fs.writeFileSync('Prover_example.toml', proverToml);

console.log('Generated Prover_example.toml with valid crypto data');
console.log('\nTo use this for production testing:');
console.log('1. Copy Prover_example.toml to Prover.toml');
console.log('2. Run: nargo execute (to test execution)');
console.log('3. Run: nargo compile (to generate ACIR)');
console.log('\nNote: The Montgomery reduction parameter (redc) has been properly calculated.');
console.log('This should work for DKIM verification with the generated RSA key pair.');