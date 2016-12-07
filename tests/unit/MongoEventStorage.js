'use strict';

const MongoEventStorage = require('../..');
const { expect } = require('chai');

describe('MongoEventStorage', function() {

	it('exports a class', () => {
		expect(MongoEventStorage).to.be.a('Function');
		expect(MongoEventStorage.toString().substr(0, 6)).to.eq('class ');
	});

	it('implements node-cqrs storage interface',() => {
		expect(MongoEventStorage).to.respondTo('getNewId');
		expect(MongoEventStorage).to.respondTo('getAggregateEvents');
		expect(MongoEventStorage).to.respondTo('getSagaEvents');
		expect(MongoEventStorage).to.respondTo('getEvents');
		expect(MongoEventStorage).to.respondTo('commitEvents');
	});

	describe('constructor({ connectionString: string })', () => {

		it('requires connectionString as an parameter object property', () => {
			expect(() => new MongoEventStorage({})).to.throw('mongoConfig.connectionString argument must be a non-empty String');
		});
	});
});
