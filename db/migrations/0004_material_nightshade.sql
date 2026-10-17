CREATE TABLE `import_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`library_id` text NOT NULL,
	`source` text DEFAULT 'fanshu' NOT NULL,
	`source_url` text,
	`r2_key` text,
	`file_name` text,
	`ran_by_user_id` text,
	`status` text DEFAULT 'success' NOT NULL,
	`counts` text,
	`error` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ran_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
