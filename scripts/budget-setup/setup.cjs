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

  // After a first run the budget exists both locally and remotely, so
  // getBudgets() returns it twice with the same groupId — collapse duplicates.
  const uniqueBudgets = [];
  const seenSync = new Set();
  for (const b of budgets) {
    const key = b.groupId || b.cloudFileId || b.id;
    if (!seenSync.has(key)) {
      seenSync.add(key);
      uniqueBudgets.push(b);
    }
  }

  let target;
  if (SYNC_ID) target = uniqueBudgets.find(b => b.groupId === SYNC_ID);
  else if (BUDGET_NAME) target = uniqueBudgets.find(b => b.name === BUDGET_NAME);
  else if (uniqueBudgets.length === 1) target = uniqueBudgets[0];

  if (!target) {
    console.error('Could not pick a budget. Set ACTUAL_BUDGET_NAME or ACTUAL_SYNC_ID. Available:');
    uniqueBudgets.forEach(b => console.error(`  - "${b.name}"  syncId=${b.groupId}`));
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

  // --- Rules (upsert: refresh our managed rule for each category so edits to
  // taxonomy.cjs take effect on re-run). A rule is "ours" if its single action
  // sets exactly this category; your hand-made rules are left untouched. ---
  let updatedRules = 0;
  const existingRules = await api.getRules();
  const ruleForCategory = new Map();
  for (const r of existingRules) {
    const sets = (r.actions || []).filter(a => a.op === 'set' && a.field === 'category');
    if (r.actions && r.actions.length === 1 && sets.length === 1) {
      if (!ruleForCategory.has(sets[0].value)) ruleForCategory.set(sets[0].value, r);
    }
  }

  for (const grp of taxonomy) {
    for (const cat of grp.categories) {
      if (!cat.match || cat.match.length === 0) continue;
      const conditions = cat.match.map(m => ({
        field: 'imported_payee',
        op: 'contains',
        value: m,
      }));
      const actions = [{ field: 'category', op: 'set', value: cat._id }];
      const existing = ruleForCategory.get(cat._id);
      if (existing) {
        const before = JSON.stringify(existing.conditions);
        if (before === JSON.stringify(conditions)) {
          skippedRules++;
        } else {
          await api.updateRule({ ...existing, stage: existing.stage ?? 'pre', conditionsOp: 'or', conditions, actions });
          updatedRules++;
          console.log(`  ~ rule updated -> ${cat.name} (${cat.match.length} patterns)`);
        }
      } else {
        await api.createRule({ stage: 'pre', conditionsOp: 'or', conditions, actions });
        createdRules++;
        console.log(`  ~ rule created -> ${cat.name} (${cat.match.length} patterns)`);
      }
    }
  }

  console.log(
    `\nCategories: groups +${createdGroups}, categories +${createdCats}, ` +
      `rules +${createdRules} created, ${updatedRules} updated, ${skippedRules} unchanged.`,
  );

  // --- Retroactively categorize already-imported transactions ---
  // Rules auto-run on FUTURE imports; this pass handles transactions that were
  // imported before the rules existed. Longest matching pattern wins (so
  // "COSTCO GAS" -> Fuel beats "COSTCO" -> Groceries). Only fills in
  // transactions that have NO category yet; never overrides your choices.
  if (process.env.APPLY_EXISTING !== '0') {
    const matchers = [];
    for (const grp of taxonomy) {
      for (const cat of grp.categories) {
        for (const m of cat.match || []) {
          matchers.push({ pat: m.toLowerCase(), len: m.length, catId: cat._id, catName: cat.name });
        }
      }
    }
    matchers.sort((a, b) => b.len - a.len);

    const payees = await api.getPayees();
    const payeeName = new Map(payees.map(p => [p.id, p.name]));
    const accounts = await api.getAccounts();
    const today = new Date().toISOString().slice(0, 10);

    let scanned = 0;
    let matched = 0;
    const unmatched = new Map(); // text -> count

    for (const acct of accounts) {
      const txns = await api.getTransactions(acct.id, '2000-01-01', today);
      for (const t of txns) {
        if (t.category) continue;          // already categorized — leave it
        if (t.transfer_id) continue;       // transfers aren't spending
        if (t.is_parent) continue;         // split parent; children handled individually
        const raw = t.imported_payee || payeeName.get(t.payee) || '';
        if (!raw) continue;
        scanned++;
        const text = raw.toLowerCase();
        const hit = matchers.find(m => text.includes(m.pat));
        if (hit) {
          await api.updateTransaction(t.id, { category: hit.catId });
          matched++;
        } else {
          unmatched.set(raw, (unmatched.get(raw) || 0) + 1);
        }
      }
    }

    console.log(`\nRetroactive: categorized ${matched} of ${scanned} uncategorized transactions.`);
    if (unmatched.size) {
      const top = [...unmatched.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
      console.log(`\nTop ${top.length} UNMATCHED payee texts (tune taxonomy.cjs to cover these):`);
      for (const [text, n] of top) console.log(`  ${String(n).padStart(3)}x  ${text}`);
    }
  }

  await api.sync();
  await api.shutdown();
  console.log('\nDone. Synced to server.');
}

main().catch(async err => {
  console.error('ERROR:', err && err.message ? err.message : err);
  try {
    await api.shutdown();
  } catch {}
  process.exit(1);
});
