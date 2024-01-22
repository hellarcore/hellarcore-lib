const _ = require('lohellar');
const BN = require('../crypto/bn');
const bufferUtil = require('../util/buffer');
const JSUtil = require('../util/js');
const BufferWriter = require('../encoding/bufferwriter');
const Script = require('../script');
const $ = require('../util/preconditions');
const errors = require('../errors');

const MAX_SAFE_INTEGER = 0x1fffffffffffff;

/**
 * Instantiate an Output from an Object

 * @param args
 * @returns {Output}
 * @constructor
 */
function Output(args) {
  if (!(this instanceof Output)) {
    return new Output(args);
  }
  if (_.isObject(args)) {
    this.hellars = args.hellars;
    if (bufferUtil.isBuffer(args.script)) {
      this._scriptBuffer = args.script;
    } else {
      let script;
      if (_.isString(args.script) && JSUtil.isHexa(args.script)) {
        script = Buffer.from(args.script, 'hex');
      } else {
        // eslint-disable-next-line prefer-destructuring
        script = args.script;
      }
      this.setScript(script);
    }
  } else {
    throw new TypeError('Unrecognized argument for Output');
  }
}

Object.defineProperty(Output.prototype, 'script', {
  configurable: false,
  enumerable: true,
  get() {
    if (this._script) {
      return this._script;
    }
    this.setScriptFromBuffer(this._scriptBuffer);
    return this._script;
  },
});

Object.defineProperty(Output.prototype, 'hellars', {
  configurable: false,
  enumerable: true,
  get() {
    return this._hellars;
  },
  set(num) {
    if (num instanceof BN) {
      this._hellarsBN = num;
      this._hellars = num.toNumber();
    } else if (_.isString(num)) {
      this._hellars = parseInt(num, 10);
      this._hellarsBN = BN.fromNumber(this._hellars);
    } else {
      $.checkArgument(
        JSUtil.isNaturalNumber(num),
        'Output hellars is not a natural number'
      );
      this._hellarsBN = BN.fromNumber(num);
      this._hellars = num;
    }
    $.checkState(
      JSUtil.isNaturalNumber(this._hellars),
      'Output hellars is not a natural number'
    );
  },
});

/**
 * @function
 * Tests if the hellars amount is invalid
 * @returns {String|Boolean} return reason as string if invalid, or false
 */
Output.prototype.invalidhellars = function () {
  if (this._hellars > MAX_SAFE_INTEGER) {
    return 'transaction txout hellars greater than max safe integer';
  }
  if (this._hellars !== this._hellarsBN.toNumber()) {
    return 'transaction txout hellars has corrupted value';
  }
  if (this._hellars < 0) {
    return 'transaction txout negative';
  }
  return false;
};

/**
 * @function
 * @returns {Object} A plain object with the output information
 */
Output.prototype.toJSON = function toObject() {
  const obj = {
    hellars: this.hellars,
  };
  obj.script = this._scriptBuffer.toString('hex');
  return obj;
};

/**
 * @function
 * @returns {Object} A plain object with the output information
 */
Output.prototype.toObject = Output.prototype.toJSON;

/**
 * Instantiate an Output from an Object
 *
 * @param {Object} data - An Object containing hellars and script
 * @returns {Output} A instance of an Output
 */
Output.fromObject = function (data) {
  return new Output(data);
};

/**
 * Set a script from a Buffer
 * Replace any previously set script
 *
 * @param {Buffer} buffer
 * @return {Output}
 */
Output.prototype.setScriptFromBuffer = function (buffer) {
  this._scriptBuffer = buffer;
  try {
    this._script = Script.fromBuffer(this._scriptBuffer);
    this._script._isOutput = true;
  } catch (e) {
    if (e instanceof errors.Script.InvalidBuffer) {
      this._script = null;
    } else {
      throw e;
    }
  }
};

/**
 * Set a script from a Script, a buffer or it's String representation.
 * Replace any previously set script
 *
 * @param {Script|Buffer|String} script
 * @return {Output}
 */
Output.prototype.setScript = function (script) {
  if (script instanceof Script) {
    this._scriptBuffer = script.toBuffer();
    this._script = script;
    this._script._isOutput = true;
  } else if (_.isString(script)) {
    this._script = Script.fromString(script);
    this._scriptBuffer = this._script.toBuffer();
    this._script._isOutput = true;
  } else if (bufferUtil.isBuffer(script)) {
    this.setScriptFromBuffer(script);
  } else {
    throw new TypeError('Invalid argument type: script');
  }
  return this;
};

/**
 * Will return a string formatted for the console
 *
 * @returns {string} Output
 */
Output.prototype.inspect = function () {
  let scriptStr;
  if (this.script) {
    scriptStr = this.script.inspect();
  } else {
    scriptStr = this._scriptBuffer.toString('hex');
  }
  return `<Output (${this.hellars} sats) ${scriptStr}>`;
};

/**
 * Will create an Output from a bufferReader
 *
 * @returns {Output} output
 */
Output.fromBufferReader = function (br) {
  const obj = {};
  obj.hellars = br.readUInt64LEBN();
  const size = br.readVarintNum();
  if (size !== 0) {
    obj.script = br.read(size);
  } else {
    obj.script = Buffer.from([]);
  }
  return new Output(obj);
};

/**
 * Will return a BufferWriter instance with Output as value
 *
 * @params {BufferWriter} writer?
 * @returns {BufferWriter} writer
 */
Output.prototype.toBufferWriter = function (writer) {
  const bufferWriter = writer || new BufferWriter();
  bufferWriter.writeUInt64LEBN(this._hellarsBN);
  const script = this._scriptBuffer;
  bufferWriter.writeVarintNum(script.length);
  bufferWriter.write(script);
  return bufferWriter;
};

module.exports = Output;
