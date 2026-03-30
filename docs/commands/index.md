# Index Command

The `index` management command is used to index documents to the remote search indexer.

## Usage

### Make Command

```bash
# Basic usage with defaults
make index

# With custom parameters
make index args="--batch-size 100 --lower-time-bound 2024-01-01T00:00:00 --upper-time-bound 2026-01-01T00:00:00"

```

### Command line

```bash
python manage.py index \
  --lower-time-bound "2024-01-01T00:00:00" \
  --upper-time-bound "2024-01-31T23:59:59" \
  --batch-size 200 \
  --async
```

### Django Admin

The command is available in the Django admin interface:

1. Go to `/admin/run-indexing/`, you arrive at the "Run Indexing Command" page
2. Fill in the form with the desired parameters
3. Click **"Run Indexing Command"**

## Parameters

### `--batch-size`
- **type:** Integer
- **default:** `settings.SEARCH_INDEXER_BATCH_SIZE`
- **description:** Number of documents to process per batch. Higher values may improve performance but use more memory.

### `--lower-time-bound`
- **optional**: true
- **type:** ISO 8601 datetime string
- **default:** `None`
- **description:** Only documents updated after this date will be indexed.

### `--upper-time-bound`
- **optional**: true
- **type:** ISO 8601 datetime string
- **default:** `None`
- **description:** Only documents updated before this date will be indexed.

### `--async`
- **type:** Boolean flag
- **default:** `False`
+- **description:** When set, dispatches the indexing job to a Celery worker instead of running it synchronously.

## Crash Safe Mode

The command saves the `updated_at` of the last document of each successful batch into the `bulk-indexer-checkpoint` cache variable.
If the process crashes, this value can be used as `lower-time-bound` to resume from the last successfully indexed document.
