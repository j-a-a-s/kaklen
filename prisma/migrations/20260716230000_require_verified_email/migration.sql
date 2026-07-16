-- Existing users are trusted and backfilled as verified. New registrations remain pending.
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
UPDATE "User" SET "emailVerifiedAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP);

CREATE TYPE "UserStatus_new" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED');
ALTER TABLE "User" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "User"
  ALTER COLUMN "status" TYPE "UserStatus_new"
  USING (
    CASE
      WHEN "status"::text = 'DISABLED' THEN 'INACTIVE'
      ELSE "status"::text
    END
  )::"UserStatus_new";
DROP TYPE "UserStatus";
ALTER TYPE "UserStatus_new" RENAME TO "UserStatus";
ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

CREATE TABLE "EmailVerificationToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key"
  ON "EmailVerificationToken"("tokenHash");
CREATE INDEX "EmailVerificationToken_userId_idx"
  ON "EmailVerificationToken"("userId");
CREATE INDEX "EmailVerificationToken_expiresAt_idx"
  ON "EmailVerificationToken"("expiresAt");
CREATE INDEX "EmailVerificationToken_sentAt_idx"
  ON "EmailVerificationToken"("sentAt");
CREATE INDEX "EmailVerificationToken_usedAt_idx"
  ON "EmailVerificationToken"("usedAt");

ALTER TABLE "EmailVerificationToken"
  ADD CONSTRAINT "EmailVerificationToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
