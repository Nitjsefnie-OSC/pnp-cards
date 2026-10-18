import { useState } from 'react';

/** Sustituto del registro del service worker en los tests (jsdom no tiene service workers). */
export const pwaMock = {
  needRefresh: false,
  offlineReady: false,
  updateServiceWorker: vi.fn(async () => {}),
};

export function useRegisterSW() {
  const needRefresh = useState(pwaMock.needRefresh);
  const offlineReady = useState(pwaMock.offlineReady);
  return {
    needRefresh,
    offlineReady,
    updateServiceWorker: pwaMock.updateServiceWorker,
  };
}
