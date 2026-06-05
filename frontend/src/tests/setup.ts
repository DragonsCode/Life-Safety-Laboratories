import '@testing-library/jest-dom/vitest';

// Polyfill ResizeObserver for jsdom / react-three-fiber
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}

if (typeof window.scrollTo === 'undefined') {
  window.scrollTo = () => {};
}

if (typeof HTMLElement.prototype.scrollTo === 'undefined') {
  HTMLElement.prototype.scrollTo = () => {};
}
