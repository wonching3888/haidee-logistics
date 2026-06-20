export function normalizePayrollDriverName(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

function buildDriverMatchKeys(driver: {
  name: string;
  fullName: string | null;
  nickname: string | null;
}) {
  const keys = new Set<string>();
  for (const value of [driver.name, driver.fullName, driver.nickname]) {
    const key = normalizePayrollDriverName(value);
    if (key) keys.add(key);
  }
  return keys;
}

export function dispatchMatchesDriver(
  driver: {
    name: string;
    fullName: string | null;
    nickname: string | null;
  },
  order: { driverName: string | null }
) {
  const orderKey = normalizePayrollDriverName(order.driverName);
  if (!orderKey) return false;
  return buildDriverMatchKeys(driver).has(orderKey);
}
