# User account reconciliation

It is possible to merge user accounts based on their email addresses.

Docs does not have an internal process to requests, but it allows the import of a CSV from an external form
(e.g. made with Grist) in the Django admin panel (in "Core" > "User reconciliation CSV imports" > "Add user reconciliation")

The CSV must contain the following mandatory columns:

- `active_email`: the email of the user that will remain active after the process.
- `inactive_email`: the email of the user(s) that will be merged into the active user. It is possible to indicate several emails, so the user only has to make one request even if they have more than two accounts.
- `id`: a unique row id, so that entries already processed in a previous import are ignored.

The following columns are optional: `active_email_checked` and `inactive_email_checked` (both must contain `0` (False) or `1` (True), and both default to False.)
If present, it allows to indicate that the source form has a way to validate that the user making the request actually controls the email addresses, skipping the need to send confirmation emails (cf. below)

Once the CSV file is processed, this will create entries in "Core" > "User reconciliations" and send verification emails to validate that the user making the request actually controls the email addresses (unless `active_email_checked` and `inactive_email_checked` were set to `1` in the CSV)

In "Core" > "User reconciliations", an admin can then select all rows they wish to process and check the action "Process selected user reconciliations". Only rows that have the status `ready` and for which both emails have been validated will be processed.
