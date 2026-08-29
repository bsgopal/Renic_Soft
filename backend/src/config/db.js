import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

let isMock = process.env.MOCK_DB === 'true';

/**
 * Connect to MongoDB. If it fails or MOCK_DB is enabled,
 * the app silently falls back to a local JSON file store
 * so the application always runs.
 */
export const connectDB = async () => {
  if (isMock) {
    console.log('[Database Mode]: MOCK (Local JSON File Persistence)');
    return;
  }

  try {
    const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/renic_soft';
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
    console.log('[Database Mode]: MONGODB Connected');
  } catch (err) {
    isMock = true;
    process.env.MOCK_DB = 'true';
    console.warn('\x1b[33m[MongoDB unavailable]', err.message, '- falling back to MOCK (Local JSON File Store)\x1b[0m');
  }
};

export const isUsingMock = () => isMock;
