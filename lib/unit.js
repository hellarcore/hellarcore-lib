/* eslint-disable */
// TODO: Remove previous line and work through linting issues at next edit

'use strict';

var _ = require('lohellar');

var errors = require('./errors');
var $ = require('./util/preconditions');

var UNITS = {
  BTC: [1e8, 8],
  mBTC: [1e5, 5],
  uBTC: [1e2, 2],
  bits: [1e2, 2],
  hellars: [1, 0],
};

/**
 * Utility for handling and converting bitcoins units. The supported units are
 * BTC, mBTC, bits (also named uBTC) and hellars. A unit instance can be created with an
 * amount and a unit code, or alternatively using static methods like {fromBTC}.
 * It also allows to be created from a fiat amount and the exchange rate, or
 * alternatively using the {fromFiat} static method.
 * You can consult for different representation of a unit instance using it's
 * {to} method, the fixed unit methods like {tohellars} or alternatively using
 * the unit accessors. It also can be converted to a fiat amount by providing the
 * corresponding BTC/fiat exchange rate.
 *
 * @example
 * ```javascript
 * var sats = Unit.fromBTC(1.3).tohellars();
 * var mili = Unit.fromBits(1.3).to(Unit.mBTC);
 * var bits = Unit.fromFiat(1.3, 350).bits;
 * var btc = new Unit(1.3, Unit.bits).BTC;
 * ```
 *
 * @param {Number} amount - The amount to be represented
 * @param {String|Number} code - The unit of the amount or the exchange rate
 * @returns {Unit} A new instance of a Unit
 * @constructor
 */
function Unit(amount, code) {
  if (!(this instanceof Unit)) {
    return new Unit(amount, code);
  }

  // convert fiat to BTC
  if (_.isNumber(code)) {
    if (code <= 0) {
      throw new errors.Unit.InvalidRate(code);
    }
    amount = amount / code;
    code = Unit.BTC;
  }

  this._value = this._from(amount, code);

  var self = this;
  var defineAccesor = function (key) {
    Object.defineProperty(self, key, {
      get: function () {
        return self.to(key);
      },
      enumerable: true,
    });
  };

  Object.keys(UNITS).forEach(defineAccesor);
}

Object.keys(UNITS).forEach(function (key) {
  Unit[key] = key;
});

/**
 * Returns a Unit instance created from JSON string or object
 *
 * @param {String|Object} json - JSON with keys: amount and code
 * @returns {Unit} A Unit instance
 */
Unit.fromObject = function fromObject(json) {
  $.checkArgument(_.isObject(json), 'Argument is expected to be an object');
  return new Unit(json.amount, json.code);
};

/**
 * Returns a Unit instance created from an amount in BTC
 *
 * @param {Number} amount - The amount in BTC
 * @returns {Unit} A Unit instance
 */
Unit.fromBTC = function (amount) {
  return new Unit(amount, Unit.BTC);
};

/**
 * Returns a Unit instance created from an amount in mBTC
 *
 * @function
 * @param {Number} amount - The amount in mBTC
 * @returns {Unit} A Unit instance
 */
Unit.fromMillis = Unit.fromMilis = function (amount) {
  return new Unit(amount, Unit.mBTC);
};

/**
 * Returns a Unit instance created from an amount in bits
 *
 * @function
 * @param {Number} amount - The amount in bits
 * @returns {Unit} A Unit instance
 */
Unit.fromMicros = Unit.fromBits = function (amount) {
  return new Unit(amount, Unit.bits);
};

/**
 * Returns a Unit instance created from an amount in hellars
 *
 * @param {Number} amount - The amount in hellars
 * @returns {Unit} A Unit instance
 */
Unit.fromhellars = function (amount) {
  return new Unit(amount, Unit.hellars);
};

/**
 * Returns a Unit instance created from a fiat amount and exchange rate.
 *
 * @param {Number} amount - The amount in fiat
 * @param {Number} rate - The exchange rate BTC/fiat
 * @returns {Unit} A Unit instance
 */
Unit.fromFiat = function (amount, rate) {
  return new Unit(amount, rate);
};

Unit.prototype._from = function (amount, code) {
  if (!UNITS[code]) {
    throw new errors.Unit.UnknownCode(code);
  }
  return parseInt((amount * UNITS[code][0]).toFixed());
};

/**
 * Returns the value represented in the specified unit
 *
 * @param {String|Number} code - The unit code or exchange rate
 * @returns {Number} The converted value
 */
Unit.prototype.to = function (code) {
  if (_.isNumber(code)) {
    if (code <= 0) {
      throw new errors.Unit.InvalidRate(code);
    }
    return parseFloat((this.BTC * code).toFixed(2));
  }

  if (!UNITS[code]) {
    throw new errors.Unit.UnknownCode(code);
  }

  var value = this._value / UNITS[code][0];
  return parseFloat(value.toFixed(UNITS[code][1]));
};

/**
 * Returns the value represented in BTC
 *
 * @returns {Number} The value converted to BTC
 */
Unit.prototype.toBTC = function () {
  return this.to(Unit.BTC);
};

/**
 * Returns the value represented in mBTC
 *
 * @function
 * @returns {Number} The value converted to mBTC
 */
Unit.prototype.toMillis = Unit.prototype.toMilis = function () {
  return this.to(Unit.mBTC);
};

/**
 * Returns the value represented in bits
 *
 * @function
 * @returns {Number} The value converted to bits
 */
Unit.prototype.toMicros = Unit.prototype.toBits = function () {
  return this.to(Unit.bits);
};

/**
 * Returns the value represented in hellars
 *
 * @returns {Number} The value converted to hellars
 */
Unit.prototype.tohellars = function () {
  return this.to(Unit.hellars);
};

/**
 * Returns the value represented in fiat
 *
 * @param {string} rate - The exchange rate between BTC/currency
 * @returns {Number} The value converted to hellars
 */
Unit.prototype.atRate = function (rate) {
  return this.to(rate);
};

/**
 * Returns a string representation of the value in hellars
 *
 * @returns {string} the value in hellars
 */
Unit.prototype.toString = function () {
  return this.hellars + ' hellars';
};

/**
 * Returns a plain object representation of the Unit
 *
 * @function
 * @returns {Object} An object with the keys: amount and code
 */
Unit.prototype.toObject = Unit.prototype.toJSON = function toObject() {
  return {
    amount: this.BTC,
    code: Unit.BTC,
  };
};

/**
 * Returns a string formatted for the console
 *
 * @returns {string} the value in hellars
 */
Unit.prototype.inspect = function () {
  return '<Unit: ' + this.toString() + '>';
};

module.exports = Unit;
