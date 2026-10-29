-- Phases 3–7: portfolio, works & approval, feed, events & ads, groups, admin, signature features.
-- Hand-edited from `prisma migrate diff` so existing rows are kept and backfilled.

-- AlterTable: comments get a scope. The new index starts with workId, so it can carry the
-- comments → works foreign key before the old index is dropped (Prisma's version dropped the key).
ALTER TABLE `comments` ADD COLUMN `scope` ENUM('review', 'public') NOT NULL DEFAULT 'review';
CREATE INDEX `comments_workId_scope_createdAt_idx` ON `comments`(`workId`, `scope`, `createdAt`);
DROP INDEX `comments_workId_createdAt_idx` ON `comments`;

-- AlterTable
ALTER TABLE `events` ADD COLUMN `capacity` INTEGER NULL,
    MODIFY `category` ENUM('colloquium', 'defense', 'fair', 'innovation', 'cpgarcia') NOT NULL;

-- AlterTable: username is backfilled from the email before it becomes required and unique.
ALTER TABLE `users` ADD COLUMN `username` VARCHAR(40) NULL,
    ADD COLUMN `verified` BOOLEAN NOT NULL DEFAULT true;

UPDATE `users` SET `username` = LEFT(REGEXP_REPLACE(LOWER(SUBSTRING_INDEX(`email`, '@', 1)), '[^a-z0-9]', ''), 30);
UPDATE `users` SET `username` = CONCAT('user', `id`) WHERE `username` = '';
UPDATE `users` u
  JOIN (SELECT `username` FROM `users` GROUP BY `username` HAVING COUNT(*) > 1) d ON u.`username` = d.`username`
  SET u.`username` = CONCAT(u.`username`, u.`id`);

ALTER TABLE `users` MODIFY `username` VARCHAR(40) NOT NULL;
CREATE UNIQUE INDEX `users_username_key` ON `users`(`username`);

-- AlterTable
ALTER TABLE `works` ADD COLUMN `pdfFile` VARCHAR(80) NULL,
    ADD COLUMN `pdfName` VARCHAR(160) NULL,
    ADD COLUMN `removedAt` DATETIME(3) NULL,
    ADD COLUMN `sealCode` VARCHAR(12) NULL,
    ADD COLUMN `submittedAt` DATETIME(3) NULL,
    MODIFY `type` ENUM('research', 'literary', 'innovation') NOT NULL,
    MODIFY `status` ENUM('draft', 'submitted', 'under_review', 'revision', 'approved', 'rejected') NOT NULL DEFAULT 'draft';

CREATE UNIQUE INDEX `works_sealCode_key` ON `works`(`sealCode`);

-- CreateTable
CREATE TABLE `profiles` (
    `userId` INTEGER NOT NULL,
    `titles` VARCHAR(120) NOT NULL DEFAULT '',
    `department` VARCHAR(160) NOT NULL DEFAULT '',
    `bioLong` TEXT NULL,
    `photoFile` VARCHAR(80) NULL,
    `photoType` VARCHAR(40) NULL,
    `cvFile` VARCHAR(80) NULL,
    `cvName` VARCHAR(160) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `academic_links` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `type` ENUM('scholar', 'orcid', 'researchgate', 'linkedin', 'faculty', 'other') NOT NULL,
    `url` VARCHAR(300) NOT NULL,
    `label` VARCHAR(80) NOT NULL DEFAULT '',

    INDEX `academic_links_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_authors` (
    `workId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `order` INTEGER NOT NULL,

    INDEX `work_authors_userId_idx`(`userId`),
    PRIMARY KEY (`workId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_versions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workId` INTEGER NOT NULL,
    `version` INTEGER NOT NULL,
    `title` VARCHAR(180) NOT NULL,
    `abstract` TEXT NOT NULL,
    `tags` JSON NOT NULL,
    `pdfFile` VARCHAR(80) NULL,
    `pdfName` VARCHAR(160) NULL,
    `note` VARCHAR(500) NOT NULL DEFAULT '',
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `work_versions_workId_version_key`(`workId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reviews` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workId` INTEGER NOT NULL,
    `reviewerId` INTEGER NOT NULL,
    `decision` ENUM('start_review', 'revise', 'approve', 'reject') NOT NULL,
    `comment` TEXT NULL,
    `version` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reviews_workId_createdAt_idx`(`workId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `revision_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reviewId` INTEGER NOT NULL,
    `text` VARCHAR(500) NOT NULL,
    `doneByStudent` BOOLEAN NOT NULL DEFAULT false,
    `confirmedByAdviser` BOOLEAN NOT NULL DEFAULT false,

    INDEX `revision_items_reviewId_idx`(`reviewId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `defense_stages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workId` INTEGER NOT NULL,
    `stage` ENUM('proposal', 'colloquium', 'final_defense', 'revisions', 'published') NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `panel` VARCHAR(300) NOT NULL DEFAULT '',
    `verdict` ENUM('pending', 'passed', 'passed_with_revisions', 'failed') NOT NULL DEFAULT 'pending',
    `notes` VARCHAR(500) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `defense_stages_workId_date_idx`(`workId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reactions` (
    `userId` INTEGER NOT NULL,
    `workId` INTEGER NOT NULL,
    `kind` ENUM('insightful', 'useful', 'inspiring') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reactions_workId_idx`(`workId`),
    PRIMARY KEY (`userId`, `workId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `saves` (
    `userId` INTEGER NOT NULL,
    `workId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `saves_workId_idx`(`workId`),
    PRIMARY KEY (`userId`, `workId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `opportunity_applications` (
    `opportunityId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `message` VARCHAR(1000) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `opportunity_applications_userId_idx`(`userId`),
    PRIMARY KEY (`opportunityId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `event_registrations` (
    `eventId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `event_registrations_userId_idx`(`userId`),
    PRIMARY KEY (`eventId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ads` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `eventId` INTEGER NOT NULL,
    `createdById` INTEGER NOT NULL,
    `headline` VARCHAR(120) NOT NULL,
    `imageFile` VARCHAR(80) NULL,
    `imageType` VARCHAR(40) NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ads_status_startsAt_endsAt_idx`(`status`, `startsAt`, `endsAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `groups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `adviserId` INTEGER NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `description` VARCHAR(1000) NOT NULL DEFAULT '',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `groups_adviserId_idx`(`adviserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `group_members` (
    `groupId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `addedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `group_members_userId_idx`(`userId`),
    PRIMARY KEY (`groupId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `group_files` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `groupId` INTEGER NOT NULL,
    `uploadedById` INTEGER NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `file` VARCHAR(80) NOT NULL,
    `type` VARCHAR(100) NOT NULL,
    `size` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `group_files_groupId_idx`(`groupId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `group_deadlines` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `groupId` INTEGER NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `dueAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `group_deadlines_groupId_dueAt_idx`(`groupId`, `dueAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `type` VARCHAR(40) NOT NULL,
    `message` VARCHAR(300) NOT NULL,
    `link` VARCHAR(200) NOT NULL,
    `read` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_userId_read_createdAt_idx`(`userId`, `read`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `profiles` ADD CONSTRAINT `profiles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `academic_links` ADD CONSTRAINT `academic_links_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_authors` ADD CONSTRAINT `work_authors_workId_fkey` FOREIGN KEY (`workId`) REFERENCES `works`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_authors` ADD CONSTRAINT `work_authors_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_versions` ADD CONSTRAINT `work_versions_workId_fkey` FOREIGN KEY (`workId`) REFERENCES `works`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_workId_fkey` FOREIGN KEY (`workId`) REFERENCES `works`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_reviewerId_fkey` FOREIGN KEY (`reviewerId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `revision_items` ADD CONSTRAINT `revision_items_reviewId_fkey` FOREIGN KEY (`reviewId`) REFERENCES `reviews`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `defense_stages` ADD CONSTRAINT `defense_stages_workId_fkey` FOREIGN KEY (`workId`) REFERENCES `works`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reactions` ADD CONSTRAINT `reactions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reactions` ADD CONSTRAINT `reactions_workId_fkey` FOREIGN KEY (`workId`) REFERENCES `works`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `saves` ADD CONSTRAINT `saves_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `saves` ADD CONSTRAINT `saves_workId_fkey` FOREIGN KEY (`workId`) REFERENCES `works`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `opportunity_applications` ADD CONSTRAINT `opportunity_applications_opportunityId_fkey` FOREIGN KEY (`opportunityId`) REFERENCES `opportunities`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `opportunity_applications` ADD CONSTRAINT `opportunity_applications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_registrations` ADD CONSTRAINT `event_registrations_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_registrations` ADD CONSTRAINT `event_registrations_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ads` ADD CONSTRAINT `ads_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ads` ADD CONSTRAINT `ads_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `groups` ADD CONSTRAINT `groups_adviserId_fkey` FOREIGN KEY (`adviserId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_members` ADD CONSTRAINT `group_members_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_members` ADD CONSTRAINT `group_members_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_files` ADD CONSTRAINT `group_files_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_files` ADD CONSTRAINT `group_files_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `group_deadlines` ADD CONSTRAINT `group_deadlines_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: existing works were submitted when created, so each gets version 1,
-- and every approved work gets a seal code.
UPDATE `works` SET `submittedAt` = `createdAt` WHERE `status` <> 'draft';
UPDATE `works` SET `sealCode` = HEX(RANDOM_BYTES(4)) WHERE `status` = 'approved';

INSERT INTO `work_versions` (`workId`, `version`, `title`, `abstract`, `tags`, `note`, `submittedAt`)
  SELECT `id`, 1, `title`, `abstract`, `tags`, '', `createdAt` FROM `works` WHERE `status` <> 'draft';

INSERT INTO `profiles` (`userId`, `updatedAt`) SELECT `id`, CURRENT_TIMESTAMP(3) FROM `users`;
