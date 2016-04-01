'use strict';

const debug = require('debug')('cqrs:MongoEventStorage');
const MongoClient = require('mongodb').MongoClient;
const ObjectID = require('mongodb').ObjectID;
const Binary = require('mongodb').Binary;
const reconnect = require('./utils/reconnect');
const _db = Symbol('db');


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


module.exports = class MongoEventStorage {

	/** Promise that resolves to connected mongo DB object */
	get db() {
		return this[_db] || Promise.reject(new Error('MongoGateway.connect(..) must be invoked first'));
	}

	get collection() {
		return this.db.then(db => db.collection(this._collectionName));
	}

	constructor(options) {
		if (!options) throw new TypeError('options argument required');
		if (!options.connectionString) throw new TypeError('options.connectionString argument required');

		this._collectionName = options.eventsCollection || 'events';

		this.connect(options.connectionString);
	}

	connect(connectionString) {
		if (typeof connectionString !== 'string' || !connectionString.length) throw new TypeError('connectionString argument must be a non-empty String');

		debug(`connecting to ${reconnect.mask(connectionString)}...`);

		this[_db] = reconnect(() => MongoClient.connect(connectionString), null, null, debug);

		this.db.then(() => {
			debug('connected');
		}, err => {
			debug('connection failure');
			debug(err);
			throw err;
		});

		this.collection.then(collection => Promise.all([
			collection.ensureIndex({ aggregateId: 1, aggregateVersion: 1 }, { unique: true, sparse: true }),
			// collection.ensureIndex({ sagaId: 1, sagaVersion: 1 }, { unique: true, sparse: true })
		])).then(indexNames => {
			debug(`indexes ${indexNames.join(', ')} ensured`);
		}, err => {
			debug('index creation has failed');
			debug(err);
		});

		return this.db;
	}

	disconnect() {
		this.db
			.then(db => db.close())
			.then(this.onDisconnected.bind(this));
	}

	onDisconnected() {
		this[_db] = undefined;
		debug('disconnected');
	}

	getNewId() {
		return new ObjectID().toString();
	}

	getAggregateEvents(aggregateId) {
		if (!aggregateId) throw new TypeError('aggregateId argument required');
		if (typeof aggregateId === 'string') aggregateId = new ObjectID(aggregateId);

		return this._findEvents({ aggregateId: aggregateId }, { sort: 'aggregateVersion' });
	}

	getSagaEvents(sagaId, options) {
		if (!sagaId) throw new TypeError('sagaId argument required');
		if (typeof sagaId === 'string') sagaId = new ObjectID(sagaId);

		const q = { sagaId: sagaId };

		if (options && options.except) {
			q._id = {
				$nin: Array.isArray(options.except) ?
					Array.from(options.except, eventId => ObjectID(eventId)) : [ObjectID(options.except)]
			};
		}

		return this._findEvents(q);
	}

	getEvents(eventTypes) {
		if (!Array.isArray(eventTypes)) throw new TypeError('eventTypes argument must be an Array');

		return this._findEvents({ type: { '$in': eventTypes } });
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
					throw new Error('Write result is not OK: ' + JSON.stringify(result));
				if (result.n !== events.length)
					throw new Error(`Number of affected records (${result.n}) does not match number of passed in events (${events.length})`);

				events.forEach(e => {
					e.id = e._id;
					delete e._id;
				});

				return events;
			}, err => {
				if (err.code === 11000) {
					const concurrencyError = new Error('event is not unique');
					concurrencyError.type = 'ConcurrencyError';
					throw concurrencyError;
				} else {
					debug('commit operation has failed');
					debug(err);
					throw err;
				}
			});
	}
};
