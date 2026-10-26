import { describe, it, expect } from 'vitest';
import { computeProductCosting } from '../../src/shared/costingEngine';
import type { OperationMeta, ProductMeta } from '../../src/shared/types';

const sp095Product: ProductMeta = {
  spId: 'SP095',
  customer: 'Taniguchi',
  productName: 'Búa đập loại máy nghiền đứng VHC-111 theo bv: VHC-20102',
  quotedPrice: 3_742_000,
  rawMaterialCost: 0,
  outsourceCost: 0,
};

const sp095Ops: OperationMeta[] = [
  {
    ncId: 'NC158',
    spId: 'SP095',
    customer: 'Taniguchi',
    productName: sp095Product.productName,
    opName: 'G/c làm định vị',
    stdSeconds: 3600,
    stage: '1',
    stepOrder: 1,
    isFinalOp: 0,
    defaultMachine: 'Máy tiện FUJI',
    matName: 'SCMnH11',
    cuttingRec: 'Vc=90',
    toolCode: 'T03',
    toolName: 'TNMG 160408',
    costPerEdge: 20833,
    stdEdgesPerPcs: 2.1,
    stdLaborCost: 48132,
    stdMachCost: 349992,
    stdToolCost: 43750,
  },
  {
    ncId: 'NC159',
    spId: 'SP095',
    customer: 'Taniguchi',
    productName: sp095Product.productName,
    opName: 'G/c hoàn thiện',
    stdSeconds: 18000,
    stage: 'End',
    stepOrder: 2,
    isFinalOp: 1,
    defaultMachine: 'Máy tiện FUJI',
    matName: 'SCMnH11',
    cuttingRec: 'Vc=90',
    toolCode: 'T01',
    toolName: 'CNMG 120408',
    costPerEdge: 27500,
    stdEdgesPerPcs: 10.5,
    stdLaborCost: 240660,
    stdMachCost: 1749960,
    stdToolCost: 288750,
  },
];

describe('costingEngine — SP095 Anti-Fake-Profit, Std Fallback & Raw/Outsource Costing', () => {
  it('prevents SP095 fake profit when only upstream op NC158 has logs and final op NC159 has 0 pcs', () => {
    const res = computeProductCosting(sp095Product, sp095Ops, [
      { ncId: 'NC158', okQty: 8, batchCost: 3_690_000 },
    ]);

    expect(res.finishedQty).toBe(0);
    expect(res.wipQty).toBe(8);
    expect(res.hasActual).toBe(false);
    expect(res.totalStdCost).toBe(2_993_368);
    expect(res.actualUnitCost).toBe(2_993_368);
    expect(res.totalBatchProfit).toBe(0);
  });

  it('substitutes stdOpUnitCost for unlogged upstream step when only final op is logged', () => {
    const res = computeProductCosting(sp095Product, sp095Ops, [
      { ncId: 'NC159', okQty: 4, batchCost: 8_800_000 },
    ]);

    expect(res.finishedQty).toBe(4);
    expect(res.hasActual).toBe(true);
    // Step 1 stdOpUnitCost = round((48132 + 349992 + 43750) * 1.1) = 486061
    // Step 2 actual unit = 8800000 / 4 = 2200000
    expect(res.stepBreakdowns[0].usedStdFallback).toBe(true);
    expect(res.actualUnitCost).toBe(486_061 + 2_200_000);
  });

  it('includes rawMaterialCost and outsourceCost in both totalStdCost and actualUnitCost', () => {
    const prodWithBlank: ProductMeta = {
      ...sp095Product,
      rawMaterialCost: 450_000,
      outsourceCost: 150_000,
      quotedPrice: 4_500_000,
    };
    const res = computeProductCosting(prodWithBlank, sp095Ops, [
      { ncId: 'NC158', okQty: 5, batchCost: 2_000_000 },
      { ncId: 'NC159', okQty: 5, batchCost: 11_000_000 },
    ]);

    expect(res.totalStdCost).toBe(2_993_368 + 600_000);
    expect(res.finishedQty).toBe(5);
    expect(res.actualUnitCost).toBe(400_000 + 2_200_000 + 600_000);
    expect(res.unitProfit).toBe(4_500_000 - res.actualUnitCost);
    expect(res.totalBatchProfit).toBe(res.unitProfit * 5);
  });
});
