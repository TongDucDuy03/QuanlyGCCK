export const DEFAULT_DRIVE_FOLDER_URL =
  'https://drive.google.com/drive/folders/1JNC5odulouS-MMdHXkMoxyt2rLLXXiiS';

export interface DriveUrlParseResult {
  rawUrl: string;
  isDrive: boolean;
  isFolder: boolean;
  isFile: boolean;
  id: string | null;
  previewUrl: string;
  viewUrl: string;
}

/**
 * Parses any Google Drive URL (file, folder, view, preview, or raw link)
 * and formats it into an embeddable preview or direct view URL.
 */
export function parseGoogleDriveUrl(rawUrl?: string | null): DriveUrlParseResult {
  const url = (rawUrl || '').trim();
  if (!url) {
    return {
      rawUrl: DEFAULT_DRIVE_FOLDER_URL,
      isDrive: true,
      isFolder: true,
      isFile: false,
      id: '1JNC5odulouS-MMdHXkMoxyt2rLLXXiiS',
      previewUrl: DEFAULT_DRIVE_FOLDER_URL,
      viewUrl: DEFAULT_DRIVE_FOLDER_URL,
    };
  }

  // Check if it's a Google Drive link
  const isDrive = url.includes('drive.google.com') || url.includes('docs.google.com');

  if (!isDrive) {
    return {
      rawUrl: url,
      isDrive: false,
      isFolder: false,
      isFile: true,
      id: null,
      previewUrl: url,
      viewUrl: url,
    };
  }

  // Match folder URL: /folders/FOLDER_ID
  const folderMatch = /\/folders\/([a-zA-Z0-9_-]+)/.exec(url);
  if (folderMatch) {
    const id = folderMatch[1];
    return {
      rawUrl: url,
      isDrive: true,
      isFolder: true,
      isFile: false,
      id,
      previewUrl: `https://drive.google.com/drive/folders/${id}`,
      viewUrl: `https://drive.google.com/drive/folders/${id}`,
    };
  }

  // Match file URL: /file/d/FILE_ID or id=FILE_ID
  const fileMatch = /\/file\/d\/([a-zA-Z0-9_-]+)/.exec(url) || /[?&]id=([a-zA-Z0-9_-]+)/.exec(url);
  if (fileMatch) {
    const id = fileMatch[1];
    return {
      rawUrl: url,
      isDrive: true,
      isFolder: false,
      isFile: true,
      id,
      // Google Drive file embed preview URL
      previewUrl: `https://drive.google.com/file/d/${id}/preview`,
      viewUrl: `https://drive.google.com/file/d/${id}/view?usp=sharing`,
    };
  }

  return {
    rawUrl: url,
    isDrive: true,
    isFolder: false,
    isFile: true,
    id: null,
    previewUrl: url,
    viewUrl: url,
  };
}

/**
 * Returns the effective drawing URL: if empty, defaults to the factory's shared Drive folder.
 */
export function getEffectiveDrawingUrl(specificUrl?: string | null): string {
  const clean = (specificUrl || '').trim();
  return clean || DEFAULT_DRIVE_FOLDER_URL;
}
