import type {
  AppRole,
  AuthSessionResponse,
  AuthSessionUser,
  BootstrapPayload,
  CuttingTool,
  MachineInfo,
  OperationMeta,
  ProductMeta,
  PurchaseOrderInfo,
  QuickSwitchProfile,
  ReportSubmitPayload,
  ReportSubmitResponse,
  WorkerDto,
} from '@shared/types';
import seedData from '../../../data/seed_gcck_1233.json';

export const GAS_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbx3YEacwHuxAdYb2yN1qckG4tmydnmmK4f8C_KVtQmUWmpBvJYUh_Jc1DrFZpTeM-bruQ/exec';

const LOCAL_LOGS_KEY = 'GCCK_LOCAL_CLIENT_LOGS_V1';

export const FALLBACK_PRODUCTS: ProductMeta[] = (seedData.costingList || []).map((c: any) => ({
  spId: String(c.spId || ''),
  customer: String(c.customer || 'Vico - Nội bộ / Khách lẻ'),
  productName: String(c.productName || ''),
  matName: String(c.matName || ''),
  setupMinutesStd: Number(c.setupMinutesStd || 0),
  opCount: Number(c.opCount || 0),
  totalStdSeconds: Number(c.totalSec || 0),
  drawingUrl: String(c.drawingUrl || ''),
  techDocUrl: String(c.techDocUrl || ''),
  quotedPrice: Number(c.quotedPrice || 0),
  rawMaterialCost: Number(c.rawMaterialCost || 0),
  outsourceCost: Number(c.outsourceCost || 0),
}));

export const FALLBACK_TOOLS: CuttingTool[] = (seedData.toolsList || []).map((t: any) => ({
  code: String(t.code),
  group: String(t.group || 'Tiện CNC'),
  name: String(t.name || ''),
  buyPrice: Number(t.buyPrice || 0),
  edges: Number(t.edges || 1),
  costPerEdge: Number(t.costPerEdge || 0),
  stockQty: Number(t.stockQty ?? 0),
  usedEdgesTotal: Number(t.usedEdgesTotal ?? 0),
}));

export const FALLBACK_OPERATIONS: OperationMeta[] = (seedData.operations || []).map((o: any, idx: number) => ({
  ncId: String(o.ncId),
  spId: String(o.spId || `SP${String(idx + 1).padStart(3, '0')}`),
  customer: String(o.customer || 'Vico - Nội bộ / Khách lẻ'),
  productName: String(o.productName),
  opName: String(o.opName),
  stdSeconds: Number(o.stdSeconds || 1800),
  stage: String(o.stage || '1'),
  stepOrder: Number(o.stepOrder || idx + 1),
  isFinalOp: Number(o.isFinalOp || (idx % 2 === 1 ? 1 : 0)),
  defaultMachine: String(o.defaultMachine || 'Máy Tiện CNC 1'),
  matName: String(o.matName || ''),
  cuttingRec: String(o.cuttingRec || ''),
  toolCode: String(o.toolCode || ''),
  toolName: String(o.toolName || ''),
  costPerEdge: Number(o.costPerEdge || 0),
  stdEdgesPerPcs: Number(o.stdEdgesPerPcs || 0),
  stdLaborCost: Number(o.stdLaborCost || 0),
  stdMachCost: Number(o.stdMachCost || 0),
  stdToolCost: Number(o.stdToolCost || 0),
}));

export const FALLBACK_MACHINES: MachineInfo[] = (seedData.machines || []).map((m: any) => ({
  id: String(m.id),
  name: String(m.name),
  group: String(m.group || 'Gia công CNC'),
  costPerHour: Number(m.costPerHour || 250000),
  status: (m.status || 'IDLE') as any,
  currentWorkerName: m.currentWorkerName || null,
  currentPoId: m.currentPoId || null,
  currentNcId: m.currentNcId || null,
  stopReason: m.stopReason || null,
  updatedAt: m.updatedAt || null,
}));

export const FALLBACK_ORDERS: PurchaseOrderInfo[] = (seedData.ordersList || []).map((p: any) => ({
  poId: String(p.poId),
  spId: p.spId ? String(p.spId) : null,
  customer: String(p.customer || 'Nội bộ'),
  productName: String(p.productName),
  qtyPo: Number(p.qtyPo || 0),
  dueDate: String(p.dueDate || '2026-10-30'),
  wipQty: Number(p.wipQty || 0),
  finishedQty: Number(p.finishedQty || 0),
  deliveredQty: Number(p.deliveredQty || 0),
  stockQty: Number(p.stockQty || 0),
  remainQty: Number(p.remainQty || 0),
  status: String(p.status || '⏳ Đang chờ SX'),
  materialLot: p.materialLot || 'LOT-2026-VC',
  faiStatus: p.faiStatus || 'PASSED_FAI',
}));

