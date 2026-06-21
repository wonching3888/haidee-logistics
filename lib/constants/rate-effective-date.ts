/** Default effective date for a shipper/consignee's first freight rate row. */
export const RATE_DEFAULT_EFFECTIVE_FLOOR = "2026-01-01";

const RATE_FLOOR_DATE = new Date(`${RATE_DEFAULT_EFFECTIVE_FLOOR}T00:00:00.000Z`);

/** Rate lookup as-of: max(session business date, canonical floor). */
export function rateAsOfForSessionDate(sessionDate: Date): Date {
  return sessionDate >= RATE_FLOOR_DATE ? sessionDate : RATE_FLOOR_DATE;
}
