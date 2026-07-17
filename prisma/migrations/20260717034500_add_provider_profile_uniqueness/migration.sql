-- A client may consent to a single provider profile per organization.
CREATE UNIQUE INDEX "ProviderProfile_organizationId_sourceClientId_key"
ON "ProviderProfile"("organizationId", "sourceClientId");
