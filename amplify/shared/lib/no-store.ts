/** Prevent CDN/browser caching of authenticated media API responses. */
export const NO_STORE_CACHE_CONTROL = "private, no-store, max-age=0, must-revalidate";

export const noStoreFetchInit: RequestInit = { cache: "no-store" };
