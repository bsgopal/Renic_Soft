import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Connect to MongoDB.
 *
 * There is deliberately NO silent fallback to the local JSON file store
 * (data/mockDb.json). Falling back on a failed connection would make every
 * API serve hardcoded/stale file data instead of the customer's real tenant
 * data — a correctness and isolation hazard. So the process fails fast.
 *
 * MOCK_DB=true stays available as an explicit opt-in for the test suite only;
 * it must never be set automatically as a side effect of an error.
 */
export const connectDB = async () => {
  if (process.env.MOCK_DB === 'true') {
    console.warn('[Database Mode]: MOCK (explicit MOCK_DB=true) — tests/dev only');
    return;
  }

  if (mongoose.connection.readyState === 1) {
    return;
  }

  const attempts = 3;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/renic_soft';
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
      console.log('[Database Mode]: MONGODB Connected');
      return;
    } catch (err) {
      console.warn(`[MongoDB attempt ${attempt}/${attempts}]: ${err.message}`);
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  console.error('[Fatal] MongoDB is unreachable after ' + attempts + ' attempts.');
  console.error('[Fatal] Refusing to start with mock/hardcoded data. Start MongoDB or fix MONGO_URI.');
  process.exit(1);
};

export const isUsingMock = () => process.env.MOCK_DB === 'true';
