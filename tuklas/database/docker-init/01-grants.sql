-- Runs once, when the MySQL volume is first created. The app uses `tuklas` (made by docker-compose);
-- `tuklas_test` is for running the test suite against MySQL (CI does), so the app user gets
-- dev-wide rights. Local development only — never use these grants in production.
CREATE DATABASE IF NOT EXISTS tuklas_test;
GRANT ALL PRIVILEGES ON *.* TO 'tuklas'@'%';
FLUSH PRIVILEGES;
