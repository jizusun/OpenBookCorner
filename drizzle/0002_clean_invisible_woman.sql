CREATE TABLE `feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`library_id` text NOT NULL,
	`user_id` text NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
