# GCCK Thắng Lợi MES v2.1 — Bright Modern SaaS UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` + `test-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert 100% of the GCCK Lean MES UI from Dark Mode (`#090D16` / `#111827`) into a crisp, high-contrast **Bright Daylight SaaS/ERP Design System** (inspired by Katana Cloud MRP, Odoo 18, Lark Base, KiotViet, and Stripe Light), while decluttering front-and-center Telegram / Cloud Sync / Webhook noise into optional settings sections.

**Architecture:**
- Global Tailwind & CSS token upgrade (`#F4F6FB` canvas, `#FFFFFF` card surface, `#E2E8F0` hairlines, `#0F172A` high-contrast slate ink, `#2563EB` Royal Blue primary accent).
- Automated TDD source-audit suite (`tests/unit/brightThemeAudit.test.ts`) enforcing zero dark-mode leftovers (`bg-slate-950`, `bg-slate-900`, `text-slate-100..300`, `text-sky-200..400`, etc.) and decluttering invariants across every upgraded file in `src/client/**`.
- Full preservation of backend APIs, business logic, security guards, and Playwright E2E selectors (`tests/e2e/mes.spec.ts`).

**Tech Stack:** React 19, TypeScript 5.7, Tailwind CSS 3.4, Lucide Icons, Vitest, Playwright (MS Edge).

**Global Constraints:**
1. Every upgraded file MUST eliminate dark-mode background classes (`bg-slate-950`, `bg-slate-900`, `bg-slate-800`, `from-*-950`, `to-*-950`, `bg-*-950`) and low-contrast light text classes (`text-slate-50..300`, `text-sky-100..400`, `text-emerald-100..400`, `text-amber-100..400`, `text-red-100..400`, `text-purple-200..300`). Only two documented exceptions exist: translucent modal backdrop (`bg-slate-900/40` or `bg-slate-900/50`) and `#qr-reader` camera `<video>` frame in `QrScannerModal.tsx`. Solid vibrant buttons/pills use `text-white`.
2. Colored text on white/pastel surfaces MUST use `-600`, `-700`, or `-800` shades (`text-blue-700`, `text-emerald-700`, `text-amber-800`, `text-rose-700`, `text-violet-700`) for WCAG AA/AAA readability under office & shopfloor lighting.
3. Do NOT delete Telegram / Webhook / Cloud Outbox backend routes, modal components, or state — tuck their UI triggers into collapsed `<details>` accordions as specified.
4. Preserve all Playwright E2E selectors and `data-testid` attributes required by `tests/e2e/mes.spec.ts`.

---

### Task 1: TDD Bright Theme Audit Suite + Core Design System, Primitives, Auth, TopBar & Print Toolbar

**Files:**
- Create: `tests/unit/brightThemeAudit.test.ts`
- Modify: `index.html`
- Modify: `tailwind.config.js`
- Modify: `src/client/index.css`
- Modify: `src/client/App.tsx`
- Modify: `src/client/components/ui/IndustrialPrimitives.tsx`
- Modify: `src/client/components/TopRoleBar.tsx`
- Modify: `src/client/context/AuthContext.tsx`
- Modify: `src/client/features/print/JobTravelerPrint.tsx`

