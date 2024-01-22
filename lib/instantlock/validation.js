const $ = require('../util/preconditions');
const { isHexStringOfSize, isUnsignedInteger } = require('../util/js');
const constants = require('../constants');

const { SHA256_HASH_SIZE, BLS_SIGNATURE_SIZE } = constants;

/**
 * Validates Instant Locks v17
 * @param {InstantLock} instantLock
 */
function validateV17(instantLock) {
  $.checkArgument(
    instantLock.inputs.length > 0,
    "TXs with no inputs can't be locked"
  );
  $.checkArgument(
    isHexStringOfSize(instantLock.inputs[0].outpointHash, SHA256_HASH_SIZE * 2),
    `Expected outpointHash to be a hex string of size ${SHA256_HASH_SIZE}`
  );
  $.checkArgument(
    isHexStringOfSize(instantLock.txid.toString('hex'), SHA256_HASH_SIZE * 2),
    `Expected txid to be a hex string of size ${SHA256_HASH_SIZE}`
  );
  $.checkArgument(
    isHexStringOfSize(instantLock.signature.toString('hex'), BLS_SIGNATURE_SIZE * 2),
    'Expected signature to be a bls signature'
  );
}

/**
 * Validates Instant Locks v18
 * @param {InstantLock} instantLock
 */
function validateV18(instantLock) {
  validateV17(instantLock);

  $.checkArgument(
    isUnsignedInteger(instantLock.version),
    "Expected version to be an unsigned integer"
  );
  $.checkArgument(
    isHexStringOfSize(instantLock.cyclehash.toString('hex'), SHA256_HASH_SIZE * 2),
    `Expected cycleHash to be a hex string of size ${SHA256_HASH_SIZE}`
  );
}

module.exports = {
  validateV17,
  validateV18
}
