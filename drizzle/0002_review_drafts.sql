CREATE TABLE `review_drafts` (
	`job_id` text PRIMARY KEY NOT NULL,
	`version` text NOT NULL,
	`content` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
