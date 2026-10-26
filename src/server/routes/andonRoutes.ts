import { Router } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import type { AndonLivePayload } from '../../shared/types';
import {
  queryMachines,
  queryOperations,
  queryPurchaseOrders,
  querySchedules,
} from '../db/queries';
import { computeMachineLoads } from '../../shared/loadBalancing';
import { getVietnamDateString } from '../../shared/payrollEngine';

export function createAndonRoutes(db: DatabaseSync): Router {
  const router = Router();

  router.get('/andon/live', (_req, res) => {
    const vietnamDate = getVietnamDateString();
    const machines = queryMachines(db);
    const orders = queryPurchaseOrders(db);
    const operations = queryOperations(db);
    const schedules = querySchedules(db);
    const loads = computeMachineLoads(machines, orders, operations, schedules);

    const loadById = new Map(loads.map((l) => [l.machineId, l]));
    const opByNcId = new Map(operations.map((o) => [o.ncId, o]));
    const lightsOutSet = new Set(
      schedules.filter((s) => s.isLightsOut === 1).map((s) => s.machineId)
    );

    const runningCount = machines.filter((m) => m.status === 'RUNNING').length;
    const setupCount = machines.filter((m) => m.status === 'SETUP').length;
    const stoppedCount = machines.filter((m) => m.status === 'STOPPED').length;
    const idleCount = machines.length - runningCount - setupCount - stoppedCount;
    const spindleRunPct =
      machines.length > 0 ? Math.round((runningCount / machines.length) * 100) : 0;

    const todayAgg = db
      .prepare(
        `SELECT COALESCE(SUM(ok_qty), 0) AS ok_sum, COALESCE(SUM(scrap_qty), 0) AS ng_sum
         FROM production_logs WHERE work_date = ? AND is_voided = 0`
      )
      .get(vietnamDate) as { ok_sum: number; ng_sum: number };

    // Urgent & Overdue Open POs (ZERO financial prices!)
    const urgentOrders = orders
      .filter((po) => po.remainQty > 0)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.priority! - b.priority!)
      .slice(0, 12)
      .map((po) => ({
        poId: po.poId,
        customer: po.customer,
        productName: po.productName,
        qtyPo: po.qtyPo,
        finishedQty: po.finishedQty,
        remainQty: po.remainQty,
        dueDate: po.dueDate,
        isOverdue: Boolean(po.dueDate && po.dueDate < vietnamDate),
        progressPct: po.qtyPo > 0 ? Math.min(100, Math.round((po.finishedQty / po.qtyPo) * 100)) : 0,
        status: po.status,
      }));

    // Worker Standard-Hour Leaderboard (ZERO VND salary leak!)
    const leaderRows = db
      .prepare(
        `SELECT worker_id, worker_name,
                COALESCE(SUM(ok_qty * std_seconds), 0) AS earned_sec,
                COALESCE(SUM(ok_qty), 0) AS ok_total,
                ROUND(AVG(kpi_pct), 0) AS avg_kpi
         FROM production_logs
         WHERE is_voided = 0
         GROUP BY worker_id
         ORDER BY earned_sec DESC
         LIMIT 10`
      )
      .all() as Array<Record<string, any>>;

    const workerLeaderboard = leaderRows.map((r, i) => ({
      rank: i + 1,
      workerId: String(r.worker_id),
      workerName: String(r.worker_name),
      earnedStdHours: Number((Number(r.earned_sec || 0) / 3600).toFixed(1)),
      kpiPct: Number(r.avg_kpi || 100),
      okQtyTotal: Number(r.ok_total || 0),
    }));

    const alertsTicker: string[] = [];
    for (const m of machines) {
      if (m.status === 'STOPPED') {
        alertsTicker.push(`🚨 DỪNG MÁY: ${m.name} (${m.stopReason || 'Kiểm tra kỹ thuật'})`);
      }
    }
    for (const l of loads) {
      if (l.isBottleneck) {
        alertsTicker.push(
          `🔥 CỔ CHAI TẢI ${l.loadPct}%: ${l.machineName} — gợi ý san tải sang ${l.alternativeMachines[0] || 'Ca 3 Lights-out'}`
        );
      }
    }
    for (const po of urgentOrders.slice(0, 4)) {
      if (po.isOverdue) {
        alertsTicker.push(
          `⏰ ĐƠN QUÁ HẠN: ${po.poId} (${po.productName}) còn thiếu ${po.remainQty} SP`
        );
      }
    }
    if (alertsTicker.length === 0) {
      alertsTicker.push('✅ Xưởng GCCK Thắng Lợi vận hành ổn định — Tuân thủ tự kiểm ★ và 5S cuối ca.');
    }

    const payload: AndonLivePayload = {
      serverTime: new Date().toISOString(),
      vietnamDate,
      spindleRunPct,
      summary: {
        totalMachines: machines.length,
        runningCount,
        setupCount,
        stoppedCount,
        idleCount,
        todayOkQty: Number(todayAgg.ok_sum || 0),
        todayScrapQty: Number(todayAgg.ng_sum || 0),
      },
      machines: machines.map((m) => {
        const l = loadById.get(m.id);
        const curOp = m.currentNcId ? opByNcId.get(m.currentNcId) : undefined;
        return {
          id: m.id,
          name: m.name,
          group: m.group,
          status: m.status ?? 'IDLE',
          currentWorkerName: m.currentWorkerName ?? null,
          currentPoId: m.currentPoId ?? null,
          currentNcId: m.currentNcId ?? null,
          currentProductName: curOp?.productName ?? null,
          currentOpName: curOp?.opName ?? null,
          stopReason: m.stopReason ?? null,
          isLightsOut: lightsOutSet.has(m.id),
          loadPct: l?.loadPct ?? 0,
          isBottleneck: l?.isBottleneck ?? false,
        };
      }),
      urgentOrders,
      workerLeaderboard,
      alertsTicker,
    };

    res.json(payload);
  });

  return router;
}
