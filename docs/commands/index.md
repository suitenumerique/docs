# Index Command

The `index` management command is used to index documents to the remote search indexer.

It sends an asynchronous task to the Celery worker.

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
  --async_mode
```

### Django Admin

The command is available in the Django admin interface:

1. Go to `/admin/core/run-indexing/`, you arrive at the "Run Indexing Command" page
3. Fill in the form with the desired parameters
4. Click **"Run Indexing Command"**

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

## `--async_mode`
- **type:** Boolean flag
- **default:** `False`
- **description:** Runs asynchronously is async_mode==True. 

## Crash Safe Mode

The command saves the updated.at of the last document of each successful batch into the `bulk-indexer-checkpoint` cache variable.
If the process crashes, this value can be used as `lower-time-bound` to resume from the last successfully indexed document.
