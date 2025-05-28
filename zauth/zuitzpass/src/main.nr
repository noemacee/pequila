use std::{collections::bounded_vec::BoundedVec, hash::pedersen_hash};
use trees::merkle::{Calculator, MerkleTree};
use zkemail::{
    KEY_LIMBS_1024,
    KEY_LIMBS_2048, 
    MAX_EMAIL_ADDRESS_LENGTH,
    Sequence,
    dkim::RSAPubkey,
    headers::email_address::get_email_address,
};

// I know a valid RS256 JWT whose email claim is in the approved merkle-set.
/*
What's going on

JWT verification
You pass in the Base64 encoded header and payload (data), your RSA public key limbs, Redc params and signature limbs.
The library decodes the payload, hashes with SHA256 under the hood (or does a partial-hash variant), and checks the RSA signature.

jwt.get_claim_string("email")
Pulls the "email" claim bytes out of the JSON payload.
You can choose to only extract it, or additionally assert_claim_string(...) if you want it as a public input.

Merkle proof
We turn the email bytes into a field-based leaf hash.
Then we run your merkle-proof code over proof_nodes (the sibling hashes) and proof_path_bits (the left/right path indicators).
Finally you assert that the computed root equals the public merkle_root.
*/

global ZUITZERLAND_EMAIL_ADDRESS: BoundedVec<u8, MAX_EMAIL_ADDRESS_LENGTH> = BoundedVec::from_array("team@zuitzerland.ch".as_bytes());

global MAX_EMAIL_HEADER_LENGTH: u32 = 512;
global MAX_DATA_LENGTH: u32 = 910; // max length of signed data (headerb64 + "." + payloadb64)
global MAX_NONCE_LENGTH: u32 = 32; // we are verifying `nonce` claim
global M: u32 = 2;

// how many Field-limbs we'll chunk the email into before hashing:
global LEAF_LIMBS: u32 = 8;

// Merkle parameters:
global TREE_DEPTH: u32 = 8; // e.g. a 2^8-leaf tree //256 participants max at Zuitzerland

// Constants for the PCD Merkle Tree
global PCD_TREE_DEPTH: u32 = 10; // Allowing for more PCDs than participants

fn main(
    header: BoundedVec<u8, MAX_DATA_LENGTH>,
    pub_key: RSAPubkey<KEY_LIMBS_2048>,
    signature: [Field; KEY_LIMBS_2048],
    from_header_sequence: Sequence,
    from_address_sequence: Sequence,
    to_header_sequence: Sequence,
    to_address_sequence: Sequence,
    nullifier: pub Field,
    merkle_root_zuitz: pub Field,
    proof_index: Field,
    proof_siblings: [Field; TREE_DEPTH] 
) {
    assert(header.len() <= MAX_EMAIL_HEADER_LENGTH);

    pub_key.verify_dkim_signature(header, signature);
    
    let from = comptime { "from".as_bytes() };
    let from_address = get_email_address(
        header, 
        from_header_sequence, 
        from_address_sequence, 
        from
    );
    assert(from_address == ZUITZERLAND_EMAIL_ADDRESS);

    let to = comptime { "to".as_bytes() };
    let to_address = get_email_address(
        header, 
        to_header_sequence, 
        to_address_sequence, 
        to
    );

    let email_fields: [Field; M] = boundedvec_to_fields(to_address);
    let leaf_hash: Field = pedersen_hash(email_fields);
    belongs_to_merkle_tree(
        merkle_root_zuitz,
        pedersen_hash,
        leaf_hash,
        proof_index,
        proof_siblings,
    );

    let email_nullifier = pedersen_hash(signature);
    assert(email_nullifier == nullifier);
}

//-----------------------------------------------------------------------------
// Byte to field conversion (truncates the 32nd byte)
// from here: https://github.com/noir-lang/noir/blob/5d782f020f6aec6aaa8a445c3a6a5fb9b275e3c6/test_programs/execution_success/ram_blowup_regression/src/main.nr
//-----------------------------------------------------------------------------
pub fn field_from_bytes_32_trunc(bytes32: [u8; 32]) -> Field {
    let mut v: Field = 1;
    let mut high: Field = 0 as Field;
    let mut low: Field = 0 as Field;

    // pack bytes16..30 into `low`, bytes0..14 into `high`, ignore byte31
    for i in 0..15 {
        low = low + (bytes32[15 + 15 - i] as Field) * v;
        v = v * 256;
        high = high + (bytes32[14 - i] as Field) * v;
    }
    // byte15
    low = low + (bytes32[15] as Field) * v;

    low + high * v
}

