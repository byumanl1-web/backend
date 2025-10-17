-- MySQL dump 10.13  Distrib 8.0.42, for Win64 (x86_64)
--
-- Host: localhost    Database: qrmanager
-- ------------------------------------------------------
-- Server version	8.0.42

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `admins`
--

DROP TABLE IF EXISTS `admins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admins` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `full_name` varchar(120) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password_hash` varchar(255) DEFAULT NULL,
  `role_id` tinyint unsigned NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `fk_admin_role` (`role_id`),
  CONSTRAINT `fk_admin_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admins`
--

LOCK TABLES `admins` WRITE;
/*!40000 ALTER TABLE `admins` DISABLE KEYS */;
INSERT INTO `admins` VALUES (1,'Administrador','admin@mail.com',NULL,1,'2025-09-28 22:51:09');
/*!40000 ALTER TABLE `admins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `emergencia_contactos`
--

DROP TABLE IF EXISTS `emergencia_contactos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `emergencia_contactos` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `motorista_id` int unsigned NOT NULL,
  `nombre` varchar(120) NOT NULL,
  `telefono` varchar(30) NOT NULL,
  `prioridad` tinyint unsigned NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_emc_motorista` (`motorista_id`),
  CONSTRAINT `fk_emc_motorista` FOREIGN KEY (`motorista_id`) REFERENCES `motoristas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `emergencia_contactos`
--

LOCK TABLES `emergencia_contactos` WRITE;
/*!40000 ALTER TABLE `emergencia_contactos` DISABLE KEYS */;
INSERT INTO `emergencia_contactos` VALUES (1,1,'tia','58693234',1,'2025-09-29 02:51:45'),(2,1,'tio ','25418796',2,'2025-09-29 02:51:45'),(3,2,'amigos','12365489',1,'2025-09-29 04:28:32'),(4,2,'pedrin','85479658',2,'2025-09-29 04:28:32'),(5,3,'juan','13254856',1,'2025-09-29 19:06:58'),(6,3,'pedrina','12354568',2,'2025-09-29 19:06:58'),(7,4,'hermano','54879652',1,'2025-10-04 02:58:49'),(8,4,'hermana','85479656',2,'2025-10-04 02:58:49'),(9,5,'elmer ','56854568',1,'2025-10-14 17:44:07'),(10,5,'elvira','47859621',2,'2025-10-14 17:44:07'),(11,6,'pedro','52360140',1,'2025-10-15 02:30:38'),(12,6,'apolonio','25416325',2,'2025-10-15 02:30:38'),(13,7,'marleny','45698745',1,'2025-10-15 05:04:13'),(14,7,'Juan valle','84756475',2,'2025-10-15 05:04:13'),(15,8,'maximo','15487647',1,'2025-10-15 05:08:34'),(16,8,'desiderio','54789632',2,'2025-10-15 05:08:34');
/*!40000 ALTER TABLE `emergencia_contactos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `incidente_archivos`
--

DROP TABLE IF EXISTS `incidente_archivos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `incidente_archivos` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `incidente_id` int unsigned NOT NULL,
  `url` varchar(500) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_incf_incidente` (`incidente_id`),
  CONSTRAINT `fk_incf_incidente` FOREIGN KEY (`incidente_id`) REFERENCES `incidentes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `incidente_archivos`
--

LOCK TABLES `incidente_archivos` WRITE;
/*!40000 ALTER TABLE `incidente_archivos` DISABLE KEYS */;
/*!40000 ALTER TABLE `incidente_archivos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `incidentes`
--

