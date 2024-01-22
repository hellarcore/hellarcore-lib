/* eslint-disable */
// TODO: Remove previous line and work through linting issues at next edit

'use strict';

var _ = require('lohellar');
var $ = require('../util/preconditions');

var constants = require('../constants');
var errors = require('../errors');
var BufferUtil = require('../util/buffer');
var JSUtil = require('../util/js');
var BufferReader = require('../encoding/bufferreader');
var BufferWriter = require('../encoding/bufferwriter');
var Hash = require('../crypto/hash');
var Signature = require('../crypto/signature');
var Sighash = require('./sighash');

var Address = require('../address');
var UnspentOutput = require('./unspentoutput');
var Input = require('./input');
var Output = require('./output');
var Script = require('../script');
var PrivateKey = require('../privatekey');
var BN = require('../crypto/bn');
var Payload = require('./payload');
var Opcode = require('../opcode');

var PublicKeyHashInput = Input.PublicKeyHash;
var PublicKeyInput = Input.PublicKey;
var MultiSigScriptHashInput = Input.MultiSigScriptHash;
var MultiSigInput = Input.MultiSig;
var registeredTransactionTypes = Payload.constants.registeredTransactionTypes;
var WrongOutPointError = errors.WrongOutPointError;
var WrongPublicKeyHashError = errors.WrongPublicKeyHashError;

/**
 * Represents a transaction, a set of inputs and outputs to change ownership of tokens
 *
 * @param {*} serialized
 * @constructor
 */
function Transaction(serialized) {
  if (!(this instanceof Transaction)) {
    return new Transaction(serialized);
  }
  this.inputs = [];
  this.outputs = [];
  this._inputAmount = undefined;
  this._outputAmount = undefined;

  try {
    if (serialized) {
      if (serialized instanceof Transaction) {
        return Transaction.shallowCopy(serialized);
      } else if (JSUtil.isHexa(serialized)) {
        this.fromString(serialized);
      } else if (BufferUtil.isBuffer(serialized)) {
        this.fromBuffer(serialized);
      } else if (_.isObject(serialized)) {
        this.fromObject(serialized);
      } else {
        throw new errors.InvalidArgument(
          'Must provide an object or string to deserialize a transaction'
        );
      }
    } else {
      this._newTransaction();
    }
  } catch (e) {
    console.error(
      `Failed transaction parsing with error ${e.message}. Transaction parameter: ${serialized}`
    );
    throw e;
  }
}

var CURRENT_VERSION = 3;
var SPECIAL_TRANSACTION_ACTIVATION_VERSION = 3;
var DEFAULT_NLOCKTIME = 0;
var MAX_BLOCK_SIZE = 1000000;

// Minimum amount for an output for it not to be considered a dust output
Transaction.DUST_AMOUNT = 5460;

// Margin of error to allow fees in the vicinity of the expected value but doesn't allow a big difference
Transaction.FEE_SECURITY_MARGIN = 15;

// max amount of hellars in circulation
Transaction.MAX_MONEY = 21000000 * 1e8;

// nlocktime limit to be considered block height rather than a timestamp
Transaction.NLOCKTIME_BLOCKHEIGHT_LIMIT = 5e8;

// Max value for an unsigned 32 bit value
Transaction.NLOCKTIME_MAX_VALUE = 4294967295;

// Value used for fee estimation (1000 duffs per kilobyte, 1 duff per byte)
Transaction.FEE_PER_KB = 1000;

// Safe upper bound for change address script size in bytes
Transaction.CHANGE_OUTPUT_MAX_SIZE = 20 + 4 + 34 + 4;
Transaction.MAXIMUM_EXTRA_SIZE = 4 + 9 + 9 + 4;

Transaction.TYPES = registeredTransactionTypes;

Transaction.CURRENT_VERSION = CURRENT_VERSION;

/* Constructors and Serialization */

/**
 * Create a 'shallow' copy of the transaction, by serializing and deserializing
 * it dropping any additional information that inputs and outputs may have hold
 *
 * @param {Transaction} transaction
 * @return {Transaction}
 */
Transaction.shallowCopy = function (transaction) {
  var copy = new Transaction(transaction.toBuffer());
  return copy;
};

/**
 * @param {Buffer} outPointBuffer
 * @return {{outputIndex: number, transactionHash: string}}
 */
Transaction.parseOutPointBuffer = function parseOutPointBuffer(outPointBuffer) {
  if (outPointBuffer.length !== 36) {
    throw new WrongOutPointError(
      'OutPoint buffer length expected to be 36 bytes'
    );
  }

  var bufferReader = new BufferReader(outPointBuffer);
  var transactionHash = bufferReader.read(32).toString('hex');
  var outputIndex = bufferReader.readUInt32LE(4);

  return {
    transactionHash: transactionHash,
    outputIndex: outputIndex,
  };
};

var hashProperty = {
  configurable: false,
  enumerable: true,
  get: function () {
    return new BufferReader(this._getHash()).readReverse().toString('hex');
  },
};
Object.defineProperty(Transaction.prototype, 'hash', hashProperty);
Object.defineProperty(Transaction.prototype, 'id', hashProperty);

var ioProperty = {
  configurable: false,
  enumerable: true,
  get: function () {
    return this._getInputAmount();
  },
};
Object.defineProperty(Transaction.prototype, 'inputAmount', ioProperty);
ioProperty.get = function () {
  return this._getOutputAmount();
};
Object.defineProperty(Transaction.prototype, 'outputAmount', ioProperty);

/**
 * Retrieve the little endian hash of the transaction (used for serialization)
 * @return {Buffer}
 */
