const x11hash = require('@hellarcore/x11-hash-js');
const crypto = require('crypto');

/**
 * @typedef {X11Hash} X11Hash
 * @property {Object} errors
 * @property {function((string|Array|buffer), number, number): (string|Array)} digest
 */

/**
 * @typedef {Crypto} Crypto
 * @property {function(string, HashOptions): Hash} createHash
 */

/**
 * @typedef {HellarCoreLibConfiguration} HellarCoreLibConfiguration
 * @property {X11Hash} [x11hash]
 * @property {Crypto} [crypto]
 */
const configuration = {
  x11hash,
  crypto
};

/**
 * Configures HellarCore library
 * @param {HellarCoreLibConfiguration} config
 */
const configure = (config) => {
  Object.assign(configuration, { ...config });
}

module.exports = {
  configuration,
  configure
}
