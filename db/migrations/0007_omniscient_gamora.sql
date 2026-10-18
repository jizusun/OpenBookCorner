ALTER TABLE `libraries` ADD `slug` text;--> statement-breakpoint
ALTER TABLE `libraries` ADD `logo_url` text;--> statement-breakpoint
ALTER TABLE `libraries` ADD `brand_color` text;--> statement-breakpoint
ALTER TABLE `libraries` ADD `login_welcome` text;--> statement-breakpoint
CREATE UNIQUE INDEX `libraries_slug_unique` ON `libraries` (`slug`);