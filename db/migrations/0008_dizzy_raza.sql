PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text NOT NULL,
	`on_behalf_of_user_id` text,
	`library_id` text,
	`action` text NOT NULL,
	`target_type` text,
	`target_id` text,
	`metadata` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_audit_logs`("id", "actor_user_id", "on_behalf_of_user_id", "library_id", "action", "target_type", "target_id", "metadata", "created_at") SELECT "id", "actor_user_id", "on_behalf_of_user_id", "library_id", "action", "target_type", "target_id", "metadata", "created_at" FROM `audit_logs`;--> statement-breakpoint
DROP TABLE `audit_logs`;--> statement-breakpoint
ALTER TABLE `__new_audit_logs` RENAME TO `audit_logs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_books` (
	`id` text PRIMARY KEY NOT NULL,
	`isbn` text NOT NULL,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`publisher` text,
	`published_year` integer,
	`cover_image_url` text,
	`description` text,
	`subjects` text,
	`library_id` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`available_count` integer DEFAULT 1 NOT NULL,
	`is_available` integer DEFAULT true NOT NULL,
	`copy_code` text,
	`category` text,
	`shelf_location` text,
	`translator` text,
	`series` text,
	`page_count` integer,
	`price` text,
	`price_unit` text,
	`cn_library_class` text,
	`entered_at` text,
	`is_shelved` integer,
	`published_date` text,
	`word_count` integer,
	`source` text,
	`raw` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_books`("id", "isbn", "title", "author", "publisher", "published_year", "cover_image_url", "description", "subjects", "library_id", "quantity", "available_count", "is_available", "copy_code", "category", "shelf_location", "translator", "series", "page_count", "price", "price_unit", "cn_library_class", "entered_at", "is_shelved", "published_date", "word_count", "source", "raw", "created_at", "updated_at") SELECT "id", "isbn", "title", "author", "publisher", "published_year", "cover_image_url", "description", "subjects", "library_id", "quantity", "available_count", "is_available", "copy_code", "category", "shelf_location", "translator", "series", "page_count", "price", "price_unit", "cn_library_class", "entered_at", "is_shelved", "published_date", "word_count", "source", "raw", "created_at", "updated_at" FROM `books`;--> statement-breakpoint
DROP TABLE `books`;--> statement-breakpoint
ALTER TABLE `__new_books` RENAME TO `books`;--> statement-breakpoint
CREATE TABLE `__new_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`library_id` text NOT NULL,
	`user_id` text NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_feedback`("id", "library_id", "user_id", "category", "message", "status", "created_at") SELECT "id", "library_id", "user_id", "category", "message", "status", "created_at" FROM `feedback`;--> statement-breakpoint
DROP TABLE `feedback`;--> statement-breakpoint
ALTER TABLE `__new_feedback` RENAME TO `feedback`;--> statement-breakpoint
CREATE TABLE `__new_import_runs` (
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
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ran_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_import_runs`("id", "library_id", "source", "source_url", "r2_key", "file_name", "ran_by_user_id", "status", "counts", "error", "created_at") SELECT "id", "library_id", "source", "source_url", "r2_key", "file_name", "ran_by_user_id", "status", "counts", "error", "created_at" FROM `import_runs`;--> statement-breakpoint
DROP TABLE `import_runs`;--> statement-breakpoint
ALTER TABLE `__new_import_runs` RENAME TO `import_runs`;--> statement-breakpoint
CREATE TABLE `__new_libraries` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email_domains` text NOT NULL,
	`settings` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`slug` text,
	`logo_url` text,
	`brand_color` text,
	`login_welcome` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_libraries`("id", "name", "email_domains", "settings", "is_active", "slug", "logo_url", "brand_color", "login_welcome", "created_at", "updated_at") SELECT "id", "name", "email_domains", "settings", "is_active", "slug", "logo_url", "brand_color", "login_welcome", "created_at", "updated_at" FROM `libraries`;--> statement-breakpoint
DROP TABLE `libraries`;--> statement-breakpoint
ALTER TABLE `__new_libraries` RENAME TO `libraries`;--> statement-breakpoint
CREATE UNIQUE INDEX `libraries_slug_unique` ON `libraries` (`slug`);--> statement-breakpoint
CREATE TABLE `__new_members` (
	`id` text PRIMARY KEY NOT NULL,
	`library_id` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'library_reader' NOT NULL,
	`phone` text,
	`email` text,
	`member_no` text,
	`employee_no` text,
	`student_no` text,
	`class_name` text,
	`department` text,
	`note` text,
	`joined_at` text,
	`membership_plan` text,
	`member_start` text,
	`member_expiry` text,
	`borrowed_count` integer,
	`returned_count` integer,
	`address` text,
	`room_no` text,
	`age` integer,
	`is_placeholder` integer DEFAULT false NOT NULL,
	`user_id` text,
	`source` text,
	`raw` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_members`("id", "library_id", "name", "role", "phone", "email", "member_no", "employee_no", "student_no", "class_name", "department", "note", "joined_at", "membership_plan", "member_start", "member_expiry", "borrowed_count", "returned_count", "address", "room_no", "age", "is_placeholder", "user_id", "source", "raw", "created_at") SELECT "id", "library_id", "name", "role", "phone", "email", "member_no", "employee_no", "student_no", "class_name", "department", "note", "joined_at", "membership_plan", "member_start", "member_expiry", "borrowed_count", "returned_count", "address", "room_no", "age", "is_placeholder", "user_id", "source", "raw", "created_at" FROM `members`;--> statement-breakpoint
DROP TABLE `members`;--> statement-breakpoint
ALTER TABLE `__new_members` RENAME TO `members`;--> statement-breakpoint
CREATE TABLE `__new_purchase_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`library_id` text NOT NULL,
	`isbn` text,
	`title` text NOT NULL,
	`author` text,
	`publisher` text,
	`requester_count` integer DEFAULT 1,
	`requesters` text,
	`source` text,
	`raw` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_purchase_requests`("id", "library_id", "isbn", "title", "author", "publisher", "requester_count", "requesters", "source", "raw", "created_at") SELECT "id", "library_id", "isbn", "title", "author", "publisher", "requester_count", "requesters", "source", "raw", "created_at" FROM `purchase_requests`;--> statement-breakpoint
DROP TABLE `purchase_requests`;--> statement-breakpoint
ALTER TABLE `__new_purchase_requests` RENAME TO `purchase_requests`;--> statement-breakpoint
CREATE TABLE `__new_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`library_id` text NOT NULL,
	`isbn` text,
	`book_title` text,
	`member_name` text,
	`nickname` text,
	`body` text NOT NULL,
	`reviewed_at` text,
	`source` text,
	`raw` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_reviews`("id", "library_id", "isbn", "book_title", "member_name", "nickname", "body", "reviewed_at", "source", "raw", "created_at") SELECT "id", "library_id", "isbn", "book_title", "member_name", "nickname", "body", "reviewed_at", "source", "raw", "created_at" FROM `reviews`;--> statement-breakpoint
DROP TABLE `reviews`;--> statement-breakpoint
ALTER TABLE `__new_reviews` RENAME TO `reviews`;