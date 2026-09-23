export const environment = {
    production: false,
    // Root server URL (no /api suffix, no trailing slash — PROTOCOL.md §1).
    // Temporary default until server-selection (Phase 1 step 5) lets the
    // user pick their own server. Plain HTTP: the dev server has no local
    // TLS (Phase 1 step 2 moved that to a Caddy reverse proxy).
    serverUrl: 'http://127.0.0.1:6868',
};
