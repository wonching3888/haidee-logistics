-- P0: crate stock agent foundation (camelCase columns)

CREATE TABLE "crate_stock_agent_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agentShipperId" UUID NOT NULL,
    "memberShipperId" UUID NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedById" UUID,

    CONSTRAINT "crate_stock_agent_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "crate_stock_agent_members_memberShipperId_key" ON "crate_stock_agent_members"("memberShipperId");
CREATE INDEX "crate_stock_agent_members_agentShipperId_idx" ON "crate_stock_agent_members"("agentShipperId");

ALTER TABLE "crate_stock_agent_members" ADD CONSTRAINT "crate_stock_agent_members_agentShipperId_fkey" FOREIGN KEY ("agentShipperId") REFERENCES "shippers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crate_stock_agent_members" ADD CONSTRAINT "crate_stock_agent_members_memberShipperId_fkey" FOREIGN KEY ("memberShipperId") REFERENCES "shippers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crate_stock_agent_members" ADD CONSTRAINT "crate_stock_agent_members_joinedById_fkey" FOREIGN KEY ("joinedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "crate_stock_agent_membership_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "action" TEXT NOT NULL,
    "agentShipperId" UUID NOT NULL,
    "memberShipperId" UUID NOT NULL,
    "userId" UUID,
    "stockSnapshot" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crate_stock_agent_membership_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crate_stock_agent_membership_logs_agentShipperId_memberShipperId_idx" ON "crate_stock_agent_membership_logs"("agentShipperId", "memberShipperId");
CREATE INDEX "crate_stock_agent_membership_logs_createdAt_idx" ON "crate_stock_agent_membership_logs"("createdAt");

ALTER TABLE "crate_stock_agent_membership_logs" ADD CONSTRAINT "crate_stock_agent_membership_logs_agentShipperId_fkey" FOREIGN KEY ("agentShipperId") REFERENCES "shippers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crate_stock_agent_membership_logs" ADD CONSTRAINT "crate_stock_agent_membership_logs_memberShipperId_fkey" FOREIGN KEY ("memberShipperId") REFERENCES "shippers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crate_stock_agent_membership_logs" ADD CONSTRAINT "crate_stock_agent_membership_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Mark existing Songkhla / Pattani pool shippers as crate stock agents
UPDATE "shippers"
SET "shipper_kind" = 'crate_stock_agent'
WHERE "code" IN ('LOC-SONGKHLA', 'LOC-PATTANI');
