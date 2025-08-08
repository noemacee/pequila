use std::{collections::bounded_vec::BoundedVec, hash::pedersen_hash};

mod test_integration;
use trees::{
    merkle::{Calculator, MerkleTree},
    types::{MT_Creator, MembershipProver, Modifier}
};
use zkemail::{ 
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
global MAX_EMAIL_ADDRESS_LENGTH: u32 = 320;
global MAX_DATA_LENGTH: u32 = 910; // max length of signed data (headerb64 + "." + payloadb64)
global MAX_NONCE_LENGTH: u32 = 32; // we are verifying `nonce` claim
global M: u32 = 2;

global KEY_LIMBS_2048: u32 = 18;

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

    let _header_hash = pub_key.verify_dkim_signature(header, signature);
    
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
fn test_merkle_tree_functionality() {
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

#[test]
fn test_email_to_fields_conversion() {
    // Test 1: Short email
    let short_email = BoundedVec::from_array("a@b.c".as_bytes());
    let fields1 = boundedvec_to_fields(short_email);
    assert(fields1[0] != 0); // First field should contain the email
    assert(fields1[1] == 0); // Second field should be empty for short email
    
    // Test 2: Longer email that spans multiple fields
    let long_email = BoundedVec::from_array(
        "very.long.email.address.that.spans.multiple.fields@example.com".as_bytes()
    );
    let fields2 = boundedvec_to_fields(long_email);
    assert(fields2[0] != 0); // First field should be populated
    assert(fields2[1] != 0); // Second field should also be populated for long email
    
    // Test 3: Exact 32-byte email
    let exact_32_email = BoundedVec::from_array(
        "exactly32bytes@domain.com123456".as_bytes()  // 32 bytes exactly
    );
    let fields3 = boundedvec_to_fields(exact_32_email);
    assert(fields3[0] != 0);
    
    // Test 4: Zuitzerland email address
    let zuitz_email = ZUITZERLAND_EMAIL_ADDRESS;
    let fields4 = boundedvec_to_fields(zuitz_email);
    assert(fields4[0] != 0);
    
    // Verify that different emails produce different field values
    assert(fields1[0] != fields2[0]);
    assert(fields1[0] != fields3[0]);
    assert(fields1[0] != fields4[0]);
}

#[test]
fn test_complete_email_verification_flow() {
    // Create a test email address
    let test_email = BoundedVec::from_array("participant@zuitzerland.ch".as_bytes());
    
    // Step 1: Convert email to fields
    let email_fields = boundedvec_to_fields(test_email);
    
    // Step 2: Hash the email fields to create a leaf
    let leaf = pedersen_hash(email_fields);
    
    // Step 3: Build a merkle tree with multiple participants
    // Simulate other participants' email hashes
    let participant1 = pedersen_hash([111, 222]); 
    let participant2 = pedersen_hash([333, 444]);
    let participant3 = pedersen_hash([555, 666]);
    
    // Create merkle tree structure (simplified for testing)
    // In production, this would be built from all participants
    let level1_node1 = pedersen_hash([leaf, participant1]);
    let level1_node2 = pedersen_hash([participant2, participant3]);
    let level2_node = pedersen_hash([level1_node1, level1_node2]);
    
    // Create dummy nodes for remaining tree levels
    let dummy_node = pedersen_hash([987, 654]);
    let mut proof_siblings: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    proof_siblings[0] = participant1;  // Sibling at level 0
    proof_siblings[1] = level1_node2;  // Sibling at level 1
    for i in 2..TREE_DEPTH {
        proof_siblings[i] = dummy_node;
    }
    
    // Calculate the root with our proof path
    let calculated_root = MerkleTree::new(pedersen_hash).calculate_root(
        leaf,
        0, // Index 0 in the tree
        proof_siblings
    );
    
    // Verify membership
    belongs_to_merkle_tree(
        calculated_root,
        pedersen_hash,
        leaf,
        0,
        proof_siblings,
    );
    
    // Step 4: Test nullifier generation
    let test_signature: [Field; KEY_LIMBS_2048] = [100; KEY_LIMBS_2048];
    let nullifier1 = pedersen_hash(test_signature);
    
    // Different signature should produce different nullifier
    let test_signature2: [Field; KEY_LIMBS_2048] = [200; KEY_LIMBS_2048];
    let nullifier2 = pedersen_hash(test_signature2);
    
    assert(nullifier1 != 0);
    assert(nullifier2 != 0);
    assert(nullifier1 != nullifier2);
    
    // Same signature should always produce same nullifier (deterministic)
    let nullifier1_again = pedersen_hash(test_signature);
    assert(nullifier1 == nullifier1_again);
}
