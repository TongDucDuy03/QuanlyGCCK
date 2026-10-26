# GCCK Thắng Lợi Next-Gen Lean MES Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, production-ready, responsive Full-Stack Lean MES web application for GCCK Thắng Lợi with 100% parity to their Google Apps Script system plus all 7 pillars from `GCCK.docx`.

**Architecture:** Unified TypeScript monorepo running on Node.js v24 with built-in `node:sqlite` (`DatabaseSync` WAL + `BEGIN IMMEDIATE` transaction wrapper), Express REST API with RBAC & DTO sanitization, shared pure-TS calculation engines (`payroll`, `costing`, `attendance`, `loadBalancing`, `vnSearch`), and a React 19 + Vite + Tailwind CSS adaptive frontend serving 4 specialized shells (`/worker`, `/admin`, `/andon`, `/print/traveler/:poId`).

**Tech Stack:** Node.js v24 (`node:sqlite`, `node:crypto`), Express, TypeScript, React 19, Vite, Tailwind CSS, `lucide-react`, `qrcode.react`, `html5-qrcode`, `exceljs`, Vitest, Supertest, Playwright.

**Spec:** `d:\GCCK\docs\superpowers\specs\2026-10-26-gcck-mes-design.md`

## Global Constraints

- Zero native C++ npm packages (`better-sqlite3`, `bcrypt`, `argon2` are forbidden); use `node:sqlite` and `node:crypto` (`scryptSync`, `timingSafeEqual`).
- Do NOT use `xlsx` npm package (CVE Prototype Pollution/ReDoS); use `exceljs` for both `.xlsx` export and `.xlsx` import, prefixing `'` on strings starting with `=` or `@`, while storing attendance codes like `+2` or `-1.5` explicitly as string values.
- Timezone for default `workDate` and Sunday detection (`isSunday`) MUST use `Asia/Ho_Chi_Minh` (`UTC+7`), never raw UTC `toISOString().slice(0, 10)`.
- Public/Worker/Andon API responses MUST strip `pinHash`, `baseSalary`, `costPerSec` of other workers, `TELEGRAM_BOT_TOKEN`, and `quotedPrice`/`unitProfit` of products; all wage and cost calculations on `POST /api/v1/reports` run server-side from database rates.
- Mobile `/worker` viewport (`360x800`) MUST have zero horizontal overflow (`scrollWidth <= clientWidth`) and primary interactive controls `>= 48px` height; Desktop `/admin` (`1920x1080`) MUST use full viewport width with search & pagination (never `.slice()` data truncation).

## Review Focus

- Multi-submission same shift (`(workerId, workDate, shiftType)`): submitting 3 operations in Shift 2 pays `MEAL_SHIFT_2_3` (`20,000đ`) on the 1st report and `0đ` on reports 2 and 3; `okQty = 0` with `stopMinutes = 0` and `overtimeMinutes = 240` pays `0đ` OT bonus and `0đ` meal.
- Mechanical special characters in product/operation names (`16335 Body-8'', JP`, `Ống 8" JIS`, `Mẫu Thử CR & hàng #`, `Φ16x150mm`) and Vietnamese NFD strings (`Căn Xe goong hồi bi NLLT`): search, selection, rendering, QR generation, and Excel export must never break or execute HTML/XSS.
- Multi-operation product costing (`SP095` *Búa đập VHC-111*): logging 8 pcs on step 1 (`NC158`) with 0 pcs on final step 2 (`NC159`) yields `finishedQty = 0` (WIP = 8), never 6.5x fake profit.
- Concurrent vs sequential dual-machine (`1 + 0.33`): 1 worker logging Machine M01 `06:00–10:00` then Machine M02 `10:00–14:00` gets `1.0` on both; logging M01 `06:00–14:00` and M02 `08:00–12:00` enforces `0.33` on the overlapping secondary run.
- Unreliable workshop Wi-Fi & double-tap submit: duplicate `recordUid` (`idempotencyKey`) returns the existing saved log without double-counting PO `finishedQty` or worker wage; network failure unlocks submit button in `finally` and queues report in `localStorage` Outbox.

---

### Task 1: Project Scaffolding & Shared Pure-TS Domain Engines (TDD)

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `postcss.config.js`, `tailwind.config.js`, `.gitignore`
- Create: `src/shared/types.ts`
- Create: `src/shared/vnSearch.ts`
- Create: `src/shared/payrollEngine.ts`
- Create: `src/shared/costingEngine.ts`
- Create: `src/shared/attendanceParser.ts`
- Create: `src/shared/loadBalancing.ts`
- Test: `tests/unit/vnSearch.test.ts`, `tests/unit/payrollEngine.test.ts`, `tests/unit/costingEngine.test.ts`, `tests/unit/attendanceParser.test.ts`, `tests/unit/loadBalancing.test.ts`

