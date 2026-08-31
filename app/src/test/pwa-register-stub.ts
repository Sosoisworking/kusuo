/**
 * Stands in for vite-plugin-pwa's `virtual:pwa-register/react`, which only
 * exists inside a Vite build. Aliased in vitest.config.ts so Settings — and any
 * test that mounts the whole router — can render without a service worker.
 */
export function useRegisterSW() {
  return {
    needRefresh: [false, () => {}] as [boolean, (value: boolean) => void],
    offlineReady: [false, () => {}] as [boolean, (value: boolean) => void],
    updateServiceWorker: async () => {},
  }
}