Transaction.prototype._getHash = function () {
  return Hash.sha256sha256(this.toBuffer());
};

/**
 * Retrieve a hex string that can be used with bitcoind's CLI interface
 * (decoderawtransaction, sendrawtransaction)
 *
 * @param {Object|boolean=} unsafe if true, skip all tests. if it's an object,
 *   it's expected to contain a set of flags to skip certain tests:
 * * `disableAll`: disable all checks
 * * `disableSmallFees`: disable checking for fees that are too small
 * * `disableLargeFees`: disable checking for fees that are too large
 * * `disableIsFullySigned`: disable checking if all inputs are fully signed
 * * `disableDustOutputs`: disable checking if there are no outputs that are dust amounts
 * * `disableMoreOutputThanInput`: disable checking if the transaction spends more bitcoins than the sum of the input amounts
 * @return {string}
 */
Transaction.prototype.serialize = function (unsafe) {
  if (true === unsafe || (unsafe && unsafe.disableAll)) {
    return this.uncheckedSerialize();
  } else {
    return this.checkedSerialize(unsafe);
  }
};

Transaction.prototype.uncheckedSerialize = Transaction.prototype.toString =
  function () {
    return this.toBuffer().toString('hex');
  };

/**
 * Retrieve a hex string that can be used with bitcoind's CLI interface
 * (decoderawtransaction, sendrawtransaction)
 *
 * @param {Object} opts allows to skip certain tests. {@see Transaction#serialize}
 * @return {string}
 */
Transaction.prototype.checkedSerialize = function (opts) {
  var serializationError = this.getSerializationError(opts);
  if (serializationError) {
    serializationError.message +=
      ' - For more information please see: ' +
      'https://bitcore.io/api/lib/transaction#serialization-checks';
    throw serializationError;
  }
  return this.uncheckedSerialize();
};

Transaction.prototype.invalidhellars = function () {
  var invalid = false;
  for (var i = 0; i < this.outputs.length; i++) {
    if (this.outputs[i].invalidhellars()) {
      invalid = true;
    }
  }
  return invalid;
};

/**
 * Retrieve a possible error that could appear when trying to serialize and
 * broadcast this transaction.
 *
 * @param {Object} opts allows to skip certain tests. {@see Transaction#serialize}
 * @return {bitcore.Error}
 */
Transaction.prototype.getSerializationError = function (opts) {
  opts = opts || {};

  if (this.invalidhellars()) {
    return new errors.Transaction.Invalidhellars();
  }

  var unspent = this._getUnspentValue();
  var unspentError;
  if (unspent < 0) {
    if (!opts.disableMoreOutputThanInput) {
      unspentError = new errors.Transaction.InvalidOutputAmountSum();
    }
  } else {
    unspentError = this._hasFeeError(opts, unspent);
  }

  if (this.isSpecialTransaction() && !this.hasExtraPayload()) {
    return new errors.Transaction.InvalidPayloadSize();
  }

  if (this.hasExtraPayload() && !this.isSpecialTransaction()) {
    return new errors.Transaction.SpecialTransactionTypeIsNotSet();
  }

  var isMissingSignatures = this._isMissingSignatures(opts);
  var hasDustOutputs = this._hasDustOutputs(opts);

  return unspentError || hasDustOutputs || isMissingSignatures;
};

Transaction.prototype._hasFeeError = function (opts, unspent) {
  if (!_.isUndefined(this._fee) && this._fee !== unspent) {
    return new errors.Transaction.FeeError.Different(
      'Unspent value is ' + unspent + ' but specified fee is ' + this._fee
    );
  }

  if (!opts.disableLargeFees) {
    var instantSendFee = this.estimateInstantSendFee();
    var maxFeePerNormalTransaction = Math.floor(
      Transaction.FEE_SECURITY_MARGIN * this._estimateFee()
    );
    var maximumFee = Math.max(maxFeePerNormalTransaction, instantSendFee);
    if (unspent > maximumFee) {
      if (this._missingChange()) {
        return new errors.Transaction.ChangeAddressMissing(
          'Fee is too large and no change address was provided'
        );
      }
      return new errors.Transaction.FeeError.TooLarge(
        'expected less than ' + maximumFee + ' but got ' + unspent
      );
    }
  }

  if (!opts.disableSmallFees) {
    var minimumFee = Math.ceil(
      this._estimateFee() / Transaction.FEE_SECURITY_MARGIN
    );
    if (unspent < minimumFee) {
      return new errors.Transaction.FeeError.TooSmall(
        'expected more than ' + minimumFee + ' but got ' + unspent
      );
    }
  }
};

/**
 * Instant send fee is based on the number of inputs, not on the transaction size
 * @return {number}
 */
Transaction.prototype.estimateInstantSendFee =
  function estimateInstantSendFee() {
    return this.inputs.length * constants.INSTANTSEND_FEE_PER_INPUT;
  };

Transaction.prototype._missingChange = function () {
  return !this._changeScript;
};

Transaction.prototype._hasDustOutputs = function (opts) {
  if (opts.disableDustOutputs) {
    return;
  }
  var index, output;
  for (index in this.outputs) {
    output = this.outputs[index];
    if (
      output.hellars < Transaction.DUST_AMOUNT &&
      !output.script.isDataOut()
    ) {
      return new errors.Transaction.DustOutputs();
    }
  }
};

Transaction.prototype._isMissingSignatures = function (opts) {
  if (opts.disableIsFullySigned) {
    return;
  }
  if (!this.isFullySigned()) {
    return new errors.Transaction.MissingSignatures();
  }
};

Transaction.prototype.inspect = function () {
  return '<Transaction: ' + this.uncheckedSerialize() + '>';
};

