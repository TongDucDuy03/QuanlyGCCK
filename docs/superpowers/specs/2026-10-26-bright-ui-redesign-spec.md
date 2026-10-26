# GCCK Thắng Lợi MES v2.1 — Bright Daylight Design System & UX Decluttering Spec

## 1. Design Philosophy & Industry Benchmarks
Synthesized from modern light-mode ERP/MES & SaaS benchmarks:
- **Katana Cloud MRP & Odoo 18 Manufacturing:** Pearl-white operational cards (`#FFFFFF`) over a cool mist canvas (`#F4F6FB`), clear status badges, uncluttered production order & machine load views.
- **Lark Suite / Base.vn / KiotViet:** Friendly Vietnamese business UI with pastel semantic badges, crisp `slate-200` hairlines, opaque sticky columns on wide grids, and high-legibility dark slate ink.
- **Stripe Dashboard / Linear Light / Geist Light:** Multi-tier light surface hierarchy, soft ambient card shadows (`0 1px 3px rgba(15,23,42,0.05)`), Royal Blue (`#2563EB`) primary actions, and `tabular-nums` numeric alignment.
- **Toyota Visual Management (Mieruka) Daylight Andon:** Anti-glare positive-polarity 55" TV board (`#EEF2F6` canvas + `#FFFFFF` machine cards + `border-l-4` bold status accents) eliminating fluorescent ceiling mirror glare.

## 2. Global Color & Typography Tokens (Binding Constraints)

### 2.1 Surface & Border Tokens (`tailwind.config.js` & `src/client/index.css`)
- `industrial.canvas` / `--gcck-canvas`: `#F4F6FB` (Cool Mist Gray page background)
- `industrial.surface` / `--gcck-surface`: `#FFFFFF` (Pure Pearl White cards, sidebar, topbar, modals, tables)
- `industrial.elevated` / `--gcck-elevated`: `#F8FAFC` (`slate-50` nested wells, table `thead`, filter toolbars)
- `industrial.subtle`: `#F1F5F9` (`slate-100` segmented control tracks, progress bar tracks, neutral pills)
- `industrial.border` / `--gcck-border`: `#E2E8F0` (`slate-200` subtle card/table dividers)
- `industrial.borderStrong`: `#CBD5E1` (`slate-300` form inputs, selects, secondary buttons)
- `industrial.text` / `--gcck-text`: `#0F172A` (`slate-900` primary dark ink)
- `industrial.muted` / `--gcck-muted`: `#64748B` (`slate-500` secondary captions)
- `industrial.accent` / `--gcck-accent`: `#2563EB` (`blue-600` Royal Blue primary brand action)
- `industrial.run` / `--gcck-run`: `#059669` (`emerald-600`)
- `industrial.warn` / `--gcck-warn`: `#D97706` (`amber-600`)
- `industrial.stop` / `--gcck-stop`: `#E11D48` (`rose-600`)
- `boxShadow.card`: `'0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.03)'`
- `boxShadow.elevated`: `'0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 4px 10px -2px rgba(15, 23, 42, 0.04)'`

### 2.2 Strict WCAG AA/AAA Text Contrast Rules on Light Surfaces
- **Headings, KPI Values, PO Codes:** `text-slate-900` (`#0F172A`, contrast ~17.4:1 on white)
- **Body Copy, Form Values, Table Cells:** `text-slate-800` (`#1E293B`, contrast ~13.5:1) or `text-slate-700` (`#334155`, contrast ~10.3:1)
- **Table Column Headers (`th`), Input Labels:** `text-slate-600` (`#475569`, contrast ~7.5:1)
- **Metadata / Subtitles:** `text-slate-500` (`#64748B`, contrast ~4.8:1)
- **Semantic Colored Text on White/Pastel Surfaces:** MUST use `-600`, `-700`, or `-800` shades ONLY (`text-blue-700`, `text-emerald-700`, `text-amber-700`/`text-amber-800`, `text-rose-700`, `text-violet-700`, `text-indigo-700`).
- **STRICTLY FORBIDDEN Dark-Mode Leftovers in `src/client/**`:**
  - `class="dark"` in `index.html`, `color-scheme: dark` in `index.css`
  - Dark opaque surfaces: `bg-slate-950`, `bg-slate-900` (except translucent modal backdrop `bg-slate-900/40` or `bg-slate-900/50`, and the `#qr-reader` camera `<video>` box in `QrScannerModal.tsx`), `bg-slate-800`, `from-slate-950`, `to-slate-950`, `bg-emerald-950`, `bg-amber-950`, `bg-red-950`, `bg-rose-950`, `bg-sky-950`, `bg-purple-950`, `from-emerald-950`, `from-sky-950`, `from-amber-950`, `from-red-950`
  - Low-contrast light text on light surfaces: `text-slate-50`, `text-slate-100`, `text-slate-200`, `text-slate-300`, `text-sky-100`, `text-sky-200`, `text-sky-300`, `text-sky-400`, `text-emerald-100`, `text-emerald-200`, `text-emerald-300`, `text-emerald-400`, `text-amber-100`, `text-amber-200`, `text-amber-300`, `text-amber-400`, `text-red-100`, `text-red-200`, `text-red-300`, `text-red-400`, `text-purple-200`, `text-purple-300` (solid filled buttons/pills with dark vibrant backgrounds use `text-white`).

