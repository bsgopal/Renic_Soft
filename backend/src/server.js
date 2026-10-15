import dotenv from 'dotenv';
import app from './app.js';
import { connectDB } from './config/db.js';
import { refreshAppSlugRegistry } from './utils/customerUrl.js';
import { portState } from './config/serverState.js';

dotenv.config();

// Database connects in parallel — the HTTP server binds immediately so the app
// starts instantly even if MongoDB is unreachable.
// NOTE: there is no auto-seed here. Users (including the platform owner) are
// created deliberately — run `npm run seed` manually if you need the owner
// account — so no hardcoded credentials are ever written on startup.
const dbReady = (async () => {
  await connectDB();
  console.log(`[Database Mode]: ${process.env.MOCK_DB === 'true' ? 'MOCK (Local File Persistence)' : 'MONGODB'}`);

  // Load appCode -> urlSlug from the Applications registry so customer URLs
  // resolve for ANY application registered in Renic Soft, with no source
  // change. Non-fatal on failure: URL building keeps the seeded fallback map.
  const refreshed = await refreshAppSlugRegistry();
  console.log(`[App Slug Registry]: ${refreshed ? 'loaded from Applications collection' : 'built-in fallback map'}`);
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
