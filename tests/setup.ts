/**
 * Node 26 defines a global `localStorage` that stays undefined unless the
 * process is started with `--localstorage-file`. Because it is an own property
 * of `globalThis`, it shadows the implementation jsdom would otherwise provide,
 * so anything reading persisted state sees `undefined`. Install a minimal
 * in-memory Storage whenever the environment has not supplied a working one.
 */
const createMemoryStorage = (): Storage => {
  let store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear: () => {
      store = new Map();
    },
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  } as Storage;
};

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: createMemoryStorage(),
    configurable: true,
    writable: true,
  });
}