### 2.3 Semantic Badges & Controls (`IndustrialPrimitives.tsx`)
- `Badge`:
  - `neutral`: `border-slate-200 bg-slate-100 text-slate-700`
  - `info`: `border-blue-200 bg-blue-50 text-blue-700`
  - `success`: `border-emerald-200 bg-emerald-50 text-emerald-700`
  - `warning`: `border-amber-200 bg-amber-50 text-amber-800`
  - `danger`: `border-rose-200 bg-rose-50 text-rose-700`
  - `purple`: `border-violet-200 bg-violet-50 text-violet-700`
- `Button`:
  - `primary`: `bg-blue-600 text-white hover:bg-blue-700 border-blue-600 shadow-sm`
  - `secondary`: `bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 border-slate-300 shadow-sm`
  - `success`: `bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600 shadow-sm`
  - `warning`: `bg-amber-500 text-slate-950 hover:bg-amber-600 border-amber-500 shadow-sm`
  - `danger`: `bg-rose-600 text-white hover:bg-rose-700 border-rose-600 shadow-sm`
  - `ghost`: `bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 border-transparent`

## 3. UX Decluttering & Layout Refinements (Preserving Backend & E2E Selectors)
1. **`TopRoleBar.tsx`**:
   - Clean pearl-white header (`h-[52px]` on `md+`, `bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm`), `md:sticky md:top-0`.
   - Segmented pill role switcher (`bg-slate-100 p-1 rounded-xl`, active pill `bg-white text-blue-700 shadow-sm ring-1 ring-slate-200`).
   - Replace English jargon `"Outbox"` with Vietnamese `"Đang đồng bộ (X)"` (shown only when `outboxCount > 0`).
2. **`WorkerPortal.tsx` (`/worker`)**:
   - Sticky top bar (`sticky top-0 md:top-[52px] z-30 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm`) with compact 2-column live salary cards (`live-turn-income` in `bg-emerald-50 border-emerald-200 text-emerald-700`, `today-accumulated-income` in `bg-blue-50 border-blue-200 text-blue-700`) and a clean compact `↻` refresh icon button.
   - **Remove the 4-button clutter row** (`Tủ Dao`, `📲 Telegram 1-1`, `🟢 Online`, `Làm mới`) from the sticky header!
   - Show an amber offline/sync banner ONLY when `!isOnline || outboxItems.length > 0`.
   - Keep Tool Crib lookup accessible cleanly inside the Tech Spec / Operation section or Tab 2 without bloating the sticky header.
   - Move `Telegram 1-1` (`TelegramLinkModal` trigger) to the bottom of Tab 3 (`Lương & Cá Nhân`) inside a collapsed `<details>` accordion: *"⚙️ Tùy chọn nâng cao: Nhận phiếu lương qua tin nhắn"*.
   - Keep all Playwright E2E selectors intact (`QUÉT MÃ QR PHIẾU CÔNG NGHỆ`, `live-turn-income`, `today-accumulated-income`, `1. Lệnh Sản Xuất`, `Tăng SL Đạt`, `GỬI BÁO CÁO SẢN LƯỢNG`, `Lệnh SX & FAI`, `Lương & Cá Nhân`, `Báo Cáo SX`).
3. **`AdminPortal.tsx` & 6 Admin Tabs (`/admin`)**:
   - Crisp white collapsible sidebar (`bg-white border-r border-slate-200`), active item `bg-blue-50 text-blue-700 font-bold` with left `bg-blue-600` bar. Keep `6 Phân Hệ Điều Hành` header & short tab names (`Điều Độ & Tải`, `Lệnh PO & QR`, `Nhật Ký & QC`, `Báo Giá P&L`, `Chấm Công & 3P`, `Master & Hệ Thống`), while simplifying subtitles to clean Vietnamese business copy (removing `PIN scrypt & Cloud Sync Outbox`, `60fps`, `SQLite ACID Master Store`).
   - Align sticky header offsets (`md:top-[52px]`).
   - In `AttendancePayrollTab.tsx`: Opaque `bg-white` sticky left columns (`sticky left-0 z-10 bg-white shadow-[2px_0_6px_-2px_rgba(15,23,42,0.08)]`) on the 31-day attendance matrix and 3P payroll table so scrolling horizontally never leaks text underneath; clean Excel/Lark pastel cells for OT (`bg-blue-50 text-blue-700`), Shift 3 (`bg-indigo-50 text-indigo-700`), Leave (`bg-amber-50 text-amber-800`), Late (`bg-orange-50 text-orange-700`), and bold `bg-rose-600 text-white` for `KP`.
   - In `MasterAndConfigTab.tsx`: Remove `Telegram` column from main Workers table (move optional `telegramChatId` into collapsible `<details>` in Worker edit modal). In Sub-tab 4 (`4. Cấu Hình Hệ Thống`), keep Payroll/Meal/Shift/Strict-PIN settings front-and-center (`Bật Strict PIN Mode` visible immediately), and tuck **Google Apps Script Webhook + Telegram Bot + Cloud Sync Outbox** inside a default-closed `<details>` accordion at the bottom: *"🔌 Kết nối mở rộng & Đồng bộ đám mây (Tùy chọn — Cài đặt sau)"*.
4. **`AndonTvBoard.tsx` (`/andon`)**:
   - Bright Daylight Anti-Glare Board (`bg-[#EEF2F6] text-slate-900`), white top header bar, white machine cards (`bg-white border-slate-200 shadow-sm`) with bold `border-l-4` status accents (`emerald-500`, `amber-500`, `rose-600`, `violet-500`, `slate-300`), crisp dark numbers, Urgent POs & Standard-Hour Leaderboard in white cards, and zero VND/salary leak.

