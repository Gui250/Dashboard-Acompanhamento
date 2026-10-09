type Entry<T> = {
  data?: T;
  error?: string;
  updatedAt: number;
  generation: number;
  promise?: Promise<T>;
};

const memory = new Map<string, Entry<unknown>>();
const subscribers = new Map<string, Set<() => void>>();
const STORAGE_PREFIX = "v4-cache:";

function notify(key: string) {
  subscribers.get(key)?.forEach((listener) => listener());
}

function readSession<T>(key: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return;
    return JSON.parse(raw) as { data: T; updatedAt: number };
  } catch {
    return;
  }
}

function writeSession(key: string, data: unknown, updatedAt: number) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify({ data, updatedAt }));
  } catch {
    sessionStorage.removeItem(STORAGE_PREFIX + key);
  }
}

function ensure<T>(key: string): Entry<T> {
  const current = memory.get(key) as Entry<T> | undefined;
  if (current) return current;
  const stored = readSession<T>(key);
  const entry: Entry<T> = stored
    ? { data: stored.data, updatedAt: stored.updatedAt, generation: 0 }
    : { updatedAt: 0, generation: 0 };
  memory.set(key, entry);
  return entry;
}

export function readQuery<T>(key: string) {
  const entry = ensure<T>(key);
  return { data: entry.data, error: entry.error, pending: Boolean(entry.promise) };
}

export function peekQuery<T>(key: string) {
  return readQuery<T>(key).data;
}

export function subscribeQuery(key: string, listener: () => void) {
  let set = subscribers.get(key);
  if (!set) {
    set = new Set();
    subscribers.set(key, set);
  }
  set.add(listener);
  return () => set.delete(listener);
}

export function setQueryData<T>(key: string, data: T) {
  const entry = ensure<T>(key);
  entry.generation += 1;
  entry.data = data;
  entry.error = undefined;
  entry.updatedAt = Date.now();
  writeSession(key, data, entry.updatedAt);
  notify(key);
}

export function prefetchQuery<T>(key: string, fetcher: () => Promise<T>, staleTime = 20_000) {
  const entry = ensure<T>(key);
  if (entry.promise) return entry.promise;
  if (entry.data !== undefined && Date.now() - entry.updatedAt < staleTime) return Promise.resolve(entry.data);

  const generation = entry.generation;
  const promise = fetcher()
    .then((data) => {
      if (entry.generation !== generation || entry.promise !== promise) return data;
      entry.data = data;
      entry.error = undefined;
      entry.updatedAt = Date.now();
      entry.promise = undefined;
      writeSession(key, data, entry.updatedAt);
      notify(key);
      return data;
    })
    .catch((error: unknown) => {
      if (entry.promise === promise) {
        entry.promise = undefined;
        entry.error = error instanceof Error ? error.message : "Falha ao carregar.";
        notify(key);
      }
      throw error;
    });

  entry.promise = promise;
  return promise;
}

export function refreshQuery<T>(key: string, fetcher: () => Promise<T>) {
  const entry = ensure<T>(key);
  entry.updatedAt = 0;
  entry.promise = undefined;
  return prefetchQuery(key, fetcher, 0);
}

export function touchStale(prefix: string) {
  for (const [key, entry] of memory) {
    if (!key.startsWith(prefix)) continue;
    entry.updatedAt = 0;
    if (entry.data !== undefined) writeSession(key, entry.data, 0);
  }
}
