CREATE TABLE `expenseTypes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `expenseTypes_id` PRIMARY KEY(`id`),
	CONSTRAINT `expenseTypes_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `maintenanceRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`expenseId` int NOT NULL,
	`truckId` int NOT NULL,
	`assetType` enum('truck','trailer') NOT NULL,
	`workshop` varchar(200),
	`odometerKm` int,
	`nextServiceDate` bigint,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `maintenanceRecords_id` PRIMARY KEY(`id`),
	CONSTRAINT `maintenanceRecords_expenseId_unique` UNIQUE(`expenseId`)
);
--> statement-breakpoint
ALTER TABLE `expenses` ADD `truckId` int;--> statement-breakpoint
ALTER TABLE `expenses` ADD `assetType` enum('truck','trailer');--> statement-breakpoint
ALTER TABLE `maintenanceRecords` ADD CONSTRAINT `maintenanceRecords_expenseId_expenses_id_fk` FOREIGN KEY (`expenseId`) REFERENCES `expenses`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maintenanceRecords` ADD CONSTRAINT `maintenanceRecords_truckId_trucks_id_fk` FOREIGN KEY (`truckId`) REFERENCES `trucks`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_truckId_trucks_id_fk` FOREIGN KEY (`truckId`) REFERENCES `trucks`(`id`) ON DELETE set null ON UPDATE no action;