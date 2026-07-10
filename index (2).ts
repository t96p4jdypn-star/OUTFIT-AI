CREATE TABLE IF NOT EXISTS `app_state` (
  `id` integer PRIMARY KEY NOT NULL,
  `payload` text NOT NULL,
  `updated_at` text NOT NULL
);
