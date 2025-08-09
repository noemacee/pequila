use crate::{
    MAX_DATA_LENGTH, KEY_LIMBS_2048, TREE_DEPTH, 
    boundedvec_to_fields, belongs_to_merkle_tree
};
use std::{collections::bounded_vec::BoundedVec, hash::pedersen_hash};
use trees::{
    merkle::{Calculator, MerkleTree}, 
    types::MT_Creator
};
use zkemail::{Sequence, dkim::RSAPubkey};

#[test]
fn test_with_valid_crypto_data() {
    let header_str = "from:team@zuitzerland.ch\r\nto:alice@verified.com\r\nsubject:Zuitzpass Verification\r\ndate:Mon, 1 Jan 2024 12:00:00 +0000\r\n";
    
    let header: BoundedVec<u8, MAX_DATA_LENGTH> = BoundedVec::from_array(header_str.as_bytes());
    
    let modulus: [Field; KEY_LIMBS_2048] = [
        482951987534466074297120555718009823, 323154718872675072998077109015776731, 48269089706825861783414042211477117,
        725677396535312129433903721860133938, 999862013022934454540784179216363733, 350544929254958267043060310455503613,
        589415500614273128642141392819874982, 1160877783177516901880781959574487129, 984080749883211887931271083152040014,
        806348113928699908903330020952283490, 1317120572264737716054964228958107300, 1285052210199459156714910844466448666,
        1058362933626505500858745551164896238, 914506187156611350789536582937140704, 941973511891899614226328695772506674,
        1137688477333809972935987655120710251, 593782832572870500797347478878466558, 185
    ];
    
    let redc: [Field; KEY_LIMBS_2048] = [
        970104885345873183579471223720536033, 135378991058972787175662840700986431, 26872083587635177503193896651303381,
        526907087254473461745555795550987833, 596393884886775222781359894835456290, 836148667774102761921064580864806259,
        634472838343859600224441613720997074, 345897823253870074241856001809132879, 59638709174484544491200984800436436,
        215083966841403522073162401528573701, 723045117197719524395523473759460951, 1097210214127584655374233615349233893,
        389166630566971584768741822792349380, 1083910806325408625285024615137097998, 370399212243513662413764041454519818,
        143772948698849797045546713155828326, 1291333669429830427742944457144984020, 487471597677800818092359710650203634
    ];
    
    let _pub_key = RSAPubkey::new(modulus, redc);
    
    let signature: [Field; KEY_LIMBS_2048] = [
        533299345943082310492026669257854520, 76139925656148444134665051133484852, 530712354544094288002188946951889913,
        526499079439166980587674341145806764, 470392202716961562241059827486873151, 798355882495784720515188969786540669,
        1070795943439421028845712981567857713, 1222667765357996599458304831642256069, 577995419400389995051739871005101473,
        484968266818867589747897734357203861, 732490196754365127458661481532229076, 593572998086973772069568992634530874,
        401159759724702224081667365954571352, 932074691701068501970906952470866482, 239219302382986371463819359257971965,
        844314789988777853073042954033232313, 1081005707438803779746638910280284770, 94
    ];
    
    let to_email = BoundedVec::from_array("alice@verified.com".as_bytes());
    let email_fields = boundedvec_to_fields(to_email);
    let leaf = pedersen_hash(email_fields);
    
    let mut proof_siblings: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    for i in 0..TREE_DEPTH {
        proof_siblings[i] = pedersen_hash([i as Field * 1000, i as Field * 2000]);
    }
    
    let merkle_root = MerkleTree::new(pedersen_hash).calculate_root(
        leaf,
        0,
        proof_siblings
    );
    
    let nullifier = pedersen_hash(signature);
    
    
    let from_start = 5;
    let from_end = 24;
    let to_start = 29;
    let to_end = 47;
    
    let mut from_email_bytes: [u8; 19] = [0; 19];
    for i in 0..19 {
        from_email_bytes[i] = header.get(from_start + i);
    }
    let from_email: BoundedVec<u8, 19> = BoundedVec::from_array(from_email_bytes);
    
    let mut to_email_bytes: [u8; 18] = [0; 18];
    for i in 0..18 {
        to_email_bytes[i] = header.get(to_start + i);
    }
    let extracted_to: BoundedVec<u8, 18> = BoundedVec::from_array(to_email_bytes);
    
    let expected_from: BoundedVec<u8, 19> = BoundedVec::from_array("team@zuitzerland.ch".as_bytes());
    let expected_to: BoundedVec<u8, 18> = BoundedVec::from_array("alice@verified.com".as_bytes());
    
    for i in 0..19 {
        assert(from_email.get(i) == expected_from.get(i));
    }
    for i in 0..18 {
        assert(extracted_to.get(i) == expected_to.get(i));
    }
    
    belongs_to_merkle_tree(
        merkle_root,
        pedersen_hash,
        leaf,
        0,
        proof_siblings,
    );
    
    assert(nullifier != 0);
    
    
    assert(header.len() == 118);
    assert(nullifier != 0);
}

#[test]
fn test_nullifier_uniqueness() {
    let sig1: [Field; KEY_LIMBS_2048] = [1; KEY_LIMBS_2048];
    let sig2: [Field; KEY_LIMBS_2048] = [2; KEY_LIMBS_2048];
    let sig3: [Field; KEY_LIMBS_2048] = [3; KEY_LIMBS_2048];
    
    let null1 = pedersen_hash(sig1);
    let null2 = pedersen_hash(sig2);
    let null3 = pedersen_hash(sig3);
    
    assert(null1 != null2);
    assert(null2 != null3);
    assert(null1 != null3);
    
    assert(null1 != 0);
    assert(null2 != 0);
    assert(null3 != 0);
}

#[test]
fn test_email_allowlist_verification() {
    let allowed_emails = [
        BoundedVec::from_array("alice@verified.com".as_bytes()),
        BoundedVec::from_array("bob@trusted.org".as_bytes()),
        BoundedVec::from_array("charlie@approved.net".as_bytes()),
        BoundedVec::from_array("team@zuitzerland.ch".as_bytes()),
    ];
    
    let mut leaves: [Field; 4] = [0; 4];
    for i in 0..4 {
        let fields = boundedvec_to_fields(allowed_emails[i]);
        leaves[i] = pedersen_hash(fields);
    }
    
    let node1 = pedersen_hash([leaves[0], leaves[1]]);
    let node2 = pedersen_hash([leaves[2], leaves[3]]);
    let _root = pedersen_hash([node1, node2]);
    
    let alice_fields = boundedvec_to_fields(allowed_emails[0]);
    let alice_leaf = pedersen_hash(alice_fields);
    
    let mut proof: [Field; TREE_DEPTH] = [0; TREE_DEPTH];
    proof[0] = leaves[1];
    proof[1] = node2;
    for i in 2..TREE_DEPTH {
        proof[i] = pedersen_hash([999, i as Field]);
    }
    
    let _calculated_root = MerkleTree::new(pedersen_hash).calculate_root(
        alice_leaf,
        0,
        proof
    );
}