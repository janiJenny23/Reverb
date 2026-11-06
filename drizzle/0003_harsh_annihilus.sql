CREATE TABLE "outbox_event" (
	"id" serial PRIMARY KEY NOT NULL,
	"eventType" text NOT NULL,
	"aggregateId" integer NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"availableAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lockedAt" timestamp with time zone,
	"lastError" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discover_content" ALTER COLUMN "title" SET DEFAULT 'Discover background';--> statement-breakpoint
ALTER TABLE "discover_content" ALTER COLUMN "status" SET DEFAULT 'PUBLISHED';--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_event_type_aggregate_unique" ON "outbox_event" USING btree ("eventType","aggregateId");--> statement-breakpoint
CREATE INDEX "outbox_status_available_idx" ON "outbox_event" USING btree ("status","availableAt");--> statement-breakpoint
INSERT INTO "outbox_event" ("eventType", "aggregateId")
SELECT 'WORK_DELETION_REQUESTED', "id"
FROM "work"
WHERE "status" = 'DELETION_PENDING'
ON CONFLICT ("eventType", "aggregateId") DO NOTHING;