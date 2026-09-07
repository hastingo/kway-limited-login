CREATE TABLE `expenseAttachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`expenseId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` varchar(800) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `expenseAttachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tripReference` varchar(80) NOT NULL,
	`expenseDate` bigint NOT NULL,
	`expenseType` varchar(120) NOT NULL,
	`description` text NOT NULL,
	`amount` decimal(14,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `incomeAttachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`incomeId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` varchar(800) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `incomeAttachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `incomeRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cargoType` enum('going','return') NOT NULL,
	`tripReference` varchar(80) NOT NULL,
	`truckId` int NOT NULL,
	`dateOfLoading` bigint NOT NULL,
	`customerName` varchar(200) NOT NULL,
	`containerNumber` varchar(100) NOT NULL,
	`destination` varchar(200) NOT NULL,
	`incomeAmount` decimal(14,2) NOT NULL,
	`description` text,
	`status` enum('active','ended') NOT NULL DEFAULT 'active',
	`returnedAt` bigint,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `incomeRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `truckDocuments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`truckId` int NOT NULL,
	`documentType` varchar(120) NOT NULL,
	`expiryDate` bigint NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` varchar(800) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `truckDocuments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trucks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`registrationNumber` varchar(64) NOT NULL,
	`model` varchar(160) NOT NULL,
	`driverName` varchar(160) NOT NULL,
	`driverPhone` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `trucks_id` PRIMARY KEY(`id`),
	CONSTRAINT `trucks_registrationNumber_unique` UNIQUE(`registrationNumber`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
ALTER TABLE `expenseAttachments` ADD CONSTRAINT `expenseAttachments_expenseId_expenses_id_fk` FOREIGN KEY (`expenseId`) REFERENCES `expenses`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `incomeAttachments` ADD CONSTRAINT `incomeAttachments_incomeId_incomeRecords_id_fk` FOREIGN KEY (`incomeId`) REFERENCES `incomeRecords`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `incomeRecords` ADD CONSTRAINT `incomeRecords_truckId_trucks_id_fk` FOREIGN KEY (`truckId`) REFERENCES `trucks`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `truckDocuments` ADD CONSTRAINT `truckDocuments_truckId_trucks_id_fk` FOREIGN KEY (`truckId`) REFERENCES `trucks`(`id`) ON DELETE cascade ON UPDATE no action;