import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Card } from '../../src/client/components/ui/IndustrialPrimitives';

const ROOT_DIR = path.resolve(__dirname, '../..');

function readRepoFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8');
}

function discoverClientFiles(relDir: string = 'src/client'): string[] {
  const absDir = path.join(ROOT_DIR, relDir);
  const results: string[] = [];

  function walk(currentAbs: string) {
    const entries = fs.readdirSync(currentAbs, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentAbs, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name)) {
        const rel = path.relative(ROOT_DIR, fullPath).split(path.sep).join('/');
        results.push(rel);
      }
    }
  }

  walk(absDir);
  return results.sort();
}

export const AUDITED_CLIENT_FILES: string[] = discoverClientFiles('src/client');

const FORBIDDEN_DARK_SURFACE_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  {
    label: 'dark 950 surface (bg-slate/gray/zinc-950)',
    regex: /\bbg-(?:slate|gray|zinc)-950\b/g,
  },
  {
    label: 'dark 900 opaque surface (only /20../50 modal backdrop allowed)',
    regex: /\bbg-(?:slate|gray|zinc)-900(?!\/[2345]0)\b/g,
  },
  {
    label: 'dark 700/800 surface (bg-slate/gray/zinc-700|800)',
    regex: /\bbg-(?:slate|gray|zinc)-(?:700|800)\b/g,
  },
  {
    label: 'dark hover surface (hover:bg-slate/gray/zinc-700..950)',
    regex: /\bhover:bg-(?:slate|gray|zinc)-(?:700|800|900|950)\b/g,
  },
  {
    label: 'dark border/divide/ring token (slate/gray/zinc-600..950)',
    regex: /\b(?:border|divide|ring)-(?:slate|gray|zinc)-(?:600|700|800|900|950)\b/g,
  },
  {
    label: 'dark gradient stop (from/via/to-*-900|950)',
    regex:
      /\b(?:from|via|to)-(?:slate|gray|zinc|sky|blue|cyan|teal|emerald|green|amber|yellow|orange|red|rose|pink|fuchsia|purple|violet|indigo)-9[05]0\b/g,
  },
  {
    label: 'dark tinted surface (bg-*-900|950)',
    regex:
      /\bbg-(?:sky|blue|cyan|teal|emerald|green|amber|yellow|orange|red|rose|pink|fuchsia|purple|violet|indigo)-9[05]0\b/g,
  },
  {
    label: 'dark black backdrop/overlay (bg-black/40..95)',
    regex: /\bbg-black\/(?:[456789]0|75|95)\b/g,
  },
  {
    label: 'dark hex canvas (bg-[#0...])',
    regex: /\bbg-\[#0[0-9a-fA-F]{5}\]/g,
  },
];

const FORBIDDEN_LIGHT_TEXT_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  {
    label: 'washed-out neutral text on light surface (text-slate/gray/zinc-50..300)',
    regex: /\btext-(?:slate|gray|zinc)-(?:50|100|200|300)\b/g,
  },
  {
    label: 'washed-out semantic text on light surface (text-*-50..400)',
    regex:
      /\btext-(?:sky|blue|cyan|teal|emerald|green|amber|yellow|orange|red|rose|pink|fuchsia|purple|violet|indigo)-(?:50|100|200|300|400)\b/g,
  },
];

function collectPatternMatches(
  source: string,
  patterns: Array<{ label: string; regex: RegExp }>
): string[] {
  const violations: string[] = [];
  const lines = source.split(/\r?\n/);

  for (const { label, regex } of patterns) {
    lines.forEach((line, idx) => {
      const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
      const lineRegex = new RegExp(regex.source, flags);
      const matches = line.match(lineRegex);
      if (matches && matches.length > 0) {
        violations.push(`L${idx + 1} [${label}]: ${matches.join(', ')}`);
      }
    });
  }

  return violations;
}

