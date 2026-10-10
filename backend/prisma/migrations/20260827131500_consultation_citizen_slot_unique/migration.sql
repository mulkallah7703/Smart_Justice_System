-- A citizen cannot hold two active consultations starting at the same instant.
-- Enforced in the database because the application check cannot be serialized
-- across lawyers by the per-lawyer row lock used during booking.
CREATE UNIQUE INDEX "consultation_active_user_slot_key"
  ON "Consultation" ("userId", "scheduledAt")
  WHERE "deletedAt" IS NULL AND "status" <> 'CANCELLED';
