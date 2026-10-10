-- CreateIndex
CREATE INDEX "Consultation_userId_scheduledAt_idx" ON "Consultation"("userId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Consultation_lawyerId_status_scheduledAt_idx" ON "Consultation"("lawyerId", "status", "scheduledAt");

-- Database-level guarantee against double booking. Two concurrent bookings for
-- the same lawyer and start time cannot both commit. Cancelled and soft-deleted
-- consultations are excluded so a released slot can be booked again.
CREATE UNIQUE INDEX "consultation_active_lawyer_slot_key"
  ON "Consultation" ("lawyerId", "scheduledAt")
  WHERE "deletedAt" IS NULL AND "status" <> 'CANCELLED';
