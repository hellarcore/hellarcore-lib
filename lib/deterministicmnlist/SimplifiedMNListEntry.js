const _ = require('lohellar');
const BufferReader = require('../encoding/bufferreader');
const BufferWriter = require('../encoding/bufferwriter');
const BufferUtil = require('../util/buffer');
const $ = require('../util/preconditions');
const Hash = require('../crypto/hash');
const constants = require('../constants');
const utils = require('../util/js');
const ipUtils = require('../util/ip');
const Address = require('../address');
const Networks = require('../networks');

const isSha256 = utils.isSha256HexString;
const { isHexStringOfSize } = utils;
const isHexString = utils.isHexaString;
const parseIp = ipUtils.bufferToIPAndPort;
const serializeIp = ipUtils.ipAndPortToBuffer;

const {
  SHA256_HASH_SIZE,
  BLS_PUBLIC_KEY_SIZE,
  PUBKEY_ID_SIZE,
  PLATFORM_NODE_ID_SIZE,
  MASTERNODE_TYPE_HP,
} = constants;

/**
 * @typedef {Object} SMLEntry
 * @property {string} proRegTxHash
 * @property {string} confirmedHash
 * @property {string} service - ip and port
 * @property {string} pubKeyOperator - operator public key
 * @property {string} votingAddress
 * @property {boolean} isValid
 * @property {number} [nVersion]
 * @property {number} [nType]
 * @property {number} [platformHTTPPort]
 * @property {string} [platformNodeID]
 * @property {string} [payoutAddress]
 * @property {string} [operatorPayoutAddress]
 */

/**
 * @class SimplifiedMNListEntry
 * @param {string|Object|Buffer} arg - A Buffer, JSON string, or Object representing a SmlEntry
 * @param {string} [network]
 * @constructor
 * @property {string} proRegTxHash
 * @property {string} confirmedHash
 * @property {string} service - ip and port
 * @property {string} pubKeyOperator - operator public key
 * @property {string} votingAddress
 * @property {boolean} isValid
 * @property {number} [nVersion]
 * @property {number} [nType]
 * @property {string} [platformHTTPPort]
 * @property {number} [platformNodeID]
 * @property {string} [payoutAddress]
 * @property {string} [operatorPayoutAddress]
 */
function SimplifiedMNListEntry(arg, network) {
  if (arg) {
    const validNetwork = Networks.get(network);

    if (arg instanceof SimplifiedMNListEntry) {
      return arg.copy();
    }
    if (BufferUtil.isBuffer(arg)) {
      return SimplifiedMNListEntry.fromBuffer(arg, validNetwork);
    }
    if (_.isObject(arg)) {
      return SimplifiedMNListEntry.fromObject(arg);
    }
    if (arg instanceof SimplifiedMNListEntry) {
      return arg.copy();
    }
    if (isHexString(arg)) {
      return SimplifiedMNListEntry.fromHexString(arg, validNetwork);
    }
    throw new TypeError('Unrecognized argument for SimplifiedMNListEntry');
  }
}

/**
 * Parse buffer and returns SimplifiedMNListEntry
 * @param {Buffer} buffer
 * @param {string} [network]
 * @return {SimplifiedMNListEntry}
 */
SimplifiedMNListEntry.fromBuffer = function fromBuffer(buffer, network) {
  const bufferReader = new BufferReader(buffer);

  const object = { };

  object.proRegTxHash = bufferReader.read(SHA256_HASH_SIZE).reverse().toString('hex');
  object.confirmedHash = bufferReader
      .read(SHA256_HASH_SIZE)
      .reverse()
      .toString('hex');
  object.service = parseIp(bufferReader.read(ipUtils.IP_AND_PORT_SIZE));
  object.pubKeyOperator = bufferReader.read(BLS_PUBLIC_KEY_SIZE).toString('hex');
  object.votingAddress = Address.fromPublicKeyHash(
      bufferReader.read(PUBKEY_ID_SIZE),
      network
    ).toString();

  object.isValid = Boolean(bufferReader.readUInt8());

  // In case of version 2, sml entry should contain more fields but
  // we don't know version here

  if (!bufferReader.finished()) {
    object.nType = bufferReader.readUInt16LE();
  }

  if (object.nType === MASTERNODE_TYPE_HP) {
    object.nVersion = 2;
    object.platformHTTPPort = bufferReader.readUInt16LE();
    object.platformNodeID = bufferReader.read(PLATFORM_NODE_ID_SIZE).reverse().toString('hex');
  }

  return SimplifiedMNListEntry.fromObject(object);
};

/**
 * @param {string} string
 * @param {string} [network]
 * @return {SimplifiedMNListEntry}
 */
SimplifiedMNListEntry.fromHexString = function fromHexString(string, network) {
  return SimplifiedMNListEntry.fromBuffer(Buffer.from(string, 'hex'), network);
};

/**
 * Serialize SML entry to buffer
 * @return {Buffer}
 */
