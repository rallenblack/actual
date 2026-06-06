#!/usr/bin/env node
/**
 * Idempotent budget bootstrapper: creates category groups, categories, and
 * auto-categorization rules defined in ./taxonomy.cjs against your
 * self-hosted Actual sync server.
 *
 * Run from the repo root:
 *
 *   # PowerShell
 *   $env:ACTUAL_PASSWORD="your-server-password"; node scripts/budget-setup/setup.cjs
 *
 *   # bash
 *   ACTUAL_PASSWORD='your-server-password' node scripts/budget-setup/setup.cjs
 *
 * Env vars:
 *   ACTUAL_PASSWORD     (required) your sync-server password
 *   ACTUAL_SERVER_URL   (default http://localhost:5006)
 *   ACTUAL_BUDGET_NAME  pick a budget by name if you have more than one
 *   ACTUAL_SYNC_ID      pick a budget by sync id (overrides name)
 *   ACTUAL_E2E_PASSWORD only if the budget file itself is end-to-end encrypted
 *
 * Safe to re-run: existing groups/categories (by name) and existing rules
 * (by the category they set) are detected and skipped. Run this BEFORE your
 * first SimpleFIN import so transactions get categorized on the way in.
 */
const path = require('path');
const fs = require('fs');
const { taxonomy } = require('./taxonomy.cjs');

let api;
try {
  api = require('@actual-app/api');
} catch {
  api = require(path.join(__dirname, '..', '..', 'packages', 'api', 'dist', 'index.js'));
}

const SERVER_URL = process.env.ACTUAL_SERVER_URL || 'http://localhost:5006';
const PASSWORD = process.env.ACTUAL_PASSWORD;
const BUDGET_NAME = process.env.ACTUAL_BUDGET_NAME;
const SYNC_ID = process.env.ACTUAL_SYNC_ID;
const E2E_PASSWORD = process.env.ACTUAL_E2E_PASSWORD;
const DATA_DIR = path.join(__dirname, 'data');

async function main() {
  if (!PASSWORD) {
    console.error('ERROR: set ACTUAL_PASSWORD to your sync-server password.');
    process.exit(1);
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });

  console.log(`Connecting to ${SERVER_URL} ...`);
  await api.init({ dataDir: DATA_DIR, serverURL: SERVER_URL, password: PASSWORD });

  const budgets = await api.getBudgets();
  if (!budgets || budgets.length === 0) {
    throw new Error('No budgets found on the server. Create one in the app first.');
  }

  let target;
  if (SYNC_ID) target = budgets.find(b => b.groupId === SYNC_ID);
  else if (BUDGET_NAME) target = budgets.find(b => b.name === BUDGET_NAME);
  else if (budgets.length === 1) target = budgets[0];

  if (!target) {
    console.error('Could not pick a budget. Set ACTUAL_BUDGET_NAME or ACTUAL_SYNC_ID. Available:');
    budgets.forEach(b => console.error(`  - "${b.name}"  syncId=${b.groupId}`));
    process.exit(1);
  }

  console.log(`Using budget "${target.name}" (syncId=${target.groupId})`);
  await api.downloadBudget(target.groupId, E2E_PASSWORD ? { password: E2E_PASSWORD } : {});

  // --- Categories & groups (idempotent by name) ---
  const existingGroups = await api.getCategoryGroups();
  const groupByName = new Map(existingGroups.map(g => [g.name, g]));
  const existingCats = await api.getCategories();
  const catByName = new Map(existingCats.map(c => [c.name, c]));

  let createdGroups = 0;
  let createdCats = 0;
  let createdRules = 0;
  let skippedRules = 0;

  for (const grp of taxonomy) {
    let groupId;
    const existing = groupByName.get(grp.group);
    if (existing) {
      groupId = existing.id;
    } else {
      groupId = await api.createCategoryGroup({ name: grp.group, is_income: !!grp.is_income });
      createdGroups++;
      console.log(`+ group: ${grp.group}`);
    }

    for (const cat of grp.categories) {
      const existingCat = catByName.get(cat.name);
      if (existingCat) {
        cat._id = existingCat.id;
      } else {
        cat._id = await api.createCategory({
          name: cat.name,
          group_id: groupId,
          is_income: !!grp.is_income,
        });
        catByName.set(cat.name, { id: cat._id, name: cat.name });
        createdCats++;
        console.log(`  + category: ${cat.name}`);
      }
    }
  }

  // --- Rules (idempotent: skip if a rule already sets this category) ---
  const existingRules = await api.getRules();
  const categoriesWithRule = new Set();
  for (const r of existingRules) {
    for (const a of r.actions || []) {
      if (a.op === 'set' && a.field === 'category') categoriesWithRule.add(a.value);
    }
  }

  for (const grp of taxonomy) {
    for (const cat of grp.categories) {
      if (!cat.match || cat.match.length === 0) continue;
      if (categoriesWithRule.has(cat._id)) {
        skippedRules++;
        continue;
      }
      await api.createRule({
        stage: 'pre',
        conditionsOp: 'or',
        conditions: cat.match.map(m => ({
          field: 'imported_payee',
          op: 'contains',
          value: m,
        })),
        actions: [{ field: 'category', op: 'set', value: cat._id }],
      });
      createdRules++;
      console.log(`  ~ rule -> ${cat.name} (${cat.match.length} patterns)`);
    }
  }

  await api.sync();
  await api.shutdown();

  console.log(
    `\nDone. Groups +${createdGroups}, Categories +${createdCats}, ` +
      `Rules +${createdRules} (skipped ${skippedRules} already present).`,
  );
}

main().catch(async err => {
  console.error('ERROR:', err && err.message ? err.message : err);
  try {
    await api.shutdown();
  } catch {}
  process.exit(1);
});
