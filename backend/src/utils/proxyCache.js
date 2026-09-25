// In-memory proxy and target cache for sub-millisecond static asset routing
export const proxyInstanceCache = new Map();
export const clientTargetCache = new Map();

export const invalidateProxyCache = (code) => {
  if (code) {
    const str = String(code).toLowerCase().trim();
    clientTargetCache.delete(str);
    clientTargetCache.delete(str.toUpperCase());

    // Purge any compound keys (e.g., pos.tx10, wa.tx10, tx10)
    for (const key of Array.from(clientTargetCache.keys())) {
      const lowerKey = key.toLowerCase();
      if (lowerKey === str || lowerKey.includes(str) || str.includes(lowerKey)) {
        clientTargetCache.delete(key);
      }
    }
  } else {
    clientTargetCache.clear();
  }

  // Clear proxy instances so dead routes don't hold open connections
  proxyInstanceCache.clear();
};

