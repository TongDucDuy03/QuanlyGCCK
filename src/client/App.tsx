import React, { Suspense, useEffect } from 'react';
import { ToastProvider } from './components/ui/IndustrialPrimitives';
import { AuthProvider } from './context/AuthContext';
import { TopRoleBar } from './components/TopRoleBar';
import { navigateTo, useLocationPath } from './lib/navigation';
import { getTravelerPoIdFromLocation } from './lib/formatters';

const WorkerView = React.lazy(() =>
  import('./features/worker/WorkerPortal').then((m) => ({
    default: (m.WorkerPortal || (m as any).default) as React.ComponentType<any>,
  }))
);
const AdminView = React.lazy(() =>
  import('./features/admin/AdminPortal').then((m) => ({
    default: (m.AdminPortal || (m as any).default) as React.ComponentType<any>,
  }))
);
const AndonView = React.lazy(() =>
  import('./features/andon/AndonTvBoard').then((m) => ({
    default: (m.AndonTvBoard || (m as any).default) as React.ComponentType<any>,
  }))
);
const PrintView = React.lazy(() =>
  import('./features/print/JobTravelerPrint').then((m) => ({
    default: (m.JobTravelerPrint || (m as any).default) as React.ComponentType<any>,
  }))
);

function ShellRouter() {
  const pathname = useLocationPath();

  useEffect(() => {
    if (pathname === '/') {
      const target =
        typeof window !== 'undefined' && window.innerWidth >= 1280 ? '/admin' : '/worker';
      navigateTo(target);
    }
  }, [pathname]);

  let content: React.ReactNode;
  if (pathname.startsWith('/admin')) {
    content = <AdminView />;
  } else if (pathname.startsWith('/andon')) {
    content = <AndonView />;
  } else if (pathname.startsWith('/print/traveler')) {
    const poId = getTravelerPoIdFromLocation(pathname);
    content = <PrintView poId={poId} />;
  } else {
    content = <WorkerView />;
  }

  return (
    <div className="min-h-screen w-full max-w-full bg-industrial-canvas text-slate-50">
      <TopRoleBar currentPath={pathname} />
      <Suspense
        fallback={
          <div className="flex min-h-[60vh] items-center justify-center px-4 text-sm font-semibold text-slate-400">
            Đang tải phân hệ MES...
          </div>
        }
      >
        {content}
      </Suspense>
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <ShellRouter />
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
