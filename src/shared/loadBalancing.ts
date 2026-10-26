import type {
  LoadCalcOptions,
  MachineInfo,
  MachineLoadLevel,
  MachineLoadSummary,
  OperationMeta,
  PurchaseOrderInfo,
  ScheduleBlock,
  SmedMaterialCluster,
} from './types';
import { normalizeVn, removeVietnameseTones } from './vnSearch';

function classifyMaterialGroup(matName: string | undefined): string {
  const raw = normalizeVn(matName);
  if (!raw) return 'Thép kết cấu chung';
  const ascii = removeVietnameseTones(raw).toUpperCase();
  if (ascii.includes('SKD11') || ascii.includes('SCMNH11') || ascii.includes('MANGAN')) {
    return 'Thép khuôn SKD11 / SCMnH11';
  }
  if (ascii.includes('HOP KIM') || ascii.includes('CR') || ascii.includes('GANG')) {
    return 'Gang / Hợp kim Cr chịu mài mòn';
  }
  if (ascii.includes('INOX') || ascii.includes('SUS') || ascii.includes('304')) {
    return 'Inox SUS304 / SUS316';
  }
  if (ascii.includes('C45') || ascii.includes('SS400') || ascii.includes('S45C')) {
    return 'Thép C45 / SS400';
  }
  return raw.slice(0, 32);
}

function isLightsOutCapable(machine: MachineInfo): boolean {
  const s = removeVietnameseTones(`${machine.name} ${machine.group}`).toUpperCase();
  return (
    s.includes('CNC') ||
    s.includes('OKUMA') ||
    s.includes('FUJI') ||
    s.includes('CAT DAY') ||
    s.includes('EDM') ||
    s.includes('IN 3D')
  );
}

