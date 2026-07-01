-- Sub-customer crate channels: billing parent shipper, stock routed per channel

CREATE TABLE "sub_customer_channels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "parentShipperId" UUID NOT NULL,
    "channelKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerShipperId" UUID NOT NULL,
    "allowMultiOrigin" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sub_customer_channels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sub_customer_channels_parentShipperId_channelKey_key"
    ON "sub_customer_channels"("parentShipperId", "channelKey");
CREATE INDEX "sub_customer_channels_parentShipperId_active_sortOrder_idx"
    ON "sub_customer_channels"("parentShipperId", "active", "sortOrder");

ALTER TABLE "sub_customer_channels"
    ADD CONSTRAINT "sub_customer_channels_parentShipperId_fkey"
    FOREIGN KEY ("parentShipperId") REFERENCES "shippers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sub_customer_channels"
    ADD CONSTRAINT "sub_customer_channels_ownerShipperId_fkey"
    FOREIGN KEY ("ownerShipperId") REFERENCES "shippers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inbound_sessions" ADD COLUMN "sub_channel_key" TEXT;
