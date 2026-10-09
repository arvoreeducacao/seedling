CREATE TABLE `admin_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`used_by` text,
	`created_by` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_invites_token_hash_unique` ON `admin_invites` (`token_hash`);
