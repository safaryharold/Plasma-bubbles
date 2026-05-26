#!/usr/bin/env bash
# MongoDB backup script — run via cron or CI schedule.
#
# Usage:
#   MONGODB_URI="mongodb://user:pass@host:27017/ibp" ./scripts/backup_mongodb.sh
#
# Env vars:
#   MONGODB_URI      — MongoDB connection string (required)
#   BACKUP_DIR       — Local output dir (default: ./backups)
#   S3_BUCKET        — If set, uploads the archive to this S3 bucket (optional)
#   RETENTION_DAYS   — Delete local backups older than N days (default: 14)

set -euo pipefail

MONGODB_URI="${MONGODB_URI:?MONGODB_URI must be set}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
ARCHIVE="${BACKUP_DIR}/ibp_mongo_${TIMESTAMP}.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date -u)] Starting MongoDB backup…"
mongodump \
  --uri="$MONGODB_URI" \
  --gzip \
  --archive="$ARCHIVE"

echo "[$(date -u)] Backup written: $ARCHIVE ($(du -sh "$ARCHIVE" | cut -f1))"

# Optional S3 upload
if [[ -n "${S3_BUCKET:-}" ]]; then
  aws s3 cp "$ARCHIVE" "s3://${S3_BUCKET}/mongodb-backups/$(basename "$ARCHIVE")" \
    --storage-class STANDARD_IA
  echo "[$(date -u)] Uploaded to s3://${S3_BUCKET}"
fi

# Prune old backups
find "$BACKUP_DIR" -name "ibp_mongo_*.gz" -mtime +"$RETENTION_DAYS" -delete
echo "[$(date -u)] Pruned backups older than ${RETENTION_DAYS} days."
echo "[$(date -u)] Done."
