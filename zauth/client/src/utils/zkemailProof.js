// Lazy load these modules to avoid browser issues
let zkEmailHelpers = null;
let zkEmailNr = null;
let NoirBignum = null;

async function loadDependencies() {
  if (!zkEmailHelpers) {
    zkEmailHelpers = await import('@zk-email/helpers');
    zkEmailNr = await import('@zk-email/zkemail-nr');
    NoirBignum = await import('@mach-34/noir-bignum-paramgen');
  }
  return { zkEmailHelpers, zkEmailNr, NoirBignum };
}

const DEFAULT_MAX_HEADERS_LENGTH = 1408;
const DEFAULT_MAX_BODY_LENGTH = 1280;   

/**
 * Generate zkEmail circuit inputs from raw email for Noir circuits
 */
export async function generateInputs({
  emailRaw, 
  merkle_root,
  proof_siblings,
  proof_index,
  maxHeadersLength = DEFAULT_MAX_HEADERS_LENGTH,
  maxBodyLength = DEFAULT_MAX_BODY_LENGTH,
  ignoreBodyHashCheck = false,
  shaPrecomputeSelector = undefined,
  extractFrom = false,
  extractTo = false,
}) {
  try {
    const { zkEmailHelpers, zkEmailNr, NoirBignum: NB } = await loadDependencies();
    const { verifyDKIMSignature, sha256Pad, Uint8ArrayToCharArray, generatePartialSHA, findIndexInUint8Array } = zkEmailHelpers;
    const { u8ToU32, getHeaderSequence, getAddressHeaderSequence } = zkEmailNr;
    const emailBuffer = typeof emailRaw === 'string' 
      ? Buffer.from(emailRaw) 
      : emailRaw;

    const dkimResult = await verifyDKIMSignature(emailBuffer, undefined, undefined, true);
    
    if (!dkimResult.verified) {
      throw new Error('Email DKIM signature verification failed');
    }

    const { headers, body, bodyHash, publicKey, signature, modulusLength } = dkimResult;

    const [headersPadded] = sha256Pad(headers, maxHeadersLength);

    const pubkeyModulusLimbs = NB.bnToLimbStrArray(publicKey, modulusLength);
    const pubkeyRedcLimbs = NB.bnToRedcLimbStrArray(publicKey, modulusLength);
    const signatureLimbs = NB.bnToLimbStrArray(signature, modulusLength);

    const dkimHeaderSequence = getHeaderSequence(headers, "dkim-signature");

    const circuitInputs = {
      header: {
        storage: Uint8ArrayToCharArray(headersPadded),
        len: headers.length.toString(),
      },
      pubkey: {
        modulus: pubkeyModulusLimbs,
        redc: pubkeyRedcLimbs,
      },
      signature: signatureLimbs,
      dkim_header_sequence: dkimHeaderSequence,
      merkle_root: merkle_root || "0",
      proof_siblings: proof_siblings || [],
      proof_index: proof_index || "0",
    };

    // Handle email body if not ignoring
    if (!ignoreBodyHashCheck && body && bodyHash) {
      const bodyHashIndex = headers.toString().indexOf(bodyHash);
      
      if (shaPrecomputeSelector) {
        const selector = new TextEncoder().encode(shaPrecomputeSelector);
        const selectorIndex = findIndexInUint8Array(body, selector);
        const shaCutoffIndex = Math.floor(selectorIndex / 64) * 64;
        
        const bodySHALength = Math.floor((body.length + 63 + 65) / 64) * 64;
        const [bodyPadded, bodyPaddedLen] = sha256Pad(
          body,
          Math.max(maxBodyLength, bodySHALength)
        );
        
        const { precomputedSha, bodyRemaining, bodyRemainingLength } = generatePartialSHA({
          body: bodyPadded,
          bodyLength: bodyPaddedLen,
          selectorString: shaPrecomputeSelector,
          maxRemainingBodyLength: maxBodyLength,
        });
        
        circuitInputs.body = {
          storage: Uint8ArrayToCharArray(bodyRemaining.slice(0, bodyRemainingLength)),
          len: (body.length - shaCutoffIndex).toString(),
        };
        circuitInputs.body_hash_index = bodyHashIndex.toString();
        circuitInputs.partial_body_real_length = body.length.toString();
        circuitInputs.partial_body_hash = Array.from(u8ToU32(precomputedSha)).map(x => x.toString());
      } else {
        const [bodyPadded] = sha256Pad(body, maxBodyLength);
        
        circuitInputs.body = {
          storage: Uint8ArrayToCharArray(bodyPadded),
          len: body.length.toString(),
        };
        circuitInputs.body_hash_index = bodyHashIndex.toString();
      }
    }

    // Extract email addresses if requested
    if (extractFrom) {
      const fromSequences = getAddressHeaderSequence(headers, "from");
      circuitInputs.from_header_sequence = fromSequences[0];
      circuitInputs.from_address_sequence = fromSequences[1];
    }
    
    if (extractTo) {
      const toSequences = getAddressHeaderSequence(headers, "to");
      circuitInputs.to_header_sequence = toSequences[0];
      circuitInputs.to_address_sequence = toSequences[1];
    }

    return circuitInputs;
  } catch (error) {
    console.error('Error generating zkEmail proof inputs:', error);
    throw new Error(`Failed to generate zkEmail proof inputs: ${error.message}`);
  }
}

