ALTER TABLE `ai_calls` ADD `agent_key` text DEFAULT 'main' NOT NULL;
--> statement-breakpoint
CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`challenge_index` integer NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`closed_at` integer,
	`merged_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agents_session_index_key_unique` ON `agents` (`session_id`,`challenge_index`,`key`);
