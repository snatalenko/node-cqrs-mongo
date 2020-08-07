const parseMongoUrl = require('parse-mongo-url')
const MongoClient = require('mongodb').MongoClient
const debug = require('debug')('mongoConnection')

const connections = {}

module.exports = async url => {
	if (!connections[url]) {
		connections[url] = new Promise((resolve, reject) => {
			const parsed = parseMongoUrl(url)
			const client = new MongoClient(url)

			client.connect(err => {
				if (err) {
					reject(err)
				}

				debug('Connected to ' + url.replace(/:([^:@]+)@/, ':***@'))
				console.log('Connected to ' + url.replace(/:([^:@]+)@/, ':***@'))
				const db = client.db(parsed.dbName)
				resolve({ db, client })
			})
		})
	}

	return (await connections[url]).db
}

module.exports.close = url => connections[url].client.close()
