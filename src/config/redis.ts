// In-memory cache for testing (replaces Redis)
const cache = new Map<string, { value: string; expiry?: number }>();

export const connectRedis = async (): Promise<void> => {
  try {
    console.log('Using in-memory cache for testing (Redis simulation)');
  } catch (error) {
    console.error('Cache initialization failed:', error);
    throw error;
  }
};

export const setCache = async (key: string, value: string, ttl?: number): Promise<void> => {
  if (ttl) {
    const expiry = Date.now() + (ttl * 1000);
    cache.set(key, { value, expiry });
  } else {
    cache.set(key, { value });
  }
};

export const getCache = async (key: string): Promise<string | null> => {
  const item = cache.get(key);
  if (!item) return null;

  if (item.expiry && Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }

  return item.value;
};

export const deleteCache = async (key: string): Promise<number> => {
  return cache.delete(key) ? 1 : 0;
};

export default {
  on: () => {},
  connect: connectRedis,
  setEx: setCache,
  get: getCache,
  del: deleteCache
};
