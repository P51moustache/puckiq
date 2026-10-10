/**
 * Screenshot text (lines with positions, as the phone reads them) grouped back into the rows a
 * person sees, so a name and its "Edm - C" or "NJ C" on the same row are read together.
 */

export interface OcrLine {
  text: string;
  /** Normalised 0..1, origin top-left. */
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Two lines share a row when their vertical centres are within half a line height. */
const SAME_ROW_TOLERANCE = 0.5;

/** Rows top to bottom, each read left to right; images follow one another. */
export function rowsFromOcr(images: OcrLine[][]): string[] {
  return images.flatMap(rowsOfImage);
}

function rowsOfImage(lines: OcrLine[]): string[] {
  const sorted = lines
    .filter((line) => line.text.trim().length > 0)
    .sort((a, b) => a.y + a.height / 2 - (b.y + b.height / 2));
  const rows: { center: number; height: number; lines: OcrLine[] }[] = [];
  for (const line of sorted) {
    const center = line.y + line.height / 2;
    const row = rows[rows.length - 1];
    if (row && Math.abs(center - row.center) <= SAME_ROW_TOLERANCE * Math.min(line.height, row.height)) {
      row.lines.push(line);
    } else {
      rows.push({ center, height: line.height, lines: [line] });
    }
  }
  return rows.map((row) => row.lines.sort((a, b) => a.x - b.x).map((line) => line.text.trim()).join('  '));
}
