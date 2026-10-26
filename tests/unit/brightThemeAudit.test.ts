import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT_DIR = path.resolve(__dirname, '../..');

function readRepoFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8');
}

export const AUDITED_CLIENT_FILES: string[] = [
  'src/client/App.tsx',
  'src/client/components/ui/IndustrialPrimitives.tsx',
  'src/client/components/TopRoleBar.tsx',
  'src/client/context/AuthContext.tsx',
  'src/client/features/print/JobTravelerPrint.tsx',
  'src/client/features/worker/WorkerPortal.tsx',
  'src/client/features/worker/SearchablePickerSheet.tsx',
  'src/client/features/worker/QrScannerModal.tsx',
  'src/client/features/worker/FaiInspectionModal.tsx',
  'src/client/features/worker/TelegramLinkModal.tsx',
  'src/client/features/andon/AndonTvBoard.tsx',
  'src/client/features/admin/AdminPortal.tsx',
  'src/client/features/admin/tabs/CockpitAndLoadTab.tsx',
  'src/client/features/admin/tabs/OrdersAndTravelerTab.tsx',
  'src/client/features/admin/tabs/LogsQcTraceTab.tsx',
];

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
      /\b(?:from|via|to)-(?:slate|gray|zinc|sky|blue|cyan|teal|emerald|green|amber|yellow|orange|red|rose|purple|violet|indigo)-9[05]0\b/g,
  },
  {
    label: 'dark tinted surface (bg-*-900|950)',
    regex:
      /\bbg-(?:sky|blue|cyan|teal|emerald|green|amber|yellow|orange|red|rose|purple|violet|indigo)-9[05]0\b/g,
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
      /\btext-(?:sky|blue|cyan|teal|emerald|green|amber|yellow|orange|red|rose|purple|violet|indigo)-(?:50|100|200|300|400)\b/g,
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
});
