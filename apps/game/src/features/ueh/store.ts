// Lightweight state store for UEH environment settings
export interface UEHStoreState {
  quality: 'high' | 'low';
  muted: boolean;
}

export function useStore<T>(selector: (state: UEHStoreState) => T): T {
  const state: UEHStoreState = {
    quality: 'high',
    muted: false,
  };
  return selector(state);
}

export function toast(msg: string) {
  console.log('[UEH Toast]:', msg);
}
