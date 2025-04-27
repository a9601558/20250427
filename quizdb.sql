-- phpMyAdmin SQL Dump
-- version 5.1.1
-- https://www.phpmyadmin.net/
--
-- 主机： localhost
-- 生成日期： 2025-04-25 21:26:12
-- 服务器版本： 5.7.44-log
-- PHP 版本： 8.0.26

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- 数据库： `quizdb`
--

-- --------------------------------------------------------

--
-- 表的结构 `options`
--

CREATE TABLE `options` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `questionId` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `text` text NOT NULL,
  `isCorrect` tinyint(1) NOT NULL DEFAULT '0',
  `optionIndex` varchar(5) NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- 表的结构 `purchases`
--

CREATE TABLE `purchases` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `userId` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `quizId` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `purchaseDate` datetime NOT NULL,
  `expiryDate` datetime NOT NULL,
  `transactionId` varchar(100) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `paymentMethod` varchar(20) NOT NULL DEFAULT 'card',
  `status` enum('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- 表的结构 `questions`
--

CREATE TABLE `questions` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `questionSetId` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `text` text NOT NULL,
  `questionType` enum('single','multiple') NOT NULL DEFAULT 'single',
  `explanation` text NOT NULL,
  `orderIndex` int(11) NOT NULL DEFAULT '0',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- 表的结构 `question_sets`
--

CREATE TABLE `question_sets` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `title` varchar(100) NOT NULL,
  `description` text NOT NULL,
  `category` varchar(50) NOT NULL,
  `icon` varchar(50) NOT NULL,
  `isPaid` tinyint(1) NOT NULL DEFAULT '0',
  `price` decimal(10,2) DEFAULT NULL,
  `trialQuestions` int(11) DEFAULT '0',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- 表的结构 `redeem_codes`
--

CREATE TABLE `redeem_codes` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `code` varchar(20) NOT NULL,
  `questionSetId` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `validityDays` int(11) NOT NULL,
  `expiryDate` datetime NOT NULL,
  `isUsed` tinyint(1) NOT NULL DEFAULT '0',
  `usedBy` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `usedAt` datetime DEFAULT NULL,
  `createdBy` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --------------------------------------------------------

--
-- 表的结构 `users`
--

CREATE TABLE `users` (
  `id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(100) NOT NULL,
  `isAdmin` tinyint(1) NOT NULL DEFAULT '0',
  `progress` json NOT NULL,
  `purchases` json NOT NULL,
  `redeemCodes` json NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- 转存表中的数据 `users`
--

INSERT INTO `users` (`id`, `username`, `email`, `password`, `isAdmin`, `progress`, `purchases`, `redeemCodes`, `createdAt`, `updatedAt`) VALUES
('3c2f3f1b-96f3-40d5-af3e-53c8451af059', '111', '1@jast.co.jp', '$2a$10$IAAYgHkkIcUTZKVkgAIsJeyw2BbCJQnaJ1YM4e5Sxh1t4dxfbUIqC', 0, '{}', '[]', '[]', '2025-04-25 13:23:38', '2025-04-25 13:23:38'),
('5d148416-d496-408d-a15b-f516da94ccc3', '222', '22@22.com', '$2a$10$GOx5NaqqS2HKhRwT5q7Bw.CUbji7ZGaBU1R4XjzRxUqEgbV0geDyu', 0, '{}', '[]', '[]', '2025-04-25 07:52:50', '2025-04-25 07:52:50'),
('63ab5c48-654d-4527-bfba-400323e8d6f6', 'zhangqiwei0509@gmail.com', 'zhangqiwei0509@gmail.com', '$2a$10$Ggv.C39tUOAofHVtTsOhNefYzlB3n8dXdxUxPn4siRe9J.c7RC.g6', 0, '{}', '[]', '[]', '2025-04-25 06:42:28', '2025-04-25 06:42:28'),
('67e6b459-937e-4842-b0ae-b4ee57e54fd1', '333', '333@333.com', '$2a$10$T3iBkV2.7rHktCsJhsweaugiFwe0wBOyqSCCpat2XmH0MoA31427a', 0, '{}', '[]', '[]', '2025-04-25 11:08:00', '2025-04-25 11:08:00'),
('d65bfd89-1de0-4263-8093-1614f75314bb', 'qiwei.zhang@jast.co.jp', 'qiwei.zhang@jast.co.jp', '$2a$10$8irWYnWa.4P.cMwwlOdYHexO4e8/RDnc8si2Im11IT/idamsBYchK', 1, '{}', '[]', '[]', '2025-04-25 06:44:43', '2025-04-25 06:44:43'),
('def2c68c-5ada-4278-800a-fb55fb088b06', '111111', '1@1.com', '$2a$10$zuPQp9YuUK3DWimmRIbJ9uLJKxZEzUIjg/a/GMTmTMF1Ww21YEBg2', 0, '{}', '[]', '[]', '2025-04-25 06:43:29', '2025-04-25 06:43:29');

--
-- 转储表的索引
--

--
-- 表的索引 `options`
--
ALTER TABLE `options`
  ADD PRIMARY KEY (`id`),
  ADD KEY `options_question_id` (`questionId`);

--
-- 表的索引 `purchases`
--
ALTER TABLE `purchases`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `transactionId` (`transactionId`),
  ADD UNIQUE KEY `purchases_transaction_id` (`transactionId`),
  ADD UNIQUE KEY `transactionId_2` (`transactionId`),
  ADD UNIQUE KEY `transactionId_3` (`transactionId`),
  ADD UNIQUE KEY `transactionId_4` (`transactionId`),
  ADD UNIQUE KEY `transactionId_5` (`transactionId`),
  ADD UNIQUE KEY `transactionId_6` (`transactionId`),
  ADD UNIQUE KEY `transactionId_7` (`transactionId`),
  ADD UNIQUE KEY `transactionId_8` (`transactionId`),
  ADD UNIQUE KEY `transactionId_9` (`transactionId`),
  ADD UNIQUE KEY `transactionId_10` (`transactionId`),
  ADD UNIQUE KEY `transactionId_11` (`transactionId`),
  ADD UNIQUE KEY `transactionId_12` (`transactionId`),
  ADD UNIQUE KEY `transactionId_13` (`transactionId`),
  ADD UNIQUE KEY `transactionId_14` (`transactionId`),
  ADD UNIQUE KEY `transactionId_15` (`transactionId`),
  ADD UNIQUE KEY `transactionId_16` (`transactionId`),
  ADD UNIQUE KEY `transactionId_17` (`transactionId`),
  ADD UNIQUE KEY `transactionId_18` (`transactionId`),
  ADD UNIQUE KEY `transactionId_19` (`transactionId`),
  ADD UNIQUE KEY `transactionId_20` (`transactionId`),
  ADD UNIQUE KEY `transactionId_21` (`transactionId`),
  ADD KEY `purchases_user_id` (`userId`),
  ADD KEY `purchases_quiz_id` (`quizId`),
  ADD KEY `purchases_status` (`status`);

--
-- 表的索引 `questions`
--
ALTER TABLE `questions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `questions_question_set_id` (`questionSetId`),
  ADD KEY `questions_question_set_id_order_index` (`questionSetId`,`orderIndex`);

--
-- 表的索引 `question_sets`
--
ALTER TABLE `question_sets`
  ADD PRIMARY KEY (`id`),
  ADD KEY `question_sets_category` (`category`);

--
-- 表的索引 `redeem_codes`
--
ALTER TABLE `redeem_codes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`),
  ADD UNIQUE KEY `redeem_codes_code` (`code`),
  ADD UNIQUE KEY `code_2` (`code`),
  ADD UNIQUE KEY `code_3` (`code`),
  ADD UNIQUE KEY `code_4` (`code`),
  ADD UNIQUE KEY `code_5` (`code`),
  ADD UNIQUE KEY `code_6` (`code`),
  ADD UNIQUE KEY `code_7` (`code`),
  ADD UNIQUE KEY `code_8` (`code`),
  ADD UNIQUE KEY `code_9` (`code`),
  ADD UNIQUE KEY `code_10` (`code`),
  ADD UNIQUE KEY `code_11` (`code`),
  ADD UNIQUE KEY `code_12` (`code`),
  ADD UNIQUE KEY `code_13` (`code`),
  ADD UNIQUE KEY `code_14` (`code`),
  ADD UNIQUE KEY `code_15` (`code`),
  ADD UNIQUE KEY `code_16` (`code`),
  ADD UNIQUE KEY `code_17` (`code`),
  ADD UNIQUE KEY `code_18` (`code`),
  ADD UNIQUE KEY `code_19` (`code`),
  ADD UNIQUE KEY `code_20` (`code`),
  ADD UNIQUE KEY `code_21` (`code`),
  ADD KEY `redeem_codes_question_set_id` (`questionSetId`),
  ADD KEY `redeem_codes_is_used` (`isUsed`),
  ADD KEY `redeem_codes_used_by` (`usedBy`),
  ADD KEY `redeem_codes_created_by` (`createdBy`);

--
-- 表的索引 `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `users_email` (`email`),
  ADD UNIQUE KEY `users_username` (`username`),
  ADD UNIQUE KEY `username_2` (`username`),
  ADD UNIQUE KEY `email_2` (`email`),
  ADD UNIQUE KEY `username_3` (`username`),
  ADD UNIQUE KEY `email_3` (`email`),
  ADD UNIQUE KEY `username_4` (`username`),
  ADD UNIQUE KEY `email_4` (`email`),
  ADD UNIQUE KEY `username_5` (`username`),
  ADD UNIQUE KEY `email_5` (`email`),
  ADD UNIQUE KEY `username_6` (`username`),
  ADD UNIQUE KEY `email_6` (`email`),
  ADD UNIQUE KEY `username_7` (`username`),
  ADD UNIQUE KEY `email_7` (`email`),
  ADD UNIQUE KEY `username_8` (`username`),
  ADD UNIQUE KEY `email_8` (`email`),
  ADD UNIQUE KEY `username_9` (`username`),
  ADD UNIQUE KEY `email_9` (`email`),
  ADD UNIQUE KEY `username_10` (`username`),
  ADD UNIQUE KEY `email_10` (`email`),
  ADD UNIQUE KEY `username_11` (`username`),
  ADD UNIQUE KEY `email_11` (`email`),
  ADD UNIQUE KEY `username_12` (`username`),
  ADD UNIQUE KEY `email_12` (`email`),
  ADD UNIQUE KEY `username_13` (`username`),
  ADD UNIQUE KEY `email_13` (`email`),
  ADD UNIQUE KEY `username_14` (`username`),
  ADD UNIQUE KEY `email_14` (`email`),
  ADD UNIQUE KEY `username_15` (`username`),
  ADD UNIQUE KEY `email_15` (`email`),
  ADD UNIQUE KEY `username_16` (`username`),
  ADD UNIQUE KEY `email_16` (`email`),
  ADD UNIQUE KEY `username_17` (`username`),
  ADD UNIQUE KEY `email_17` (`email`),
  ADD UNIQUE KEY `username_18` (`username`),
  ADD UNIQUE KEY `email_18` (`email`),
  ADD UNIQUE KEY `username_19` (`username`),
  ADD UNIQUE KEY `email_19` (`email`),
  ADD UNIQUE KEY `username_20` (`username`),
  ADD UNIQUE KEY `email_20` (`email`),
  ADD UNIQUE KEY `username_21` (`username`),
  ADD UNIQUE KEY `email_21` (`email`);

--
-- 限制导出的表
--

--
-- 限制表 `options`
--
ALTER TABLE `options`
  ADD CONSTRAINT `options_ibfk_1` FOREIGN KEY (`questionId`) REFERENCES `questions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- 限制表 `purchases`
--
ALTER TABLE `purchases`
  ADD CONSTRAINT `purchases_ibfk_41` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `purchases_ibfk_42` FOREIGN KEY (`quizId`) REFERENCES `question_sets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- 限制表 `questions`
--
ALTER TABLE `questions`
  ADD CONSTRAINT `questions_ibfk_1` FOREIGN KEY (`questionSetId`) REFERENCES `question_sets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- 限制表 `redeem_codes`
--
ALTER TABLE `redeem_codes`
  ADD CONSTRAINT `redeem_codes_ibfk_61` FOREIGN KEY (`questionSetId`) REFERENCES `question_sets` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `redeem_codes_ibfk_62` FOREIGN KEY (`usedBy`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `redeem_codes_ibfk_63` FOREIGN KEY (`createdBy`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
