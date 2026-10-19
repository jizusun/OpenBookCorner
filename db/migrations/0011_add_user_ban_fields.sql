-- Better Auth admin plugin reads user.banned / banReason / banExpires on EVERY
-- session validation (even though OpenBookCorner only uses impersonation, not
-- the ban feature). Without these columns, every session/sign-up throws
-- "no such column" → HTTP 500. Separate migration (not folded into 0010) because
-- 0010 is already applied to the shared preview D1. Forward-only ALTERs.
ALTER TABLE `user` ADD `banned` integer;
--> statement-breakpoint
ALTER TABLE `user` ADD `ban_reason` text;
--> statement-breakpoint
ALTER TABLE `user` ADD `ban_expires` integer;
