ALTER TABLE `books` ADD `quantity` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `available_count` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
-- Backfill for databases upgraded via these committed migrations: the ADDs above
-- default available_count=1 for ALL existing rows, which would make an already
-- borrowed single-copy book (is_available=0) borrowable again now that borrowing
-- trusts available_count. Derive the correct count from the pre-existing
-- is_available flag so upgrades preserve availability. (quantity stays 1 for
-- pre-existing rows, which matches the single-copy model before this feature.)
UPDATE `books` SET `available_count` = CASE WHEN `is_available` THEN 1 ELSE 0 END;