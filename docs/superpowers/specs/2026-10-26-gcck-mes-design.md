# GCCK Thắng Lợi — Next-Gen Lean MES Web Application Design Spec

**Date:** 2026-10-26  
**Authors:** `it-ba`, `it-architect`, `it-qa`, `it-critic`, orchestrated by PM (`it-software-team` × `superpowers`)  
**Source Material:** `d:\GCCK\GCCK.docx` + Legacy Google Apps Script Web App (`MES 2027 - GCCK Thắng Lợi`)

## 1. Intent & Vision

Replace GCCK Thắng Lợi's slow, fragile, single-file Google Apps Script web app (~1MB uncached HTML inside nested cross-origin iframes) with an industrial-grade, lightning-fast (<15ms local API), responsive Full-Stack Lean MES tailored for a 14–20 person precision machining workshop. It guarantees **100% feature and data parity** with the existing GAS app while fulfilling all **7 Lean Workshop Pillars** in `GCCK.docx` and fixing **31 security, formula, UX, and dirty-data defects** uncovered during Phase 1 QA Audit.

## 2. Goals, Non-Goals & Anti-Goals

### Goals
1. **100% Legacy Parity + Sanitized Real Data:** Preserve all 16 workers, 23+ machines, 63 cutting tools, 334 products, 627 operations, 189 POs, 16 monthly attendance sheets, live piecework/KPI calculator (`1 + 0.33` dual-machine rule, Shift 3 `1.3x`, Sunday `2.0x`, 15m OT steps, 50% casting-defect support, NG penalty, stop-time wage), Excel `.xlsx` imports/exports, Telegram 1-1 notifications, and optional background sync to the legacy Google Apps Script `/exec` webhook.
2. **5 High-ROI `GCCK.docx` Upgrades:**
   - Print-ready A4/A5 **QR Job Traveler (`/print/traveler/:poId`)** with per-operation QR (`GCCK|<poId>|<ncId>`) + 1-tap QR scanning on `/worker`.
   - **Hybrid Lean Machine Loading Board** (automatic capacity % from open POs across 23+ machines, bottleneck alerts `>80%` / `>100%`, machine reassignment, SMED material grouping badges, `🌙 Lights-out` overnight flag).
   - **55-Inch Shopfloor TV Andon (`/andon`)** with 3 auto-rotating/pinnable zones (23+ Machine 4-color live grid, Urgent/Overdue POs, Worker Standard-Hour Leaderboard without exposing personal VND salaries).
   - **3-Tier QA/QC & 100% Traceability** (`★` Operator Self-check, First Article Inspection `FAI` for PO `qty >= 5`, soft-warning when downstream op exceeds upstream op qty, material lot/supplier traceability).
   - **Complete Job Costing & 3P Monthly Payroll** (adding Raw Blank Cost + Outsource Heat/Plating Cost + Scrap Cost + optional $T_{setup}$ split, plus consolidated 3P Monthly Payroll sheet).
3. **Industrial Precision Multi-Device UX (ISA-101 × Linear Dark):**
   - Zero horizontal overflow at `360px` mobile width; touch targets `>= 48px–52px` for oil-stained hands.
   - Full-width `1920px` desktop workspace with collapsible sidebar (6 deep modules), sticky table headers, search/filter/pagination unlocking 100% of records (zero `.slice()` silent truncation).

### Anti-Goals
- **No heavy ERP bloat:** No tax/accounting ledger, multi-level warehouse requisition approvals, or complex finite APS black-box scheduling.
- **No hard production blocks on night shifts:** Missing FAI or upstream quantity mismatches trigger prominent visual warnings + `PENDING_QC` flags rather than locking operators out of reporting work.
- **No native C++ npm dependencies (`bcrypt`, `better-sqlite3`):** Use Node.js v24 built-in `node:sqlite` (`DatabaseSync`) and `node:crypto` (`scryptSync`) for zero compilation issues on Windows.
- **No blocking login wall during evaluation/demo:** Provide **Zero-Friction UX + Zero-Leakage Server** (`DEMO_QUICK` 1-click Role Switcher bar + 30-day remembered PIN session + `Strict PIN Mode` toggle in System Settings), while strictly stripping colleague salaries, PIN hashes, bot tokens, and customer quoted prices from public/worker/andon APIs.

## 3. Architecture & Data Decisions

- **Stack:** Node.js `v24.15.0` + Express 5/4 + TypeScript (`tsx`) + `node:sqlite` (`DatabaseSync` in WAL mode wrapped with explicit `BEGIN IMMEDIATE / COMMIT / ROLLBACK` helper) + React 19 + Vite + Tailwind CSS + `lucide-react` + `qrcode.react` + `html5-qrcode` + `exceljs` (with CSV/Excel formula injection sanitization).
- **4 Adaptive Routes:** `/worker` (3-tab Mobile Shopfloor HMI), `/admin` (6-module Desktop Command Center), `/andon` (Fullscreen 55" TV Kiosk), `/print/traveler/:poId` (A4/A5 Print View).
- **Resolved Domain Formulas:**
  1. **Unified Meal Allowance & Per-Shift Cap:** Read `MEAL_SHIFT_2_3` (`20,000`), `MEAL_OT_2H` (`15,000`), `MEAL_SUNDAY` (`30,000`) from `system_config` across both Worker and Attendance modules. Cap meal allowance to at most once per `(workerId, workDate, shiftType)` and cap OT bonus to unpaid OT delta with positive work/objective stop.
  2. **Continuous Marginal NG Penalty:** `0–10M` @ `50%`, excess `10M–30M` @ `40%`, excess `>30M` @ `30%` (strictly monotonically increasing; eliminates the 10M/30M cliff bug).
  3. **Smart `1 + 0.33` Multi-Machine Rule:** Sequential jobs on 1 machine in the same shift both earn `1.0`; overlapping `[startTime, endTime]` across 2 different machines enforces `SECOND = 0.33`.
  4. **Salary Mode Separation:** `Hành chính (Tháng)` staff (`NV00053`, etc.) contribute machine/labor cost to Job Costing and earn KPI `% ĐM`, while direct per-turn piecework payout = `0đ` (rewarded via monthly 3P standard-hour surplus). Objective stop reasons (*Chờ phôi/cẩu*, *Hỏng máy/Mất điện*, *Chế thử chưa ĐM*) earn `waitWage` capped at shift capacity; *Thay dao / Setup* does not double-pay `waitWage`.
  5. **Routing `End` Stage & `SP095` Costing Fix:** Normalize each product's operations into `stepOrder = 1..K` with exactly one `isFinalOp = 1` (`stage = 'End'`) at `stepOrder = K`. `finishedQty` counts only `isFinalOp = 1` completions; multi-op actual unit cost substitutes `stdOpUnitCost` for any unlogged upstream step so partial logging never creates fake profit (`SP095` fixed).
