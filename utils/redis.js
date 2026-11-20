const Redis = require('ioredis');
require('dotenv').config();

let redis = null;

try {
  redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });
  redis.on('error', (err) => {
    console.warn('Redis error (optional):', err.message);
  });
} catch (e) {
  console.warn('Redis unavailable, continuing without cache');
  redis = {
    get: async () => null,
    set: async () => null,
    del: async () => null,
    quit: async () => null,
  };
}

module.exports = redis;