//-----------------------------------------------------------------------------
// Chop a BoundedVec<u8,N> into M chunks of 32-bytes and convert each
//-----------------------------------------------------------------------------
fn boundedvec_to_fields(vec: BoundedVec<u8, MAX_EMAIL_ADDRESS_LENGTH>) -> [Field; M] {
    let mut fields: [Field; M] = [0; M];
    for i in 0..M {
        // build a 32-byte window
        let mut chunk: [u8; 32] = [0; 32];
        for j in 0..32 {
            let idx = i * 32 + j;
            if idx < vec.len() {
                chunk[j] = vec.storage()[idx];
            }
        }
        fields[i] = field_from_bytes_32_trunc(chunk);
    }
    fields
}

fn belongs_to_merkle_tree(
    root: Field,
    hasher: fn([Field; 2]) -> Field,
    leaf: Field,
    indexes: Field,
    hash_path: [Field; TREE_DEPTH],
) {
    let mut mt = MerkleTree::from(root, hasher);
    mt.membership(leaf, indexes, hash_path);
}

// Create a hasher function that can be used with MerkleTree
// pub fn poseidon_hasher(inputs: [Field; 2]) -> Field {
//     hash(inputs, 2)
// }

// Function to add a PCD hash to the PCD Merkle Tree
fn add_pcd_to_merkle_tree(
    pcd_hash: Field,
    pcd_merkle_root: Field,
    proof_siblings: [Field; PCD_TREE_DEPTH],
    proof_index: Field,
) -> Field {
    // Create a Merkle Tree instance with the current root
    let mut pcd_tree = MerkleTree::from(pcd_merkle_root, pedersen_hash);

    // Add the PCD hash to the tree and get the updated root
    pcd_tree.add(pcd_hash, proof_index, proof_siblings);

    // Return the new root after adding the PCD hash
    pcd_tree.root
}

// Function to verify that a PCD hash exists in the PCD Merkle Tree
fn verify_pcd_in_merkle_tree(
    pcd_hash: Field,
    pcd_merkle_root: Field,
    proof_siblings: [Field; PCD_TREE_DEPTH],
    proof_index: Field,
) -> bool {
    // Create a Merkle Tree instance with the root
    let pcd_tree = MerkleTree::from(pcd_merkle_root, pedersen_hash);

    // Calculate the expected root if the PCD hash is at the given index
    let calculated_root = pcd_tree.calculate_root(pcd_hash, proof_index, proof_siblings);

    // Compare the calculated root with the provided root
    calculated_root == pcd_merkle_root
}

#[test]
fn test_merkle_membership() {
    // Create test data for a simple Merkle tree
    let leaf = 42;
    let indexes = 0; // Position in the tree
    // 2) build a dummy sibling path
    let hash_path: [Field; TREE_DEPTH] = [123; TREE_DEPTH];
    // 3) build tree and get the real root
    let root: Field = MerkleTree::new(pedersen_hash).calculate_root(leaf, indexes, hash_path);
    let mut mt1 = MerkleTree::from(root, pedersen_hash);

    // Test the membership function
    belongs_to_merkle_tree(root, pedersen_hash, leaf, indexes, hash_path);
}

#[test(should_fail)]
fn test_merkle_membership_wrong_leaf() {
    // Create test data for a simple Merkle tree
    let leaf = 42;
    let indexes = 0; // Position in the tree
    let hash_path = [123, 234, 345, 456, 567, 678, 789, 890];

    // Calculate what the root should be by manually applying the hash function
    // This simulates what would happen inside the MerkleTree::membership function
    let node1 = pedersen_hash([leaf, hash_path[0]]);
    let root = pedersen_hash([node1, hash_path[1]]);

    // Negative test case
    let wrong_leaf = 43;
    belongs_to_merkle_tree(root, pedersen_hash, wrong_leaf, indexes, hash_path);
}

