/* eslint no-console: "off" */
'use strict';

const co = require('co');

/**
 * Tries to establish the connection, until successful
 *
 * @param {function():PromiseLike<any>} connectMethod
 * @param {{retries:number, timeout:number, debug:function(string):void}} options
 * @returns {PromiseLike<any>}
 */
function* reconnect(connectMethod, { retries, timeout = 5000, debug = console.warn } = {}) {
	if (typeof connectMethod !== 'function') throw new TypeError('connectMethod argument must be a Function');
	if (typeof timeout !== 'number' || !timeout) throw new TypeError('timeout argument must be a Number');
	if (typeof debug !== 'function') throw new TypeError('debug argument must be a Function');

	let attempts = 0;
	let result;

	do {
		try {
			result = yield connectMethod();
		}
		catch (err) {
			debug(err && err.message);
			attempts += 1;
			if (attempts < retries || !retries) {
				debug(`retrying in ${timeout / 1000} seconds...`);
				yield new Promise(rs => setTimeout(rs, timeout));
			}
			else {
				throw err;
			}
		}
	}
	while (!result);

	return result;
}

module.exports = co.wrap(reconnect);
