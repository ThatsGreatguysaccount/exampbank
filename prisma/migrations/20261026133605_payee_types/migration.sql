-- AlterTable
ALTER TABLE `Payee` ADD COLUMN `type` ENUM('BILL', 'ETRANSFER', 'INTERNATIONAL') NOT NULL DEFAULT 'BILL',
    ADD COLUMN `email` VARCHAR(191) NULL,
    ADD COLUMN `phone` VARCHAR(191) NULL,
    ADD COLUMN `swiftBic` VARCHAR(191) NULL,
    ADD COLUMN `bankName` VARCHAR(191) NULL,
    ADD COLUMN `bankCountry` CHAR(2) NULL,
    ADD COLUMN `routingCode` VARCHAR(191) NULL,
    ADD COLUMN `beneficiaryAddress` VARCHAR(191) NULL,
    ADD COLUMN `beneficiaryCity` VARCHAR(191) NULL,
    ADD COLUMN `beneficiaryCountry` CHAR(2) NULL,
    ADD COLUMN `currency` CHAR(3) NULL;

-- CreateIndex (created before dropping the old one so the userId foreign key always has an index)
CREATE UNIQUE INDEX `Payee_userId_type_name_key` ON `Payee`(`userId`, `type`, `name`);

-- DropIndex
DROP INDEX `Payee_userId_name_key` ON `Payee`;

-- AlterTable
ALTER TABLE `Transaction` MODIFY `kind` ENUM('TRANSFER', 'BILL_PAYMENT', 'CHEQUE_DEPOSIT', 'ETRANSFER', 'WIRE_TRANSFER', 'ADMIN_CREDIT', 'ADMIN_DEBIT', 'INTEREST', 'FEE') NOT NULL;