- [ ] **Step 1 (RED):** Write `tests/unit/brightThemeAudit.test.ts` testing `index.html` (no `class="dark"`, bright `theme-color`), `src/client/index.css` (`color-scheme: light`, `--gcck-canvas: #f4f6fb`), `tailwind.config.js` (`canvas: '#F4F6FB'`, `surface: '#FFFFFF'`), and scanning the Task 1 `.tsx` files (`App.tsx`, `IndustrialPrimitives.tsx`, `TopRoleBar.tsx`, `AuthContext.tsx`, `JobTravelerPrint.tsx`) for forbidden dark-mode surface & low-contrast light text tokens + checking `"Outbox"` English jargon is removed from `TopRoleBar.tsx`. Run `npx vitest run tests/unit/brightThemeAudit.test.ts` and confirm RED failure.
- [ ] **Step 2 (GREEN):** Upgrade `index.html`, `tailwind.config.js`, `src/client/index.css`, `src/client/App.tsx`, `IndustrialPrimitives.tsx` (crisp white cards with `shadow-card`, pastel semantic badges, Royal Blue primary buttons, light modals & pagination), `TopRoleBar.tsx` (52px pearl-white top bar, Lark-style segmented role switcher, Vietnamese `"Đang đồng bộ"`), `AuthContext.tsx` (bright POS/banking 56px PIN modal), and `JobTravelerPrint.tsx` (bright `.no-print` toolbar while keeping `.print-sheet` ISO black-on-white).
- [ ] **Step 3:** Run `npx vitest run tests/unit/brightThemeAudit.test.ts`, `npm run typecheck`, and `npm test` — confirm 100% GREEN, then commit.

---

### Task 2: Bright Mobile Shopfloor HMI (`/worker`), Shopfloor Modals & Daylight 55" TV Andon (`/andon`)

**Files:**
- Modify: `tests/unit/brightThemeAudit.test.ts` (expand audited files to include Task 2 files + Worker header declutter check)
- Modify: `src/client/features/worker/WorkerPortal.tsx`
- Modify: `src/client/features/worker/SearchablePickerSheet.tsx`
- Modify: `src/client/features/worker/QrScannerModal.tsx`
- Modify: `src/client/features/worker/FaiInspectionModal.tsx`
- Modify: `src/client/features/worker/TelegramLinkModal.tsx`
- Modify: `src/client/features/andon/AndonTvBoard.tsx`

- [ ] **Step 1 (RED):** Expand `tests/unit/brightThemeAudit.test.ts` to scan all 6 Task 2 `.tsx` files for forbidden dark tokens and assert `Telegram 1-1` is placed inside a `<details>` block in `WorkerPortal.tsx` rather than the sticky `<header>`. Run `npx vitest run tests/unit/brightThemeAudit.test.ts` and confirm RED failure.
- [ ] **Step 2 (GREEN):** Upgrade `WorkerPortal.tsx` (compact pearl-white sticky header `sticky top-0 md:top-[52px]` with pastel emerald/blue salary cards + compact `↻` refresh button; remove 4-button clutter row; show offline banner only when `!isOnline || outboxItems.length > 0`; keep Tool Crib button cleanly inside Operation/Tech section; move `Telegram 1-1` into collapsed `<details>` at bottom of Tab 3; Royal Blue/Indigo QR Hero button; crisp white cards & `OK / Rework / NG` counters; white Bottom Nav), brighten all 4 worker modals (`SearchablePickerSheet`, `QrScannerModal` keeping only `#qr-reader` camera frame dark, `FaiInspectionModal`, `TelegramLinkModal`), and upgrade `AndonTvBoard.tsx` to Daylight Anti-Glare Board (`bg-[#EEF2F6] text-slate-900`, white machine cards with `border-l-4` status accents, zero VND leak).
- [ ] **Step 3:** Run `npx vitest run tests/unit/brightThemeAudit.test.ts`, `npm run typecheck`, and `npm test` — confirm 100% GREEN, then commit.

---

### Task 3: Desktop Admin Command Center Part A (`AdminPortal`, `CockpitAndLoadTab`, `OrdersAndTravelerTab`, `LogsQcTraceTab`)

**Files:**
- Modify: `tests/unit/brightThemeAudit.test.ts` (expand audited files to include Task 3 files + Admin sidebar jargon check)
- Modify: `src/client/features/admin/AdminPortal.tsx`
- Modify: `src/client/features/admin/tabs/CockpitAndLoadTab.tsx`
- Modify: `src/client/features/admin/tabs/OrdersAndTravelerTab.tsx`
- Modify: `src/client/features/admin/tabs/LogsQcTraceTab.tsx`

