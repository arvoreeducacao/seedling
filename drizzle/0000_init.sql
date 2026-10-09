CREATE TABLE `access_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `admin_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `admins` (
	`email` text PRIMARY KEY NOT NULL,
	`name` text,
	`added_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`source` text NOT NULL,
	`model` text NOT NULL,
	`prompt` text,
	`response` text,
	`tool_uses` text DEFAULT '[]' NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cost_usd` real DEFAULT 0 NOT NULL,
	`status` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`challenge_id` text NOT NULL,
	`index` integer NOT NULL,
	`started_at` integer,
	`submitted_at` integer,
	`hidden_passed` integer,
	`hidden_total` integer,
	`hidden_output` text,
	`states_done` text DEFAULT '[]' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`target` text,
	`ip` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `challenge_files` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge_id` text NOT NULL,
	`path` text NOT NULL,
	`role` text NOT NULL,
	`size` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `challenge_files_path` ON `challenge_files` (`challenge_id`,`path`);--> statement-breakpoint
CREATE TABLE `challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`level` text NOT NULL,
	`kind` text DEFAULT 'code' NOT NULL,
	`minutes` integer DEFAULT 30 NOT NULL,
	`runtime` text DEFAULT 'node' NOT NULL,
	`statement` text DEFAULT '' NOT NULL,
	`rubric` text,
	`visible_test_command` text,
	`hidden_test_command` text,
	`preview_command` text,
	`preview_port` integer,
	`traps` text DEFAULT '[]' NOT NULL,
	`flow` text DEFAULT '[]' NOT NULL,
	`states` text DEFAULT '[]' NOT NULL,
	`file_counts` text DEFAULT '{"visible":0,"hidden":0,"reference":0,"team":0}' NOT NULL,
	`checks` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`evaluator` text NOT NULL,
	`scores` text NOT NULL,
	`traps_found` text DEFAULT '[]' NOT NULL,
	`comment` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `evaluations_unique` ON `evaluations` (`session_id`,`evaluator`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`kind` text NOT NULL,
	`actor` text NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT 'cand' NOT NULL,
	`challenge_ids` text NOT NULL,
	`minutes` integer NOT NULL,
	`budget_usd` real DEFAULT 5 NOT NULL,
	`model` text DEFAULT 'claude-sonnet-5-5' NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `passes` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`budget_usd` real NOT NULL,
	`spent_usd` real DEFAULT 0 NOT NULL,
	`revoked_at` integer,
	`revoked_reason` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `passes_token_hash_unique` ON `passes` (`token_hash`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text,
	`candidate_email` text NOT NULL,
	`candidate_name` text,
	`mode` text DEFAULT 'live' NOT NULL,
	`invite_token_hash` text NOT NULL,
	`invite_expires_at` integer NOT NULL,
	`candidate_cookie_hash` text,
	`challenge_ids` text NOT NULL,
	`current_index` integer DEFAULT 0 NOT NULL,
	`minutes` integer NOT NULL,
	`extra_minutes` integer DEFAULT 0 NOT NULL,
	`budget_usd` real NOT NULL,
	`model` text NOT NULL,
	`status` text DEFAULT 'invited' NOT NULL,
	`started_at` integer,
	`paused_at` integer,
	`paused_ms` integer DEFAULT 0 NOT NULL,
	`ended_at` integer,
	`decision` text,
	`decided_by` text,
	`created_by` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
