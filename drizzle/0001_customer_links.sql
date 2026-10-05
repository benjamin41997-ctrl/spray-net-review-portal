CREATE TABLE IF NOT EXISTS `customer_links` (
	`job_id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `customer_links_token_unique` ON `customer_links` (`token`);
