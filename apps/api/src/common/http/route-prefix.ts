/**
 * The single place the public API prefix is defined. The web app proxies
 * `/api/v1/*` to this origin, so the bootstrap and the end-to-end tests must
 * mount exactly the same prefix or the proxy silently targets nothing.
 */
export const API_ROUTE_PREFIX = 'api/v1';

/** Routes that stay outside the versioned prefix, such as the load-balancer probe. */
export const UNPREFIXED_HEALTH_PATH = 'health';