/**
 * @private
 * @param {BufferWriter} writer
 * @returns {BufferWriter}
 */
Transaction.prototype.toBufferWriter = function (writer) {
  writer.writeUInt16LE(this.version);
  writer.writeUInt16LE(this.type);
  writer.writeVarintNum(this.inputs.length);
  _.each(this.inputs, function (input) {
    input.toBufferWriter(writer);
  });
  writer.writeVarintNum(this.outputs.length);
  _.each(this.outputs, function (output) {
    output.toBufferWriter(writer);
  });
  writer.writeUInt32LE(this.nLockTime);

  if (this.isSpecialTransaction() && this.hasExtraPayload()) {
    var payload = Payload.serializeToBuffer(this.extraPayload);
    writer.writeVarintNum(payload.length);
    writer.write(payload);
  }
  return writer;
};

Transaction.prototype.toBuffer = function () {
  var writer = new BufferWriter();
  return this.toBufferWriter(writer).toBuffer();
};

Transaction.prototype.fromBufferReader = function (reader) {
  $.checkArgument(!reader.finished(), 'No transaction data received');
  var i, sizeTxIns, sizeTxOuts;

  // Read legacy version
  var n32bitVersion = reader.readInt32LE();
  // Convert legacy version into two 16-bit integers: new version format and type
  this.version = n32bitVersion & 0xffff;
  this.type = (n32bitVersion >> 16) & 0xffff;

  sizeTxIns = reader.readVarintNum();
  for (i = 0; i < sizeTxIns; i++) {
    var input = Input.fromBufferReader(reader);
    this.inputs.push(input);
  }
  sizeTxOuts = reader.readVarintNum();
  for (i = 0; i < sizeTxOuts; i++) {
    this.outputs.push(Output.fromBufferReader(reader));
  }
  this.nLockTime = reader.readUInt32LE();

  if (this.isSpecialTransaction() && !reader.finished()) {
    var extraPayloadSize = reader.readVarintNum();
    if (extraPayloadSize > 0) {
      var payloadBuffer = reader.read(extraPayloadSize);
      this.setExtraPayload(Payload.parseBuffer(this.type, payloadBuffer));
    }
  }

  return this;
};

Transaction.prototype.fromBuffer = function (buffer) {
  var reader = new BufferReader(buffer);
  return this.fromBufferReader(reader);
};

Transaction.prototype.toObject = Transaction.prototype.toJSON =
  function toObject() {
    var inputs = [];
    this.inputs.forEach(function (input) {
      inputs.push(input.toObject());
    });
    var outputs = [];
    this.outputs.forEach(function (output) {
      outputs.push(output.toObject());
    });
    var obj = {
      hash: this.hash,
      version: this.version,
      inputs: inputs,
      outputs: outputs,
      nLockTime: this.nLockTime,
    };
    if (this._changeScript) {
      obj.changeScript = this._changeScript.toString();
    }
    if (!_.isUndefined(this._changeIndex)) {
      obj.changeIndex = this._changeIndex;
    }
    if (!_.isUndefined(this._fee)) {
      obj.fee = this._fee;
    }
    if (this.isSpecialTransaction()) {
      obj.type = this.type;
      obj.extraPayload = Payload.serializeToBuffer(this.extraPayload).toString(
        'hex'
      );
    }
    return obj;
  };

Transaction.prototype.fromObject = function fromObject(arg) {
  /* jshint maxstatements: 20 */
  $.checkArgument(_.isObject(arg) || arg instanceof Transaction);
  var self = this;
  var transaction;
  if (arg instanceof Transaction) {
    transaction = arg.toObject();
  } else {
    transaction = arg;
  }
  _.each(transaction.inputs, function (input) {
    if (!input.output || !input.output.script) {
      self.uncheckedAddInput(new Input(input));
      return;
    }
    var script = new Script(input.output.script);
    var txin;
    if (script.isPublicKeyHashOut()) {
      txin = new Input.PublicKeyHash(input);
    } else if (
      script.isScriptHashOut() &&
      input.publicKeys &&
      input.threshold
    ) {
      txin = new Input.MultiSigScriptHash(
        input,
        input.publicKeys,
        input.threshold,
        input.signatures
      );
    } else if (script.isPublicKeyOut()) {
      txin = new Input.PublicKey(input);
    } else {
      throw new errors.Transaction.Input.UnsupportedScript(input.output.script);
    }
    self.addInput(txin);
  });
  _.each(transaction.outputs, function (output) {
    self.addOutput(new Output(output));
  });
  if (transaction.changeIndex) {
    this._changeIndex = transaction.changeIndex;
  }
  if (transaction.changeScript) {
    this._changeScript = new Script(transaction.changeScript);
  }
  if (transaction.fee) {
    this._fee = transaction.fee;
  }
  this.nLockTime = transaction.nLockTime;
  this.version =
    transaction.version == null ? CURRENT_VERSION : transaction.version;
  if (transaction.type) {
    this.setType(transaction.type);
    this.type = transaction.type;
    if (transaction.extraPayload) {
      this.setExtraPayload(
        Payload.parseBuffer(
          transaction.type,
          Buffer.from(transaction.extraPayload, 'hex')
        )
      );
    }
  }
  this._checkConsistency(arg);
  return this;
};

Transaction.prototype._checkConsistency = function (arg) {
  if (!_.isUndefined(this._changeIndex)) {
    $.checkState(this._changeScript);
    $.checkState(this.outputs[this._changeIndex]);
    $.checkState(
      this.outputs[this._changeIndex].script.toString() ===
        this._changeScript.toString()
    );
  }
  if (arg && arg.hash) {
    $.checkState(
      arg.hash === this.hash,
      'Hash in object does not match transaction hash'
    );
  }
};