describe('Bright Daylight Design System — Static Source Audit', () => {
  it('recursively discovers and audits 100% of .ts and .tsx files in src/client/ (>= 18 files)', () => {
    expect(AUDITED_CLIENT_FILES.length).toBeGreaterThanOrEqual(18);
    expect(AUDITED_CLIENT_FILES).toContain('src/client/features/admin/tabs/CostingPnlTab.tsx');
    expect(AUDITED_CLIENT_FILES).toContain('src/client/features/admin/tabs/AttendancePayrollTab.tsx');
    expect(AUDITED_CLIENT_FILES).toContain('src/client/features/admin/tabs/MasterAndConfigTab.tsx');
  });

  it('configures index.html for Bright Daylight mode without dark class or light-on-dark body text', () => {
    const html = readRepoFile('index.html');

    expect(html).not.toContain('class="dark"');
    expect(html).not.toContain('text-slate-50');
    expect(html).toMatch(/<meta\s+name="theme-color"\s+content="#(?:2563EB|FFFFFF)"\s*\/?>/i);
    expect(html).toMatch(/<body[^>]*\btext-slate-900\b/);
  });

  it('configures src/client/index.css with light color-scheme, bright CSS variables, and light scrollbars', () => {
    const css = readRepoFile('src/client/index.css');

    expect(css).toMatch(/color-scheme:\s*light\s*;/i);
    expect(css).toMatch(/--gcck-canvas:\s*#f4f6fb\s*;/i);
    expect(css).toMatch(/--gcck-surface:\s*#ffffff\s*;/i);
    expect(css.toLowerCase()).not.toContain('#090d16');
    expect(css.toLowerCase()).not.toContain('#0b111e');
  });

  it('defines Bright Daylight industrial palette and card/elevated shadows in tailwind.config.js', () => {
    const tw = readRepoFile('tailwind.config.js');

    expect(tw).toMatch(/canvas:\s*['"]#F4F6FB['"]/i);
    expect(tw).toMatch(/surface:\s*['"]#FFFFFF['"]/i);
    expect(tw).toMatch(/elevated:\s*['"]#F8FAFC['"]/i);
    expect(tw).toMatch(/subtle:\s*['"]#F1F5F9['"]/i);
    expect(tw).toMatch(/border:\s*['"]#E2E8F0['"]/i);
    expect(tw).toMatch(/borderStrong:\s*['"]#CBD5E1['"]/i);
    expect(tw).toMatch(/text:\s*['"]#0F172A['"]/i);
    expect(tw).toMatch(/muted:\s*['"]#64748B['"]/i);
    expect(tw).toMatch(/accent:\s*['"]#2563EB['"]/i);
    expect(tw).toMatch(/boxShadow:\s*\{[\s\S]*?\bcard:\s*['"][^'"]+['"]/);
    expect(tw).toMatch(/boxShadow:\s*\{[\s\S]*?\belevated:\s*['"][^'"]+['"]/);
  });

  it('Card primitive avoids Tailwind v3 bg-white / border-slate-200 cascade conflicts when tinted classes are passed', () => {
    const defaultHtml = renderToStaticMarkup(React.createElement(Card, null, 'Default'));
    expect(defaultHtml).toContain('bg-white');
    expect(defaultHtml).toContain('border-slate-200');

    const tintedHtml = renderToStaticMarkup(
      React.createElement(Card, { className: 'bg-amber-50/50 border-amber-200' }, 'Tinted')
    );
    expect(tintedHtml).toContain('bg-amber-50/50');
    expect(tintedHtml).toContain('border-amber-200');
    expect(tintedHtml).not.toContain('bg-white');
    expect(tintedHtml).not.toContain('border-slate-200');

    const leftAccentHtml = renderToStaticMarkup(
      React.createElement(Card, { className: 'border-l-4 border-l-blue-600' }, 'Accent')
    );
    expect(leftAccentHtml).toContain('bg-white');
    expect(leftAccentHtml).toContain('border-slate-200');
    expect(leftAccentHtml).toContain('border-l-4');
    expect(leftAccentHtml).toContain('border-l-blue-600');
  });

  describe.each(AUDITED_CLIENT_FILES)('Client component audit: %s', (relPath) => {
    it('contains zero forbidden dark surface, dark border, or dark hover tokens', () => {
      const source = readRepoFile(relPath);
      const violations = collectPatternMatches(source, FORBIDDEN_DARK_SURFACE_PATTERNS);
      expect(violations, `Dark surface/border leftovers in ${relPath}:\n${violations.join('\n')}`).toEqual([]);
    });

    it('contains zero washed-out light text tokens or orphan hover:text-white on light controls', () => {
      const source = readRepoFile(relPath);
      const violations = collectPatternMatches(source, FORBIDDEN_LIGHT_TEXT_PATTERNS);

      // Ensure hover:text-white is never left on light/secondary/ghost/close buttons without a solid dark/vibrant hover bg
      const lines = source.split(/\r?\n/);
      lines.forEach((line, idx) => {
        if (
          /\bhover:text-white\b/.test(line) &&
          !/\bhover:bg-(?:blue|rose|red|emerald|amber|indigo|violet|sky)-[5678]00\b/.test(line)
        ) {
          violations.push(`L${idx + 1} [orphan hover:text-white on light control]: ${line.trim()}`);
        }
      });

      expect(violations, `Low-contrast text leftovers in ${relPath}:\n${violations.join('\n')}`).toEqual([]);
    });
  });

  it('TopRoleBar uses clean Vietnamese sync copy ("Đang đồng bộ") and never renders English "Outbox" in JSX', () => {
    const topBarSource = readRepoFile('src/client/components/TopRoleBar.tsx');
    const withoutComments = topBarSource
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    expect(withoutComments).not.toMatch(/\bOutbox\b/i);
    expect(topBarSource).toContain('Đang đồng bộ');
  });

  it('WorkerPortal renders compact <header data-testid="worker-sticky-header"> without Telegram, tucks Telegram inside <details>, and removes English "Offline Outbox"', () => {
    const workerSource = readRepoFile('src/client/features/worker/WorkerPortal.tsx');

    // 1. Sticky header exists as <header ... data-testid="worker-sticky-header" ...>...</header>
    const headerMatch = workerSource.match(
      /<header\b[^>]*data-testid="worker-sticky-header"[^>]*>([\s\S]*?)<\/header>/
    );
    expect(headerMatch, 'Expected <header data-testid="worker-sticky-header"> in WorkerPortal.tsx').not.toBeNull();
    const headerContent = headerMatch![1];
    expect(headerContent).not.toMatch(/Telegram/i);

    // 2. Every setTelegramModalOpen(true) trigger is inside a <details ...>...</details> block
    const detailsBlocks = Array.from(
      workerSource.matchAll(/<details\b[\s\S]*?<\/details>/g),
      (m) => m[0]
    );
    expect(detailsBlocks.length).toBeGreaterThan(0);
    expect(detailsBlocks.some((block) => block.includes('setTelegramModalOpen(true)'))).toBe(true);

    const outsideDetails = workerSource.replace(/<details\b[\s\S]*?<\/details>/g, '');
    expect(outsideDetails).not.toContain('setTelegramModalOpen(true)');

    // 3. English "Offline Outbox" is absent from WorkerPortal.tsx
    expect(workerSource).not.toMatch(/Offline\s+Outbox/i);
  });

  it('QrScannerModal restricts bg-black strictly to the dynamic readerDomId camera viewport container', () => {
    const qrSource = readRepoFile('src/client/features/worker/QrScannerModal.tsx');

    expect(qrSource).toMatch(/id=\{readerDomId\}[\s\S]{0,160}\bbg-black\b/);

    // Ensure no other bare bg-black (without opacity slash) exists outside readerDomId element
    const withoutReaderViewport = qrSource.replace(
      /<div\s+id=\{readerDomId\}[\s\S]*?\/>/g,
      ''
    );
    expect(withoutReaderViewport).not.toMatch(/(?<!hover:)\bbg-black(?!\/)\b/);
  });

  it('AndonTvBoard uses anti-glare daylight #EEF2F6 canvas and strictly leaks zero VND/salary strings', () => {
    const andonSource = readRepoFile('src/client/features/andon/AndonTvBoard.tsx');
    const withoutComments = andonSource
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    expect(andonSource).toContain('bg-[#EEF2F6]');
    expect(andonSource).toContain('text-slate-900');
    expect(withoutComments).not.toMatch(/₫|VNĐ|\bVND\b|đ\/s|Lương|Thu nhập/i);
  });

  it('AdminPortal uses Bright SaaS canvas/sidebar aligned to lg:top-[52px] and omits technical jargon (scrypt, Cloud Sync Outbox, 60fps)', () => {
    const adminSource = readRepoFile('src/client/features/admin/AdminPortal.tsx');
    const withoutComments = adminSource
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    expect(withoutComments).not.toMatch(/\bscrypt\b/i);
    expect(withoutComments).not.toMatch(/Cloud\s+Sync\s+Outbox/i);
    expect(withoutComments).not.toMatch(/\b60fps\b/i);
    expect(adminSource).toContain('bg-industrial-canvas');
    expect(adminSource).toContain('text-slate-900');
    expect(adminSource).toContain('lg:top-[52px]');
  });

  it('CostingPnlTab preserves SP095 placeholder and zero-fake-margin WIP badge copy', () => {
    const costingSource = readRepoFile('src/client/features/admin/tabs/CostingPnlTab.tsx');
    expect(costingSource).toContain('SP095');
    expect(costingSource).toContain('Đang WIP: {c.wipQty} (Xong: 0 SP)');
  });

  it('AttendancePayrollTab preserves 6 Radar cards, cell aria-labels, sync button, and uses opaque sticky left columns + z-30 corners on wide sheets', () => {
    const attSource = readRepoFile('src/client/features/admin/tabs/AttendancePayrollTab.tsx');

    for (const radarTitle of [
      '🏆 Chuyên cần cao',
      '⚡ Top Tăng ca',
      '🚨 Có nghỉ KP',
      '⏰ Đi muộn / Về sớm',
      '🏖️ Nghỉ nhiều',
      '🌙 Chuyên Ca 3 Đêm',
    ]) {
      expect(attSource).toContain(radarTitle);
    }

    expect(attSource).toContain('aria-label={`Chấm công ${empId} ngày ${dayIndex + 1}`}');
    expect(attSource).toContain('Lưu Đồng Bộ');
    expect(attSource).toContain('6. Bảng Chốt Lương Tháng KPI 3P');

    // Sticky top-left corner headers on wide sheets (Sub-tab 1, Sub-tab 3, Sub-tab 6) use z-30 bg-slate-50
    const z30Corners = attSource.match(/sticky\s+left-0\s+z-30\b[^\n"]*?\bbg-slate-50\b/g) || [];
    expect(z30Corners.length).toBeGreaterThanOrEqual(3);

    // Sticky left body cells use opaque bg-white group-hover:bg-blue-50 (never /40 translucent)
    const opaqueStickyCells =
      attSource.match(/sticky\s+left-0\s+z-10\b[^\n"]*?\bbg-white\b[^\n"]*?\bgroup-hover:bg-blue-50\b(?!\/)/g) || [];
    expect(opaqueStickyCells.length).toBeGreaterThanOrEqual(3);
    expect(attSource).not.toMatch(/sticky\s+left-0\s+z-10[^\n"]*\/40/);
  });

  it('MasterAndConfigTab removes SQLite ACID Master Store badge, drops Telegram column from Workers table, and tucks Webhook/Telegram/Cloud Outbox into default-closed <details> while keeping Strict PIN & primary save visible', () => {
    const masterSource = readRepoFile('src/client/features/admin/tabs/MasterAndConfigTab.tsx');

    expect(masterSource).not.toContain('SQLite ACID Master Store');
    expect(masterSource).not.toMatch(/4\.\s*Cấu Hình Hệ Thống\s*&\s*Cloud Sync/i);
    expect(masterSource).toContain('4. Cấu Hình Hệ Thống');

    // Main Workers table should not have a Telegram column header
    expect(masterSource).not.toMatch(/<th\b[^>]*>\s*Telegram\s*<\/th>/i);

    const detailsBlocks = Array.from(
      masterSource.matchAll(/<details\b([^>]*)>([\s\S]*?)<\/details>/g)
    );
    expect(detailsBlocks.length).toBeGreaterThanOrEqual(2);

    // Ensure every <details> accordion is closed by default (no open attribute)
    for (const match of detailsBlocks) {
      expect(match[1]).not.toMatch(/\bopen\b/);
    }

    // Worker modal optional Telegram chatId is tucked inside <details>
    expect(detailsBlocks.some((m) => m[2].includes('wChatId'))).toBe(true);

    // System Config Webhook + Telegram Bot + Cloud Outbox queue are tucked inside <details>
    const integrationDetails = detailsBlocks.find(
      (m) =>
        m[2].includes('WEB_APP_URL') &&
        m[2].includes('TELEGRAM_BOT_TOKEN') &&
        m[2].includes('outboxItems')
    );
    expect(
      integrationDetails,
      'Expected WEB_APP_URL, TELEGRAM_BOT_TOKEN, and outboxItems to be tucked inside a default-closed <details> block'
    ).toBeDefined();

    // Outside <details> in JSX: Strict PIN Mode button AND primary Lưu Cấu Hình Hệ Thống submit button remain visible
    const jsxSection = masterSource.slice(masterSource.indexOf('return ('));
    const outsideDetailsJsx = jsxSection.replace(/<details\b[\s\S]*?<\/details>/g, '');
    expect(outsideDetailsJsx).toContain('Bật Strict PIN Mode');
    expect(outsideDetailsJsx).toContain('Lưu Cấu Hình Hệ Thống');
    expect(outsideDetailsJsx).not.toContain('WEB_APP_URL');
    expect(outsideDetailsJsx).not.toContain('TELEGRAM_BOT_TOKEN');
    expect(outsideDetailsJsx).not.toContain('outboxItems');
  });
});
