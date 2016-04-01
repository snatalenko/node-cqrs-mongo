'use strict';

/**
 * Tries to establish AMQP connection until successful.
 * @param  {Function} connectMethod  Method used to establish a connection
 * @param  {Number} retries          Number of connection retries to perform
 * @param  {Number} timeout          Timeout between connection retries
 * @return {Promise}                 Promise that resolves to a successfully established connection
 * @example
 * 	reconnect(() => MongoClient.connect(connectionString)).then(connection => ...);
 */
module.exports = function reconnect(connectMethod, retries, timeout, debug) {
	if (typeof connectMethod !== 'function') throw new TypeError('connectMethod argument must be a Function');
	if (!timeout) timeout = 5000;
	if (!debug) debug = console.warn;

	// return a promise which will resolve to a successfull connection attempt promise
	return new Promise(function (resolve, reject) {

		let connectAttemptsCount = 0;

		(function connect() {

			if (connectAttemptsCount++ !== 0) {
				debug(`trying to reconnect, attempt ${connectAttemptsCount}...`);
			}

			const connectionAttempt = connectMethod();
			connectionAttempt.then(connection => resolve(connectionAttempt), err => {
				debug(`connection could not be established: ${err}`);
				if (connectAttemptsCount < retries || !retries) {
					debug(`reconnecting in ${timeout/1000} seconds...`);
					setTimeout(connect, timeout);
				}
				else {
					reject(err);
				}
			});
		})();
	});
};

/**
 * Masks username and password in a connection string
 * @param  {String} connectionString Connection string in a format 'protocol://login:password@host...'
 * @return {String}                  Masked connection string, e.g. 'protocol://***@host...'
 */
module.exports.mask = function mask(connectionString) {
	if (typeof connectionString !== 'string' || !connectionString.length)
		throw new TypeError('connectionString argument must be a non-empty String');
	return connectionString.replace(/\/\/([^@\/]+@)?/, '//***@');
};
