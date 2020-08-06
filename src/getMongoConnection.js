const parseMongoUrl = require('parse-mongo-url')
const MongoClient = require('mongodb').MongoClient
const debug = require('debug')('mongoConnection')

const connections = {}

module.exports = url => {
	if (!connections[url]) {
		connections[url] = new Promise((resolve, reject) => {
			const parsed = parseMongoUrl(url)
			const client = new MongoClient(url)

			client.connect(err => {
				if (err) {
					reject(err)
				}

				debug('Connected to ' + url.replace(/:([^:@]+)@/, ':***@'))
				const db = client.db(parsed.dbName)
				resolve(db)
			})
		})
	}

	return connections[url]
}

module.exports.close = url => connections[url].client.close()
