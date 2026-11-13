-- CreateEnum
CREATE TYPE "IssueType" AS ENUM ('discoloration', 'odor', 'outage', 'broken_infrastructure', 'sanitation_gap', 'other');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('open', 'verified', 'forwarded', 'rejected', 'resolved');

-- CreateEnum
CREATE TYPE "Duration" AS ENUM ('today', 'few_days', 'week_plus');

-- CreateEnum
CREATE TYPE "WaterUsable" AS ENUM ('yes', 'no', 'unsure');

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issue_type" "IssueType" NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "severity" INTEGER NOT NULL,
    "duration" "Duration" NOT NULL,
    "water_usable" "WaterUsable" NOT NULL,
    "contact_email" TEXT NOT NULL DEFAULT '',
    "photo_public_id" TEXT,
    "precise_lat" DOUBLE PRECISION NOT NULL,
    "precise_lng" DOUBLE PRECISION NOT NULL,
    "public_lat" DOUBLE PRECISION NOT NULL,
    "public_lng" DOUBLE PRECISION NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'open',
    "moderator_note" TEXT NOT NULL DEFAULT '',
    "submitter_hash" TEXT NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_history" (
    "id" SERIAL NOT NULL,
    "report_id" UUID NOT NULL,
    "status" "Status" NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moderators" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderators_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reports_submitter_hash_created_at_idx" ON "reports"("submitter_hash", "created_at");

-- CreateIndex
CREATE INDEX "reports_status_created_at_idx" ON "reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "status_history_report_id_idx" ON "status_history"("report_id");

-- CreateIndex
CREATE UNIQUE INDEX "moderators_email_key" ON "moderators"("email");

-- AddForeignKey
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
