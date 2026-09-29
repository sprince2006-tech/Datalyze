const mongoose = require('mongoose');

const connectDB = async (retries = 5) => {
  while (retries > 0) {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 10000,
      });
      console.log(`MongoDB connected: ${conn.connection.host}`);
      mongoose.connection.on('disconnected', () => console.warn('[MONGO] disconnected'));
      mongoose.connection.on('reconnected', () => console.log('[MONGO] reconnected'));
      mongoose.connection.on('error', (e) => console.error('[MONGO] error:', e.message));
      return conn;
    } catch (err) {
      retries -= 1;
      console.error(`[MONGO] connect failed (${retries} retries left):`, err.message);
      if (retries === 0) process.exit(1);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
};

module.exports = connectDB;