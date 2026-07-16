-- Match sibling cash-book tables: RLS on, zero policies (Prisma postgres bypasses RLS).
ALTER TABLE "cash_book_receipt_voucher_lines" ENABLE ROW LEVEL SECURITY;