**Interfaces:**
- Produces:
  - `normalizeVn(str: string): string` & `removeVietnameseTones(str: string): string` & `matchesSearch(haystack: string, query: string): boolean`
  - `calculateTurnPayroll(input: PayrollCalcInput, shiftContext: ShiftPriorContext, config: SystemPayrollConfig): PayrollCalcResult`
  - `calculateMarginalScrapPenalty(damageValue: number): number`
  - `hasTimeOverlap(startA: string, endA: string, startB: string, endB: string): boolean`
  - `getVietnamDateString(now?: Date): string` & `isVietnamSunday(dateStr: string): boolean`
  - `computeProductCosting(product: ProductMeta, ops: OperationMeta[], logs: OpLogSummary[]): ProductCostingSummary`
  - `parseAttendanceCell(raw: string, defaultShift: string, mealCfg: MealConfig): ParsedAttDay` & `computeEmployeeMonthlyStats(emp: AttendanceRow, year: number, month: number, mealCfg: MealConfig): EmployeeAttSummary`
  - `computeMachineLoads(machines: MachineInfo[], openOrders: PurchaseOrderInfo[], ops: OperationMeta[], schedules: ScheduleBlock[]): MachineLoadSummary[]`

- [ ] **Step 1: Initialize project & install dependencies (`react`, `react-dom`, `express`, `lucide-react`, `qrcode.react`, `html5-qrcode`, `exceljs`, `tailwindcss`, `vite`, `@vitejs/plugin-react`, `tsx`, `vitest`, `supertest`, `@playwright/test`)**
- [ ] **Step 2: Write failing Vitest unit tests in `tests/unit/*.test.ts` covering all Review Focus cases (`SP095` costing, `1+0.33` overlap vs sequential, per-shift meal/OT cap, `0`-qty OT exploit, marginal NG penalty at `10,000,000` vs `10,000,001`, `Hành chính` salary mode, NFD `hồi bi` search, Feb 28/29 days & all GCCK attendance codes `X`, `x/2`, `6.25`, `C2+2`, `C2/2-0.75`, `K+2TK`, `C3+2D`, `X/2+O/2`, `P`, `KP`, bottleneck load `>85%` & `>100%`)**
- [ ] **Step 3: Run `npx vitest run tests/unit` and verify RED failure**
- [ ] **Step 4: Implement `src/shared/types.ts` and the 5 shared engines to satisfy all domain contracts cleanly**
- [ ] **Step 5: Run `npx vitest run tests/unit` and verify 100% GREEN**

---

### Task 2: SQLite WAL Database, Sanitized Real Data Seeder & Express RBAC API (TDD)

**Files:**
- Create: `src/server/db/schema.sql`
- Create: `src/server/db/connection.ts`
- Create: `src/server/db/seed.ts`
- Create: `src/server/auth/security.ts`
- Create: `src/server/adapters/syncAdapters.ts`
- Create: `src/server/app.ts`, `src/server/index.ts`
- Create: `src/server/routes/authRoutes.ts`, `src/server/routes/workerRoutes.ts`, `src/server/routes/adminRoutes.ts`, `src/server/routes/andonRoutes.ts`
- Test: `tests/api/seedAndApi.test.ts`

