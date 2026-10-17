CREATE TABLE `members` (
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
	`is_placeholder` integer DEFAULT false NOT NULL,
	`user_id` text,
	`source` text,
	`raw` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchase_requests` (
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
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `reviews` (
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
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_borrow_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`book_id` text NOT NULL,
	`user_id` text,
	`member_id` text,
	`library_id` text NOT NULL,
	`borrowed_at` text NOT NULL,
	`due_date` text NOT NULL,
	`returned_at` text,
	`source` text,
	`raw` text,
	FOREIGN KEY (`book_id`) REFERENCES `books`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_borrow_transactions`("id", "book_id", "user_id", "member_id", "library_id", "borrowed_at", "due_date", "returned_at", "source", "raw") SELECT "id", "book_id", "user_id", "member_id", "library_id", "borrowed_at", "due_date", "returned_at", "source", "raw" FROM `borrow_transactions`;--> statement-breakpoint
DROP TABLE `borrow_transactions`;--> statement-breakpoint
ALTER TABLE `__new_borrow_transactions` RENAME TO `borrow_transactions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `books` ADD `copy_code` text;--> statement-breakpoint
ALTER TABLE `books` ADD `category` text;--> statement-breakpoint
ALTER TABLE `books` ADD `shelf_location` text;--> statement-breakpoint
ALTER TABLE `books` ADD `translator` text;--> statement-breakpoint
ALTER TABLE `books` ADD `series` text;--> statement-breakpoint
ALTER TABLE `books` ADD `page_count` integer;--> statement-breakpoint
ALTER TABLE `books` ADD `price` text;--> statement-breakpoint
ALTER TABLE `books` ADD `price_unit` text;--> statement-breakpoint
ALTER TABLE `books` ADD `cn_library_class` text;--> statement-breakpoint
ALTER TABLE `books` ADD `entered_at` text;--> statement-breakpoint
ALTER TABLE `books` ADD `source` text;--> statement-breakpoint
ALTER TABLE `books` ADD `raw` text;