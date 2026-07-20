/**
 * Boot seam for the LAZY adapters (0.0.115 bundle): app.config must provide
 * AUTH_PROVIDER / API_CLIENT synchronously, but the real implementations
 * (MockApi + MockAuthProvider, or HttpApi + CognitoAuthProvider) now arrive
 * via dynamic import() so neither pair rides the initial bundle. This
 * stand-in starts the load at construction and each call simply awaits it —
 * by the first real api/auth call the chunk is long since here.
 *
 * SAFE ONLY because both seam interfaces are METHODS-ONLY and every method
 * returns a Promise (AuthProvider, RoadmapApi — checked 0.0.115). If either
 * contract ever grows a sync member or a plain property, that member must
 * not be served through lazySeam.
 */
export function lazySeam<T extends object>(load: () => Promise<T>): T {
  const ready = load();
  return new Proxy({} as T, {
    get:
      (_target, method: PropertyKey) =>
      (...args: unknown[]) =>
        ready.then((impl) =>
          (impl as Record<PropertyKey, (...a: unknown[]) => unknown>)[method](...args),
        ),
  });
}
