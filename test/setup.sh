#!/bin/sh

# Setup the test environment

DATABASE_NAME="snapshot_sequencer_test"
MYSQL_USER="root"
MYSQL_PASSWORD="root"

# - Create a test database
echo 'Dropping existing test database'
mysql -e "DROP DATABASE $DATABASE_NAME" -u$MYSQL_USER -p$MYSQL_PASSWORD

echo 'Creating test database'
mysql -e "CREATE DATABASE $DATABASE_NAME" -u$MYSQL_USER -p$MYSQL_PASSWORD

echo 'Importing schema'
mysql -u$MYSQL_USER -p$MYSQL_PASSWORD $DATABASE_NAME < ./test/schema.sql

echo 'Setting permissions'
mysql -u$MYSQL_USER -p$MYSQL_PASSWORD -e "ALTER USER '$MYSQL_USER'@'localhost' IDENTIFIED WITH mysql_native_password BY '$MYSQL_PASSWORD';"
mysql -u$MYSQL_USER -p$MYSQL_PASSWORD -e "FLUSH PRIVILEGES;"
