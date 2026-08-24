#!/usr/bin/env node
/**
 * Points .env.local at a Firebase project by swapping in its service account.
 *
 * Risk F-8: .env.local shipped with the PRODUCTION service account, so running
 * the app locally read and wrote the live database. This makes switching a
 * deliberate, reversible step instead of a manual base64 paste.
 *
 *   node scripts/use-firebase-key.mjs ~/Downloads/fanta-fpl-dev-....json
 *   node scripts/use-firebase-key.mjs --restore
 *
 * The previous value is kept in .env.local.<project_id>.bak, so switching back
 * to production is the same command with that key.
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';

const ENV = '.env.local';
const arg = process.argv[2];

if (!arg) {
  console.error('Usage: node scripts/use-firebase-key.mjs <service-account.json>');
  process.exit(1);
}
if (!existsSync(ENV)) {
  console.error(`${ENV} not found — run this from the project root.`);
  process.exit(1);
}

function currentProject(text) {
  const m = text.match(/^FIREBASE_SERVICE_ACCOUNT=(.*)$/m);
  if (!m) return null;
  const raw = m[1].trim();
  try {
    const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    return JSON.parse(json).project_id ?? null;
  } catch {
    return null;
  }
}

let text = readFileSync(ENV, 'utf8');
const from = currentProject(text);

if (arg === '--restore') {
  const bak = `${ENV}.production.bak`;
  if (!existsSync(bak)) {
    console.error(`No ${bak} to restore from.`);
    process.exit(1);
  }
  copyFileSync(bak, ENV);
  console.log(`Restored ${ENV} from ${bak} (was pointing at ${from}).`);
  process.exit(0);
}

const key = JSON.parse(readFileSync(arg, 'utf8'));
const to = key.project_id;
if (!to) {
  console.error('That file has no project_id — is it a service account key?');
  process.exit(1);
}
if (!key.private_key || !key.client_email) {
  console.error('That file is missing private_key or client_email.');
  process.exit(1);
}

// Keep one backup of whatever production looked like, written once so a second
// switch cannot overwrite the good copy with a dev one.
const bak = `${ENV}.production.bak`;
if (!existsSync(bak) && from) {
  copyFileSync(ENV, bak);
  console.log(`Backed up current config (${from}) to ${bak}`);
}

const b64 = Buffer.from(JSON.stringify(key)).toString('base64');
text = text.replace(/^FIREBASE_SERVICE_ACCOUNT=.*$/m, `FIREBASE_SERVICE_ACCOUNT=${b64}`);

// The analyst features stay off unless explicitly enabled. Turning them on is
// safe here precisely because this is no longer the production database.
if (!/^ANALYST_ENABLED=/m.test(text)) {
  text += `${text.endsWith('\n') ? '' : '\n'}ANALYST_ENABLED=true\n`;
} else {
  text = text.replace(/^ANALYST_ENABLED=.*$/m, 'ANALYST_ENABLED=true');
}

writeFileSync(ENV, text);
console.log(`${ENV}: ${from ?? '(unset)'} -> ${to}`);
console.log('ANALYST_ENABLED=true');
if (to.endsWith('-dev')) console.log('\nThis is a dev project. Writes here cannot touch production data.');
else console.log(`\nWARNING: "${to}" does not look like a dev project. Check before writing.`);
