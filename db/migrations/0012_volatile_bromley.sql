-- ADR 0009: self-signup + multi-library membership.
-- Hand-written ADDITIVE migration (the drizzle-generated 0012 was discarded: its
-- snapshot baseline (0007) predated the hand-written 0010/0011 + slug backfill,
-- so it re-added already-present columns and rebuilt unrelated tables). This
-- migration only adds the new tables/columns and backfills existing users.

CREATE TABLE `membership` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`library_id` text NOT NULL,
	`role` text DEFAULT 'library_reader' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`join_fields` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `membership_user_library_unique` ON `membership` (`user_id`, `library_id`);--> statement-breakpoint
CREATE TABLE `join_request` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`library_id` text NOT NULL,
	`via` text DEFAULT 'button' NOT NULL,
	`invite_id` text,
	`answers` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`decided_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`decided_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`decided_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invite` (
	`id` text PRIMARY KEY NOT NULL,
	`library_id` text NOT NULL,
	`token` text NOT NULL,
	`role` text DEFAULT 'library_reader' NOT NULL,
	`requires_approval` integer DEFAULT true NOT NULL,
	`max_uses` integer,
	`used_count` integer DEFAULT 0 NOT NULL,
	`expires_at` integer,
	`revoked` integer DEFAULT false NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invite_token_unique` ON `invite` (`token`);--> statement-breakpoint
CREATE TABLE `join_field` (
	`id` text PRIMARY KEY NOT NULL,
	`library_id` text NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`type` text DEFAULT 'text' NOT NULL,
	`required` integer DEFAULT true NOT NULL,
	`verify_email` integer DEFAULT false NOT NULL,
	`options` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `libraries` ADD `visibility` text DEFAULT 'private' NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `active_library_id` text;--> statement-breakpoint
-- Backfill: every existing user with a library becomes an ACTIVE membership of
-- that library (role preserved), and that library becomes their active one.
-- Idempotent (INSERT ... WHERE NOT EXISTS; UPDATE only when null).
INSERT INTO `membership` ("id", "user_id", "library_id", "role", "status", "created_at", "updated_at")
SELECT
  lower(hex(randomblob(16))),
  u.id,
  u.library_id,
  CASE WHEN u.role IN ('library_admin','library_reader') THEN u.role ELSE 'library_reader' END,
  'active',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM `user` u
WHERE u.library_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `membership` m WHERE m.user_id = u.id AND m.library_id = u.library_id
  );--> statement-breakpoint
UPDATE `user` SET `active_library_id` = `library_id`
WHERE `active_library_id` IS NULL AND `library_id` IS NOT NULL;
