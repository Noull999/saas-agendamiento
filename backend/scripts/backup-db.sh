#!/bin/bash
# Daily PostgreSQL backup script
# Usage: DATABASE_URL=postgres://... ./backup-db.sh
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_${TIMESTAMP}.sql.gz"

echo "[backup] Starting backup: $BACKUP_FILE"
pg_dump "$DATABASE_URL" | gzip > "/tmp/$BACKUP_FILE"
echo "[backup] Backup created: $(du -sh /tmp/$BACKUP_FILE | cut -f1)"
echo "[backup] Completed: $BACKUP_FILE"
