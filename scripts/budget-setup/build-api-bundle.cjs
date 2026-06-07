#!/usr/bin/env node
/**
 * Bundles THIS fork's @actual-app/api into a single self-contained, Node-runnable
 * CommonJS file (_apibundle.cjs) so the budget setup script can talk to the sync
 * server using the exact same loot-core (and migrations) as the running app.
 *
 * Why this exists: loot-core is published as TypeScript source with platform
 * variants chosen by export conditions (electron/api/default) and extensionless
 * imports — plain Node can't run it, and the published npm @actual-app/api can be
 * a different migration version than your fork. Bundling with `conditions: ['api']`
 * picks the Node/API platform and inlines everything except native addons.
 *
 * Run from the repo root:  node scripts/budget-setup/build-api-bundle.cjs
 */
const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '..', '..');
const esbuild = require(path.join(repoRoot, 'node_modules', 'esbuild'));
const peggy = require(path.join(repoRoot, 'node_modules', 'peggy'));

// Compile .pegjs grammars to CommonJS (mirrors vite-plugin-peggy-loader).
const peggyPlugin = {
  name: 'peggy',
  setup(build) {
    build.onLoad({ filter: /\.pegjs$/ }, args => {
      const source = fs.readFileSync(args.path, 'utf8');
      const contents = peggy.generate(source, {
        output: 'source',
        format: 'commonjs',
      });
      return { contents, loader: 'js' };
    });
  },
};

esbuild
  .build({
    entryPoints: [path.join(repoRoot, 'packages/api/index.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    conditions: ['api'],
    // Native addons + heavy optional deps stay external (resolved at runtime
    // from the repo's node_modules, where they're already built).
    external: ['better-sqlite3', 'bcrypt', 'sharp', 'electron'],
    outfile: path.join(__dirname, '_apibundle.cjs'),
    plugins: [peggyPlugin],
    logLevel: 'warning',
  })
  .then(() => {
    // The api platform resolves migrationsPath/bundledDatabasePath relative to
    // __dirname (now this folder), so copy the runtime assets next to the bundle.
    const lootCore = path.join(repoRoot, 'packages', 'loot-core');
    fs.rmSync(path.join(__dirname, 'migrations'), { recursive: true, force: true });
    fs.cpSync(path.join(lootCore, 'migrations'), path.join(__dirname, 'migrations'), {
      recursive: true,
    });
    const seed = path.join(lootCore, 'default-db.sqlite');
    if (fs.existsSync(seed)) {
      fs.copyFileSync(seed, path.join(__dirname, 'default-db.sqlite'));
    }
    console.log('Built _apibundle.cjs and copied migrations/ + seed db');
  })
  .catch(e => {
    console.error('Bundle failed:', e.message);
    process.exit(1);
  });