DROP TABLE IF EXISTS `incidentes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `incidentes` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `motorista_id` int unsigned NOT NULL,
  `tipo` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descripcion` text COLLATE utf8mb4_unicode_ci,
  `ubicacion` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reportado_por` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `telefono_reportante` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lat` decimal(9,6) DEFAULT NULL,
  `lng` decimal(9,6) DEFAULT NULL,
  `estado` enum('pendiente','en_revision','resuelto','descartado') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pendiente',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_inc_motorista` (`motorista_id`),
  KEY `idx_incidentes_motorista` (`motorista_id`),
  KEY `idx_incidentes_estado` (`estado`),
  KEY `idx_incidentes_created` (`created_at`),
  CONSTRAINT `fk_inc_motorista` FOREIGN KEY (`motorista_id`) REFERENCES `motoristas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `incidentes`
--

LOCK TABLES `incidentes` WRITE;
/*!40000 ALTER TABLE `incidentes` DISABLE KEYS */;
INSERT INTO `incidentes` VALUES (1,3,'Emergencia médica','subrio una emergencia','antigua guatemala','estuardo ramirez','34998913',NULL,NULL,'pendiente','2025-10-16 22:56:31'),(2,2,'Emergencia médica','subrio una emergencia','antigua guatemala','estuardo ramirez','34998913',NULL,NULL,'pendiente','2025-10-16 22:57:21'),(3,2,'Emergencia médica','subrio una emergencia','san juan del obispo','juan perez','18213561',NULL,NULL,'pendiente','2025-10-16 22:57:40'),(4,2,'Emergencia médica','subrio una emergencia','san juan del obispo','juan perez','18213561',NULL,NULL,'pendiente','2025-10-16 22:57:41'),(5,2,'Fallecimiento','subrio una emergencia','san juan del obispo','juan perez','18213561',NULL,NULL,'pendiente','2025-10-16 22:57:45'),(6,2,'Accidente','subrio una emergencia','san juan del obispo','juan perez','18213561',NULL,NULL,'pendiente','2025-10-16 23:38:11'),(7,2,'Otro','subrio una emergencia','san juan del obispo','juan perez','18213561',NULL,NULL,'pendiente','2025-10-17 00:08:27'),(8,2,'Otro','subrio una emergencia','san juan del obispo','juan perez','18213561',NULL,NULL,'pendiente','2025-10-17 00:11:21');
/*!40000 ALTER TABLE `incidentes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `login_audit`
--

DROP TABLE IF EXISTS `login_audit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `login_audit` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_type` enum('admin','motorista') NOT NULL,
  `user_id` int unsigned DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `ip` varchar(64) DEFAULT NULL,
  `success` tinyint(1) NOT NULL,
  `message` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_login_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `login_audit`
--

