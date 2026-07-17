-- Match sibling tables: RLS on, zero policies (Prisma postgres bypasses RLS).
ALTER TABLE "staff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_pcb_ytd_balances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_payroll_months" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_payroll_change_logs" ENABLE ROW LEVEL SECURITY;
