CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text NOT NULL,
	`on_behalf_of_user_id` text,
	`library_id` text,
	`action` text NOT NULL,
	`target_type` text,
	`target_id` text,
	`metadata` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
