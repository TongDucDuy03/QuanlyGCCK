import { describe, it, expect } from 'vitest';
import { computeMachineLoads } from '../../src/shared/loadBalancing';
import type { MachineInfo, OperationMeta, PurchaseOrderInfo, ScheduleBlock } from '../../src/shared/types';

describe('loadBalancing — Machine Capacity %, Bottleneck Flags, SMED Grouping & Lights-Out', () => {
  const machines: MachineInfo[] = [
    { id: 'M02', name: 'Máy Tiện CNC 1', group: 'Tiện CNC 2 trục (M01)', costPerHour: 350000, status: 'RUNNING' },
    { id: 'M03', name: 'Máy Tiện CNC 2', group: 'Tiện CNC 2 trục (M01)', costPerHour: 350000, status: 'IDLE' },
    { id: 'M09', name: 'Máy phay OKK1', group: 'Phay cơ vạn năng (M07)', costPerHour: 220000, status: 'RUNNING' },
  ];

  const ops: OperationMeta[] = [
    {
      ncId: 'NC101',
      spId: 'SP010',
      customer: 'Win-Win',
      productName: 'ALKTOP 1130 H',
      opName: 'Tiện thô',
      stdSeconds: 3600, // 1h/pc
      stage: 'End',
      stepOrder: 1,
      isFinalOp: 1,
      defaultMachine: 'Máy Tiện CNC 1',
      matName: 'Thép SKD11',
      cuttingRec: 'Vc=120',
      toolCode: 'T01',
      toolName: 'CNMG',
      costPerEdge: 27500,
      stdEdgesPerPcs: 1,
      stdLaborCost: 50000,
      stdMachCost: 350000,
      stdToolCost: 27500,
    },
    {
      ncId: 'NC102',
      spId: 'SP011',
      customer: 'Win-Win',
      productName: 'ALKTOP 1342 H',
      opName: 'Tiện tinh',
      stdSeconds: 3600, // 1h/pc
      stage: 'End',
      stepOrder: 1,
      isFinalOp: 1,
      defaultMachine: 'Máy Tiện CNC 1',
      matName: 'Thép SKD11',
      cuttingRec: 'Vc=120',
      toolCode: 'T01',
      toolName: 'CNMG',
      costPerEdge: 27500,
      stdEdgesPerPcs: 1,
      stdLaborCost: 50000,
      stdMachCost: 350000,
      stdToolCost: 27500,
    },
    {
      ncId: 'NC201',
      spId: 'SP020',
      customer: 'TFG',
      productName: 'Bích thép C45',
      opName: 'Phay mặt',
      stdSeconds: 3600,
      stage: 'End',
      stepOrder: 1,
      isFinalOp: 1,
      defaultMachine: 'Máy phay OKK1',
      matName: 'Thép C45',
      cuttingRec: 'Vc=90',
      toolCode: 'T05',
      toolName: 'APMT',
      costPerEdge: 20000,
      stdEdgesPerPcs: 2,
      stdLaborCost: 50000,
      stdMachCost: 220000,
      stdToolCost: 40000,
    },
  ];

  const openOrders: PurchaseOrderInfo[] = [
    {
      poId: 'PO-01',
      customer: 'Win-Win',
      spId: 'SP010',
      productName: 'ALKTOP 1130 H',
      qtyPo: 60,
      finishedQty: 0,
      wipQty: 0,
      deliveredQty: 0,
      stockQty: 0,
      remainQty: 60,
      dueDate: '2026-10-30',
      status: '⏳ Đang chờ SX',
    },
    {
      poId: 'PO-02',
      customer: 'Win-Win',
      spId: 'SP011',
      productName: 'ALKTOP 1342 H',
      qtyPo: 50,
      finishedQty: 0,
      wipQty: 0,
      deliveredQty: 0,
      stockQty: 0,
      remainQty: 50,
      dueDate: '2026-10-31',
      status: '⏳ Đang chờ SX',
    },
    {
      poId: 'PO-03',
      customer: 'TFG',
      spId: 'SP020',
      productName: 'Bích thép C45',
      qtyPo: 82,
      finishedQty: 0,
      wipQty: 0,
      deliveredQty: 0,
      stockQty: 0,
      remainQty: 82,
      dueDate: '2026-11-02',
      status: '⏳ Đang chờ SX',
    },
  ];

  const schedules: ScheduleBlock[] = [
    {
      id: 1,
      machineId: 'M02',
      machineName: 'Máy Tiện CNC 1',
      poId: 'PO-01',
      ncId: 'NC101',
      workDate: '2026-10-26',
      shiftType: 'Ca 3 (Đêm 22h-06h)',
      plannedQty: 8,
      plannedHours: 8,
      isLightsOut: 1,
      sequenceOrder: 1,
      status: 'PLANNED',
    },
  ];

  it('flags >100% bottleneck (red), >80% warning (yellow), SMED material consolidation, sister alternatives & Lights-out', () => {
    const loads = computeMachineLoads(machines, openOrders, ops, schedules, { capacityHours: 96 });

    const m02 = loads.find((m) => m.machineId === 'M02')!;
    const m03 = loads.find((m) => m.machineId === 'M03')!;
    const m09 = loads.find((m) => m.machineId === 'M09')!;

    // M02: 60 + 50 = 110h / 96h = 114.6% -> BOTTLENECK
    expect(m02.totalDemandHours).toBe(110);
    expect(m02.loadPct).toBeGreaterThan(100);
    expect(m02.isBottleneck).toBe(true);
    expect(m02.loadLevel).toBe('BOTTLENECK');
    expect(m02.suggestLightsOut).toBe(true);
    expect(m02.lightsOutHours).toBe(8);
    expect(m02.alternativeMachines).toContain('Máy Tiện CNC 2');
    expect(m02.smedSuggestion).toContain('SKD11');

    // M03: 0h -> IDLE
    expect(m03.loadPct).toBe(0);
    expect(m03.loadLevel).toBe('IDLE');

    // M09: 82h / 96h = 85.4% -> WARNING (>80% and <=100%)
    expect(m09.loadPct).toBeGreaterThan(80);
    expect(m09.loadPct).toBeLessThanOrEqual(100);
    expect(m09.isWarning).toBe(true);
    expect(m09.isBottleneck).toBe(false);
    expect(m09.loadLevel).toBe('WARNING');
  });
});