/**
 * Sets nLockTime so that transaction is not valid until the desired date(a
 * timestamp in seconds since UNIX epoch is also accepted)
 *
 * @param {Date | Number} time
 * @return {Transaction} this
 */
Transaction.prototype.lockUntilDate = function (time) {
  $.checkArgument(time);
  if (_.isNumber(time) && time < Transaction.NLOCKTIME_BLOCKHEIGHT_LIMIT) {
    throw new errors.Transaction.LockTimeTooEarly();
  }
  if (_.isDate(time)) {
    time = time.getTime() / 1000;
  }

  for (var i = 0; i < this.inputs.length; i++) {
    if (this.inputs[i].sequenceNumber === Input.DEFAULT_SEQNUMBER) {
      this.inputs[i].sequenceNumber = Input.DEFAULT_LOCKTIME_SEQNUMBER;
    }
  }

  this.nLockTime = time;
  return this;
};

/**
 * Sets nLockTime so that transaction is not valid until the desired block
 * height.
 *
 * @param {Number} height
 * @return {Transaction} this
 */
Transaction.prototype.lockUntilBlockHeight = function (height) {
  $.checkArgument(_.isNumber(height));
  if (height >= Transaction.NLOCKTIME_BLOCKHEIGHT_LIMIT) {
    throw new errors.Transaction.BlockHeightTooHigh();
  }
  if (height < 0) {
    throw new errors.Transaction.NLockTimeOutOfRange();
  }

  for (var i = 0; i < this.inputs.length; i++) {
    if (this.inputs[i].sequenceNumber === Input.DEFAULT_SEQNUMBER) {
      this.inputs[i].sequenceNumber = Input.DEFAULT_LOCKTIME_SEQNUMBER;
    }
  }

  this.nLockTime = height;
  return this;
};

/**
 *  Returns a semantic version of the transaction's nLockTime.
 *  @return {Number|Date}
 *  If nLockTime is 0, it returns null,
 *  if it is < 500000000, it returns a block height (number)
 *  else it returns a Date object.
 */
Transaction.prototype.getLockTime = function () {
  if (!this.nLockTime) {
    return null;
  }
  if (this.nLockTime < Transaction.NLOCKTIME_BLOCKHEIGHT_LIMIT) {
    return this.nLockTime;
  }
  return new Date(1000 * this.nLockTime);
};

Transaction.prototype.fromString = function (string) {
  this.fromBuffer(Buffer.from(string, 'hex'));
};

Transaction.prototype._newTransaction = function () {
  this.version = CURRENT_VERSION;
  this.type = registeredTransactionTypes.TRANSACTION_NORMAL;
  this.nLockTime = DEFAULT_NLOCKTIME;
};

/* Transaction creation interface */

/**
 * @typedef {Object} Transaction.fromObject
 * @property {string} prevTxId
 * @property {number} outputIndex
 * @property {(Buffer|string|Script)} script
 * @property {number} hellars
 */

/**
 * Add an input to this transaction. This is a high level interface
 * to add an input, for more control, use @{link Transaction#addInput}.
 *
 * Can receive, as output information, the output of bitcoind's `listunspent` command,
 * and a slightly fancier format recognized by bitcore:
 *
 * ```
 * {
 *  address: 'mszYqVnqKoQx4jcTdJXxwKAissE3Jbrrc1',
 *  txId: 'a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458',
 *  outputIndex: 0,
 *  script: Script.empty(),
 *  hellars: 1020000
 * }
 * ```
 * Where `address` can be either a string or a bitcore Address object. The
 * same is true for `script`, which can be a string or a bitcore Script.
 *
 * Beware that this resets all the signatures for inputs (in further versions,
 * SIGHASH_SINGLE or SIGHASH_NONE signatures will not be reset).
 *
 * @example
 * ```javascript
 * var transaction = new Transaction();
 *
 * // From a pay to public key hash output from bitcoind's listunspent
 * transaction.from({'txid': '0000...', vout: 0, amount: 0.1, scriptPubKey: 'OP_DUP ...'});
 *
 * // From a pay to public key hash output
 * transaction.from({'txId': '0000...', outputIndex: 0, hellars: 1000, script: 'OP_DUP ...'});
 *
 * // From a multisig P2SH output
 * transaction.from({'txId': '0000...', inputIndex: 0, hellars: 1000, script: '... OP_HASH'},
 *                  ['03000...', '02000...'], 2);
 * ```
 *
 * @param {(Array<Transaction.fromObject>|Transaction.fromObject)} utxo
 * @param {Array=} pubkeys
 * @param {number=} threshold
 */
Transaction.prototype.from = function (utxo, pubkeys, threshold) {
  if (_.isArray(utxo)) {
    var self = this;
    _.each(utxo, function (utxo) {
      self.from(utxo, pubkeys, threshold);
    });
    return this;
  }
  var exists = _.some(this.inputs, function (input) {
    // TODO: Maybe prevTxId should be a string? Or defined as read only property?
    return (
      input.prevTxId.toString('hex') === utxo.txId &&
      input.outputIndex === utxo.outputIndex
    );
  });
  if (exists) {
    return this;
  }
  if (pubkeys && threshold) {
    this._fromMultisigUtxo(utxo, pubkeys, threshold);
  } else {
    this._fromNonP2SH(utxo);
  }
  return this;
};

