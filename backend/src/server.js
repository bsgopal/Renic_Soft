import dotenv from 'dotenv';
import app from './app.js';
import { connectDB } from './config/db.js';
import { portState } from './config/serverState.js';
import { runSeed } from './utils/seed.js';

dotenv.config();

// Database connects in parallel — the HTTP server binds immediately so the app
// starts instantly even if MongoDB is unreachable (JSON file store fallback).
const dbReady = (async () => {
  await connectDB();
  try {
    await runSeed();
  } catch (err) {
    console.error('Platform owner sync failed:', err);
  }
  console.log(`[Database Mode]: ${process.env.MOCK_DB === 'true' ? 'MOCK (Local File Persistence)' : 'MONGODB'}`);
})();

dbReady.catch((err) => console.error('Database bootstrap failed:', err));

// If the preferred port is taken by another application, switch to the next
// free port immediately and report the chosen port via portState so Electron
// can load the UI against the exact port the API is running on.
const maxRetries = 8;
const tryListen = (port, remaining) => {
  const server = app.listen(port, () => {
    portState.port = port;
    portState.ready = true;
    console.log(`\x1b[36m[Renic Soft Server Running]: http://localhost:${port}\x1b[0m`);
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} is already in use by another application - switching to port ${port + 1}...`);
      if (remaining > 0) {
        setImmediate(() => tryListen(port + 1, remaining - 1));
      } else {
        console.error('All candidate ports are in use. Exiting.');
        process.exit(1);
      }
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
};

tryListen(portState.basePort, maxRetries - 1);

export { portState };
