import { useEffect, useState } from 'react';

const NAV_EVENT = 'gcck:navigate';

export function navigateTo(path: string): void {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === path) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new CustomEvent(NAV_EVENT));
}

export function useLocationPath(): string {
  const [pathname, setPathname] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/worker'
  );

  useEffect(() => {
    const sync = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', sync);
    window.addEventListener(NAV_EVENT, sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener(NAV_EVENT, sync);
    };
  }, []);

  return pathname;
}
