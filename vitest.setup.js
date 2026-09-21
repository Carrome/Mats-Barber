// Setup jsdom localStorage
if (typeof window !== 'undefined' && !window.localStorage) {
  const store = {};
  window.localStorage = {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value; },
    removeItem: (key) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(key => delete store[key]); },
    key: (index) => Object.keys(store)[index] || null,
    get length() { return Object.keys(store).length; }
  };
}
