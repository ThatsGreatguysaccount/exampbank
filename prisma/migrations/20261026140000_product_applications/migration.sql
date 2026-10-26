-- AlterTable
ALTER TABLE `Transaction` MODIFY `kind` ENUM('TRANSFER', 'BILL_PAYMENT', 'CHEQUE_DEPOSIT', 'ETRANSFER', 'WIRE_TRANSFER', 'ADMIN_CREDIT', 'ADMIN_DEBIT', 'INTEREST', 'FEE', 'INVESTMENT') NOT NULL;

-- AlterTable
ALTER TABLE `Product` ADD COLUMN `slug` VARCHAR(191) NULL,
    ADD COLUMN `kind` ENUM('GENERAL', 'TFSA_FUNDS', 'RRSP_GIC', 'RRIF', 'MORTGAGE') NOT NULL DEFAULT 'GENERAL',
    ADD COLUMN `summary` TEXT NULL,
    ADD COLUMN `minAmount` DECIMAL(14, 2) NULL,
    ADD COLUMN `options` JSON NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Product_slug_key` ON `Product`(`slug`);

-- CreateTable
CREATE TABLE `ProductApplication` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reference` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `kind` ENUM('GENERAL', 'TFSA_FUNDS', 'RRSP_GIC', 'RRIF', 'MORTGAGE') NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'DECLINED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `optionLabel` VARCHAR(191) NULL,
    `rate` DECIMAL(5, 2) NULL,
    `termMonths` INTEGER NULL,
    `amount` DECIMAL(14, 2) NULL,
    `approvedAmount` DECIMAL(14, 2) NULL,
    `sourceAccountId` INTEGER NULL,
    `holdTransactionId` INTEGER NULL,
    `openedAccountId` INTEGER NULL,
    `details` JSON NOT NULL,
    `adminNote` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `reviewedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ProductApplication_reference_key`(`reference`),
    INDEX `ProductApplication_userId_idx`(`userId`),
    INDEX `ProductApplication_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ProductApplication` ADD CONSTRAINT `ProductApplication_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductApplication` ADD CONSTRAINT `ProductApplication_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