Transaction.prototype._fromNonP2SH = function (utxo) {
  var clazz;
  utxo = new UnspentOutput(utxo);
  if (utxo.script.isPublicKeyHashOut()) {
    clazz = PublicKeyHashInput;
  } else if (utxo.script.isPublicKeyOut()) {
    clazz = PublicKeyInput;
  } else {
    clazz = Input;
  }
  this.addInput(
    new clazz({
      output: new Output({
        script: utxo.script,
        hellars: utxo.hellars,
      }),
      prevTxId: utxo.txId,
      outputIndex: utxo.outputIndex,
      script: Script.empty(),
    })
  );
};

Transaction.prototype._fromMultisigUtxo = function (utxo, pubkeys, threshold) {
  $.checkArgument(
    threshold <= pubkeys.length,
    'Number of required signatures must be greater than the number of public keys'
  );
  var clazz;
  utxo = new UnspentOutput(utxo);
  if (utxo.script.isMultisigOut()) {
    clazz = MultiSigInput;
  } else if (utxo.script.isScriptHashOut()) {
    clazz = MultiSigScriptHashInput;
  } else {
    throw new Error('@TODO');
  }
  this.addInput(
    new clazz(
      {
        output: new Output({
          script: utxo.script,
          hellars: utxo.hellars,
        }),
        prevTxId: utxo.txId,
        outputIndex: utxo.outputIndex,
        script: Script.empty(),
      },
      pubkeys,
      threshold
    )
  );
};

/**
 * Add an input to this transaction. The input must be an instance of the `Input` class.
 * It should have information about the Output that it's spending, but if it's not already
 * set, two additional parameters, `outputScript` and `hellars` can be provided.
 *
 * @param {Input} input
 * @param {String|Script} outputScript
 * @param {number} hellars
 * @return Transaction {this}, for chaining
 */
Transaction.prototype.addInput = function (input, outputScript, hellars) {
  $.checkArgumentType(input, Input, 'input');
  if (
    !input.output &&
    (_.isUndefined(outputScript) || _.isUndefined(hellars))
  ) {
    throw new errors.Transaction.NeedMoreInfo(
      'Need information about the UTXO script and hellars'
    );
  }
  if (!input.output && outputScript && !_.isUndefined(hellars)) {
    outputScript =
      outputScript instanceof Script ? outputScript : new Script(outputScript);
    $.checkArgumentType(hellars, 'number', 'hellars');
    input.output = new Output({
      script: outputScript,
      hellars: hellars,
    });
  }
  return this.uncheckedAddInput(input);
};

/**
 * Add an input to this transaction, without checking that the input has information about
 * the output that it's spending.
 *
 * @param {Input} input
 * @return Transaction {this}, for chaining
 */
Transaction.prototype.uncheckedAddInput = function (input) {
  $.checkArgumentType(input, Input, 'input');
  this.inputs.push(input);
  this._inputAmount = undefined;
  this._updateChangeOutput();
  return this;
};

/**
 * Returns true if the transaction has enough info on all inputs to be correctly validated
 *
 * @return {boolean}
 */
Transaction.prototype.hasAllUtxoInfo = function () {
  return _.some(
    this.inputs.map(function (input) {
      return !!input.output;
    })
  );
};

/**
 * Manually set the fee for this transaction. Beware that this resets all the signatures
 * for inputs (in further versions, SIGHASH_SINGLE or SIGHASH_NONE signatures will not
 * be reset).
 *
 * @param {number} amount hellars to be sent
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.fee = function (amount) {
  $.checkArgument(_.isNumber(amount), 'amount must be a number');
  this._fee = amount;
  this._updateChangeOutput();
  return this;
};

/**
 * Manually set the fee per KB for this transaction. Beware that this resets all the signatures
 * for inputs (in further versions, SIGHASH_SINGLE or SIGHASH_NONE signatures will not
 * be reset).
 *
 * @param {number} amount hellars per KB to be sent
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.feePerKb = function (amount) {
  $.checkArgument(_.isNumber(amount), 'amount must be a number');
  this._feePerKb = amount;
  this._updateChangeOutput();
  return this;
};

/* Output management */

/**
 * Set the change address for this transaction
 *
 * Beware that this resets all the signatures for inputs (in further versions,
 * SIGHASH_SINGLE or SIGHASH_NONE signatures will not be reset).
 *
 * @param {Address} address An address for change to be sent to.
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.change = function (address) {
  $.checkArgument(address, 'address is required');
  this._changeScript = Script.fromAddress(address);
  this._updateChangeOutput();
  return this;
};

/**
 * @return {Output} change output, if it exists
 */
Transaction.prototype.getChangeOutput = function () {
  if (!_.isUndefined(this._changeIndex)) {
    return this.outputs[this._changeIndex];
  }
  return null;
};

/**
 * @typedef {Object} Transaction.toObject
 * @property {(string|Address)} address
 * @property {number} hellars
 */

