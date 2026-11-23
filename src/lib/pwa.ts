import { registerSW } from 'virtual:pwa-register';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export interface PwaState {
  isOnline: boolean;
  isStandalone: boolean;
  canInstall: boolean;
  needRefresh: boolean;
  offlineReady: boolean;
  swRegistered: boolean;
  swError: string | null;
}

type PwaListener = (state: PwaState) => void;

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
let updateSWFn: ((reloadPage?: boolean) => Promise<void>) | null = null;

const state: PwaState = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isStandalone:
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true),
  canInstall: false,
  needRefresh: false,
  offlineReady: false,
  swRegistered: false,
  swError: null,
};

const listeners = new Set<PwaListener>();

function notify(): void {
  const snapshot = { ...state };
  for (const listener of listeners) {
    listener(snapshot);
  }
}

export function subscribePwa(listener: PwaListener): () => void {
  listeners.add(listener);
  listener({ ...state });
  return () => {
    listeners.delete(listener);
  };
}

export function getPwaState(): PwaState {
  return { ...state };
}

export function initPwa(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('online', () => {
    state.isOnline = true;
    notify();
  });

  window.addEventListener('offline', () => {
    state.isOnline = false;
    notify();
  });

  const standaloneMq = window.matchMedia('(display-mode: standalone)');
  standaloneMq.addEventListener('change', (ev) => {
    state.isStandalone = ev.matches;
    notify();
  });

  window.addEventListener('beforeinstallprompt', (ev) => {
    ev.preventDefault();
    deferredInstallPrompt = ev as BeforeInstallPromptEvent;
    state.canInstall = true;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    state.canInstall = false;
    state.isStandalone = true;
    notify();
  });

  if ('serviceWorker' in navigator) {
    updateSWFn = registerSW({
      immediate: true,
      onNeedRefresh() {
        state.needRefresh = true;
        notify();
      },
      onOfflineReady() {
        state.offlineReady = true;
        notify();
      },
      onRegisteredSW(_swUrl, registration) {
        state.swRegistered = Boolean(registration);
        notify();
      },
      onRegisterError(err) {
        state.swError = err instanceof Error ? err.message : String(err);
        notify();
      },
    });
  }
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredInstallPrompt) return 'unavailable';
  await deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  if (choice.outcome === 'accepted') {
    deferredInstallPrompt = null;
    state.canInstall = false;
    notify();
  }
  return choice.outcome;
}

export async function applySwUpdate(): Promise<void> {
  if (updateSWFn) {
    await updateSWFn(true);
  } else {
    window.location.reload();
  }
}