export const FALLBACK_WORKERS: WorkerDto[] = (seedData.workers || []).map((w: any) => {
  let appRole: AppRole = 'WORKER';
  if (w.id === 'NV00053' || w.role === 'QĐ' || w.title?.includes('Quản đốc')) {
    appRole = 'ADMIN';
  } else if (w.id === 'NV_KT02' || w.title?.includes('QC')) {
    appRole = 'QC';
  } else if (w.role === 'TC' || w.title?.includes('Trưởng ca')) {
    appRole = 'SHIFT_LEADER';
  } else if (w.role === 'KT') {
    appRole = 'SHIFT_LEADER';
  }

  return {
    id: String(w.id),
    name: String(w.name),
    username: String(w.username || w.name),
    role: String(w.role || 'CN'),
    appRole,
    title: String(w.title || 'Công nhân'),
    salaryMode: String(w.salaryMode || 'KHOAN'),
    isLinked: true,
    chatId: w.chatId ? String(w.chatId) : null,
  };
});

export const FALLBACK_PROFILES: QuickSwitchProfile[] = [
  {
    workerId: 'NV00214',
    name: 'Trần Văn Quỳnh',
    role: 'CN',
    appRole: 'WORKER',
    title: 'Công nhân đứng máy CNC',
    salaryMode: 'KHOAN',
  },
  {
    workerId: 'NV_KT02',
    name: 'Nguyễn Văn Duy',
    role: 'KT',
    appRole: 'QC',
    title: 'Kiểm soát chất lượng QC',
    salaryMode: 'LUONG_NGAY',
  },
  {
    workerId: 'NV00266',
    name: 'Trần Văn Dũng',
    role: 'TC',
    appRole: 'SHIFT_LEADER',
    title: 'Trưởng ca sản xuất',
    salaryMode: 'LUONG_NGAY',
  },
  {
    workerId: 'NV00053',
    name: 'Hoàng Ngọc Hà',
    role: 'QĐ',
    appRole: 'ADMIN',
    title: 'Quản đốc xưởng',
    salaryMode: 'LUONG_NGAY',
  },
];

export function getFallbackUser(workerId: string = 'NV00214'): AuthSessionUser {
  const w = FALLBACK_WORKERS.find((x) => x.id === workerId) || FALLBACK_WORKERS[0];
  return {
    workerId: w.id,
    name: w.name,
    username: w.username,
    role: w.role,
    appRole: w.appRole,
    title: w.title,
    salaryMode: w.salaryMode,
    isLinked: true,
    chatId: w.chatId,
  };
}

