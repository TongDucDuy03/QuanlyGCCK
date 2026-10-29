import { useEffect, useState } from 'react';

const NAV_EVENT = 'gcck:navigate';

export function getBasePath(): string {
  if (typeof window === 'undefined') return '';
  const pathname = window.location.pathname;
  if (pathname.startsWith('/sanluonggcck')) {
    return '/sanluonggcck';
  }
  if (pathname.startsWith('/SANLUONG2026') || pathname.startsWith('/sanluong2026')) {
    return pathname.startsWith('/SANLUONG2026') ? '/SANLUONG2026' : '/sanluong2026';
  }
  return '';
}

export function normalizePath(path: string): string {
  if (typeof window !== 'undefined' && window.location.hash && window.location.hash.startsWith('#/')) {
    return window.location.hash.slice(1);
  }
  const base = getBasePath();
  if (base && path.startsWith(base)) {
    const stripped = path.slice(base.length);
    return stripped ? (stripped.startsWith('/') ? stripped : `/${stripped}`) : '/';
  }
  return path || '/';
}

export function navigateTo(path: string): void {
  if (typeof window === 'undefined') return;
  const base = getBasePath();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const fullPath = base ? `${base}${normalized}` : normalized;

  if (window.location.hash && window.location.hash.startsWith('#/')) {
    window.location.hash = `#${normalized}`;
    window.dispatchEvent(new CustomEvent(NAV_EVENT));
    return;
  }

  const currentFull = window.location.pathname + window.location.search;
  if (currentFull === fullPath) return;
  window.history.pushState({}, '', fullPath);
  window.dispatchEvent(new CustomEvent(NAV_EVENT));
}

export function useLocationPath(): string {
  const getFullNormPath = () => {
    if (typeof window === 'undefined') return '/worker';
    if (window.location.hash && window.location.hash.startsWith('#/')) {
      return window.location.hash.slice(1);
    }
    return normalizePath(window.location.pathname) + window.location.search;
  };

  const [pathname, setPathname] = useState<string>(getFullNormPath);

  useEffect(() => {
    const sync = () => {
      setPathname(getFullNormPath());
    };
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    window.addEventListener(NAV_EVENT, sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
      window.removeEventListener(NAV_EVENT, sync);
    };
  }, []);

  return pathname;
}
