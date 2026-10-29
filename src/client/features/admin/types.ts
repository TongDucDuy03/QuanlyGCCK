import type { BootstrapPayload } from '@shared/types';

export type AdminTabKey =
  | 'cockpit'
  | 'orders'
  | 'daily_schedule'
  | 'logs_qc'
  | 'costing'
  | 'attendance'
  | 'master';

export interface AdminDeepLinkContext {
  tracePoId?: string;
  logsSubView?: 'LOGS' | 'QC' | 'TRACE' | 'HANDOVER';
  ordersSearch?: string;
  costingSearch?: string;
  masterSubTab?: 'OPS' | 'MACHINES_TOOLS' | 'WORKERS' | 'CONFIG';
  masterSearch?: string;
  attendanceSearch?: string;
}

export interface AdminTabCommonProps {
  bootstrap: BootstrapPayload;
  onRefreshBootstrap: () => Promise<void>;
  onNavigateTab: (tab: AdminTabKey, ctx?: AdminDeepLinkContext) => void;
  deepLink?: AdminDeepLinkContext;
}