/**
 * Add an output to the transaction.
 *
 * Beware that this resets all the signatures for inputs (in further versions,
 * SIGHASH_SINGLE or SIGHASH_NONE signatures will not be reset).
 *
 * @param {(string|Address|Array.<Transaction.toObjectParams>)} address
 * @param {number} amount in hellars
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.to = function (address, amount) {
  if (_.isArray(address)) {
    var self = this;
    _.each(address, function (to) {
      self.to(to.address, to.hellars);
    });
    return this;
  }

  $.checkArgument(
    JSUtil.isNaturalNumber(amount),
    'Amount is expected to be a positive integer'
  );
  this.addOutput(
    new Output({
      script: Script(new Address(address)),
      hellars: amount,
    })
  );
  return this;
};

/**
 * Add an OP_RETURN output to the transaction.
 *
 * Beware that this resets all the signatures for inputs (in further versions,
 * SIGHASH_SINGLE or SIGHASH_NONE signatures will not be reset).
 *
 * @param {Buffer|string} value the data to be stored in the OP_RETURN output.
 *    In case of a string, the UTF-8 representation will be stored
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.addData = function (value) {
  this.addOutput(
    new Output({
      script: Script.buildDataOut(value),
      hellars: 0,
    })
  );
  return this;
};

/**
 * Add an output to the transaction.
 *
 * @param {Output} output the output to add.
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.addOutput = function (output) {
  $.checkArgumentType(output, Output, 'output');
  this._addOutput(output);
  this._updateChangeOutput();
  return this;
};

/**
 * Remove all outputs from the transaction.
 *
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.clearOutputs = function () {
  this.outputs = [];
  this._clearSignatures();
  this._outputAmount = undefined;
  this._changeIndex = undefined;
  this._updateChangeOutput();
  return this;
};

Transaction.prototype._addOutput = function (output) {
  this.outputs.push(output);
  this._outputAmount = undefined;
};

/**
 * Calculates or gets the total output amount in hellars
 *
 * @return {Number} the transaction total output amount
 */
Transaction.prototype._getOutputAmount = function () {
  if (_.isUndefined(this._outputAmount)) {
    var self = this;
    this._outputAmount = 0;
    _.each(this.outputs, function (output) {
      self._outputAmount += output.hellars;
    });
  }
  return this._outputAmount;
};

/**
 * Calculates or gets the total input amount in hellars
 *
 * @return {Number} the transaction total input amount
 */
Transaction.prototype._getInputAmount = function () {
  if (_.isUndefined(this._inputAmount)) {
    var self = this;
    this._inputAmount = 0;
    _.each(this.inputs, function (input) {
      if (_.isUndefined(input.output)) {
        throw new errors.Transaction.Input.MissingPreviousOutput();
      }
      self._inputAmount += input.output.hellars;
    });
  }
  return this._inputAmount;
};

Transaction.prototype._updateChangeOutput = function () {
  if (!this._changeScript) {
    return;
  }
  this._clearSignatures();
  if (!_.isUndefined(this._changeIndex)) {
    this._removeOutput(this._changeIndex);
  }
  var available = this._getUnspentValue();
  var fee = this.getFee();
  var changeAmount = available - fee;
  if (changeAmount > 0) {
    this._changeIndex = this.outputs.length;
    this._addOutput(
      new Output({
        script: this._changeScript,
        hellars: changeAmount,
      })
    );
  } else {
    this._changeIndex = undefined;
  }
};
/**
 * Calculates the fee of the transaction.
 *
 * If there's a fixed fee set, return that.
 *
 * If there is no change output set, the fee is the
 * total value of the outputs minus inputs. Note that
 * a serialized transaction only specifies the value
 * of its outputs. (The value of inputs are recorded
 * in the previous transaction outputs being spent.)
 * This method therefore raises a "MissingPreviousOutput"
 * error when called on a serialized transaction.
 *
 * If there's no fee set and no change address,
 * estimate the fee based on size.
 *
 * @return {Number} fee of this transaction in hellars
 */
Transaction.prototype.getFee = function () {
  if (this.isCoinbase()) {
    return 0;
  }
  if (!_.isUndefined(this._fee)) {
    return this._fee;
  }
  // if no change output is set, fees should equal all the unspent amount
  if (!this._changeScript) {
    return this._getUnspentValue();
  }
  return this._estimateFee();
};

/**
 * Estimates fee from serialized transaction size in bytes.
 */
Transaction.prototype._estimateFee = function () {
  var estimatedSize = this._estimateSize();
  var available = this._getUnspentValue();
  return Transaction._estimateFee(estimatedSize, available, this._feePerKb);
};

Transaction.prototype._getUnspentValue = function () {
  return this._getInputAmount() - this._getOutputAmount();
};

Transaction.prototype._clearSignatures = function () {
  _.each(this.inputs, function (input) {
    input.clearSignatures();
  });
};

Transaction._estimateFee = function (size, amountAvailable, feePerKb) {
  var fee = Math.ceil(size / 1000) * (feePerKb || Transaction.FEE_PER_KB);
  if (amountAvailable > fee) {
    size += Transaction.CHANGE_OUTPUT_MAX_SIZE;
  }
  return Math.ceil(size / 1000) * (feePerKb || Transaction.FEE_PER_KB);
};

Transaction.prototype._estimateSize = function () {
  var result = Transaction.MAXIMUM_EXTRA_SIZE;
  _.each(this.inputs, function (input) {
    result += input._estimateSize();
  });
  _.each(this.outputs, function (output) {
    result += output.script.toBuffer().length + 9;
  });
  return result;
};

Transaction.prototype._removeOutput = function (index) {
  var output = this.outputs[index];
  this.outputs = _.without(this.outputs, output);
  this._outputAmount = undefined;
};

Transaction.prototype.removeOutput = function (index) {
  this._removeOutput(index);
  this._updateChangeOutput();
};

/**
 * Sort a transaction's inputs and outputs according to BIP69
 *
 * @see {@link https://github.com/bitcoin/bips/blob/master/bip-0069.mediawiki}
 * @return {Transaction} this
 */
Transaction.prototype.sort = function () {
  this.sortInputs(function (inputs) {
    var copy = Array.prototype.concat.apply([], inputs);
    copy.sort(function (first, second) {
      return (
        Buffer.compare(first.prevTxId, second.prevTxId) ||
        first.outputIndex - second.outputIndex
      );
    });
    return copy;
  });
  this.sortOutputs(function (outputs) {
    var copy = Array.prototype.concat.apply([], outputs);
    copy.sort(function (first, second) {
      return (
        first.hellars - second.hellars ||
        Buffer.compare(first.script.toBuffer(), second.script.toBuffer())
      );
    });
    return copy;
  });
  return this;
};

