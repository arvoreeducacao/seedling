CREATE TABLE `candidate_setups` (
	`session_id` text PRIMARY KEY NOT NULL,
	`skills` text DEFAULT '[]' NOT NULL,
	`claude_md` text,
	`mcp_servers` text DEFAULT '[]' NOT NULL,
	`last_install` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer
);
