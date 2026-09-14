CREATE TABLE `invoiceItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceId` int NOT NULL,
	`description` text NOT NULL,
	`numberOfTrucks` int NOT NULL,
	`unitPrice` decimal(14,2) NOT NULL,
	`totalPrice` decimal(14,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invoiceItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceNumber` varchar(80) NOT NULL,
	`invoiceDate` bigint NOT NULL,
	`customerName` varchar(200) NOT NULL,
	`customerTin` varchar(80) NOT NULL,
	`customerVrn` varchar(80) NOT NULL,
	`containerNumber` varchar(200),
	`currency` varchar(12) NOT NULL DEFAULT 'USD',
	`bankDetails` text NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoices_invoiceNumber_unique` UNIQUE(`invoiceNumber`)
);
--> statement-breakpoint
ALTER TABLE `invoiceItems` ADD CONSTRAINT `invoiceItems_invoiceId_invoices_id_fk` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE cascade ON UPDATE no action;