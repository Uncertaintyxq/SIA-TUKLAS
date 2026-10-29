-- Runs once, when the MySQL volume is first created.
-- Prisma needs to create a temporary "shadow" database for `prisma migrate dev`,
-- and the tests use their own database, so the app user gets dev-wide rights.
-- Local development only — never use these grants in production.
CREATE DATABASE IF NOT EXISTS tuklas_test;
GRANT ALL PRIVILEGES ON *.* TO 'tuklas'@'%';
FLUSH PRIVILEGES;
