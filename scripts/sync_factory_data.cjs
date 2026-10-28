const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

function getNum(cell, fallback = 0) {
  let v = cell.value;
  if (v !== null && typeof v === 'object' && 'result' in v) {
    v = v.result;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function getStr(cell) {
  let v = cell.value;
  if (v !== null && typeof v === 'object' && 'result' in v) {
    v = v.result;
  }
  return String(v ?? '').trim();
}

async function syncAll() {
  console.log('>>> 1. READING DM_NHAN_SU_MAY.xlsx...');
  const wbNS = new ExcelJS.Workbook();
  await wbNS.xlsx.readFile('DM_NHAN_SU_MAY.xlsx');
  const wsNS = wbNS.worksheets[0];

  const workersFromExcel = [];
  const machinesFromExcel = [];
  const machineRateByName = new Map();

  for (let r = 2; r <= wsNS.rowCount; r++) {
    const row = wsNS.getRow(r);
    const wId = getStr(row.getCell(1));
    if (wId && wId.startsWith('NV')) {
      const shiftWage = getNum(row.getCell(6), 385000);
      const secWage = getNum(row.getCell(7), Number((shiftWage / 28800).toFixed(2)));

      workersFromExcel.push({
        id: wId,
        name: getStr(row.getCell(2)),
        title: getStr(row.getCell(3)),
        role: getStr(row.getCell(4)),
        salaryMode: getStr(row.getCell(5)) || 'Khoán 1 + 0.33 máy',
        baseSalary: shiftWage,
        costPerSec: secWage,
        chatId: getStr(row.getCell(8)),
        note: getStr(row.getCell(10)),
      });
    }

    const mId = getStr(row.getCell(12));
    if (mId && mId.startsWith('M')) {
      const shiftCost = getNum(row.getCell(18), 700000);
      const costPerHour = getNum(row.getCell(19), Math.round(shiftCost / 8));
      const mName = getStr(row.getCell(13));
      const mGroup = getStr(row.getCell(14));
      const assetCode = getStr(row.getCell(15));
      const hoursPerDay = getNum(row.getCell(16), 16);
      const machOnlyPerHour = getNum(row.getCell(17), 39375);

      const mItem = {
        id: mId,
        name: mName,
        group: mGroup,
        assetCode,
        hoursPerDay,
        machOnlyPerHour,
        costPerShift: shiftCost,
        costPerHour,
      };
      machinesFromExcel.push(mItem);
      machineRateByName.set(mName.toLowerCase(), mItem);
    }
  }

  console.log(`Parsed ${workersFromExcel.length} workers, ${machinesFromExcel.length} machines from DM_NHAN_SU_MAY.xlsx`);

  console.log('\n>>> 2. READING DM_CONG_NGHE.xlsx...');
  const wbCN = new ExcelJS.Workbook();
  await wbCN.xlsx.readFile('DM_CONG_NGHE.xlsx');
  const wsCN = wbCN.worksheets[0];

  const operationsFromExcel = [];
  const productsMap = new Map();

  for (let r = 2; r <= wsCN.rowCount; r++) {
    const row = wsCN.getRow(r);
    const ncId = getStr(row.getCell(1));
    if (!ncId || !ncId.startsWith('NC')) continue;

    const customer = getStr(row.getCell(3));
    const productName = getStr(row.getCell(4));
    const opName = getStr(row.getCell(5));
    const stdSeconds = Math.round(getNum(row.getCell(6)));
    const stage = getStr(row.getCell(8)) || 'End';
    const defaultMachine = getStr(row.getCell(9));
    const matName = getStr(row.getCell(11));
    const cuttingRec = getStr(row.getCell(12));
    const toolCode = getStr(row.getCell(13));
    const toolName = getStr(row.getCell(14));
    const costPerEdge = getNum(row.getCell(15));
    const stdEdgesPerPcs = getNum(row.getCell(16));

    let stdLaborCost = Math.round(getNum(row.getCell(17)));
    if (!stdLaborCost && stdSeconds > 0) {
      stdLaborCost = Math.round(stdSeconds * (385000 / 28800));
    }

    let stdMachCost = Math.round(getNum(row.getCell(18)));
    if (!stdMachCost && stdSeconds > 0) {
      const machMeta = machineRateByName.get(defaultMachine.toLowerCase());
      const machRateOnly = machMeta ? machMeta.machOnlyPerHour : 39375;
      stdMachCost = Math.round((stdSeconds / 3600) * machRateOnly);
    }

    const stdToolCost = 0; // auxiliary tools already bundled in shift rate
    let totalNcCost = Math.round(getNum(row.getCell(20)));
    if (!totalNcCost) {
      totalNcCost = stdLaborCost + stdMachCost + stdToolCost;
    }

    const opItem = {
      ncId,
      customer,
      productName,
      opName,
      stdSeconds,
      stage,
      defaultMachine,
      matName,
      cuttingRec,
      toolCode,
      toolName,
      costPerEdge,
      stdEdgesPerPcs,
      stdLaborCost,
      stdMachCost,
      stdToolCost,
      totalNcCost,
    };
    operationsFromExcel.push(opItem);

    const prodKey = `${customer}||${productName}`;
    if (!productsMap.has(prodKey)) {
      productsMap.set(prodKey, {
        customer,
        productName,
        matName,
        ops: [],
        totalSec: 0,
        stdLabor: 0,
        stdMach: 0,
        stdTool: 0,
        quotedPrice: 0,
      });
    }
    const p = productsMap.get(prodKey);
    p.ops.push(opItem);
    p.totalSec += stdSeconds;
    p.stdLabor += stdLaborCost;
    p.stdMach += stdMachCost;
    p.stdTool += stdToolCost;
    p.quotedPrice += totalNcCost;
  }

  console.log(`Parsed ${operationsFromExcel.length} operations across ${productsMap.size} products from DM_CONG_NGHE.xlsx`);

  // Load existing seed data
  const existingSeed = JSON.parse(fs.readFileSync('data/seed_gcck_1233.json', 'utf8'));
  const oldSpIdByProd = new Map();
  for (const c of existingSeed.costingList || []) {
    oldSpIdByProd.set(`${c.customer}||${c.productName}`, c.spId);
  }

  let spCounter = 1;
  const productEntries = [];
  for (const [key, p] of productsMap.entries()) {
    let spId = oldSpIdByProd.get(key);
    if (!spId) {
      spId = `SP${String(spCounter).padStart(3, '0')}`;
      spCounter++;
    }
    productEntries.push({
      spId,
      customer: p.customer,
      productName: p.productName,
      matName: p.matName,
      totalSec: p.totalSec,
      totalHours: Number((p.totalSec / 3600).toFixed(2)),
      stdLabor: p.stdLabor,
      stdMach: p.stdMach,
      stdTool: p.stdTool,
      stdOverhead: 0,
      totalStdCost: p.stdLabor + p.stdMach + p.stdTool,
      quotedPrice: p.quotedPrice,
      opCount: p.ops.length,
      opsSummary: p.ops.map(o => o.opName).join(' → '),
    });
  }

  // Deduplicate spId
  const usedSpIds = new Set();
  productEntries.forEach((p, idx) => {
    let target = p.spId;
    if (usedSpIds.has(target)) {
      target = `SP${String(idx + 1).padStart(3, '0')}`;
    }
    usedSpIds.add(target);
    p.spId = target;
  });

  console.log('\n>>> 3. UPDATING seed_gcck_1233.json...');
  // Keep admin/tech accounts
  const existingWorkersMap = new Map();
  for (const w of existingSeed.workers || []) {
    existingWorkersMap.set(w.id, w);
  }
  for (const w of workersFromExcel) {
    const prev = existingWorkersMap.get(w.id) || {};
    existingWorkersMap.set(w.id, {
      ...prev,
      id: w.id,
      name: w.name,
      role: w.title,
      title: w.role,
      salaryMode: w.salaryMode,
      baseSalary: w.baseSalary,
      costPerSec: w.costPerSec,
      chatId: w.chatId || prev.chatId || '',
      isLinked: prev.isLinked || false,
      username: prev.username || w.id.toLowerCase(),
      pin: prev.pin || '1234',
    });
  }
  existingSeed.workers = Array.from(existingWorkersMap.values());

  existingSeed.machines = machinesFromExcel.map(m => ({
    id: m.id,
    name: m.name,
    group: m.group,
    costPerHour: m.costPerHour,
  }));

  existingSeed.operations = operationsFromExcel.map(o => ({
    ncId: o.ncId,
    customer: o.customer,
    productName: o.productName,
    opName: o.opName,
    stdSeconds: o.stdSeconds,
    stage: o.stage,
    defaultMachine: o.defaultMachine,
    matName: o.matName,
    cuttingRec: o.cuttingRec,
    toolCode: o.toolCode,
    toolName: o.toolName,
    costPerEdge: o.costPerEdge,
    stdEdgesPerPcs: o.stdEdgesPerPcs,
    stdLaborCost: o.stdLaborCost,
    stdMachCost: o.stdMachCost,
    stdToolCost: o.stdToolCost,
  }));

  existingSeed.costingList = productEntries.map(p => ({
    spId: p.spId,
    customer: p.customer,
    productName: p.productName,
    opCount: p.opCount,
    opsSummary: p.opsSummary,
    totalSec: p.totalSec,
    totalHours: p.totalHours,
    stdLabor: p.stdLabor,
    stdMach: p.stdMach,
    stdTool: p.stdTool,
    stdOverhead: 0,
    totalStdCost: p.totalStdCost,
    quotedPrice: p.quotedPrice,
    finishedQty: 0,
    actualBatchCost: 0,
    actualUnitCost: p.totalStdCost,
    unitProfit: 0,
    totalBatchProfit: 0,
    marginPct: 0,
    hasActual: false,
  }));

  fs.writeFileSync('data/seed_gcck_1233.json', JSON.stringify(existingSeed, null, 2), 'utf8');
  console.log('Saved data/seed_gcck_1233.json successfully!');

  console.log('\n>>> 4. UPDATING ACTIVE SQLITE DATABASE (data/gcck_mes.sqlite)...');
  const db = new DatabaseSync('data/gcck_mes.sqlite');
  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec('BEGIN IMMEDIATE;');

  try {
    // 4.1 Update machines
    const updateMach = db.prepare('UPDATE machines SET cost_per_hour = ?, group_name = ? WHERE id = ?');
    for (const m of machinesFromExcel) {
      updateMach.run(m.costPerHour, m.group, m.id);
    }
    console.log(`Updated ${machinesFromExcel.length} machines.`);

    // 4.2 Update workers
    const upsertWorker = db.prepare(`
      INSERT INTO workers (id, name, username, role, title, salary_mode, base_salary, cost_per_sec, pin_hash, chat_id, is_linked, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, '89d535ff49463a56cf9937001fc935f8e56218151240c5f49e7cf8a8044d03b0', ?, 0, 1)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        role = excluded.role,
        title = excluded.title,
        salary_mode = excluded.salary_mode,
        base_salary = excluded.base_salary,
        cost_per_sec = excluded.cost_per_sec
    `);
    for (const w of workersFromExcel) {
      upsertWorker.run(w.id, w.name, w.id.toLowerCase(), w.title, w.role, w.salaryMode, w.baseSalary, w.costPerSec, w.chatId);
    }
    console.log(`Updated ${workersFromExcel.length} workers.`);

    // 4.3 Update operations
    const updateOp = db.prepare(`
      UPDATE operations SET
        std_seconds = ?,
        default_machine = ?,
        std_labor_cost = ?,
        std_mach_cost = ?,
        std_tool_cost = ?,
        cost_per_edge = ?,
        std_edges_per_pcs = ?
      WHERE nc_id = ?
    `);
    let opUpdated = 0;
    for (const o of operationsFromExcel) {
      const res = updateOp.run(
        o.stdSeconds,
        o.defaultMachine,
        o.stdLaborCost,
        o.stdMachCost,
        o.stdToolCost,
        o.costPerEdge,
        o.stdEdgesPerPcs,
        o.ncId
      );
      if (res.changes > 0) opUpdated++;
    }
    console.log(`Updated ${opUpdated} operations in SQLite.`);

    // 4.4 Update product quoted_price based on updated operations
    const updateProdPrices = db.prepare(`
      UPDATE products SET quoted_price = (
        SELECT COALESCE(SUM(std_labor_cost + std_mach_cost + std_tool_cost), 0)
        FROM operations WHERE operations.sp_id = products.sp_id
      )
    `);
    const pRes = updateProdPrices.run();
    console.log(`Updated quoted_price for products (${pRes.changes} rows).`);

    db.exec('COMMIT;');
    console.log('Database transaction COMMITTED successfully!');
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('Database transaction FAILED and rolled back:', err);
    throw err;
  } finally {
    db.exec('PRAGMA foreign_keys = ON;');
    db.close();
  }

  console.log('\n>>> 5. VERIFYING SAMPLE DATA FROM SQLITE...');
  const verifyDb = new DatabaseSync('data/gcck_mes.sqlite');
  const sampleMach = verifyDb.prepare('SELECT id, name, cost_per_hour FROM machines LIMIT 4').all();
  console.log('Sample Machines:', sampleMach);

  const sampleWorkers = verifyDb.prepare("SELECT id, name, base_salary, cost_per_sec FROM workers WHERE id IN ('NV00053', 'NV00266', 'NV00214')").all();
  console.log('Sample Workers:', sampleWorkers);

  const sampleOps = verifyDb.prepare("SELECT nc_id, op_name, std_seconds, default_machine, std_labor_cost, std_mach_cost, std_tool_cost FROM operations WHERE nc_id IN ('NC001', 'NC002', 'NC003')").all();
  console.log('Sample Operations:', sampleOps);

  const sampleProds = verifyDb.prepare("SELECT sp_id, customer, product_name, quoted_price FROM products WHERE sp_id IN ('SP001', 'SP002')").all();
  console.log('Sample Products:', sampleProds);

  verifyDb.close();
  console.log('\n>>> ALL TASKS FINISHED SUCCESSFULLY! <<<');
}

syncAll().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