export function computeMachineLoads(
  machines: MachineInfo[],
  openOrders: PurchaseOrderInfo[],
  ops: OperationMeta[],
  schedules: ScheduleBlock[],
  options: LoadCalcOptions = {}
): MachineLoadSummary[] {
  // Default weekly 2-shift capacity: 6 days x 16h = 96 hours
  const capacityHours = Math.max(1, Number(options.capacityHours) || 96);

  // Index operations by spId and by compact normalized productName
  const opsBySpId = new Map<string, OperationMeta[]>();
  const opsByCompactProd = new Map<string, OperationMeta[]>();

  for (const op of ops) {
    if (op.spId) {
      const list = opsBySpId.get(op.spId) || [];
      list.push(op);
      opsBySpId.set(op.spId, list);
    }
    const compact = normalizeVn(op.productName).replace(/\s+/g, '').toUpperCase();
    if (compact) {
      const list = opsByCompactProd.get(compact) || [];
      list.push(op);
      opsByCompactProd.set(compact, list);
    }
  }

  interface RawMachineAcc {
    machine: MachineInfo;
    openPoHours: number;
    scheduledHours: number;
    lightsOutHours: number;
    extraScheduleHours: number;
    coveredPoNcKeys: Set<string>;
    jobPoIds: Set<string>;
    matClusters: Map<string, { jobCount: number; totalHours: number; poIds: Set<string> }>;
  }

  const accByName = new Map<string, RawMachineAcc>();
  const accById = new Map<string, RawMachineAcc>();

  for (const m of machines) {
    const acc: RawMachineAcc = {
      machine: m,
      openPoHours: 0,
      scheduledHours: 0,
      lightsOutHours: 0,
      extraScheduleHours: 0,
      coveredPoNcKeys: new Set(),
      jobPoIds: new Set(),
      matClusters: new Map(),
    };
    accByName.set(normalizeVn(m.name).toLowerCase(), acc);
    accById.set(m.id, acc);
  }

  // 1. Accumulate open PO hours per assigned defaultMachine
  for (const po of openOrders) {
    const statusAscii = removeVietnameseTones(po.status || '').toLowerCase();
    if (statusAscii.includes('da giao du')) continue;

    const openQty = Math.max(0, (Number(po.qtyPo) || 0) - (Number(po.finishedQty) || 0));
    if (openQty <= 0) continue;

    const compactProd = normalizeVn(po.productName).replace(/\s+/g, '').toUpperCase();
    const matchedOps =
      (po.spId && opsBySpId.get(po.spId)) || opsByCompactProd.get(compactProd) || [];

    for (const op of matchedOps) {
      const acc = accByName.get(normalizeVn(op.defaultMachine).toLowerCase());
      if (!acc) continue;

      const hrs = (openQty * Math.max(0, Number(op.stdSeconds) || 0)) / 3600;
      if (hrs <= 0) continue;

      acc.openPoHours += hrs;
      acc.coveredPoNcKeys.add(`${po.poId}||${op.ncId}`);
      acc.jobPoIds.add(po.poId);

      const matGroup = classifyMaterialGroup(op.matName);
      const cluster = acc.matClusters.get(matGroup) || {
        jobCount: 0,
        totalHours: 0,
        poIds: new Set<string>(),
      };
      cluster.jobCount += 1;
      cluster.totalHours += hrs;
      cluster.poIds.add(po.poId);
      acc.matClusters.set(matGroup, cluster);
    }
  }

  // 2. Accumulate schedule blocks (avoid double counting if already in openPoHours)
  for (const sb of schedules) {
    if (sb.status === 'DONE' || sb.status === 'CANCELLED') continue;
    const acc =
      accById.get(sb.machineId) ||
      accByName.get(normalizeVn(sb.machineName).toLowerCase());
    if (!acc) continue;

    const hrs = Math.max(0, Number(sb.plannedHours) || 0);
    acc.scheduledHours += hrs;
    if (Number(sb.isLightsOut) === 1) {
      acc.lightsOutHours += hrs;
    }
    const key = `${sb.poId}||${sb.ncId}`;
    if (!acc.coveredPoNcKeys.has(key)) {
      acc.extraScheduleHours += hrs;
      if (sb.poId) acc.jobPoIds.add(sb.poId);
    }
  }

  // First pass: calculate loadPct per machine so we can find underloaded sister machines
  const prelim = machines.map((m) => {
    const acc = accById.get(m.id)!;
    const totalDemandHours = Number((acc.openPoHours + acc.extraScheduleHours).toFixed(2));
    const loadPct = Number(((totalDemandHours / capacityHours) * 100).toFixed(1));
    return { acc, totalDemandHours, loadPct };
  });

  return prelim.map(({ acc, totalDemandHours, loadPct }) => {
    const { machine } = acc;
    const isBottleneck = loadPct > 100;
    const isWarning = loadPct > 80;

    let loadLevel: MachineLoadLevel = 'NORMAL';
    if (totalDemandHours <= 0) loadLevel = 'IDLE';
    else if (isBottleneck) loadLevel = 'BOTTLENECK';
    else if (isWarning) loadLevel = 'WARNING';

    const smedClusters: SmedMaterialCluster[] = [...acc.matClusters.entries()]
      .map(([materialGroup, c]) => ({
        materialGroup,
        jobCount: c.jobCount,
        totalHours: Number(c.totalHours.toFixed(1)),
        poIds: [...c.poIds],
      }))
      .sort((a, b) => b.jobCount - a.jobCount || b.totalHours - a.totalHours);

    const topMultiCluster = smedClusters.find((c) => c.jobCount >= 2);
    const smedSuggestion = topMultiCluster
      ? `Gộp ${topMultiCluster.jobCount} lệnh cùng phôi [${topMultiCluster.materialGroup}] (${topMultiCluster.totalHours}h) để giảm gá đặt SMED`
      : null;

    const suggestLightsOut = isWarning && isLightsOutCapable(machine);
    const lightsOutReason = suggestLightsOut
      ? `Tải ${loadPct}% (>80%) trên máy tự động — đề xuất chạy Ca 3 Lights-out cho phôi dài giờ`
      : null;

    const alternativeMachines = prelim
      .filter(
        (other) =>
          other.acc.machine.id !== machine.id &&
          normalizeVn(other.acc.machine.group) === normalizeVn(machine.group) &&
          other.loadPct < 80
      )
      .map((other) => other.acc.machine.name);

    return {
      machineId: machine.id,
      machineName: machine.name,
      group: machine.group,
      status: machine.status ?? 'IDLE',
      capacityHours,
      openPoHours: Number(acc.openPoHours.toFixed(2)),
      scheduledHours: Number(acc.scheduledHours.toFixed(2)),
      lightsOutHours: Number(acc.lightsOutHours.toFixed(2)),
      totalDemandHours,
      loadPct,
      loadLevel,
      isWarning,
      isBottleneck,
      jobCount: acc.jobPoIds.size,
      smedClusters,
      smedSuggestion,
      suggestLightsOut,
      lightsOutReason,
      alternativeMachines,
    };
  });
}
