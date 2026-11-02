/**
 * Extract the author's Python line number, not an internal Pyodide or ManimGX frame.
 * The isolated runtime executes scenes from /home/pyodide/films/<id>/scene.py.
 * Tracebacks may contain several scene frames: the innermost (last) wins.
 * This is display-only information, never an instruction to execute code.
 */
export function sceneLineFromTraceback(detail: string): number | undefined {
  const frames = detail.matchAll(/(?:^|\n)\s*File\s+["'][^"'\r\n]*\/scene\.py["'],\s*line\s+(\d+)/g);
  let line: number | undefined;
  for (const frame of frames) {
    const n = Number(frame[1]);
    if (Number.isSafeInteger(n) && n >= 1 && n <= 1_000_000) line = n;
  }
  return line;
}
