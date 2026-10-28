import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DRIVE_FOLDER_URL,
  getEffectiveDrawingUrl,
  parseGoogleDriveUrl,
} from '../../src/shared/driveHelper';

describe('driveHelper', () => {
  it('falls back to default factory drive folder when empty', () => {
    const res = parseGoogleDriveUrl('');
    expect(res.rawUrl).toBe(DEFAULT_DRIVE_FOLDER_URL);
    expect(res.isFolder).toBe(true);
    expect(res.id).toBe('1JNC5odulouS-MMdHXkMoxyt2rLLXXiiS');
    expect(getEffectiveDrawingUrl('')).toBe(DEFAULT_DRIVE_FOLDER_URL);
  });

  it('correctly converts Google Drive file view link into embed preview link', () => {
    const viewUrl = 'https://drive.google.com/file/d/1ABCxyz123_testFile/view?usp=sharing';
    const res = parseGoogleDriveUrl(viewUrl);

    expect(res.isDrive).toBe(true);
    expect(res.isFile).toBe(true);
    expect(res.isFolder).toBe(false);
    expect(res.id).toBe('1ABCxyz123_testFile');
    expect(res.previewUrl).toBe('https://drive.google.com/file/d/1ABCxyz123_testFile/preview');
  });

  it('correctly parses Google Drive folder link', () => {
    const folderUrl = 'https://drive.google.com/drive/folders/1JNC5odulouS-MMdHXkMoxyt2rLLXXiiS';
    const res = parseGoogleDriveUrl(folderUrl);

    expect(res.isDrive).toBe(true);
    expect(res.isFolder).toBe(true);
    expect(res.id).toBe('1JNC5odulouS-MMdHXkMoxyt2rLLXXiiS');
  });

  it('handles external direct PDF / image links', () => {
    const directUrl = 'https://example.com/drawings/part101.pdf';
    const res = parseGoogleDriveUrl(directUrl);

    expect(res.isDrive).toBe(false);
    expect(res.previewUrl).toBe(directUrl);
  });
});
