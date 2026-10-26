import { describe, it, expect } from 'vitest';
import { normalizeVn, removeVietnameseTones, matchesSearch } from '../../src/shared/vnSearch';

describe('vnSearch — Vietnamese NFD/NFC & Mechanical Special Character Search', () => {
  it('normalizes NFD strings to NFC and collapses extra spaces', () => {
    // 'hồi' in decomposed NFD form: 'h' + 'o' + '\u0302' + '\u0300' + 'i'
    const nfdRaw = '  Căn  Xe goong hô\u0300i bi   NLLT ';
    const normalized = normalizeVn(nfdRaw);
    expect(normalized).toBe('Căn Xe goong hồi bi NLLT');
    expect(normalized).toBe(normalized.normalize('NFC'));
  });

  it('removes Vietnamese tones including đ/Đ -> d/D', () => {
    expect(removeVietnameseTones('Đặng Ngọc Long — Điều độ')).toBe('Dang Ngoc Long — Dieu do');
    expect(removeVietnameseTones('Căn Xe goong hô\u0300i bi NLLT')).toBe('Can Xe goong hoi bi NLLT');
  });

  it('matches NFD haystack against both unaccented "hoi bi" and NFC accented "hồi bi"', () => {
    const nfdHaystack = 'Căn Xe goong hô\u0300i bi NLLT';
    expect(matchesSearch(nfdHaystack, 'hoi bi')).toBe(true);
    expect(matchesSearch(nfdHaystack, 'hồi bi')).toBe(true);
    expect(matchesSearch(nfdHaystack, 'xe nllt')).toBe(true);
    expect(matchesSearch(nfdHaystack, 'bánh răng')).toBe(false);
  });

  it('preserves and matches mechanical symbols (", \'\', &, #, Φ/φ)', () => {
    expect(matchesSearch("16335 Body-8'', JP", "body-8''")).toBe(true);
    expect(matchesSearch('Ống 8" JIS', '8" jis')).toBe(true);
    expect(matchesSearch('Mẫu Thử CR & hàng #', 'cr & hang #')).toBe(true);
    expect(matchesSearch('Chốt Φ16x150mm', 'φ16x150')).toBe(true);
    expect(matchesSearch('Thân rô to (φ820x700)', 'Φ820')).toBe(true);
  });
});