LOCK TABLES `login_audit` WRITE;
/*!40000 ALTER TABLE `login_audit` DISABLE KEYS */;
/*!40000 ALTER TABLE `login_audit` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `motoristas`
--

DROP TABLE IF EXISTS `motoristas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `motoristas` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `role_id` tinyint unsigned NOT NULL DEFAULT '2',
  `nombreCompleto` varchar(120) NOT NULL,
  `dpi` varchar(20) NOT NULL,
  `numeroCasa` varchar(40) DEFAULT NULL,
  `nombrePadre` varchar(120) DEFAULT NULL,
  `nombreMadre` varchar(120) DEFAULT NULL,
  `email` varchar(120) NOT NULL,
  `password_hash` varchar(200) NOT NULL,
  `qr_data` longtext,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `emergencia1Nombre` varchar(120) DEFAULT NULL,
  `emergencia1Telefono` varchar(30) DEFAULT NULL,
  `emergencia2Nombre` varchar(120) DEFAULT NULL,
  `emergencia2Telefono` varchar(30) DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `dpi` (`dpi`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `u_motoristas_email` (`email`),
  UNIQUE KEY `u_motoristas_dpi` (`dpi`),
  KEY `fk_motorista_role` (`role_id`),
  KEY `idx_motoristas_email` (`email`),
  KEY `idx_motoristas_created` (`created_at`),
  CONSTRAINT `fk_motorista_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `motoristas`
--

LOCK TABLES `motoristas` WRITE;
/*!40000 ALTER TABLE `motoristas` DISABLE KEYS */;
INSERT INTO `motoristas` VALUES (1,2,'bryan estuardo yuman lorenzo ','3010507160101','2da calle zona 2 chimaltenango','juan perez','abelina samora','estuardolorenzo1234@gmail.com','$2a$10$QnocvlnGdtg/OAJ.VlABJeAISjKbxZ/OlwwtpwHeaax8/8FR8jajq','{\"t\":\"driver\",\"id\":1,\"dpi\":\"3010507160101\"}','2025-09-29 02:51:45',NULL,NULL,NULL,NULL,'2025-10-14 21:14:08'),(2,2,'juan perz','1236548975511','2da calle','pedro','marcelina','juan1234@gmail.com','$2a$10$a8Q0ttjGGOiXx6dakkURfe.GybUeQ8dDCwBb8qGguohkwp28/TvI.','{\"t\":\"driver\",\"id\":2,\"dpi\":\"1236548975511\"}','2025-09-29 04:28:32',NULL,NULL,NULL,NULL,NULL),(3,2,'estuardo','0223236516512','2do canton','juan','pedroq','estuardolorenzo@gmial.com','$2a$10$A7.bvYOV2/2ON/1a2cBhNuMw6vkpvilbZ8V3bn2pOEaUeVZJiRFXC','{\"t\":\"driver\",\"id\":3,\"dpi\":\"0223236516512\"}','2025-09-29 19:06:58',NULL,NULL,NULL,NULL,NULL),(4,2,'juana piche','0261651621213','san antonio aguas caliente ','juan','maria','juanapiche@gmial.com','$2a$10$8CXki/O8C7nx8lEc3Bq3vuFMRMTJ92RrWtkUutF9K1Q/3qHK4DuCi','{\"t\":\"driver\",\"id\":4,\"dpi\":\"0261651621213\"}','2025-10-04 02:58:49',NULL,NULL,NULL,NULL,NULL),(5,2,'estuardo lorenzo ','7458961232556','2da avenida escuintla ','juan perez ','Juana valle ','estuardolorenzo12@gmail.com','$2a$10$yYzMiD98EsLXCODqiUvSTeJPkv1yxfN2bfkF362mLaj654sAO2fo2','{\"t\":\"driver\",\"id\":5,\"dpi\":\"7458961232556\"}','2025-10-14 17:44:07',NULL,NULL,NULL,NULL,NULL),(6,2,'sandra valle ','8546516232213','chimaltenango 2da avenida','juan ortiz','marcela lorenzo','sandravalle@gmail.com','$2a$10$9jE818WiRUOISSg1BbEOAu9wHNG0l7xSn.cvYIuGp9aOuZADbFpoS','{\"t\":\"driver\",\"id\":6,\"dpi\":\"8546516232213\"}','2025-10-15 02:30:38',NULL,NULL,NULL,NULL,'2025-10-14 20:30:38'),(7,2,'evelin aleyda piche ','8547656123132','santa maria de jesus','hector piche ','sandra valle ','evelinpiche@gmail.com','$2a$10$1mjYqEbKwqyw7edaeyW0iOUXKAW4UfpFG5xmxCiRLD2luQM.8HGEC','{\"t\":\"driver\",\"id\":7,\"dpi\":\"8547656123132\"}','2025-10-15 05:04:13',NULL,NULL,NULL,NULL,'2025-10-14 23:04:13'),(8,2,'marleny valle ','2132151231313','santa maria de jesus','hector valle ','sandra valle','marlenypichevalle@gmail.com','$2a$10$p3OoXGgc1MoiMpbX8eoAH.Of45Z2EVUfnSWrSeAGGcFPN7aP7pCR.','{\"t\":\"driver\",\"id\":8,\"dpi\":\"2132151231313\"}','2025-10-15 05:08:34',NULL,NULL,NULL,NULL,'2025-10-14 23:08:34');
/*!40000 ALTER TABLE `motoristas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `password_resets`
--

DROP TABLE IF EXISTS `password_resets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_resets` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_type` enum('admin','motorista') NOT NULL,
  `email` varchar(150) NOT NULL,
  `token` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `password_resets`
--

LOCK TABLES `password_resets` WRITE;
/*!40000 ALTER TABLE `password_resets` DISABLE KEYS */;
/*!40000 ALTER TABLE `password_resets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `qr_codes`
--

DROP TABLE IF EXISTS `qr_codes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `qr_codes` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `motorista_id` int unsigned NOT NULL,
  `payload` varchar(255) NOT NULL,
  `image_base64` mediumtext,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `motorista_id` (`motorista_id`),
  CONSTRAINT `fk_qr_motorista` FOREIGN KEY (`motorista_id`) REFERENCES `motoristas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `qr_codes`
--

LOCK TABLES `qr_codes` WRITE;
/*!40000 ALTER TABLE `qr_codes` DISABLE KEYS */;
/*!40000 ALTER TABLE `qr_codes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `qr_scans`
--

DROP TABLE IF EXISTS `qr_scans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `qr_scans` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `qr_id` int unsigned NOT NULL,
  `scanner` varchar(120) DEFAULT NULL,
  `lat` decimal(9,6) DEFAULT NULL,
  `lng` decimal(9,6) DEFAULT NULL,
  `scanned_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_qrsc_qr` (`qr_id`),
  CONSTRAINT `fk_qrs_qr` FOREIGN KEY (`qr_id`) REFERENCES `qr_codes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `qr_scans`
--

LOCK TABLES `qr_scans` WRITE;
/*!40000 ALTER TABLE `qr_scans` DISABLE KEYS */;
/*!40000 ALTER TABLE `qr_scans` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` tinyint unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES (1,'admin'),(2,'motorista');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sesiones`
--

DROP TABLE IF EXISTS `sesiones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sesiones` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_type` enum('admin','motorista') NOT NULL,
  `user_id` int unsigned NOT NULL,
  `token` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sesiones`
--

LOCK TABLES `sesiones` WRITE;
/*!40000 ALTER TABLE `sesiones` DISABLE KEYS */;
/*!40000 ALTER TABLE `sesiones` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary view structure for view `v_metrics_counts`
--

DROP TABLE IF EXISTS `v_metrics_counts`;
/*!50001 DROP VIEW IF EXISTS `v_metrics_counts`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_metrics_counts` AS SELECT 
 1 AS `driversCount`,
 1 AS `adminsCount`,
 1 AS `usersCount`*/;
