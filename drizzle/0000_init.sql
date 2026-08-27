CREATE TABLE `badges` (
	`code` text PRIMARY KEY NOT NULL,
	`earned_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `visits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`place_id` text NOT NULL,
	`first_visited_year` integer,
	`note` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `visits_kind_place_unq` ON `visits` (`kind`,`place_id`);--> statement-breakpoint
CREATE INDEX `visits_kind_idx` ON `visits` (`kind`);--> statement-breakpoint
CREATE TABLE `wishlist` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`place_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wishlist_kind_place_unq` ON `wishlist` (`kind`,`place_id`);