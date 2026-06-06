# Budget setup script

Bootstraps your household budget with a sensible **category structure** and
**auto-categorization rules**, via the `@actual-app/api` package talking to your
self-hosted sync server.

## What it does

- Creates category groups + categories from [`taxonomy.cjs`](./taxonomy.cjs)
- Creates one auto-categorization rule per category, matching the bank's
  *imported payee* text against the `match` lists (case-insensitive `contains`)
- Is **idempotent** — re-run any time after editing `taxonomy.cjs`

## Run it

1. Make sure the **sync server is running** (`yarn start:server`, port 5006) and
   you've created your budget in the app.
2. Personalize [`taxonomy.cjs`](./taxonomy.cjs) (rename categories, fix the
   merchant lists for your actual banks).
3. From the **repo root**, with your sync-server password:

   ```powershell
   # PowerShell
   $env:ACTUAL_PASSWORD = "your-server-password"
   node scripts/budget-setup/setup.cjs
   ```

   ```bash
   # bash
   ACTUAL_PASSWORD='your-server-password' node scripts/budget-setup/setup.cjs
   ```

   If you have more than one budget, the script lists them — re-run with
   `ACTUAL_BUDGET_NAME="Household"` (or `ACTUAL_SYNC_ID=...`).

> Run this **before** your first SimpleFIN import so transactions get
> categorized on the way in. Rules also apply on every future import; to
> recategorize transactions already imported, select them in the app and choose
> **"Apply rules"** (or just re-run a bank sync).

## Notes

- The script writes a local working copy of the budget to `./data/` (gitignored).
- `WALMART`/`COSTCO` default to **Groceries**, `TARGET` to **Shopping** — adjust
  in `taxonomy.cjs` if your spending differs.
- Venmo / Fidelity / Zillow aren't bank-synced; their categories are here for
  manual entry.