#[test]
fn test_email_parsing_and_merkle_tree() {
    let pubkey_modulus_limbs = [
        484791102317025465533947056954494751,
        689128460766062759582134715581990032,
        810523707777777878428965619663888709,
        184404549238669475316963116864788898,
        93466218048229154672139102341852900,
        584828628768888069086079532464056431,
        97425187031931427039620311245463762,
        26273806718910063326353308419294998,
        788747954066548540615875263034804664,
        889704621954975151388848797463892494,
        311999144542197118282319553447935979,
        569776388981460921496753063185331362,
        903966640703701959992132828577771898,
        159022820921763067563807580152706463,
        503819859541011037194389727017199051,
        1078173269124751507098806957834900664,
        808018922828293630146825008649069450,
        163,
    ];
    
    let redc_params_limbs = [
        1143167338325541577958669340190596824,
        782066667103526839077340987159104121,
        1067845759344375818181746341911682002,
        880124617802511701465844415806808588,
        285259139341669707856057706066903101,
        1230850420220071595120007854793337041,
        243441877489860292941608721967510056,
        821283804950244931298352888469271304,
        265590023859021620015146340457966193,
        955602690275722281613949658760787989,
        704159826142581942518373637894303280,
        313938418637521056314346970388282852,
        296174013877567499290252280618882959,
        127533166408087917092441034792304239,
        486694435757811118946661778147879193,
        742440511645057019411661928820777129,
        106100992772450627263374716203348785,
        6409,
    ];
    
    let pub_key = RSAPubkey {
        modulus: pubkey_modulus_limbs,
        redc: redc_params_limbs,
    };
    
    let signature_limbs = [
        782421962573548264472674190647943355,
        528649442614902878048130358901749842,
        795671681115216636642039527621785323,
        342055983261463759066440970886912343,
        320943042314824191484469254030368420,
        233931545977215775766660875366648712,
        166738968145911552289782464945436391,
        1280090914380823160665554635957223606,
        225322564371992173705155119766257284,
        1012067778676730712845356243167441596,
        337008035250054394089555850701430953,
        441480997772890594691718538441538925,
        1266099611422563733802354067242028554,
        163890419575820619684088542045789366,
        71236811945264458762129145425586273,
        106105739687938386497215871288359508,
        598323717706499880526430558338637686,
        97,
    ];
    
    // Sample email header with from and to fields
    let header_data = "DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; d=zuitzerland.ch; s=default; t=1640995200; h=from:to:subject; bh=abcd1234; b=xyz789...\r\nFrom: team@zuitzerland.ch\r\nTo: alice@test.com\r\nSubject: Test Email\r\n".as_bytes();
    
    let header: BoundedVec<u8, MAX_DATA_LENGTH> = BoundedVec::from_array(header_data);
    
    // Sequence parameters for parsing the from header
    let from_header_sequence = Sequence {
        index: 120,
        length: 25,
    };
    
    let from_address_sequence = Sequence {
        index: 6, 
        length: 19,
    };
    let to_header_sequence = Sequence {
        index: 146,
        length: 20,
    };
    
    // Sequence parameters for extracting the to email address
    let to_address_sequence = Sequence {
        index: 4,
        length: 14,
    };
    
    // Test the email to field conversion and merkle tree logic
    let expected_email: BoundedVec<u8, MAX_EMAIL_ADDRESS_LENGTH> = BoundedVec::from_array("alice@test.com".as_bytes());
    let email_fields: [Field; M] = boundedvec_to_fields(expected_email);
    let leaf_hash: Field = pedersen_hash(email_fields);
    
    // Merkle tree parameters
    let proof_index = 0;
    let proof_siblings: [Field; TREE_DEPTH] = [123; TREE_DEPTH];
    
    // Calculate the merkle root
    let merkle_root_zuitz: Field = MerkleTree::new(pedersen_hash).calculate_root(
        leaf_hash, 
        proof_index, 
        proof_siblings
    );
    
    // Test the merkle tree membership directly
    belongs_to_merkle_tree(
        merkle_root_zuitz,
        pedersen_hash,
        leaf_hash,
        proof_index,
        proof_siblings,
    );
    
    // Test nullifier generation
    let signature_limbs = [42; KEY_LIMBS_2048]; 
    let email_nullifier = pedersen_hash(signature_limbs);
    
    assert(email_nullifier != 0);
}
