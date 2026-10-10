/**
 * Roster screenshots read on the device (iOS: the system photo picker and Vision text
 * recognition in RosterScanner.swift). Nothing is uploaded. Unsupported builds (Android, web,
 * an older binary without the method) report `false` from rosterScannerSupported().
 */

import { NativeModules, Platform } from 'react-native';
import type { OcrLine } from '../rosterImport/ocrRows';

/** A full fantasy roster fits in a few screens. */
export const MAX_ROSTER_SCREENSHOTS = 4;

interface ScannerModule {
  scanRosterScreenshots(maxImages: number): Promise<string | null>;
}

function scannerModule(): ScannerModule | null {
  if (Platform.OS !== 'ios') return null;
  // Optional chaining: partial react-native mocks in jest leave NativeModules undefined.
  const module = (NativeModules as Record<string, unknown> | undefined)?.PuckIQNative as Partial<ScannerModule> | undefined;
  return module && typeof module.scanRosterScreenshots === 'function' ? (module as ScannerModule) : null;
}

export function rosterScannerSupported(): boolean {
  return scannerModule() !== null;
}

/** Lines of each picked screenshot, or null when cancelled or unsupported. */
export async function scanRosterScreenshots(maxImages: number = MAX_ROSTER_SCREENSHOTS): Promise<OcrLine[][] | null> {
  const module = scannerModule();
  if (!module) return null;
  const json = await module.scanRosterScreenshots(maxImages);
  return json ? parseScan(json) : null;
}

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Keeps well-formed lines only; anything else in the payload is dropped, never thrown. */
export function parseScan(json: string): OcrLine[][] {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return raw.map((image) =>
    (Array.isArray(image) ? image : []).flatMap((line: Partial<OcrLine>) =>
      line && typeof line.text === 'string' && isNumber(line.x) && isNumber(line.y) && isNumber(line.width) && isNumber(line.height)
        ? [{ text: line.text, x: line.x, y: line.y, width: line.width, height: line.height }]
        : [],
    ),
  );
}
