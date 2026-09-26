const mongoose = require('mongoose')

const connectDb = async () => {
	const mongoUri = process.env.MONGO_URI

	if (!mongoUri) {
		throw new Error('MONGO_URI is not configured in environment variables')
	}

	const forceIpv4 = String(process.env.MONGO_FORCE_IPV4 || 'true').toLowerCase() === 'true'
	const timeoutMs = Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 5000)

	const connectOptions = {
		serverSelectionTimeoutMS: timeoutMs,
		socketTimeoutMS: Number(process.env.MONGO_SOCKET_TIMEOUT_MS || 45000),
		family: forceIpv4 ? 4 : undefined,
		maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 10)
	}

	try {
		await mongoose.connect(mongoUri, connectOptions)
	} catch (primaryErr) {
		console.warn(`Primary database connection (${mongoUri}) failed: ${primaryErr.message}`)
		console.warn('Attempting fallback database connection...')

		// Attempt 1: Local MongoDB instance if MONGO_URI wasn't already local
		if (!mongoUri.includes('127.0.0.1') && !mongoUri.includes('localhost')) {
			try {
				const localUri = 'mongodb://127.0.0.1:27017/collabnote'
				await mongoose.connect(localUri, { ...connectOptions, serverSelectionTimeoutMS: 3000 })
				console.log(`Connected to local MongoDB instance: ${localUri}`)
			} catch (localErr) {
				console.warn(`Local MongoDB connection failed: ${localErr.message}`)
			}
		}

		// Attempt 2: mongodb-memory-server
		if (mongoose.connection.readyState !== 1) {
			try {
				const { MongoMemoryServer } = require('mongodb-memory-server')
				console.log('Spinning up in-memory MongoDB instance...')
				const mongoServer = await MongoMemoryServer.create()
				const memoryUri = mongoServer.getUri()
				await mongoose.connect(memoryUri, { ...connectOptions, serverSelectionTimeoutMS: 10000 })
				console.log(`Connected to In-Memory MongoDB: ${memoryUri}`)
			} catch (memErr) {
				console.error(`In-Memory MongoDB start failed: ${memErr.message}`)
				throw primaryErr
			}
		}
	}

	const activeDb = mongoose.connection.name
	const activeHost = mongoose.connection.host
	const usingAtlas = /mongodb\+srv:\/\/.+mongodb\.net/i.test(mongoUri) && mongoose.connection.host.includes('mongodb.net')

	console.log(`MongoDB connected successfully: ${activeDb} @ ${activeHost}${usingAtlas ? ' (Atlas)' : ''}`)

	mongoose.connection.on('error', (err) => {
		const msg = String(err?.message || '')
		if (/SSL routines|tlsv1 alert|MongoServerSelectionError|Could not connect to any servers/i.test(msg)) {
			console.error('MongoDB runtime connection error: Atlas TLS/network issue.')
			return
		}
		console.error('MongoDB runtime connection error:', msg || err)
	})
}

module.exports = connectDb


