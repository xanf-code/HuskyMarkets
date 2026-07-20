#!/usr/bin/env bash
# W4: Rerunnable dry-run migration gate (S6-2 / S7-1).
#
# Restores a production dump to a local scratch database, applies pending
# migrations (0010–0013), runs verify_ledger_invariant(), then runs the full
# post-migration reconciliation against ops/pre-migration-snapshot.json.
# Exits non-zero on any failure so this can be used as a pre-push gate.
#
# Usage:
#   ./scripts/dry-run-migration.sh <dump.sql.gz>
#   ./scripts/dry-run-migration.sh <dump.sql>
#
# Prerequisites:
#   - Supabase CLI installed (https://supabase.com/docs/guides/cli)
#   - psql and createdb available in PATH
#   - .env.local or shell environment with NEXT_PUBLIC_SUPABASE_URL and
#     SUPABASE_SERVICE_ROLE_KEY pointing at the LOCAL stack after start
#   - ops/pre-migration-snapshot.json captured from the target production
#     environment (run scripts/pre-migration-snapshot.ts first)
#
# What it does:
#   1. Starts the local Supabase stack  (supabase start)
#   2. Wipes and restores the prod dump into the local Postgres
#   3. Applies migrations 0010–0013 via supabase db push --local
#   4. Verifies ledger invariant via verify_ledger_invariant() RPC
#   5. Runs post-migration-reconciliation.ts against the local stack
#   6. Stops the local stack and exits with the combined pass/fail code

set -euo pipefail

DUMP="${1:?Usage: $0 <dump.sql[.gz]>}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SNAPSHOT="$REPO_ROOT/ops/pre-migration-snapshot.json"

# ── Pre-flight checks ────────────────────────────────────────────────────────

if [[ ! -f "$DUMP" ]]; then
  echo "ERROR: dump file not found: $DUMP" >&2
  exit 1
fi

if [[ ! -f "$SNAPSHOT" ]]; then
  echo "ERROR: ops/pre-migration-snapshot.json not found." >&2
  echo "       Run 'npx tsx --env-file=.env.local scripts/pre-migration-snapshot.ts'" >&2
  echo "       against the target environment first." >&2
  exit 1
fi

command -v supabase >/dev/null 2>&1 || {
  echo "ERROR: supabase CLI not found in PATH." >&2
  exit 1
}
command -v psql >/dev/null 2>&1 || {
  echo "ERROR: psql not found in PATH." >&2
  exit 1
}

# ── 1. Start local Supabase stack ───────────────────────────────────────────

echo ""
echo "=== 1. Starting local Supabase stack ==="
cd "$REPO_ROOT"
supabase start

# Supabase CLI local stack always exposes Postgres on port 54322 with these
# default credentials. Adjust if your config differs.
LOCAL_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
LOCAL_API_URL="http://127.0.0.1:54321"

# Extract the service_role key from supabase status.
LOCAL_SERVICE_KEY=$(supabase status 2>/dev/null \
  | grep -E 'service_role key|service_role:' \
  | awk '{print $NF}')

if [[ -z "$LOCAL_SERVICE_KEY" ]]; then
  echo "ERROR: could not read service_role key from 'supabase status'" >&2
  supabase stop
  exit 1
fi

# ── 2. Restore production dump ───────────────────────────────────────────────

echo ""
echo "=== 2. Restoring production dump: $DUMP ==="

# Drop all public tables so the restored dump starts clean without conflicting
# with any baseline migrations that supabase start may have applied.
psql "$LOCAL_DB_URL" -c "
  DO \$\$
  DECLARE r record;
  BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
      EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
  END \$\$;
" > /dev/null

if [[ "$DUMP" == *.gz ]]; then
  gunzip -c "$DUMP" | psql "$LOCAL_DB_URL" > /dev/null
else
  psql "$LOCAL_DB_URL" < "$DUMP" > /dev/null
fi
echo "Dump restored."

# ── 3. Apply pending migrations 0010–0013 ───────────────────────────────────

echo ""
echo "=== 3. Applying pending migrations ==="
supabase db push --local
echo "Migrations applied."

# ── 4. Verify ledger invariant ───────────────────────────────────────────────

echo ""
echo "=== 4. Verifying ledger invariant ==="
INVARIANT=$(psql "$LOCAL_DB_URL" --no-psqlrc -t -A \
  -c "SELECT public.verify_ledger_invariant();")
BALANCED=$(echo "$INVARIANT" | python3 -c \
  "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('balanced','false'))" \
  2>/dev/null || echo "false")

if [[ "$BALANCED" != "True" && "$BALANCED" != "true" ]]; then
  echo "FAIL: verify_ledger_invariant() returned balanced=false" >&2
  echo "$INVARIANT" >&2
  supabase stop
  exit 1
fi
echo "verify_ledger_invariant: balanced=true ✓"

# ── 5. Post-migration reconciliation ────────────────────────────────────────

echo ""
echo "=== 5. Running post-migration reconciliation ==="
# The reconciliation script calls RPCs — never raw SQL — so it is safe to run
# against the local stack's PostgREST endpoint (W4 / REC-17).
NEXT_PUBLIC_SUPABASE_URL="$LOCAL_API_URL" \
  SUPABASE_SERVICE_ROLE_KEY="$LOCAL_SERVICE_KEY" \
  npx tsx --env-file=/dev/null \
  "$REPO_ROOT/scripts/post-migration-reconciliation.ts"

# ── 6. Cleanup ───────────────────────────────────────────────────────────────

echo ""
echo "=== 6. Stopping local stack ==="
supabase stop

echo ""
echo "=== Dry-run PASSED — migration is safe to push ==="