/**
 * Randomize this transaction's outputs ordering. The shuffling algorithm is a
 * version of the Fisher-Yates shuffle, provided by lohellar's _.shuffle().
 *
 * @return {Transaction} this
 */
Transaction.prototype.shuffleOutputs = function () {
  return this.sortOutputs(_.shuffle);
};

/**
 * Sort this transaction's outputs, according to a given sorting function that
 * takes an array as argument and returns a new array, with the same elements
 * but with a different order. The argument function MUST NOT modify the order
 * of the original array
 *
 * @param {Function} sortingFunction
 * @return {Transaction} this
 */
Transaction.prototype.sortOutputs = function (sortingFunction) {
  var outs = sortingFunction(this.outputs);
  return this._newOutputOrder(outs);
};

/**
 * Sort this transaction's inputs, according to a given sorting function that
 * takes an array as argument and returns a new array, with the same elements
 * but with a different order.
 *
 * @param {Function} sortingFunction
 * @return {Transaction} this
 */
Transaction.prototype.sortInputs = function (sortingFunction) {
  this.inputs = sortingFunction(this.inputs);
  this._clearSignatures();
  return this;
};

Transaction.prototype._newOutputOrder = function (newOutputs) {
  var isInvalidSorting =
    this.outputs.length !== newOutputs.length ||
    _.difference(this.outputs, newOutputs).length !== 0;
  if (isInvalidSorting) {
    throw new errors.Transaction.InvalidSorting();
  }

  if (!_.isUndefined(this._changeIndex)) {
    var changeOutput = this.outputs[this._changeIndex];
    this._changeIndex = _.findIndex(newOutputs, changeOutput);
  }

  this.outputs = newOutputs;
  return this;
};

Transaction.prototype.removeInput = function (txId, outputIndex) {
  var index;
  if (!outputIndex && _.isNumber(txId)) {
    index = txId;
  } else {
    index = _.findIndex(this.inputs, function (input) {
      return (
        input.prevTxId.toString('hex') === txId &&
        input.outputIndex === outputIndex
      );
    });
  }
  if (index < 0 || index >= this.inputs.length) {
    throw new errors.Transaction.InvalidIndex(index, this.inputs.length);
  }
  var input = this.inputs[index];
  this.inputs = _.without(this.inputs, input);
  this._inputAmount = undefined;
  this._updateChangeOutput();
};

/* Signature handling */

/**
 * Sign the transaction using one or more private keys.
 *
 * It tries to sign each input, verifying that the signature will be valid
 * (matches a public key).
 *
 * @param {Array|String|PrivateKey} privateKey
 * @param {number} [sigtype]
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.sign = function (privateKey, sigtype) {
  $.checkState(this.hasAllUtxoInfo());
  var self = this;
  if (_.isArray(privateKey)) {
    _.each(privateKey, function (privateKey) {
      self.sign(privateKey, sigtype);
    });
    return this;
  }
  _.each(this.getSignatures(privateKey, sigtype), function (signature) {
    self.applySignature(signature);
  });
  return this;
};

Transaction.prototype.getSignatures = function (privKey, sigtype) {
  privKey = new PrivateKey(privKey);
  sigtype = sigtype || Signature.SIGHASH_ALL;
  var transaction = this;
  var results = [];
  var hashData = Hash.sha256ripemd160(privKey.publicKey.toBuffer());
  _.each(this.inputs, function forEachInput(input, index) {
    _.each(
      input.getSignatures(transaction, privKey, index, sigtype, hashData),
      function (signature) {
        results.push(signature);
      }
    );
  });
  return results;
};

/**
 * Add a signature to the transaction
 *
 * @param {Object} signature
 * @param {number} signature.inputIndex
 * @param {number} signature.sigtype
 * @param {PublicKey} signature.publicKey
 * @param {Signature} signature.signature
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.applySignature = function (signature) {
  this.inputs[signature.inputIndex].addSignature(this, signature);
  return this;
};

/**
 * Check whether the transaction is fully signed
 *
 * @return {boolean}
 */
Transaction.prototype.isFullySigned = function () {
  _.each(this.inputs, function (input) {
    if (input.isFullySigned === Input.prototype.isFullySigned) {
      throw new errors.Transaction.UnableToVerifySignature(
        'Unrecognized script kind, or not enough information to execute script.' +
          'This usually happens when creating a transaction from a serialized transaction'
      );
    }
  });
  return _.some(
    _.map(this.inputs, function (input) {
      return input.isFullySigned();
    })
  );
};

/**
 * Check whether the signature is valid
 *
 * @param signature
 * @return {Boolean}
 */
Transaction.prototype.isValidSignature = function (signature) {
  var self = this;
  if (
    this.inputs[signature.inputIndex].isValidSignature ===
    Input.prototype.isValidSignature
  ) {
    throw new errors.Transaction.UnableToVerifySignature(
      'Unrecognized script kind, or not enough information to execute script.' +
        'This usually happens when creating a transaction from a serialized transaction'
    );
  }
  return this.inputs[signature.inputIndex].isValidSignature(self, signature);
};

/**
 * @returns {bool} whether the signature is valid for this transaction input
 */
Transaction.prototype.verifySignature = function (sig, pubkey, nin, subscript) {
  return Sighash.verify(this, sig, pubkey, nin, subscript);
};

