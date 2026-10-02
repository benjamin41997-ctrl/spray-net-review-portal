CREATE TABLE `counters` (
	`name` text PRIMARY KEY NOT NULL,
	`value` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`type` text NOT NULL,
	`platform` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_events_job_type` ON `events` (`job_id`,`type`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`internal_name` text NOT NULL,
	`title` text NOT NULL,
	`source` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`links` text DEFAULT '{}' NOT NULL,
	`demo` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`object_key` text NOT NULL,
	`label` text NOT NULL,
	`kind` text NOT NULL,
	`position` integer NOT NULL,
	`mime` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_photos_job` ON `photos` (`job_id`);--> statement-breakpoint
CREATE TABLE `qr_codes` (
	`token` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`batch_id` text NOT NULL,
	`job_id` text,
	`assigned_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `qr_codes_label_unique` ON `qr_codes` (`label`);--> statement-breakpoint
CREATE INDEX `idx_qr_job` ON `qr_codes` (`job_id`);--> statement-breakpoint
CREATE INDEX `idx_qr_batch` ON `qr_codes` (`batch_id`);