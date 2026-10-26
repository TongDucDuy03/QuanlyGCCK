import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const ARTIFACT_DIR =
  'C:\\Users\\IEC\\.gemini\\antigravity\\brain\\4b1437c6-88bd-4619-a3b7-485089d9dc9b';

function parseVndAmount(raw: string): number {
  const digits = raw.replace(/[^\d-]/g, '');
  return Number(digits || '0');
}

async function assertBrightBodyLuminance(page: Page) {
  const rgb = await page.evaluate(() => {
    const bg = window.getComputedStyle(document.body).backgroundColor;
    const match = bg.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (!match) return null;
    return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), raw: bg };
  });
  expect(rgb, 'Expected parsable rgb() backgroundColor on document.body').not.toBeNull();
  expect(rgb!.r).toBeGreaterThan(225);
  expect(rgb!.g).toBeGreaterThan(230);
  expect(rgb!.b).toBeGreaterThan(235);
}

function attachCleanRuntimeMonitor(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err.message || String(err));
  });

  return {
    assertZeroErrors: () => {
      expect(pageErrors, `Uncaught page errors: ${pageErrors.join(' | ')}`).toEqual([]);
      expect(consoleErrors, `Console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
    },
  };
}

test.beforeAll(() => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
});

test.describe('GCCK Thắng Lợi MES — End-to-End Verification Suite', () => {
  test('Test 1 — Mobile Shopfloor HMI (/worker at 360x800) + QR + Live Piecework + 3 Tabs', async ({
    page,
  }) => {
    const monitor = attachCleanRuntimeMonitor(page);
    await page.setViewportSize({ width: 360, height: 800 });

    await page.goto('/worker');

    const qrHeroBtn = page.getByRole('button', { name: /QUÉT MÃ QR PHIẾU CÔNG NGHỆ/i });
    await expect(qrHeroBtn).toBeVisible();
    await assertBrightBodyLuminance(page);

    // Wait for initial Demo Quick-Switch auth session (NV00214) & bootstrap data
    await expect(page.getByTestId('live-turn-income')).toBeVisible();
    await expect(page.getByTestId('today-accumulated-income')).toBeVisible();

    // 1. Verify zero horizontal overflow at 360x800
    const initialOverflow = await page.evaluate(() => ({
      docScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
    }));
    expect(initialOverflow.docScrollWidth).toBeLessThanOrEqual(360);
    expect(initialOverflow.bodyScrollWidth).toBeLessThanOrEqual(360);

    // 2. Verify primary touch targets >= 48px
    const qrBox = await qrHeroBtn.boundingBox();
    expect(qrBox).not.toBeNull();
    expect(qrBox!.height).toBeGreaterThanOrEqual(48);

    // 3. Open QR Scanner Modal -> tap 1-tap sample QR GCCK|PO485-01|NC098
    await qrHeroBtn.click();
    await expect(
      page.getByText(/Chạm Nhanh Mã QR Mẫu Thực Tế/i)
    ).toBeVisible();

    const samplePresetBtn = page.getByRole('button', {
      name: /GCCK\|PO485-01\|NC098/i,
    });
    await expect(samplePresetBtn).toBeVisible();
    await samplePresetBtn.click();

    // Verify PO & Operation auto-fill + Tech Spec card renders
    await expect(page.getByText('ALKTOP 1342 M').first()).toBeVisible();
    await expect(page.getByText(/NC098/).first()).toBeVisible();
    await expect(page.getByText(/Hướng Dẫn Công Nghệ & Tự Kiểm/i)).toBeVisible();

    // Re-check zero horizontal overflow at 360px with full operation & tech spec expanded
    const expandedOverflow = await page.evaluate(() => ({
      docScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
    }));
    expect(expandedOverflow.docScrollWidth).toBeLessThanOrEqual(360);
    expect(expandedOverflow.bodyScrollWidth).toBeLessThanOrEqual(360);

    // Verify '+' OK stepper & Submit button heights >= 48px
    const plusOkBtn = page.getByRole('button', { name: 'Tăng SL Đạt' });
    await expect(plusOkBtn).toBeVisible();
    const plusBox = await plusOkBtn.boundingBox();
    expect(plusBox).not.toBeNull();
    expect(plusBox!.height).toBeGreaterThanOrEqual(48);

    const submitBtn = page.getByRole('button', { name: /GỬI BÁO CÁO SẢN LƯỢNG/i });
    await expect(submitBtn).toBeVisible();
    const submitBox = await submitBtn.boundingBox();
    expect(submitBox).not.toBeNull();
    expect(submitBox!.height).toBeGreaterThanOrEqual(48);

    // 4. Read initial today's accumulated salary, increment OK qty, verify live turn salary > 0
    const initialAccumulatedText =
      (await page.getByTestId('today-accumulated-income').textContent()) || '0';
    const initialAccumulatedVnd = parseVndAmount(initialAccumulatedText);

    const onePcsLiveVnd = parseVndAmount(
      (await page.getByTestId('live-turn-income').textContent()) || '0'
    );
    expect(onePcsLiveVnd).toBeGreaterThan(0);

    await plusOkBtn.click();
    await plusOkBtn.click();

    await expect
      .poll(async () =>
        parseVndAmount((await page.getByTestId('live-turn-income').textContent()) || '0')
      )
      .toBeGreaterThan(onePcsLiveVnd);

    // Capture required high-res Mobile Worker screenshot at 390x844 showing selected op & live salary
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'preview_worker_mobile.png'),
      fullPage: false,
    });
    await page.setViewportSize({ width: 360, height: 800 });

    // 5. Submit report -> verify success Toast & today's accumulated salary increases
    await submitBtn.scrollIntoViewIfNeeded();
    await submitBtn.click();

    await expect(page.getByText(/Đã ghi nhận sản lượng thành công/i).first()).toBeVisible();
    await expect
      .poll(async () =>
        parseVndAmount((await page.getByTestId('today-accumulated-income').textContent()) || '0')
      )
      .toBeGreaterThan(initialAccumulatedVnd);

    // 6. Switch smoothly across all 3 bottom navigation tabs with zero overflow
    const tabOrdersFai = page.getByRole('button', { name: /Lệnh SX & FAI/i });
    await tabOrdersFai.click();
    await expect(page.getByText(/PO485-01/i).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      360
    );

    const tabPayrollMe = page.getByRole('button', { name: /Lương & Cá Nhân/i });
    await tabPayrollMe.click();
    await expect(page.getByText(/NV00214/i).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      360
    );

    const tabReport = page.getByRole('button', { name: /Báo Cáo SX/i });
    await tabReport.click();
    await expect(qrHeroBtn).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      360
    );

    monitor.assertZeroErrors();
  });

  test('Test 2 — Desktop Admin Command Center (/admin at 1920x1080): All 6 Modules + Ctrl+K', async ({
    page,
  }) => {
    const monitor = attachCleanRuntimeMonitor(page);
    await page.setViewportSize({ width: 1920, height: 1080 });

    await page.goto('/admin');

    // Ensure Admin role (NV00053) is active
    const adminRoleBtn = page.getByRole('button', { name: /Quản Trị Admin/i });
    if (await adminRoleBtn.isVisible()) {
      await adminRoleBtn.click();
    }
    await expect(page.getByText(/6 Phân Hệ Điều Hành/i)).toBeVisible();
    await assertBrightBodyLuminance(page);

    // 1. Module 1: Điều Độ & Tải (cockpit)
    await expect(page.getByText(/Cân Bằng Tải/i).first()).toBeVisible();
    // Verify 23+ machines rendered in load balancing view
    await expect(page.getByText(/23 máy/i).first()).toBeVisible();
    await expect(page.getByText(/QUÁ TẢI/i).first()).toBeVisible();

    // Capture Admin Cockpit screenshot (1920x1080)
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'preview_admin_cockpit.png'),
      fullPage: false,
    });

    // 2. Module 2: Lệnh PO & QR (orders) — verify all 189 POs accessible (not truncated at 60)
    await page.getByRole('button', { name: /Lệnh PO & QR/i }).click();
    await expect(page.getByRole('button', { name: /Tất cả \(189\)/i })).toBeVisible();

    const poSearchInput = page.getByPlaceholder(/Gõ Mã PO/i).first();
    await expect(poSearchInput).toBeVisible();
    await poSearchInput.fill('PO485-01');
    await expect(page.getByText('ALKTOP 1342 M').first()).toBeVisible();
    await poSearchInput.fill('');

    // 3. Module 3: Nhật Ký & QC (logs_qc) — Logs, FAI/QC 3-Tier, Traceability Tree
    await page.getByRole('button', { name: /Nhật Ký & QC/i }).click();
    await expect(page.getByRole('button', { name: /A\. Nhật Ký Sản Lượng Realtime/i })).toBeVisible();
    await expect(page.getByText('PO485-01').first()).toBeVisible();

    await page.getByRole('button', { name: /B\. Kiểm Soát Chất Lượng 3 Tầng/i }).click();
    await expect(page.getByText(/FAI/i).first()).toBeVisible();

    await page.getByRole('button', { name: /C\. Truy Vết Nguồn Gốc 100% Theo Mã PO/i }).click();
    await expect(page.getByText(/PO485-01/i).first()).toBeVisible();

    // 4. Module 4: Báo Giá P&L (costing) — SP095 (Búa đập VHC-111) finishedQty = 0, no 87.7% fake profit
    await page.getByRole('button', { name: /Báo Giá P&L/i }).click();
    const costingSearch = page.getByPlaceholder(/SP095/i).first();
    await expect(costingSearch).toBeVisible();
    await costingSearch.fill('SP095');

    const sp095Row = page.locator('tr', { hasText: 'SP095' }).first();
    await expect(sp095Row).toBeVisible();
    await expect(sp095Row).toContainText(/Búa đập.*VHC-111/i);
    await expect(sp095Row).toContainText('Đang WIP: 8 (Xong: 0 SP)');
    const sp095Text = (await sp095Row.textContent()) || '';
    expect(sp095Text).not.toContain('87.7%');
    expect(sp095Text).not.toContain('87,7%');

    // 5. Module 5: Chấm Công & 3P (attendance) — 6 Radar cards, 31-day matrix edit, Sub-Tab 6 3P Payroll
    await page.getByRole('button', { name: /Chấm Công & 3P/i }).click();
    await expect(page.getByText('🏆 Chuyên cần cao')).toBeVisible();
    await expect(page.getByText('⚡ Top Tăng ca')).toBeVisible();
    await expect(page.getByText('🚨 Có nghỉ KP')).toBeVisible();
    await expect(page.getByText('⏰ Đi muộn / Về sớm')).toBeVisible();
    await expect(page.getByText('🏖️ Nghỉ nhiều')).toBeVisible();
    await expect(page.getByText('🌙 Chuyên Ca 3 Đêm')).toBeVisible();

    // Edit a cell in the 31-day attendance matrix and save
    const attCell = page.getByLabel('Chấm công NV00214 ngày 25');
    await expect(attCell).toBeVisible();
    await attCell.fill('1 2g');
    await page.getByRole('button', { name: /Lưu Đồng Bộ/i }).click();
    await expect(page.getByText(/Đã lưu & đồng bộ bảng công/i).first()).toBeVisible();

    // Switch to Sub-Tab 6: 💎 6. Bảng Chốt Lương Tháng KPI 3P
    await page.getByRole('button', { name: /6\. Bảng Chốt Lương Tháng KPI 3P/i }).click();
    const payrollRows = page.locator('table tbody tr');
    await expect(payrollRows).toHaveCount(16);

    // Capture Attendance Radar + 3P Payroll screenshot (1920x1080)
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'preview_admin_attendance_3p.png'),
      fullPage: false,
    });

    // 6. Module 6: Master & Hệ Thống (master) — 627 NC, 23 Machines, 63 Tools, 16 Workers, Strict PIN Mode
    await page.getByRole('button', { name: /Master & Hệ Thống/i }).click();
    await expect(page.getByText(/627 NC/i).first()).toBeVisible();

    await page.getByRole('button', { name: /2\. Máy Móc/i }).click();
    await expect(page.getByText(/Danh Mục Máy Gia Công.*23 Máy/i)).toBeVisible();
    await expect(page.getByText(/Tủ Dao Cụ CNC.*63 Mã Dao/i)).toBeVisible();

    await page.getByRole('button', { name: /3\. Nhân Sự & Tài Khoản PIN/i }).click();
    await expect(page.getByText(/16 Nhân Sự/i).first()).toBeVisible();

    await page.getByRole('button', { name: /4\. Cấu Hình Hệ Thống/i }).click();
    await expect(page.getByRole('button', { name: /Bật Strict PIN Mode/i })).toBeVisible();

    // Verify zero HTML5 stepMismatch when typing non-round VND value (e.g. 21543)
    const firstNumberInput = page.locator('form input[type="number"]').first();
    await expect(firstNumberInput).toBeVisible();
    const origNumVal = await firstNumberInput.inputValue();
    await firstNumberInput.fill('21543');
    const hasStepMismatch = await firstNumberInput.evaluate(
      (el: HTMLInputElement) => el.validity.stepMismatch
    );
    expect(hasStepMismatch).toBe(false);
    await firstNumberInput.fill(origNumVal);

    // 7. Global Command Search (Ctrl+K)
    await page.keyboard.press('Control+k');
    await expect(
      page.getByText(/Tìm Kiếm & Điều Hướng Tức Thì \(Command Center\)/i)
    ).toBeVisible();
    const cmdInput = page.getByPlaceholder(/VD: PO485, SP095/i);
    await expect(cmdInput).toBeVisible();
    await cmdInput.fill('PO485-01');
    await expect(page.getByText('ALKTOP 1342 M').first()).toBeVisible();
    await page.keyboard.press('Escape');

    monitor.assertZeroErrors();
  });

  test('Test 3 — 55" TV Andon Kiosk (/andon at 1920x1080): 23+ Machines, Urgent POs, Leaderboard & Zero VND Leak', async ({
    page,
  }) => {
    const monitor = attachCleanRuntimeMonitor(page);
    await page.setViewportSize({ width: 1920, height: 1080 });

    await page.goto('/andon');

    await expect(page.getByText(/GCCK THẮNG LỢI — LIVE SHOPFLOOR ANDON/i)).toBeVisible();
    await assertBrightBodyLuminance(page);

    // Verify 23+ machine live cards
    const machineCards = page.locator('[data-testid^="andon-machine-"]');
    const machineCount = await machineCards.count();
    expect(machineCount).toBeGreaterThanOrEqual(23);

    // Verify Urgent POs & Standard-Hour Leaderboard zones
    await expect(page.getByText(/Đơn Hàng PO Khẩn/i)).toBeVisible();
    await expect(page.getByText(/Bảng Vàng Giờ Chuẩn Định Mức/i)).toBeVisible();
    const leaderboardRows = page.locator('[data-testid^="leaderboard-row-"]');
    expect(await leaderboardRows.count()).toBeGreaterThanOrEqual(1);

    // STRICT PRIVACY CHECK: Public TV screen must NOT leak personal VND salary/currency
    const visibleText = await page.evaluate(() => document.body.innerText);
    expect(visibleText).not.toMatch(/₫|VNĐ|\bVND\b|đ\/s|Lương|Thu nhập/i);

    // Capture 55" Shopfloor TV Andon screenshot (1920x1080)
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'preview_tv_andon.png'),
      fullPage: false,
    });

    monitor.assertZeroErrors();
  });

  test('Test 4 — Print QR Job Traveler (/print/traveler/PO485-01 at 1200x900): Crisp SVG QR Codes', async ({
    page,
  }) => {
    const monitor = attachCleanRuntimeMonitor(page);
    await page.setViewportSize({ width: 1200, height: 900 });

    await page.goto('/print/traveler/PO485-01');

    const sheet = page.getByTestId('job-traveler-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('PO485-01');
    await expect(sheet).toContainText('ALKTOP 1342 M');
    await expect(sheet).toContainText('NC098');
    await expect(sheet).toContainText('NC274');

    // Verify crisp <svg> QR codes rendered (1 master header QR + 2 operation QRs = at least 3 QR SVGs with size >= 60px)
    const qrSvgCount = await sheet.locator('svg').evaluateAll((svgs) => {
      return svgs.filter((svg) => {
        const rect = svg.getBoundingClientRect();
        return rect.width >= 60 && rect.height >= 60 && svg.querySelectorAll('path').length > 0;
      }).length;
    });
    expect(qrSvgCount).toBeGreaterThanOrEqual(3);

    // Capture QR Job Traveler Print Sheet screenshot (1200x900)
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, 'preview_qr_traveler.png'),
      fullPage: false,
    });

    monitor.assertZeroErrors();
  });

  test('Test 5 — Security, SPA Fallback (Direct F5) & RBAC API Enforcement', async ({
    request,
    playwright,
  }) => {
    // 1. Direct HTTP GET on SPA routes -> HTTP 200 & zero SERVER_PRELOAD_DB / PIN / Salary leak
    const spaRoutes = ['/', '/worker', '/admin', '/andon', '/print/traveler/PO485-01'];
    for (const route of spaRoutes) {
      const res = await request.get(route, {
        headers: { Accept: 'text/html' },
      });
      expect(res.status(), `Expected HTTP 200 on direct SPA route ${route}`).toBe(200);
      expect(res.headers()['content-type']).toContain('text/html');

      const html = await res.text();
      expect(html).toContain('<div id="root"></div>');
      expect(html).not.toContain('SERVER_PRELOAD_DB');
      expect(html).not.toContain('pinHash');
      expect(html).not.toContain('pin_hash');
      expect(html).not.toContain('baseSalary');
      expect(html).not.toContain('base_salary');
      expect(html).not.toContain('cost_per_sec');
      expect(html).not.toContain('admin123');
    }

    // 2. Unauthenticated requests to Admin-only APIs -> 401 Unauthorized
    const unauthCosting = await request.get('/api/v1/costing');
    expect(unauthCosting.status()).toBe(401);

    const unauthPayroll = await request.get('/api/v1/payroll/3p?month=2026-10');
    expect(unauthPayroll.status()).toBe(401);

    // 3. Authenticate as Worker (NV00214) -> strictly blocked with 403 Forbidden on Admin APIs
    const workerAuthRes = await request.post('/api/v1/auth/quick-switch', {
      data: { workerId: 'NV00214' },
    });
    expect(workerAuthRes.status()).toBe(200);
    const workerSession = (await workerAuthRes.json()) as {
      token: string;
      user: Record<string, unknown>;
    };
    expect(workerSession.token).toBeTruthy();
    expect(workerSession.user.pinHash).toBeUndefined();

    const workerHeaders = { Authorization: `Bearer ${workerSession.token}` };

    const workerCostingRes = await request.get('/api/v1/costing', { headers: workerHeaders });
    expect(workerCostingRes.status()).toBe(403);

    const workerPayrollRes = await request.get('/api/v1/payroll/3p?month=2026-10', {
      headers: workerHeaders,
    });
    expect(workerPayrollRes.status()).toBe(403);

    const workerSysConfigRes = await request.get('/api/v1/config', {
      headers: workerHeaders,
    });
    expect(workerSysConfigRes.status()).toBe(403);

    // 4. Public Andon API payload must strip all salary & PIN fields
    const andonApiRes = await request.get('/api/v1/andon/live');
    expect(andonApiRes.status()).toBe(200);
    const andonRaw = await andonApiRes.text();
    expect(andonRaw).not.toContain('baseSalary');
    expect(andonRaw).not.toContain('costPerSec');
    expect(andonRaw).not.toContain('pinHash');
    expect(andonRaw).not.toContain('pieceWage');

    // 5. Wave 3D Regression: Server-side isSunday anti-spoof (QA-SEC-01) & Log Edit Recalc (QA-BIZ-01)
    const spoofWedRes = await request.post('/api/v1/reports', {
      headers: workerHeaders,
      data: {
        recordUid: `E2E-WED-SPOOF-${Date.now()}`,
        workDate: '2026-10-28', // Wednesday
        isSunday: true,
        poId: 'PO485-01',
        ncId: 'NC098',
        okQty: 3,
      },
    });
    expect(spoofWedRes.status()).toBe(201);
    const spoofWedJson = (await spoofWedRes.json()) as {
      log: { id: number; income: number };
      payroll: { isSunday: boolean; shiftMult: number; turnTotalIncome: number };
    };
    expect(spoofWedJson.payroll.isSunday).toBe(false);
    expect(spoofWedJson.payroll.shiftMult).toBe(1);
    expect(spoofWedJson.payroll.turnTotalIncome).toBe(20002);

    const adminAuthRes = await request.post('/api/v1/auth/quick-switch', {
      data: { workerId: 'NV00053' },
    });
    const adminSession = (await adminAuthRes.json()) as { token: string };
    const adminHeaders = { Authorization: `Bearer ${adminSession.token}` };

    const patchLogRes = await request.patch(`/api/v1/logs/${spoofWedJson.log.id}`, {
      headers: adminHeaders,
      data: { okQty: 1 },
    });
    expect(patchLogRes.status()).toBe(200);
    const patchLogJson = (await patchLogRes.json()) as {
      item: { okQty: number; pieceWage: number; income: number };
    };
    expect(patchLogJson.item.okQty).toBe(1);
    expect(patchLogJson.item.pieceWage).toBe(6667);
    expect(patchLogJson.item.income).toBe(6667);

    // 6. Wave 3D Regression: STRICT_PIN locks unauthenticated /bootstrap (QA-SEC-03) & PIN 429 rate-limit (QA-SEC-02)
    await request.put('/api/v1/config', {
      headers: adminHeaders,
      data: { AUTH_MODE: 'STRICT_PIN' },
    });
    try {
      const freshAnonCtx = await playwright.request.newContext({
        baseURL: 'http://localhost:3101',
      });
      const unauthBootStrict = await freshAnonCtx.get('/api/v1/bootstrap');
      expect(unauthBootStrict.status()).toBe(401);
      await freshAnonCtx.dispose();

      const pinStatuses: number[] = [];
      for (let i = 0; i < 6; i++) {
        const pinRes = await request.post('/api/v1/auth/login', {
          data: { workerId: 'NV00283', pin: `999${i}` },
        });
        pinStatuses.push(pinRes.status());
      }
      expect(pinStatuses).toEqual([401, 401, 401, 401, 401, 429]);
    } finally {
      await request.put('/api/v1/config', {
        headers: adminHeaders,
        data: { AUTH_MODE: 'DEMO_QUICK' },
      });
    }
  });
});
