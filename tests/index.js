'use strict';

process.stdout.write('\u001b[2J\u001b[0;0H');

require('debug').enable('cqrs:*');

const MongoEventStorage = require('..');
const chai = require('chai');
const expect = chai.expect;
chai.should();

describe('MongoEventStorage', function () {

	let storage;
	let aggregateId;

	this.slow(250);
	this.timeout(500);

	before(() => {
		storage = new MongoEventStorage({
			connectionString: 'mongodb://bq:test@localhost:27018/bq',
			eventsCollection: 'test'
		});
		aggregateId = storage.getNewId();
	});

	describe('constructor', () => {

		it('requires connectionString as an option parameter', () => {

			expect(() => {
				new MongoEventStorage({});
			}).to.throw('options.connectionString argument required');
		});

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
				{ aggregateId: aggregateId, aggregateVersion: 0 },
				{ aggregateId: aggregateId, aggregateVersion: 2 },
				{ aggregateId: aggregateId, aggregateVersion: 1 }
			];

			return storage.commitEvents(events).then(r => {
				expect(events).to.have.deep.property('[0].id');
				expect(events).to.have.deep.property('[1].id');
				expect(events).to.have.deep.property('[2].id');
			});
		});

		it('rejects with ConcurrencyError if aggregate event of the same version already exists', () => {

			const events = [
				{ aggregateId: aggregateId, aggregateVersion: 2 }
			];

			return storage.commitEvents(events).then(r => {
				throw new Error('must fail');
			}, err => {
				err.should.have.property('type', 'ConcurrencyError');
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
	});

	describe('getSagaEvents(sagaId, options)', () => {

		it('exists', () => {
			storage.should.respondTo('getSagaEvents');
		});

		it('retrieves a sorted list of saga events');

		it('allows to exclude the event that triggered saga execution');
	});

	describe('getEvents(eventTypes)', () => {
		it('exists', () => {
			storage.should.respondTo('getEvents');
		});

		it('retrieves a list of events of specific types');
	});
});