export function getClientStoredLogs(): any[] {
  try {
    const raw = localStorage.getItem(LOCAL_LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveClientStoredLog(log: any): void {
  try {
    const existing = getClientStoredLogs();
    existing.unshift(log);
    localStorage.setItem(LOCAL_LOGS_KEY, JSON.stringify(existing.slice(0, 100)));
  } catch {
    // ignore
  }
}

export function getFallbackBootstrap(currentUser?: AuthSessionUser | null): BootstrapPayload {
  const user = currentUser || getFallbackUser('NV00214');
  const storedLogs = getClientStoredLogs();
  const seedLogs = (seedData.recentLogs || []) as any[];
  const combinedLogs = [...storedLogs, ...seedLogs];

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const vnToday = `${yyyy}-${mm}-${dd}`;

  return {
    user,
    authMode: 'DEMO_QUICK',
    vietnamToday: vnToday,
    isSundayToday: now.getDay() === 0,
    workers: FALLBACK_WORKERS,
    machines: FALLBACK_MACHINES,
    toolsList: FALLBACK_TOOLS,
    products: FALLBACK_PRODUCTS,
    operations: FALLBACK_OPERATIONS,
    ordersList: FALLBACK_ORDERS,
    schedules: [],
    machineLoads: [],
    qcInspections: [],
    recentLogs: combinedLogs,
    todayAccumulated: (seedData.todayAccumulated as Record<string, number>) || {},
    opDoneMap: (seedData.opDoneMap as Record<string, number>) || {},
    kpiSummary: {
      totalOk: (seedData.kpiSummary as any)?.totalOk ?? 4390,
      totalRework: (seedData.kpiSummary as any)?.totalRework ?? 15,
      totalScrap: (seedData.kpiSummary as any)?.totalScrap ?? 8,
      totalStopMinutes: (seedData.kpiSummary as any)?.totalStopMinutes ?? 35,
      runningMachines: 18,
      bottleneckMachines: 2,
      openOrders: 189,
      overdueOrders: 4,
    },
    shiftHandoverAlerts: [],
    config: {
      WEB_APP_URL: GAS_WEBHOOK_URL,
      MANAGER_CHAT_ID: '5422717407',
      SECONDS_PER_SHIFT: '28800',
      SECOND_MACHINE_RATE: '0.33',
      MEAL_SHIFT_2_3: '25000',
      MEAL_OT_2H: '25000',
      MEAL_SUNDAY: '50000',
      KPI_WARNING_THRESHOLD: '95',
    },
  };
}

export function getFallbackSession(): AuthSessionResponse {
  return {
    authenticated: true,
    user: getFallbackUser('NV00214'),
    authMode: 'DEMO_QUICK',
    quickSwitchProfiles: FALLBACK_PROFILES,
  };
}

export async function submitDirectToGoogleAppsScript(
  payload: ReportSubmitPayload
): Promise<ReportSubmitResponse> {
  const recordUid = payload.recordUid || `GCCK-${Date.now()}`;
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  const worker = FALLBACK_WORKERS.find((w) => w.id === payload.workerId) || {
    name: 'Công nhân GCCK',
  };
  const op = FALLBACK_OPERATIONS.find((o) => o.ncId === payload.ncId);
  const machName = payload.machineName || 'Máy Tiện CNC 1';

  const scrapQty = Number(payload.scrapQty || 0);
  const edgesUsed = Number(payload.edgesUsed || 0);

  const gasBody = {
    record_id: recordUid,
    recordUid,
    date: payload.workDate || todayStr,
    worker: worker.name,
    worker_id: payload.workerId,
    customer: op?.customer || 'Vico - Nội bộ / Khách lẻ',
    product: op?.productName || 'Sản phẩm GCCK',
    po: payload.poId || 'PO485-01',
    op: op?.opName || payload.ncId || 'Gia công',
    machine: machName,
    qty_dat: Number(payload.okQty || 0),
    qty_xuly: Number(payload.reworkQty || 0),
    qty_huy: scrapQty,
    responsibility: scrapQty > 0 ? (payload.defectType || 'Không rõ lỗi') : 'Không có lỗi',
    material: payload.toolCode || '',
    qty_material: edgesUsed,
    downtime_min: Number(payload.stopMinutes || 0),
    downtime_note: payload.stopReason || '',
    photos: payload.photoBase64 ? [payload.photoBase64] : [],
    shift: payload.shiftType || 'Ca 1',
  };

  try {
    await fetch(GAS_WEBHOOK_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(gasBody),
    });
  } catch (gasErr) {
    console.warn('Direct GAS sync warning (stored offline):', gasErr);
  }

  const unitWage = Math.round(Number(op?.stdLaborCost) || 35000);
  const turnIncome = (payload.okQty || 0) * unitWage;

  const mockLogDto: any = {
    id: Date.now(),
    recordUid,
    workDate: payload.workDate || todayStr,
    workerId: payload.workerId,
    workerName: worker.name,
    customer: op?.customer || 'Vico - Nội bộ / Khách lẻ',
    productName: op?.productName || 'Sản phẩm GCCK',
    poId: payload.poId || 'PO485-01',
    opName: op?.opName || payload.ncId || 'Gia công',
    machineName: machName,
    okQty: payload.okQty || 0,
    reworkQty: payload.reworkQty || 0,
    scrapQty,
    income: turnIncome,
    shiftType: payload.shiftType || 'Ca 1',
    createdAt: new Date().toISOString(),
  };

  saveClientStoredLog(mockLogDto);

  return {
    success: true,
    deduplicated: false,
    message: 'Ghi nhận báo cáo thành công vào Nhật Ký Sản Lượng.',
    warnings: [],
    log: mockLogDto,
    payroll: {
      effectiveMachineMode: 'FIRST',
      machRate: 1,
      shiftMult: 1,
      isSunday: false,
      effectiveOtMinutes: Number(payload.overtimeMinutes || 0),
      unpaidOtMinutes: 0,
      effectivePaidStopMinutes: Number(payload.stopMinutes || 0),
      isMonthlyStaff: false,
      unitPiecePrice: unitWage,
      earnedStdSeconds: (payload.okQty || 0) * (op?.stdSeconds || 1800),
      netWorkSeconds: 28800,
      basePieceWage: turnIncome,
      otBonusWage: 0,
      waitWage: 0,
      pieceWage: turnIncome,
      directPieceIncome: turnIncome,
      mealAllowance: 0,
      scrapPenalty: 0,
      turnTotalIncome: turnIncome,
      costingLaborCost: turnIncome,
      costingMachCost: 0,
      costingToolCost: 0,
      costingScrapLoss: 0,
      batchCost: turnIncome,
      kpiPct: 100,
      kpiStatus: 'DAT_MUC',
      edgesConsumed: edgesUsed,
    },
    todayTotalIncome: turnIncome,
  };
}
