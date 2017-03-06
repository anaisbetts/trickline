export function captureStack() {
  try { throw new Error(); } catch (e) { return e.stack; }
}