**Interfaces:**
- Consumes: All engines and types from `src/shared/*`, seed file `d:\GCCK\data\seed_gcck_1233.json`
- Produces:
  - `createApp(dbPath?: string): Express`
  - Endpoints under `/api/v1`:
    - `GET /auth/session`, `POST /auth/login` (PIN check via `scryptSync`), `POST /auth/quick-switch` (enabled when `AUTH_MODE === 'DEMO_QUICK'`), `POST /auth/logout`
    - `GET /bootstrap` (role-filtered DTO: hides other workers' salaries, PINs, tokens, and hides `quotedPrice`/`unitProfit` from non-Director/Admin roles)
    - `POST /reports/preview` & `POST /reports` (atomic `withTransaction`: idempotent on `recordUid`, server-calculated wages/costs, updates PO `wipQty`/`finishedQty` only on `isFinalOp=1`, updates tool stock & machine status, auto-marks attendance day, enqueues async GAS/Telegram outbox)
    - `GET /orders`, `POST /orders`, `PATCH /orders/:poId`, `POST /orders/:poId/deliver`, `GET /orders/:poId/traveler`, `GET /orders/:poId/traceability`
    - `GET /schedules`, `POST /schedules`, `PATCH /schedules/:id`, `DELETE /schedules/:id`, `POST /operations/:ncId/assign-machine`
    - `GET /logs`, `PATCH /logs/:id` (Admin edit/void mistaken log & recalculate PO qty), `GET /qc`, `POST /qc` (FAI / IPQC / OQC & NG review)
    - `GET /costing`, `PATCH /costing/:spId` (update `quotedPrice`, `rawMaterialCost`, `outsourceCost` — Admin/Director only, `403` for Worker/QC)
    - `GET /attendance/:yearMonth`, `PUT /attendance/:yearMonth/cell`, `POST /attendance/:yearMonth/batch`, `GET /payroll/:yearMonth` (3P monthly consolidation)
    - `GET /master/operations`, `POST /master/operations`, `PATCH /master/operations/:ncId`, `DELETE /master/operations/:ncId`, `POST /master/operations/import-xlsx`
    - `POST /master/machines`, `PATCH /master/machines/:id`, `POST /master/tools/swap`, `POST /master/workers`
    - `GET /config`, `PUT /config`, `GET /sync/outbox`, `POST /sync/flush`
    - `GET /andon/live` (read-only TV kiosk payload, zero financial secrets)

- [ ] **Step 1: Write failing integration tests in `tests/api/seedAndApi.test.ts` verifying: (a) Seeder loads all 16 workers, >=23 machines (including `Máy tiện FUJI`, `Máy phay OKK1`), 63 tools, 334 products, 627 operations, 189 POs with NFC normalization, unique final `End` op per product (`SP095` `finishedQty === 0`), sanitized PO `remainQty` & customer names; (b) `GET /api/v1/bootstrap` as Worker strips `pinHash`, colleague `baseSalary`, `TELEGRAM_BOT_TOKEN`, and `quotedPrice`, and `GET /api/v1/costing` returns `401/403` for unauthenticated/Worker sessions; (c) `POST /api/v1/reports` enforces server-side rates (ignoring client-tampered `workerCostPerSec`), deduplicates `recordUid`, caps meal allowance per shift, and increments `finishedQty` on final op; (d) `Strict PIN Mode` disables `POST /auth/quick-switch`**
- [ ] **Step 2: Run `npx vitest run tests/api` and verify RED failure**
- [ ] **Step 3: Implement `schema.sql`, `connection.ts` (`withTransaction`), `security.ts` (`scryptSync`), `seed.ts`, `syncAdapters.ts`, and Express routes**
- [ ] **Step 4: Run `npx vitest run` (unit + api) and verify 100% GREEN**

---

### Task 3: Design System Shell, Quick Role Switcher & Client API/Offline Core

**Files:**
- Create: `index.html`, `src/client/main.tsx`, `src/client/index.css`
- Create: `src/client/lib/apiClient.ts`, `src/client/lib/offlineOutbox.ts`, `src/client/lib/imageCompressor.ts`, `src/client/lib/formatters.ts`
- Create: `src/client/context/AuthContext.tsx`, `src/client/components/ui/IndustrialPrimitives.tsx`, `src/client/components/TopRoleBar.tsx`
- Create: `src/client/App.tsx`

**Interfaces:**
- Consumes: `src/shared/types.ts` and `/api/v1/*` endpoints
- Produces:
  - ISA-101 × Linear Industrial Dark CSS theme (`#090D16` canvas, `#111827` surface, `tabular-nums` monospace numbers, `@media print` clean white/black sheet rules)
  - `apiFetch<T>(path, options)` with `AbortController` timeout, structured error handling, and `offlineOutbox` fallback (`localStorage` queue + auto-sync on `online`)
  - `compressImageToDataUrl(file: File, maxWidth?: number, quality?: number): Promise<string>` (`<= 1280px`, JPEG/WebP)
  - `AuthProvider` + `PinLoginModal` (`56px` numeric keypad) + `TopRoleBar` (1-tap switch between `📱 Công Nhân`, `🔍 Tổ Trưởng / QC`, `🛡️ Quản Đốc Admin`, `📺 TV Andon 55"`, `🖨️ In Phiếu QR`, hidden automatically in `@media print` and collapsible in Fullscreen Kiosk)

- [ ] **Step 1: Build Design System CSS, responsive layout shell, `AuthContext`, `offlineOutbox`, `imageCompressor`, and placeholder route containers in `App.tsx`**
- [ ] **Step 2: Verify `npx tsc --noEmit` passes with 0 errors**

---

### Task 4: Shopfloor Mobile HMI (`/worker`), 55" TV Andon (`/andon`) & Print QR Traveler (`/print/traveler/:poId`)

**Files:**
- Create: `src/client/features/worker/WorkerPortal.tsx`
- Create: `src/client/features/worker/QrScannerModal.tsx`
- Create: `src/client/features/worker/SearchablePickerSheet.tsx`
- Create: `src/client/features/andon/AndonTvBoard.tsx`
- Create: `src/client/features/print/JobTravelerPrint.tsx`

**Interfaces:**
- Consumes: `AuthContext`, `apiClient`, `offlineOutbox`, `imageCompressor`, `src/shared/payrollEngine.ts`, `src/shared/vnSearch.ts`
- Produces:
  - `WorkerPortal`: Sticky live salary header + Online/Offline badge; 3 crisp bottom tabs (`⚡ Báo Cáo SX`, `📋 Lệnh SX & FAI`, `💰 Lương & Cá Nhân`); 3-mode QR scanner (Live Camera + Upload QR Photo + Sample QR Quick-Sim); Bottom-sheet searchable picker showing full multi-line drawing names; Shift handover yellow alert banner; `★` Self-check checkbox; `52px` stacked/responsive `OK / Rework / NG` steppers (zero overflow at `360px`); Progressive Disclosure sections for Stop Timer (`Date.now()` persistent in `localStorage`), OT / `🌙 Lights-out`, Tool 1-for-1 swap (`isEdgesDirty` respected!), Photo capture & Handover note; Telegram 1-1 link modal.
  - `AndonTvBoard`: 16:9 high-contrast 3-zone TV Kiosk with live clock, overall spindle run-time %, auto-rotating/pinnable slides (23+ Machine 4-color live cards, Urgent/Overdue POs, Top Worker Standard-Hour Leaderboard with zero salary leak), and bottom alert ticker.
  - `JobTravelerPrint`: A4/A5 toggleable print layout with header PO QR + sequential routing table where every operation row renders its own SVG QR (`GCCK|<poId>|<ncId>`), cutting specs, tool code, `★` self-check column, and QC FAI sign-off box.

- [ ] **Step 1: Implement `QrScannerModal.tsx`, `SearchablePickerSheet.tsx`, `WorkerPortal.tsx`, `AndonTvBoard.tsx`, and `JobTravelerPrint.tsx`**
- [ ] **Step 2: Run `npx tsc --noEmit` and verify 0 errors**

---

### Task 5: Desktop Admin Command Center (`/admin` — 6 Deep Workspaces + Safe Excel Import/Export)

**Files:**
- Create: `src/client/lib/excelService.ts`
- Create: `src/client/features/admin/AdminPortal.tsx`
- Create: `src/client/features/admin/tabs/CockpitAndLoadTab.tsx`
- Create: `src/client/features/admin/tabs/OrdersAndTravelerTab.tsx`
- Create: `src/client/features/admin/tabs/LogsQcTraceTab.tsx`
- Create: `src/client/features/admin/tabs/CostingPnlTab.tsx`
- Create: `src/client/features/admin/tabs/AttendancePayrollTab.tsx`
- Create: `src/client/features/admin/tabs/MasterAndConfigTab.tsx`

**Interfaces:**
- Consumes: `AuthContext`, `apiClient`, `src/shared/*`, `exceljs`
- Produces:
  - Full-width responsive Desktop Command Center (`AdminPortal`) with collapsible left sidebar, global `Ctrl+K` quick search, and role-aware tab visibility (`QC` / `ShiftLeader` cannot view `CostingPnlTab`).
  - All 6 deep workspaces with sticky headers, search/filter/pagination (showing 100% of 189+ POs, 334+ Products, 627+ Operations), modern Modals/Drawers/Toasts (zero `window.prompt` / `window.alert`!), memoized 60fps 31-day Attendance Matrix + 6 glowing Radar cards + 4-mode Batch Fill + Tab 6 Monthly 3P Payroll Consolidation, and full `exceljs` export/import (Costing 19-col `.xlsx`, Attendance 4-Sheet `.xlsx`, Daily Logs 17-col `.xlsx`, Master Ops template & `.xlsx` importer).

- [ ] **Step 1: Implement `excelService.ts` (with formula-injection guard) and all 6 Admin workspace tabs inside `src/client/features/admin/`**
- [ ] **Step 2: Run `npx tsc --noEmit` and `npm run build` to verify full client + server production build passes with 0 errors**

---

### Task 6: End-to-End Verification (`Playwright` Mobile 360px + Desktop 1920px + QA & Critic Gate)

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/mes.spec.ts`

- [ ] **Step 1: Write Playwright E2E suite testing: (1) Mobile `360x800` `/worker` (`scrollWidth <= 360`, button height `>= 48px`, QR quick-scan fills PO/Op, live salary updates, report submission updates today's total); (2) Desktop `1920x1080` `/admin` (all 6 workspaces render, >60 POs accessible via search/pagination, Machine Loading bottleneck bar & Lights-out toggle, Costing `SP095` has 0 fake finishedQty, Attendance cell edit & 3P Payroll tab); (3) `/andon` TV board renders 23+ machines & leaderboard without salary leak; (4) `/print/traveler/PO485-01` renders crisp SVG QR codes**
- [ ] **Step 2: Run `npx vitest run`, `npm run build`, and `npx playwright test` — verify 100% GREEN across all suites**
- [ ] **Step 3: Dispatch independent `it-qa` and `it-critic` final verification; resolve any findings until 0 open defects remain**
