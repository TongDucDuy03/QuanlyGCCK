/**
 * Vietnamese NFC Normalization, Diacritics Stripping, and Multi-Token Mechanical Search
 */

export function normalizeVn(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
}

export function removeVietnameseTones(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeMechanicalFold(str: string): string {
  return removeVietnameseTones(str)
    .replace(/[Φφ∅]/g, 'φ')
    .toLowerCase();
}

export function matchesSearch(haystack: string | null | undefined, query: string | null | undefined): boolean {
  const q = normalizeVn(query);
  if (!q) return true;
  if (!haystack) return false;

  const foldedHay = normalizeMechanicalFold(haystack);
  const tokens = normalizeMechanicalFold(q)
    .split(' ')
    .filter(Boolean);

  if (tokens.length === 0) return true;
  return tokens.every((tok) => foldedHay.includes(tok));
}
