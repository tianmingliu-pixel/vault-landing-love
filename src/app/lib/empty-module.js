// Stand-in for satellite.js's optional WebAssembly bulk propagator (see next.config.ts). The site only uses the plain
// JavaScript SGP4 functions, and the WASM build pulls in node:worker_threads, which cannot be bundled for the browser.
export {};
