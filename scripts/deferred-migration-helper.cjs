#!/usr/bin/env node
/**
 * Deferred-migration ops helper
 *
 * Walks an operator through the pre-conditions and (optional) safe
 * promotion of a migrations-deferred/*.sql file into migrations/.
 *
 * The deferred files in this repo are intentionally NOT picked up by
 * the production runner (scripts/run-migration.cjs only globs
 * migrations/*.sql) because they're destructive / one-way / depend on
 * a soak window. Each file's header comment lists pre-conditions; this
 * script automates the verification queries against a live DATABASE_URL
 * so the operator doesn't have to copy-paste them.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/deferred-migration-helper.cjs check 0014
 *   DATABASE_URL=postgres://... node scripts/deferred-migration-helper.cjs check 0015
 *   DATABASE_URL=postgres://... node scripts/deferred-migration-helper.cjs check all
 *
 *   # When all checks pass and you're ready to promote (does NOT apply
 *   # the migration; just moves the file from deferred/ to migrations/):
 *   node scripts/deferred-migration-helper.cjs promote 0015
 *
 * Promotion is a manual `git mv` step. The script prints the exact
 * command but does not execute it — operator must run it, review the
 * diff, and ship via PR.
 *
 * IMPORTANT: this script READS but never WRITES to the database. It
 * cannot accidentally apply a destructive migration.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Each deferred migration registers its pre-condition query here.
// Adding a new deferred migration: add a key. The check command runs
// the query and reports pass/fail; the file's own header comment
// remains the source of truth for what to do on failure.
const PRECHECKS = {
  '0014': {
    label: '0014_drop_team_members.sql — LU-DD-3 / AUD-DD-TEAM-001',
    description:
      'Refuses to drop team_members if any rows are not mirrored to ' +
      'company_members. Run during the parallel-write soak window.',
    query: `
      SELECT count(*) AS unmatched_rows
      FROM team_members tm
      WHERE NOT EXISTS (
        SELECT 1 FROM company_members cm
        WHERE cm.company_id = tm.company_id
          AND LOWER(cm.email) = LOWER(tm.email)
      );
    `,
    pass: (row) => Number(row.unmatched_rows) === 0,
    explainPass: 'All team_members rows are mirrored to company_members. Safe to drop.',
    explainFail: (row) =>
      `Found ${row.unmatched_rows} team_members rows NOT in company_members. ` +
      'Investigate via: SELECT * FROM team_members tm WHERE NOT EXISTS ' +
      '(SELECT 1 FROM company_members cm WHERE cm.company_id=tm.company_id AND LOWER(cm.email)=LOWER(tm.email)); ' +
      'Then either backfill (see migration 0013) or accept the loss after Innoedge legal review.',
  },
  '0015': {
    label: '0015_payouts_companyid_not_null.sql — AUD-DB-008',
    description:
      'Refuses to apply NOT NULL on payouts.company_id if any rows still ' +
      'have NULL. Hand-resolve those rows first (backfill or delete).',
    query: `
      SELECT count(*) AS orphan_count FROM payouts WHERE company_id IS NULL;
    `,
    pass: (row) => Number(row.orphan_count) === 0,
    explainPass: '0 orphan rows with NULL company_id. Safe to apply NOT NULL.',
    explainFail: (row) =>
      `Found ${row.orphan_count} payouts rows with NULL company_id. ` +
      'For each row: trace audit_logs(entityType=\'payout\', entityId=<id>) and ' +
      'the payout.initiated_by Cognito sub to find the intended company. Then either ' +
      'UPDATE payouts SET company_id = \'<X>\' WHERE id = \'<id>\' (if recoverable) or ' +
      'DELETE FROM payouts WHERE id = \'<id>\' (if it was queue-poisoning artefact never ' +
      'processed). See migration header for details.',
  },
};

function printBanner() {
  console.log('');
  console.log('Deferred-migration ops helper');
  console.log('==============================');
  console.log('');
}

function printUsage() {
  console.log('Usage:');
  console.log('  DATABASE_URL=postgres://... node scripts/deferred-migration-helper.cjs check <0014|0015|all>');
  console.log('  node scripts/deferred-migration-helper.cjs promote <0014|0015>');
  console.log('  node scripts/deferred-migration-helper.cjs list');
  console.log('');
  console.log('Commands:');
  console.log('  check <id>    Run the pre-condition query for a deferred migration.');
  console.log('  check all     Run pre-condition queries for every registered migration.');
  console.log('  promote <id>  Print the git-mv command to promote the file (does NOT execute).');
  console.log('  list          List the deferred migrations this script knows about.');
  console.log('');
}

async function runCheck(id) {
  const spec = PRECHECKS[id];
  if (!spec) {
    console.error(`Unknown deferred migration id "${id}". Try: list`);
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL env var required for `check`. Example:');
    console.error('  DATABASE_URL=postgres://user:pass@host:5432/db node scripts/deferred-migration-helper.cjs check ' + id);
    process.exit(1);
  }

  console.log(`Checking ${spec.label}...`);
  console.log(`  ${spec.description}`);
  console.log('');

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query(spec.query);
    const row = result.rows[0] || {};
    if (spec.pass(row)) {
      console.log('  PASS — ' + spec.explainPass);
      console.log('');
      console.log(`  Next: node scripts/deferred-migration-helper.cjs promote ${id}`);
      return true;
    } else {
      console.log('  FAIL — ' + spec.explainFail(row));
      console.log('');
      console.log('  Do NOT promote yet. Resolve the precondition and re-check.');
      return false;
    }
  } finally {
    await client.end();
  }
}

function runPromote(id) {
  const spec = PRECHECKS[id];
  if (!spec) {
    console.error(`Unknown deferred migration id "${id}". Try: list`);
    process.exit(1);
  }

  const fileName = `${id}_${spec.label.split(' — ')[0].replace(`${id}_`, '').replace('.sql', '')}.sql`;
  // Safer: just look up the actual filename in migrations-deferred/.
  const deferredDir = path.join(__dirname, '..', 'migrations-deferred');
  const matches = fs.readdirSync(deferredDir).filter((f) => f.startsWith(`${id}_`) && f.endsWith('.sql'));
  if (matches.length !== 1) {
    console.error(`Expected exactly one file in migrations-deferred/ matching ${id}_*.sql, found ${matches.length}.`);
    process.exit(1);
  }
  const file = matches[0];

  console.log('Pre-flight checklist:');
  console.log('  [ ] Pre-condition check passed (re-run `check ' + id + '` if unsure)');
  console.log('  [ ] Production RDS snapshot taken');
  console.log('  [ ] Deploy window scheduled with on-call coverage');
  console.log('  [ ] Rollback plan rehearsed (see migration file header)');
  console.log('');
  console.log('When all four boxes are ticked, run:');
  console.log('');
  console.log(`  git mv migrations-deferred/${file} migrations/${file}`);
  console.log(`  git commit -m "ops: promote ${file} (post-soak)"`);
  console.log(`  git push`);
  console.log('  # Open PR; merge after approval');
  console.log('');
  console.log('The migration runner will pick up the file at the next ECS startup.');
  console.log('Watch CloudWatch for at least 30 minutes after the deploy completes.');
}

function runList() {
  console.log('Registered deferred migrations:');
  console.log('');
  for (const [id, spec] of Object.entries(PRECHECKS)) {
    console.log(`  ${id} — ${spec.label}`);
    console.log(`    ${spec.description}`);
    console.log('');
  }
  console.log('Files in migrations-deferred/ that don\'t appear above need a');
  console.log('PRECHECKS entry added before they can be promoted via this script.');
}

async function main() {
  const [, , command, arg] = process.argv;
  printBanner();

  if (!command) {
    printUsage();
    process.exit(0);
  }

  if (command === 'list') {
    runList();
    return;
  }

  if (command === 'promote') {
    if (!arg) {
      console.error('promote requires a migration id (eg. 0015).');
      process.exit(1);
    }
    runPromote(arg);
    return;
  }

  if (command === 'check') {
    if (!arg) {
      console.error('check requires a migration id or "all".');
      process.exit(1);
    }
    if (arg === 'all') {
      let allPassed = true;
      for (const id of Object.keys(PRECHECKS)) {
        const passed = await runCheck(id);
        if (!passed) allPassed = false;
        console.log('');
      }
      process.exit(allPassed ? 0 : 1);
    } else {
      const passed = await runCheck(arg);
      process.exit(passed ? 0 : 1);
    }
    return;
  }

  console.error(`Unknown command "${command}".`);
  printUsage();
  process.exit(1);
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
