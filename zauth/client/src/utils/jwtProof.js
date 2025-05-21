// Only utility functions here! No JSX!
export function splitBigIntToChunks(bigInt, chunkSize, numChunks) {
  const mask = (1n << BigInt(chunkSize)) - 1n;
  const chunks = [];
  for (let i = 0; i < numChunks; i++) {
    const chunk = (bigInt >> (BigInt(i) * BigInt(chunkSize))) & mask;
    chunks.push(chunk);
  }
  return chunks;
}

export async function generateInputs({
  jwt,
  pubkey,
  maxSignedDataLength,
  merkle_root,
  proof_siblings,
  proof_index,
}) {
  // Split into header, payload, signature
  const parts = jwt.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const [headerB64, payloadB64, signatureB64url] = parts;

  // Prepare signed data (header.payload)
  
  const signedDataString = jwt.split(".").slice(0, 2).join("."); // $header.$payload

  const encoder = new TextEncoder();
  const signedData = encoder.encode(signedDataString);

  if (signedData.length > maxSignedDataLength) {
    console.log('Signed data length exceeds maxSignedDataLength');
    console.log(signedData);
    throw new Error('Signed data length exceeds maxSignedDataLength');
  }

  // Pad signed data to circuit size
  const dataPadded = new Uint8Array(maxSignedDataLength);
  dataPadded.set(signedData);

  // Decode signature to BigInt
  const signatureBase64Url = parts[2]
  const signatureBase64 = signatureBase64Url
  .replace(/-/g, "+")
  .replace(/_/g, "/");

  const signature = new Uint8Array(
    atob(signatureBase64)
      .split("")
      .map((c) => c.charCodeAt(0))
  );
  const signatureBigInt = BigInt("0x" + Array.from(signature).map(b => b.toString(16).padStart(2, '0')).join(''));
  // Decode pubkey modulus to BigInt
  if (!pubkey.n) throw new Error('JWK missing modulus');
  const nB64 = pubkey.n.replace(/-/g, '+').replace(/_/g, '/');


  const nBytes = Uint8Array.from(atob(nB64), c => c.charCodeAt(0));
  const pubkeyBigInt = BigInt('0x' + Array.from(nBytes).map(b => b.toString(16).padStart(2, '0')).join(''));

  // Compute Redc param for 2048-bit key
  const redcParam = (1n << (2n * 2048n + 4n)) / pubkeyBigInt;

  // Split into 18 limbs of 120 bits each
  const pubkey_modulus_limbs = splitBigIntToChunks(pubkeyBigInt, 120, 18).map(c => c.toString());
  const redc_params_limbs  = splitBigIntToChunks(redcParam,      120, 18).map(c => c.toString());
  const signature_limbs     = splitBigIntToChunks(signatureBigInt,120, 18).map(c => c.toString());

  // Build final inputs
  return {
    data: { storage: Array.from(dataPadded), len: signedData.length },
    base64_decode_offset: headerB64.length + 1,
    pubkey_modulus_limbs,
    redc_params_limbs,
    signature_limbs,
    merkle_root,
    proof_siblings,
    proof_index,
  };
}