/**
 * Check that a transaction passes basic sanity tests. If not, return a string
 * describing the error. This function contains the same logic as
 * CheckTransaction in bitcoin core.
 *
 * @return {Boolean|String} true or reason for failure as a string
 */
Transaction.prototype.verify = function () {
  // Basic checks that don't depend on any context
  if (this.inputs.length === 0) {
    return 'transaction txins empty';
  }

  if (this.outputs.length === 0) {
    return 'transaction txouts empty';
  }

  // Check for negative or overflow output values
  var valueoutbn = new BN(0);
  for (var i = 0; i < this.outputs.length; i++) {
    var txout = this.outputs[i];

    if (txout.invalidhellars()) {
      return 'transaction txout ' + i + ' hellars is invalid';
    }
    if (txout._hellarsBN.gt(new BN(Transaction.MAX_MONEY, 10))) {
      return 'transaction txout ' + i + ' greater than MAX_MONEY';
    }
    valueoutbn = valueoutbn.add(txout._hellarsBN);
    if (valueoutbn.gt(new BN(Transaction.MAX_MONEY))) {
      return 'transaction txout ' + i + ' total output greater than MAX_MONEY';
    }
  }

  // Size limits
  if (this.toBuffer().length > MAX_BLOCK_SIZE) {
    return 'transaction over the maximum block size';
  }

  // Check for duplicate inputs
  var txinmap = {};
  for (i = 0; i < this.inputs.length; i++) {
    var txin = this.inputs[i];

    var inputid = txin.prevTxId + ':' + txin.outputIndex;
    if (!_.isUndefined(txinmap[inputid])) {
      return 'transaction input ' + i + ' duplicate input';
    }
    txinmap[inputid] = true;
  }

  var isCoinbase = this.isCoinbase();
  if (isCoinbase) {
    var buf = this.inputs[0]._scriptBuffer;
    if (buf.length < 2 || buf.length > 100) {
      return 'coinbase transaction script size invalid';
    }
  } else {
    for (i = 0; i < this.inputs.length; i++) {
      if (this.inputs[i].isNull()) {
        return 'transaction input ' + i + ' has null input';
      }
    }
  }
  return true;
};

/**
 * Analogous to bitcoind's IsCoinBase function in transaction.h
 * @returns {boolean}
 */
Transaction.prototype.isCoinbase = function () {
  return this.inputs.length === 1 && this.inputs[0].isNull();
};

/* DIP2 special transaction methods */

/**
 * Set special transaction type and create an empty extraPayload
 * @param {number} type
 * @returns {Transaction}
 */
Transaction.prototype.setType = function (type) {
  if (Boolean(this.type)) {
    throw new Error('Type is already set');
  }
  $.checkArgumentType(type, 'number');

  this.type = type;
  this.setExtraPayload(Payload.create(type));

  return this;
};

/**
 * Returns true if this transaction is DIP2 special transaction, returns false otherwise.
 * @returns {boolean}
 */
Transaction.prototype.isSpecialTransaction = function () {
  return (
    this.version >= SPECIAL_TRANSACTION_ACTIVATION_VERSION &&
    !!this.type &&
    this.type !== registeredTransactionTypes.TRANSACTION_NORMAL
  );
};

/**
 * Checks if transaction has DIP2 extra payload
 * @returns {boolean}
 */
Transaction.prototype.hasExtraPayload = function () {
  return !!this.extraPayload;
};

/**
 * @param {AbstractPayload} payload
 * @return {Transaction}
 */
Transaction.prototype.setExtraPayload = function (payload) {
  if (!Boolean(this.type)) {
    throw new Error('Transaction type is not set');
  }
  if (!Payload.hasCorrectType(this.type, payload)) {
    throw new Error("Payload doesn't match the transaction type");
  }
  this.extraPayload = payload;
  return this;
};

/**
 * Return extra payload size in bytes
 * @return {Number}
 */
Transaction.prototype.getExtraPayloadSize = function getExtraPayloadSize() {
  return Payload.serializeToBuffer(this.extraPayload).length;
};

/**
 * @param {number} fundingAmount
 * @return {Transaction}
 */
Transaction.prototype.addFundingOutput = function addFundingOutput(
  fundingAmount
) {
  var script = new Script().add('OP_RETURN');
  var output = new Output({
    hellars: fundingAmount,
    script: script,
  });
  this.addOutput(output);
  return this;
};

/**
 * @param {Number} hellarsToBurn
 * @param {Buffer} publicKeyHash
 * @return {Transaction}
 */
Transaction.prototype.addBurnOutput = function addBurnOutput(
  hellarsToBurn,
  publicKeyHash
) {
  if (publicKeyHash.length !== 20) {
    throw new WrongPublicKeyHashError(
      'Expect public key hash to be 20 bytes long'
    );
  }

  var script = new Script().add(Opcode.OP_RETURN).add(publicKeyHash);
  var output = new Output({
    hellars: hellarsToBurn,
    script: script,
  });
  this.addOutput(output);
  return this;
};

/**
 * Gives an OutPoint buffer for the output at a given index
 *
 * @param {Number} outputIndex
 * @return {Buffer}
 */
Transaction.prototype.getOutPointBuffer = function getOutPointBuffer(
  outputIndex
) {
  if (!this.outputs[outputIndex]) {
    throw new WrongOutPointError(
      "There's no output with such index in the transaction"
    );
  }

  var binaryTransactionHash = this._getHash();
  var indexBuffer = Buffer.alloc(4);

  indexBuffer.writeUInt32LE(outputIndex, 0);

  return Buffer.concat([binaryTransactionHash, indexBuffer]);
};

module.exports = Transaction;