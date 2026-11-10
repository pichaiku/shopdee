FROM mysql:9.7

# Scripts in this folder run automatically the first time the container
# starts with an empty data directory (empty mysql_data volume)
COPY schema.sql /docker-entrypoint-initdb.d/schema.sql

# Map DB_PASSWORD / DB_NAME (from mysql/.env) to the variables the official
# MySQL image expects, then hand off to the original entrypoint.
ENTRYPOINT ["sh", "-c", ": \"${MYSQL_ROOT_PASSWORD:=$DB_PASSWORD}\" \"${MYSQL_DATABASE:=$DB_NAME}\"; export MYSQL_ROOT_PASSWORD MYSQL_DATABASE; exec docker-entrypoint.sh \"$@\"", "--"]
CMD ["mysqld"]

EXPOSE 3306