SET character_set_client = @saved_cs_client;

--
-- Temporary view structure for view `v_new_users_by_month`
--

DROP TABLE IF EXISTS `v_new_users_by_month`;
/*!50001 DROP VIEW IF EXISTS `v_new_users_by_month`*/;
SET @saved_cs_client     = @@character_set_client;
/*!50503 SET character_set_client = utf8mb4 */;
/*!50001 CREATE VIEW `v_new_users_by_month` AS SELECT 
 1 AS `month`,
 1 AS `count`*/;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `vehiculos`
--

DROP TABLE IF EXISTS `vehiculos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vehiculos` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `motorista_id` int unsigned NOT NULL,
  `placa` varchar(20) NOT NULL,
  `marca` varchar(60) DEFAULT NULL,
  `modelo` varchar(60) DEFAULT NULL,
  `anio` smallint DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_veh_motorista` (`motorista_id`),
  CONSTRAINT `fk_veh_motorista` FOREIGN KEY (`motorista_id`) REFERENCES `motoristas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vehiculos`
--

LOCK TABLES `vehiculos` WRITE;
/*!40000 ALTER TABLE `vehiculos` DISABLE KEYS */;
INSERT INTO `vehiculos` VALUES (1,4,'MOA-6584A','Honda','PLATINUM',2025,'2025-10-04 02:58:49'),(2,5,'M135P','Kawasaki','Ninja 250',2013,'2025-10-14 17:44:07'),(3,6,'MO125B','Honda','CB125F',2024,'2025-10-15 02:30:38'),(4,7,'MO4157','Honda','XR190L',2025,'2025-10-15 05:04:13'),(5,8,'MO5478','TVS','Apache 160',2024,'2025-10-15 05:08:34');
/*!40000 ALTER TABLE `vehiculos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Final view structure for view `v_metrics_counts`
--

/*!50001 DROP VIEW IF EXISTS `v_metrics_counts`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_metrics_counts` AS select (select count(0) from `motoristas`) AS `driversCount`,(select count(0) from `admins`) AS `adminsCount`,((select count(0) from `motoristas`) + (select count(0) from `admins`)) AS `usersCount` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_new_users_by_month`
--

/*!50001 DROP VIEW IF EXISTS `v_new_users_by_month`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_0900_ai_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_new_users_by_month` AS select date_format(`motoristas`.`created_at`,'%Y-%m') AS `month`,count(0) AS `count` from `motoristas` group by `month` order by `month` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-17 11:00:05