SimplifiedMNListEntry.prototype.toBuffer = function toBuffer() {
  this.validate();
  const bufferWriter = new BufferWriter();

  bufferWriter.write(Buffer.from(this.proRegTxHash, 'hex').reverse());
  bufferWriter.write(Buffer.from(this.confirmedHash, 'hex').reverse());
  bufferWriter.write(serializeIp(this.service));
  bufferWriter.write(Buffer.from(this.pubKeyOperator, 'hex'));
  bufferWriter.write(
    Buffer.from(Address.fromString(this.votingAddress).hashBuffer, 'hex')
  );
  bufferWriter.writeUInt8(Number(this.isValid));

  if (this.nVersion === 2) {
    if (typeof this.nType === 'number') {
      bufferWriter.writeUInt16LE(this.nType);

      if (this.nType === MASTERNODE_TYPE_HP) {
        bufferWriter.writeUInt16LE(this.platformHTTPPort);
        bufferWriter.write(Buffer.from(this.platformNodeID, 'hex').reverse());
      }
    }
  }

  return bufferWriter.toBuffer();
};

/**
 * Create SMLEntry from an object
 * @param {SMLEntry} obj
 * @return {SimplifiedMNListEntry}
 */
SimplifiedMNListEntry.fromObject = function fromObject(obj) {
  const SMLEntry = new SimplifiedMNListEntry();
  SMLEntry.proRegTxHash = obj.proRegTxHash;
  SMLEntry.confirmedHash = obj.confirmedHash;
  SMLEntry.service = obj.service;
  SMLEntry.pubKeyOperator = obj.pubKeyOperator;
  SMLEntry.votingAddress = obj.votingAddress;
  SMLEntry.isValid = obj.isValid;
  SMLEntry.nVersion = obj.nVersion;
  SMLEntry.nType = obj.nType;
  SMLEntry.platformHTTPPort = obj.platformHTTPPort;
  SMLEntry.platformNodeID = obj.platformNodeID;
  SMLEntry.payoutAddress = obj.payoutAddress;
  SMLEntry.operatorPayoutAddress = obj.operatorPayoutAddress;
  SMLEntry.network = Address.fromString(obj.votingAddress).network;

  SMLEntry.validate();

  return SMLEntry;
};

SimplifiedMNListEntry.prototype.validate = function validate() {
  $.checkArgument(
    isSha256(this.proRegTxHash),
    'Expected proRegTxHash to be a sha256 hex string'
  );
  $.checkArgument(
    isSha256(this.confirmedHash),
    'Expected confirmedHash to be a sha256 hex string'
  );
  if (!ipUtils.isZeroAddress(this.service)) {
    $.checkArgument(
      ipUtils.isIPV4(this.service),
      'Expected service to be a string with ip address and port'
    );
  }
  $.checkArgument(
    isHexStringOfSize(this.pubKeyOperator, BLS_PUBLIC_KEY_SIZE * 2),
    'Expected pubKeyOperator to be a pubkey id'
  );
  $.checkArgument(
    Address.isValid(this.votingAddress),
    'votingAddress is not valid'
  );
  $.checkArgument(
    typeof this.isValid === 'boolean',
    'Expected isValid to be a boolean'
  );
  $.checkArgument(
    typeof this.nType === 'number',
    'Expected nType to be a number'
  );

  if (this.nType === constants.MASTERNODE_TYPE_HP) {
    $.checkArgument(
      typeof this.platformHTTPPort === 'number',
      'Expected platformHTTPPort to be a number'
    );

    $.checkArgument(
      typeof this.platformNodeID === 'string',
      'Expected platformNodeID to be a string'
    );
  }
};

SimplifiedMNListEntry.prototype.toObject = function toObject() {
  const result = {
    proRegTxHash: this.proRegTxHash,
    confirmedHash: this.confirmedHash,
    service: this.service,
    pubKeyOperator: this.pubKeyOperator,
    votingAddress: this.votingAddress,
    isValid: this.isValid,
  };

  if (typeof this.nVersion === 'number') {
    result.nVersion = this.nVersion;
  }

  if (typeof this.nType === 'number') {
    result.nType = this.nType;
  }

  if (this.payoutAddress) {
    result.payoutAddress = this.payoutAddress;
  }

  if (this.operatorPayoutAddress) {
    result.operatorPayoutAddress = this.operatorPayoutAddress;
  }

  if (this.platformHTTPPort) {
    result.platformHTTPPort = this.platformHTTPPort;
  }

  if (this.platformNodeID) {
    result.platformNodeID = this.platformNodeID;
  }

  return result;
};

/**
 * @return {Buffer}
 */
SimplifiedMNListEntry.prototype.calculateHash = function calculateHash() {
  return Hash.sha256sha256(this.toBuffer());
};

/**
 * Gets the ip from the service property
 * @return {string}
 */
SimplifiedMNListEntry.prototype.getIp = function getIp() {
  return this.service.split(':')[0];
};

/**
 * Serialize confirmed hash with proRegTxHash for MN scores
 * and quorum member selection
 * @return {Buffer}
 */
SimplifiedMNListEntry.prototype.confirmedHashWithProRegTxHash =
  function confirmedHashWithProRegTxHash() {
    const bufferWriter = new BufferWriter();
    bufferWriter.write(Buffer.from(this.confirmedHash, 'hex'));
    bufferWriter.write(Buffer.from(this.proRegTxHash, 'hex'));
    return Hash.sha256(bufferWriter.toBuffer().reverse()).reverse();
  };

/**
 * Creates a copy of SimplifiedMNListEntry
 * @return {SimplifiedMNListEntry}
 */
SimplifiedMNListEntry.prototype.copy = function copy() {
  return _.cloneDeep(this);
};

module.exports = SimplifiedMNListEntry;
