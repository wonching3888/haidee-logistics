/** Lightweight counters for validation scripts (not production logging). */
let freightContextLoadCount = 0;

export function resetFreightContextLoadCount() {
  freightContextLoadCount = 0;
}

export function incFreightContextLoadCount() {
  freightContextLoadCount += 1;
}

export function getFreightContextLoadCount() {
  return freightContextLoadCount;
}