/**
 * Helper function to extract email metadata from raw email
 */
export function extractEmailMetadata(emailRaw) {
  try {
    const emailStr = typeof emailRaw === 'string' ? emailRaw : emailRaw.toString();
    
    const fromMatch = emailStr.match(/^From:\s*(?:.*?<(.+?)>|(.+?))$/mi);
    const fromEmail = fromMatch ? (fromMatch[1] || fromMatch[2]).trim() : null;

    const toMatch = emailStr.match(/^To:\s*(?:.*?<(.+?)>|(.+?))$/mi);
    const toEmail = toMatch ? (toMatch[1] || toMatch[2]).trim() : null;
    
    const subjectMatch = emailStr.match(/^Subject:\s*(.+?)$/mi);
    const subject = subjectMatch ? subjectMatch[1].trim() : null;

    const dateMatch = emailStr.match(/^Date:\s*(.+?)$/mi);
    const date = dateMatch ? dateMatch[1].trim() : null;

    const messageIdMatch = emailStr.match(/^Message-ID:\s*<(.+?)>/mi);
    const messageId = messageIdMatch ? messageIdMatch[1].trim() : null;

    const dkimMatch = emailStr.match(/^DKIM-Signature:.*?d=([^;]+)/mi);
    const dkimDomain = dkimMatch ? dkimMatch[1].trim() : null;
    
    return {
      from: fromEmail,
      to: toEmail,
      subject,
      date,
      messageId,
      dkimDomain,
    };
  } catch (error) {
    console.error('Error extracting email metadata:', error);
    return {
      from: null,
      to: null,
      subject: null,
      date: null,
      messageId: null,
      dkimDomain: null,
    };
  }
}

/**
 * Verify DKIM signature
 */
export async function verifyEmailDKIM(emailRaw) {
  try {
    const { zkEmailHelpers } = await loadDependencies();
    const { verifyDKIMSignature } = zkEmailHelpers;
    const emailBuffer = typeof emailRaw === 'string' 
      ? Buffer.from(emailRaw) 
      : emailRaw;
      
    const result = await verifyDKIMSignature(emailBuffer);
    
    return {
      verified: result.verified,
      signingDomain: result.signingDomain,
      selector: result.selector,
      publicKey: result.publicKey,
      signature: result.signature,
      bodyHash: result.bodyHash,
      status: result.status,
      error: result.verified ? null : 'DKIM verification failed',
    };
  } catch (error) {
    console.error('DKIM verification failed:', error);
    return {
      verified: false,
      error: error.message,
    };
  }
}

/**
 * Main function to prepare email for circuit - replaces JWT preparation
 */
export async function prepareEmailForCircuit(emailRaw, options = {}) {
  const {
    maxHeadersLength = DEFAULT_MAX_HEADERS_LENGTH,
    maxBodyLength = DEFAULT_MAX_BODY_LENGTH,
    merkle_root,
    proof_siblings,
    proof_index,
    ...otherOptions
  } = options;

  const dkimVerification = await verifyEmailDKIM(emailRaw);
  if (!dkimVerification.verified) {
    throw new Error(`DKIM verification failed: ${dkimVerification.error || 'Unknown error'}`);
  }

  const emailMetadata = extractEmailMetadata(emailRaw);

  const inputs = await generateInputs({
    emailRaw,
    maxHeadersLength,
    maxBodyLength,
    merkle_root,
    proof_siblings,
    proof_index,
    ...otherOptions,
  });

  return {
    inputs,
    metadata: {
      ...emailMetadata,
      dkimVerified: true,
      signingDomain: dkimVerification.signingDomain,
      selector: dkimVerification.selector,
    },
  };
}

export function splitBigIntToChunks(bigInt, chunkSize, numChunks) {
  const mask = (1n << BigInt(chunkSize)) - 1n;
  const chunks = [];
  for (let i = 0; i < numChunks; i++) {
    const chunk = (bigInt >> (BigInt(i) * BigInt(chunkSize))) & mask;
    chunks.push(chunk);
  }
  return chunks;
}