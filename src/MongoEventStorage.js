'use strict';

const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const Binary = require('mongodb').Binary;
const ConcurrencyError = require('./ConcurrencyError');
const reconnect = require('./reconnect');
const debug = require('debug')('cqrs:debug:mongo');
const info = require('debug')('cqrs:info:mongo');
const parseMongoUrl = require('parse-mongo-url')

const co = require('co');

const _collection = Symbol('collection');

function wrapObjectId(obj, key) {
	if (!obj) throw new TypeError('obj argument required');
	if (!key) throw new TypeError('key argument required');
	if (typeof obj[key] === 'string' && obj[key].length === 24) {
		obj[key] = new ObjectID(obj[key]);
	}
}

function wrapBinary(obj, key) {
	if (!obj) throw new TypeError('obj argument required');
	if (!key) throw new TypeError('key argument required');
	if (typeof obj[key] === 'string') {
		obj[key] = new Binary(new Buffer(obj[key], 'hex'));
	}
}

function wrapEvent(evt) {
	if (evt) {
		wrapObjectId(evt, '_id');
		wrapObjectId(evt, 'aggregateId');
		wrapObjectId(evt, 'sagaId');
		if (evt.context) {
			wrapObjectId(evt.context, 'sagaId');
			wrapObjectId(evt.context, 'uid');
		}
		wrapBinary(evt, 'sig');
		wrapBinary(evt, 'hash');
	}
}


function* connect({ connectionString, collectionName }) {
	if (typeof connectionString !== 'string' || !connectionString.length) throw new TypeError('connectionString argument must be a non-empty String');
	if (typeof collectionName !== 'string' || !collectionName.length) throw new TypeError('collectionName argument must be a non-empty String');

	debug(`connecting to ${connectionString.replace(/\/\/([^@/]+@)?/, '//***@')}...`);

	const client = new MongoClient(connectionString);
	const parsed = parseMongoUrl(connectionString)

	yield client.connect()
	const connection = client.db(parsed.dbName);

	info(`connected to ${connectionString.replace(/\/\/([^@/]+@)?/, '//***@')}`);

	const collection = connection.collection(collectionName);
	const indexNames = yield [
		collection.ensureIndex({ aggregateId: 1, aggregateVersion: 1 }, { unique: true, sparse: true }),
		collection.ensureIndex({ sagaId: 1, sagaVersion: 1 }, { unique: false, sparse: true })
	];

	debug(`indexes ${indexNames.join(', ')} ensured`);

	return collection;
}


module.exports = class MongoEventStorage {

	get collection() {
		return this[_collection];
	}

	constructor(mongoConfig) {
		if (!mongoConfig) throw new TypeError('mongoConfig argument required');
		if (typeof mongoConfig.connectionString !== 'string' || !mongoConfig.connectionString.length) throw new TypeError('mongoConfig.connectionString argument must be a non-empty String');

		const connectionString = mongoConfig.connectionString;
		const collectionName = mongoConfig.eventsCollection || 'events';
		const connectMethod = co.wrap(connect);

		Object.defineProperty(this, _collection, {
			value: reconnect(() => connectMethod({ connectionString, collectionName }), { debug: info })
		});
	}

	getNewId() { // eslint-disable-line class-methods-use-this
		return new ObjectID().toString();
	}

	getAggregateEvents(aggregateId, options) {
		if (!aggregateId) throw new TypeError('aggregateId argument required');
		if (typeof aggregateId === 'string') aggregateId = new ObjectID(aggregateId);

		const q = { aggregateId };

		if (options && options.after) {
			(q.aggregateVersion || (q.aggregateVersion = {})).$gt = options.after;
		}

		if (options && options.before) {
			(q.aggregateVersion || (q.aggregateVersion = {})).$lt = options.before;
		}

		return this._findEvents(q, { sort: 'aggregateVersion' });
	}

	getSagaEvents(sagaId, options) {
		if (!sagaId) throw new TypeError('sagaId argument required');
		if (typeof sagaId === 'string') sagaId = new ObjectID(sagaId);

		const q = { sagaId };

		if (options && options.after) {
			(q.sagaVersion || (q.sagaVersion = {})).$gt = options.after;
		}

		if (options && options.before) {
			(q.sagaVersion || (q.sagaVersion = {})).$lt = options.before;
		}

		if (options && options.except) {
			q._id = { $ne: ObjectID(options.except) };
		}

		return this._findEvents(q, { sort: 'sagaVersion' });
	}

	getEvents(eventTypes) {
		if (!Array.isArray(eventTypes)) throw new TypeError('eventTypes argument must be an Array');

		return this._findEvents({ type: { $in: eventTypes } });
	}

	_findEvents(findStatement, options) {
		if (!findStatement) throw new TypeError('findStatement argument required');

		const fields = { _id: false };

		return this.collection.then(collection =>
			collection.find(findStatement, fields, options).toArray());
	}

	commitEvents(events) {
		if (!events) throw new TypeError('events argument required');
		if (!Array.isArray(events)) throw new TypeError('events argument must be an Array');

		events.forEach(wrapEvent);

		return this.collection
			.then(collection => collection.insert(events, { w: 1 }))
			.then(writeResult => writeResult.result)
			.then(result => {
				if (!result.ok)
					throw new Error(`Write result is not OK: ${JSON.stringify(result)}`);
				if (result.n !== events.length)
					throw new Error(`Number of affected records (${result.n}) does not match number of passed in events (${events.length})`);

				events.forEach(e => {
					e.id = e._id;
					delete e._id;
				});

				return events;
			}, err => {
				if (err.code === 11000) {
					throw new ConcurrencyError('event is not unique');
				}
				else {
					info('commit operation has failed: %s', (err && err.message) || err);
					throw err;
				}
			});
	}
};

module.exports.connect = connect