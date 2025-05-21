use jwt::JWT;
use std::hash::{self, poseidon2::Poseidon2::hash};
use trees::merkle::{Calculator, MerkleTree};

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

global MAX_EMAIL_LENGTH: u32 = 64;
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
    data: BoundedVec<u8, MAX_DATA_LENGTH>,
    base64_decode_offset: u32,
    pubkey_modulus_limbs: pub [u128; 18],
    redc_params_limbs: [u128; 18],
    signature_limbs: [u128; 18],
    merkle_root: pub Field,
    proof_siblings: [Field; TREE_DEPTH], // sibling hashes
    proof_index: Field, // leaf index in the tree
) {
    let jwt = JWT::init(
        data,
        base64_decode_offset,
        pubkey_modulus_limbs,
        redc_params_limbs,
        signature_limbs,
    );

    jwt.verify();

    // Verify `iss` claim value is "test"
    //TODO: Is the below line needed?
    //jwt.assert_claim_string("iss".as_bytes(),  BoundedVec::<u8, 15>::from_array("http://test.com".as_bytes()));

    let email: BoundedVec<u8, MAX_EMAIL_LENGTH> = jwt.get_claim_string("email".as_bytes());
    let email_fields: [Field; M] = boundedvec_to_fields(email);
    // 2) Poseidon-hash those limbs down to one Field
    let leaf: Field = hash(email_fields, LEAF_LIMBS);
    // 3) Verify the Merkle proof
    belongs_to_merkle_tree(
        merkle_root,
        poseidon_hasher,
        leaf,
        proof_index,
        proof_siblings,
    );
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
fn boundedvec_to_fields(vec: BoundedVec<u8, MAX_EMAIL_LENGTH>) -> [Field; M] {
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
pub fn poseidon_hasher(inputs: [Field; 2]) -> Field {
    hash(inputs, 2)
}

// Function to add a PCD hash to the PCD Merkle Tree
fn add_pcd_to_merkle_tree(
    pcd_hash: Field,
    pcd_merkle_root: Field,
    proof_siblings: [Field; PCD_TREE_DEPTH],
    proof_index: Field,
) -> Field {
    // Create a Merkle Tree instance with the current root
    let mut pcd_tree = MerkleTree::from(pcd_merkle_root, poseidon_hasher);

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
    let pcd_tree = MerkleTree::from(pcd_merkle_root, poseidon_hasher);

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
    let root: Field = MerkleTree::new(poseidon_hasher).calculate_root(leaf, indexes, hash_path);
    let mut mt1 = MerkleTree::from(root, poseidon_hasher);

    // Test the membership function
    belongs_to_merkle_tree(root, poseidon_hasher, leaf, indexes, hash_path);
}

#[test(should_fail)]
fn test_merkle_membership_wrong_leaf() {
    // Create test data for a simple Merkle tree
    let leaf = 42;
    let indexes = 0; // Position in the tree
    let hash_path = [123, 234, 345, 456, 567, 678, 789, 890];

    // Calculate what the root should be by manually applying the hash function
    // This simulates what would happen inside the MerkleTree::membership function
    let node1 = poseidon_hasher([leaf, hash_path[0]]);
    let root = poseidon_hasher([node1, hash_path[1]]);

    // Negative test case
    let wrong_leaf = 43;
    belongs_to_merkle_tree(root, poseidon_hasher, wrong_leaf, indexes, hash_path);
}

// #[test]
// fn test_main() {
//     let pubkey_modulus_limbs = [
//         484791102317025465533947056954494751,
//         689128460766062759582134715581990032,
//         810523707777777878428965619663888709,
//         184404549238669475316963116864788898,
//         93466218048229154672139102341852900,
//         584828628768888069086079532464056431,
//         97425187031931427039620311245463762,
//         26273806718910063326353308419294998,
//         788747954066548540615875263034804664,
//         889704621954975151388848797463892494,
//         311999144542197118282319553447935979,
//         569776388981460921496753063185331362,
//         903966640703701959992132828577771898,
//         159022820921763067563807580152706463,
//         503819859541011037194389727017199051,
//         1078173269124751507098806957834900664,
//         808018922828293630146825008649069450,
//         163,
//     ];
//     let redc_params_limbs = [
//         1143167338325541577958669340190596824,
//         782066667103526839077340987159104121,
//         1067845759344375818181746341911682002,
//         880124617802511701465844415806808588,
//         285259139341669707856057706066903101,
//         1230850420220071595120007854793337041,
//         243441877489860292941608721967510056,
//         821283804950244931298352888469271304,
//         265590023859021620015146340457966193,
//         955602690275722281613949658760787989,
//         704159826142581942518373637894303280,
//         313938418637521056314346970388282852,
//         296174013877567499290252280618882959,
//         127533166408087917092441034792304239,
//         486694435757811118946661778147879193,
//         742440511645057019411661928820777129,
//         106100992772450627263374716203348785,
//         6409,
//     ];
//     let signature_limbs = [
//         782421962573548264472674190647943355,
//         528649442614902878048130358901749842,
//         795671681115216636642039527621785323,
//         342055983261463759066440970886912343,
//         320943042314824191484469254030368420,
//         233931545977215775766660875366648712,
//         166738968145911552289782464945436391,
//         1280090914380823160665554635957223606,
//         225322564371992173705155119766257284,
//         1012067778676730712845356243167441596,
//         337008035250054394089555850701430953,
//         441480997772890594691718538441538925,
//         1266099611422563733802354067242028554,
//         163890419575820619684088542045789366,
//         71236811945264458762129145425586273,
//         106105739687938386497215871288359508,
//         598323717706499880526430558338637686,
//         97,
//     ];
//     let data: BoundedVec<u8, 512> = BoundedVec::from_array([
//         101, 121, 74, 104, 98, 71, 99, 105, 79, 105, 74, 83, 85, 122, 73, 49, 78, 105, 73, 115, 73,
//         110, 82, 53, 99, 67, 73, 54, 73, 107, 112, 88, 86, 67, 74, 57, 46, 101, 121, 74, 112, 99,
//         51, 77, 105, 79, 105, 74, 111, 100, 72, 82, 119, 79, 105, 56, 118, 100, 71, 86, 122, 100,
//         67, 53, 106, 98, 50, 48, 105, 76, 67, 74, 122, 100, 87, 73, 105, 79, 105, 74, 66, 81, 107,
//         78, 69, 77, 84, 73, 122, 77, 84, 73, 122, 73, 105, 119, 105, 90, 87, 49, 104, 97, 87, 120,
//         102, 100, 109, 86, 121, 97, 87, 90, 112, 90, 87, 81, 105, 79, 110, 82, 121, 100, 87, 85,
//         115, 73, 109, 53, 118, 98, 109, 78, 108, 73, 106, 111, 105, 77, 84, 73, 122, 77, 84, 73,
//         122, 77, 84, 73, 122, 73, 105, 119, 105, 90, 87, 49, 104, 97, 87, 119, 105, 79, 105, 74,
//         104, 98, 71, 108, 106, 90, 85, 66, 48, 90, 88, 78, 48, 76, 109, 78, 118, 98, 83, 73, 115,
//         73, 109, 108, 104, 100, 67, 73, 54, 77, 84, 99, 122, 78, 122, 89, 48, 77, 106, 73, 120, 78,
//         121, 119, 105, 89, 88, 86, 107, 73, 106, 111, 105, 77, 84, 73, 122, 77, 84, 73, 122, 77, 84,
//         73, 122, 76, 106, 81, 49, 78, 106, 81, 49, 78, 106, 81, 49, 78, 105, 73, 115, 73, 109, 86,
//         52, 99, 67, 73, 54, 77, 84, 99, 53, 79, 84, 107, 53, 79, 84, 107, 53, 79, 88, 48,
//     ]);
//     let base64_decode_offset = 37;

//     // Create test data for a simple Merkle tree
//     let expected_email: BoundedVec<u8, 64> = BoundedVec::from_array("alice@test.com".as_bytes());
//     let email_fields: [Field; M] = boundedvec_to_fields(expected_email);
//     let leaf: Field = hash(email_fields, LEAF_LIMBS);
//     let indexes = 0; // Position in the tree
//     // 2) build a dummy sibling path
//     let hash_path: [Field; TREE_DEPTH] = [123; TREE_DEPTH];
//     // 3) build tree and get the real root
//     let root: Field = MerkleTree::new(poseidon_hasher).calculate_root(leaf, indexes, hash_path);
//     let mut mt1 = MerkleTree::from(root, poseidon_hasher);
//     main(
//         data,
//         base64_decode_offset,
//         pubkey_modulus_limbs,
//         redc_params_limbs,
//         signature_limbs,
//         root,
//         hash_path,
//         indexes,
//     )
// }

#[test]
fn test_get_claim_string() {
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
    let data: BoundedVec<u8, 910> = BoundedVec::from_array([
        101, 121, 74, 104, 98, 71, 99, 105, 79, 105, 74, 83, 85, 122, 73, 49, 78, 105, 73, 115, 73,
        110, 82, 53, 99, 67, 73, 54, 73, 107, 112, 88, 86, 67, 74, 57, 46, 101, 121, 74, 112, 99,
        51, 77, 105, 79, 105, 74, 111, 100, 72, 82, 119, 79, 105, 56, 118, 100, 71, 86, 122, 100,
        67, 53, 106, 98, 50, 48, 105, 76, 67, 74, 122, 100, 87, 73, 105, 79, 105, 74, 66, 81, 107,
        78, 69, 77, 84, 73, 122, 77, 84, 73, 122, 73, 105, 119, 105, 90, 87, 49, 104, 97, 87, 120,
        102, 100, 109, 86, 121, 97, 87, 90, 112, 90, 87, 81, 105, 79, 110, 82, 121, 100, 87, 85,
        115, 73, 109, 53, 118, 98, 109, 78, 108, 73, 106, 111, 105, 77, 84, 73, 122, 77, 84, 73,
        122, 77, 84, 73, 122, 73, 105, 119, 105, 90, 87, 49, 104, 97, 87, 119, 105, 79, 105, 74,
        104, 98, 71, 108, 106, 90, 85, 66, 48, 90, 88, 78, 48, 76, 109, 78, 118, 98, 83, 73, 115,
        73, 109, 108, 104, 100, 67, 73, 54, 77, 84, 99, 122, 78, 122, 89, 48, 77, 106, 73, 120, 78,
        121, 119, 105, 89, 88, 86, 107, 73, 106, 111, 105, 77, 84, 73, 122, 77, 84, 73, 122, 77, 84,
        73, 122, 76, 106, 81, 49, 78, 106, 81, 49, 78, 106, 81, 49, 78, 105, 73, 115, 73, 109, 86,
        52, 99, 67, 73, 54, 77, 84, 99, 53, 79, 84, 107, 53, 79, 84, 107, 53, 79, 88, 48,
    ]);
    let base64_decode_offset = 37;

    let jwt: JWT<910> = JWT::init(
        data,
        base64_decode_offset,
        pubkey_modulus_limbs,
        redc_params_limbs,
        signature_limbs,
    );

    jwt.verify();

    let email: BoundedVec<u8, 64> = jwt.get_claim_string("email".as_bytes());
    let expected_email: BoundedVec<u8, 64> = BoundedVec::from_array("alice@test.com".as_bytes());
    assert(email == expected_email);
}

// #[test]
// fn test_other_inputs(){
//     //https://github.com/shield-labs/zklogin/blob/main/packages/contracts/noir/jwt/src/lib.nr
//     global pubkey_limbs: [Field; 18] = [0x9d9b7ab520532396758488b2100155, 0x87ff0f733247ea1ae377d26bdd60aa, 0x55e1805ec2babe74ebadb5de3c29a7, 0x4131e289b5519e562dff8935a669e2, 0xe974f2f0179abc0cc837efb26a9d5d, 0x72f158dfb2a2ba0fd881d8742426ec, 0x7e56e9182ef83caea0a45cfdaba45a, 0xc2b9b23f6684f0442257dbb8a37291, 0xfc0ecae4fe9f8be5c52a91edd59db2, 0x3ba9bd0376ade89881c7bafa2b36de, 0x3548bec7032b97739300f7fd72769b, 0x6a5b4b975ccf938c5e63ee41d57c7c, 0x4fabc9dbb6a9157f91a87adaff6e66, 0x303d705edf9cae022cd91f57f332b6, 0x1834cc2b65d9d2cab6dd210ba58cad, 0x43b9c3ca0df606d243d4c442794829, 0x5239e9f174adc5871d580714b1eb98, 0xe1];
//     global pubkey_redc_limbs: [Field; 18] = [0x1e7578875458139006e47aac5c17fb, 0x249a5affa65fe288cb0df8ab6548be, 0xc29ec9b115f3132ff5fb71e744fba3, 0xbde4d1e1b2e894dd482277dc14aba5, 0x675f382edc2e53fabb2c785f0dd7e8, 0x8af86434e50f50ddfc9b46ce2c8990, 0xbaf8f36a4caec8a61d14be456599d3, 0x4ac14c9865afb8da5ab36b76e6d651, 0x2be72e03504024bbc777e0a1e9d16d, 0x249a0c4d673705ab5ad1757a225fea, 0x0300712f5005899fffeb1289f9ef4b, 0x73eb759f585e597acb40bfbf59efed, 0xe070a169f35358c7ead1df56d02d4b, 0x5657e0c005b6bca107abd9024b4dd1, 0xe6da2103c7938911ca44a5e641c541, 0xc98e9e1235394e0eb2b87143fd42c3, 0xdb1c76abaf095069edf0ea5248ef95, 0x0122];
//     global signature_limbs: [Field; 18] = [ 0xabf49b8204494364afed7815aae9ba, 0x8888b30c7c97cdc0db80766909eba6, 0x5bd07a0786375af02d5f8e9cf9e0bb, 0xb5b1f36ae1cd61952109a814129827, 0xbd011faeecf1eb1ea383e81e1b424e, 0xdb819268100bedf9bb00ceae0c074a, 0x0eaeb846fc824d344bba37468c316d, 0x9123576355f3f5e896ea786a86ce8a, 0x1b9d1c8c412149b3c82e6498a732a9, 0x3d8cbd4f7856947f02ff19e8c478d0, 0x1d3f1389db68a6d6168d9e8104e742, 0x134d7ca6427322a9f62176146be4dc, 0x072d9968d8070f0612a7a781eb3cd0, 0x29a01c7d38758d3cb1ab0a45f9f3e7, 0xa92f67bad1f1995d9e72c23bfa469d, 0x9139299fb1abcc7c45a0305a92a454, 0x6f7998d04ba5abf002a11808d0de0e, 0x42 ];
//     global header_base64url: [u8; 102] = "eyJhbGciOiJSUzI1NiIsImtpZCI6ImE1MGY2ZTcwZWY0YjU0OGE1ZmQ5MTQyZWVjZDFmYjhmNTRkY2U5ZWUiLCJ0eXAiOiJKV1QifQ".as_bytes();
//     global payload_base64url: [u8; 774] = "eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJhenAiOiI2OTgxMDk0NzQ4MDUtbnZmZzloaDMxa2ptYjZtbW41MWQ0b2lvbWJncjNzM3YuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJhdWQiOiI2OTgxMDk0NzQ4MDUtbnZmZzloaDMxa2ptYjZtbW41MWQ0b2lvbWJncjNzM3YuYXBwcy5nb29nbGV1c2VyY29udGVudC5jb20iLCJzdWIiOiIxMTYzMjIyNTIzMjA3NTUyMTgyMjIiLCJlbWFpbCI6ImJhc2UuZW1haWwud2FsbGV0QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJhdF9oYXNoIjoiVzZWN2NmdURjVVhNeTNqWHNpbmRTZyIsIm5vbmNlIjoiZDhkQTZCRjI2OTY0YUY5RDdlRWQ5ZTAzRTUzNDE1RDM3YUE5NjA0NSIsIm5hbWUiOiJUZXN0IEdtYWlsIiwicGljdHVyZSI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hL0FDZzhvY0pVa3FXYVpVMUtxX1RKMU5tak9XWUtBZ1VSc2txUl9IX21FbXVIQmVGRklCSHhWUT1zOTYtYyIsImdpdmVuX25hbWUiOiJUZXN0IiwiZmFtaWx5X25hbWUiOiJHbWFpbCIsImlhdCI6MTcyOTIwNDM2NiwiZXhwIjoxNzI5MjA3OTY2fQ".as_bytes();
//     global payload_json_padded: [u8; 580] = "{\"iss\":\"https://accounts.google.com\",\"azp\":\"698109474805-nvfg9hh31kjmb6mmn51d4oiombgr3s3v.apps.googleusercontent.com\",\"aud\":\"698109474805-nvfg9hh31kjmb6mmn51d4oiombgr3s3v.apps.googleusercontent.com\",\"sub\":\"116322252320755218222\",\"email\":\"base.email.wallet@gmail.com\",\"email_verified\":true,\"at_hash\":\"W6V7cfuDcUXMy3jXsindSg\",\"nonce\":\"d8dA6BF26964aF9D7eEd9e03E53415D37aA96045\",\"name\":\"Test Gmail\",\"picture\":\"https://lh3.googleusercontent.com/a/ACg8ocJUkqWaZU1Kq_TJ1NmjOWYKAgURskqR_H_mEmuHBeFFIBHxVQ=s96-c\",\"given_name\":\"Test\",\"family_name\":\"Gmail\",\"iat\":1729204366,\"exp\":1729207966}".as_bytes();

// }
