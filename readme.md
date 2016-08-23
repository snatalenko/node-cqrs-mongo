MongoDB Event Storage for node-cqrs
===================================

## Usage

```bash
npm install bitbucket:cqrs/node-cqrs bitbucket:cqrs/node-cqrs-mongo --save
```

A configured instance of MongoEventStorage must be passed in as "storage" option to the EventStore constructor:

```javascript
const EventStore = require('node-cqrs').EventStore;
const MongoEventStorage = require('node-cqrs-mongo');

const storage = new MongoEventStorage({
	connectionString: 'mongodb://username:password@localhost:27017/db',
	eventsCollection: 'events'
});

const eventStore = new EventStore({ storage });

eventStore.commit([
	{ aggregateId: 1, aggregateVersion: 1, type: 'somethingHappened', payload: {} }
]);
```

The same, using DI container: 

```javascript
const EventStore = require('node-cqrs').EventStore;
const Container = require('node-cqrs').Container;
const MongoEventStorage = require('node-cqrs-mongo');

// create container instance
const c = new Container();

// register MongoEventStorage factory as "storage"
c.register(c => new MongoEventStorage({
	connectionString: 'mongodb://username:password@localhost:27017/db'
}), 'storage');

// register EventStore as "eventStore"
c.register(EventStore, 'eventStore');

// commit events to eventStore
c.eventStore.commit([
	{ aggregateId: 1, aggregateVersion: 1, type: 'somethingHappened', payload: {} }
]);
```

