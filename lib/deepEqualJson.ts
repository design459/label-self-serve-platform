// Structural equality for values that round-tripped through Postgres
// jsonb, which doesn't preserve object key insertion order — a plain
// JSON.stringify(a) === JSON.stringify(b) can report a false mismatch
// purely from key reordering. Used to detect whether a design's saved
// render_input/extra_pages_elements/theme still match the order's current
// canvas_layout/extra_pages/theme (see app/api/workspace/[token]/summary
// and submit routes) — comparing recursively avoids that false positive.
export function deepEqualJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqualJson(v, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const aKeys = Object.keys(aObj).sort();
    const bKeys = Object.keys(bObj).sort();
    if (aKeys.length !== bKeys.length) return false;
    for (let i = 0; i < aKeys.length; i++) {
      if (aKeys[i] !== bKeys[i]) return false;
    }
    return aKeys.every((k) => deepEqualJson(aObj[k], bObj[k]));
  }
  return a === b;
}
