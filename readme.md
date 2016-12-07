MongoDB Event Storage for node-cqrs
===================================

## Usage

```bash
npm install node-cqrs node-cqrs-mongo --save
```

A configured instance of MongoEventStorage must be passed in as "storage" option to the EventStore constructor:

```js
const { EventStore } = require('node-cqrs');
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

```js
const { EventStore, Container } = require('node-cqrs');
const MongoEventStorage = require('node-cqrs-mongo');

// create container instance
const container = new Container();

// register MongoEventStorage as "storage"
container.registerInstance({ connectionString: 'mongodb://username:password@localhost:27017/db' }, 'mongoConfig');
container.register(MongoEventStorage, 'storage');

// register EventStore as "eventStore"
container.register(EventStore, 'eventStore');

// commit events to eventStore
container.eventStore.commit([
	{ aggregateId: 1, aggregateVersion: 1, type: 'somethingHappened', payload: {} }
]);
```