- [ ] **Step 1 (RED):** Expand `tests/unit/brightThemeAudit.test.ts` to scan all 4 Task 3 `.tsx` files for forbidden dark tokens and assert `AdminPortal.tsx` contains no `"scrypt"` or `"Cloud Sync Outbox"` jargon. Run `npx vitest run tests/unit/brightThemeAudit.test.ts` and confirm RED failure.
- [ ] **Step 2 (GREEN):** Upgrade `AdminPortal.tsx` (white collapsible sidebar, active `bg-blue-50 text-blue-700` with left `bg-blue-600` bar, clean Vietnamese module subtitles, `md:top-[52px]` alignment, bright `Ctrl+K` Command Palette), `CockpitAndLoadTab.tsx` (white KPI cards with pastel icon boxes & `border-l-4`, `bg-slate-100` capacity tracks, soft `bg-rose-50/60` bottleneck highlights, bright Gantt & weighted WIP table), `OrdersAndTravelerTab.tsx` (Lark/Katana light PO table with `bg-slate-50` `thead`, `hover:bg-blue-50/40`, crisp action buttons & PO modals), and `LogsQcTraceTab.tsx` (bright realtime logs, muted `—` for zero rework/NG, bright 3-Tier QC & traceability tree).
- [ ] **Step 3:** Run `npx vitest run tests/unit/brightThemeAudit.test.ts`, `npm run typecheck`, and `npm test` — confirm 100% GREEN, then commit.

---

### Task 4: Desktop Admin Command Center Part B (`CostingPnlTab`, `AttendancePayrollTab`, `MasterAndConfigTab`) & 100% Client Audit Coverage

**Files:**
- Modify: `tests/unit/brightThemeAudit.test.ts` (enforce dynamic recursive scan across 100% of `src/client/**/*.{ts,tsx}` + Master/Settings declutter assertions)
- Modify: `src/client/features/admin/tabs/CostingPnlTab.tsx`
- Modify: `src/client/features/admin/tabs/AttendancePayrollTab.tsx`
- Modify: `src/client/features/admin/tabs/MasterAndConfigTab.tsx`
- Modify: `tests/e2e/mes.spec.ts` (align sub-tab 4 button selector to `/4\. Cấu Hình Hệ Thống/i` and add Bright Theme computed background luminance assertions on `/worker`, `/admin`, and `/andon`)

- [ ] **Step 1 (RED):** Expand `tests/unit/brightThemeAudit.test.ts` to dynamically scan ALL files under `src/client/**/*.{ts,tsx}` (zero un-audited files!) and assert `MasterAndConfigTab.tsx` has no `"SQLite ACID Master Store"` badge and wraps Webhook/Telegram/Cloud Sync inside a default-closed `<details>` element. Run `npx vitest run tests/unit/brightThemeAudit.test.ts` and confirm RED failure.
- [ ] **Step 2 (GREEN):** Upgrade `CostingPnlTab.tsx` (bright MISA/KiotViet P&L summary cards & table, `text-emerald-700` profit, `text-rose-600` loss), `AttendancePayrollTab.tsx` (bright 6 Radar cards, Excel/Lark light 31-day matrix with opaque `bg-white` sticky employee column + subtle right shadow + pastel OT/Shift3/Leave/Late cells + bold `bg-rose-600 text-white` `KP`, bright Sub-Tab 6 3P Payroll sheet), `MasterAndConfigTab.tsx` (bright master data tables, remove `Telegram` column from Workers table into collapsible section in modal, rename Sub-tab 4 to `⚙️ 4. Cấu Hình Hệ Thống`, keep Payroll/Shift/Strict-PIN settings front-and-center, tuck GAS Webhook + Telegram Bot + Cloud Outbox into collapsed `<details>` accordion), and update `tests/e2e/mes.spec.ts` with Bright Theme computed luminance checks.
- [ ] **Step 3:** Run `npx vitest run tests/unit/brightThemeAudit.test.ts`, `npm run typecheck`, and `npm test` — confirm 100% GREEN across all unit tests, then commit.

