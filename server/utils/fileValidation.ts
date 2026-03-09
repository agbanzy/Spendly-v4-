import * as fs from 'fs';

// Magic byte signatures for allowed file types
const FILE_SIGNATURES: { type: string; mime: string; bytes: number[] }[] = [
  { type: 'jpeg', mime: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF] },
  { type: 'png', mime: 'image/png', bytes: [0x89, 0x50, 0x4E, 0x47] },
  { type: 'pdf', mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
];

export type ValidFileType = 'jpeg' | 'png' | 'pdf';

/**
 * Validates a file's actual type by reading its magic bytes.
 * Prevents MIME type spoofing (e.g., .exe renamed to .png).
 * @returns The detected file type, or null if not a valid/allowed type.
 */
export function validateFileMagicBytes(filePath: string): ValidFileType | null {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(8);
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);

    for (const sig of FILE_SIGNATURES) {
      const match = sig.bytes.every((byte, i) => buffer[i] === byte);
      if (match) return sig.type as ValidFileType;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Validates an uploaded file by checking both MIME type and magic bytes.
 * Call this after multer has saved the file to disk.
 * @returns true if file is valid, false if it should be rejected.
 */
export function validateUploadedFile(filePath: string, claimedMime: string): boolean {
  const allowedMimes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (!allowedMimes.includes(claimedMime)) return false;

  const detectedType = validateFileMagicBytes(filePath);
  if (!detectedType) return false;

  // Verify claimed MIME matches detected type
  const mimeToType: Record<string, ValidFileType> = {
    'image/jpeg': 'jpeg',
    'image/png': 'png',
    'application/pdf': 'pdf',
  };

  return mimeToType[claimedMime] === detectedType;
}
