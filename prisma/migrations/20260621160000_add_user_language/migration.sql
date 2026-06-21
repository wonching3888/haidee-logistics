-- User UI language preference: zh (default) | th
ALTER TABLE "users" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'zh';
