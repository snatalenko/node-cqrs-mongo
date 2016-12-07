'use strict';

require('debug').enable('cqrs:*');

const MongoEventStorage = require('../..');
const credentials = require('./credentials.json');
const { expect, should } = require('chai');
should();

describe('MongoEventStorage', function () {

	let storage;
	let aggregateId;
	let sagaId;

	this.slow(250);
	this.timeout(500);

	before(() => {
		storage = new MongoEventStorage(credentials);
		aggregateId = storage.getNewId();
		sagaId = storage.getNewId();
	});

	describe('constructor', () => {
		it('establishes connection', () => {
			storage.should.have.property('collection');
			storage.collection.should.be.a('Promise');
		});
	});

	describe('commitEvents(events)', () => {

		it('exists', () => {
			storage.should.respondTo('commitEvents');
		});

		it('commits events to the db and assigns id property to committed objects', () => {

			const events = [
				{ aggregateId, aggregateVersion: 0 },
				{ aggregateId, aggregateVersion: 2 },
				{ aggregateId, aggregateVersion: 1 },
				{ sagaId, sagaVersion: 0 },
				{ sagaId, sagaVersion: 2 },
				{ sagaId, sagaVersion: 1 },
			];

			return storage.commitEvents(events).then(r => {
				expect(events).to.have.deep.property('[0].id');
				expect(events).to.have.deep.property('[1].id');
			});
		});

		it('rejects with ConcurrencyError if aggregate event of the same version already exists', () => {

			const events = [
				{ aggregateId, aggregateVersion: 2 }
			];

			return storage.commitEvents(events).then(r => {
				throw new Error('must fail');
			}, err => {
				err.should.have.property('name', 'ConcurrencyError');
			});
		});

		it('rejects with ConcurrencyError if saga event of the same version already exists', () => {

			const events = [
				{ sagaId, sagaVersion: 2 }
			];

			return storage.commitEvents(events).then(r => {
				throw new Error('must fail');
			}, err => {
				err.should.have.property('name', 'ConcurrencyError');
			});
		});
	});

	describe('getAggregateEvents(aggregateId)', () => {

		it('retrieves a sorted list of aggregate events', () => {

			return storage.getAggregateEvents(aggregateId).then(events => {

				events.should.be.an('Array');
				events.should.not.be.empty;

				for (let i = 1; i < events.length; i++) {
					events[i].aggregateVersion.should.be.greaterThan(events[i - 1].aggregateVersion);
				}
			});
		});

		it('allows to exclude events saved in a snapshot', () => {

			return storage.getAggregateEvents(aggregateId, { after: 1 }).then(events => {
				events.should.be.an('Array').that.has.length(1);
				events.should.have.deep.property('[0].aggregateVersion', 2);
			});
		});
	});

	describe('getSagaEvents(sagaId, options)', () => {

		it('exists', () => {
			storage.should.respondTo('getSagaEvents');
		});

		it('retrieves a sorted list of saga events', () => {

			return storage.getSagaEvents(sagaId).then(events => {
				events.should.be.an('Array').that.has.length(3);
				events.should.have.deep.property('[0].sagaVersion', 0);
				events.should.have.deep.property('[1].sagaVersion', 1);
			});
		});

		it('allows to exclude the event that triggered saga execution', () => {

			return storage.getSagaEvents(sagaId, { before: 2 }).then(events => {
				events.should.be.an('Array').that.has.length(2);
				events.should.have.deep.property('[0].sagaVersion', 0);
				events.should.have.deep.property('[1].sagaVersion', 1);
			});
		});

		it('allows to exclude events saved in a snapshot', () => {

			return storage.getSagaEvents(sagaId, { after: 1 }).then(events => {
				events.should.be.an('Array').that.has.length(1);
				events.should.have.deep.property('[0].sagaVersion', 2);
			});
		});
	});

	describe('getEvents(eventTypes)', () => {
		it('exists', () => {
			storage.should.respondTo('getEvents');
		});

		it('retrieves a list of events of specific types');
	});
});
