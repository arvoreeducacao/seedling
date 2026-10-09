CREATE TABLE `prep_kits` (
	`id` text PRIMARY KEY NOT NULL,
	`kit` text NOT NULL,
	`updated_by` text,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `prep_progress` (
	`session_id` text PRIMARY KEY NOT NULL,
	`opened_at` integer,
	`last_seen_at` integer,
	`sections_done` text DEFAULT '[]' NOT NULL,
	`practice_session_id` text,
	`practice_token` text
);
--> statement-breakpoint
ALTER TABLE `sessions` ADD `scheduled_at` integer;--> statement-breakpoint
ALTER TABLE `sessions` ADD `practice_of` text;
