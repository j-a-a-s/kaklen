ALTER TABLE "PasswordResetToken" ADD COLUMN "sentAt" TIMESTAMP(3);

CREATE INDEX "PasswordResetToken_sentAt_idx" ON "PasswordResetToken"("sentAt");
