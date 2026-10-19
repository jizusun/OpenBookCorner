-- Better Auth admin plugin (ADR 0004 Part B): track the real super-admin who
-- started an impersonation session. Null for normal sessions. Forward-only,
-- non-destructive ALTER (no table rebuild) so it applies cleanly over the D1
-- HTTP API — unlike a drizzle-generated full rebuild, which violates FKs.
ALTER TABLE `session` ADD `impersonated_by` text;
