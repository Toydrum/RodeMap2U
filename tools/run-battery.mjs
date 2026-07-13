// The honest battery runner (B6, 0.0.77) — encodes the BATTERY LAW:
//   a script FAILS if its exit code is non-zero OR its FULL output greps
//   OK=false / PAGEERROR / Error:  (never grep only the tail — a crashed
//   probe ends with an error-object dump whose last lines match nothing).
// It also refuses to run against a server without the SPA fallback
// (deep page.goto dies there and the wreckage can read as green).
//
//   node tools/run-battery.mjs              # every tools/verify-*.mjs
//   node tools/run-battery.mjs undo perch   # just these
//
// Exit code: 0 all green, 1 any failure. Logs land in tools/battery-logs/
// (gitignored) — one <script>.log per probe, full output.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:' + (process.env.RM_PORT ?? '8826');
const logDir = path.join(toolsDir, 'battery-logs');
fs.mkdirSync(logDir, { recursive: true });

// Server preflight: a DEEP route must answer 200 (SPA fallback present).
try {
  const res = await fetch(`${BASE}/check-in`);
  if (!res.ok) throw new Error(`status ${res.status}`);
} catch (err) {
  console.error(`BATTERY ABORTED — ${BASE}/check-in unreachable (${err.message}).`);
  console.error('Start the server WITH the SPA fallback:');
  console.error('  npx http-server dist/roadmap2u/browser -p 8826 -s -P "http://localhost:8826?"');
  process.exit(2);
}

const picked = process.argv.slice(2);
const scripts = (
  picked.length
    ? picked.map((s) => `verify-${s.replace(/^verify-|\.mjs$/g, '')}.mjs`)
    : fs.readdirSync(toolsDir).filter((f) => f.startsWith('verify-') && f.endsWith('.mjs')).sort()
);

const RED = /OK=false|PAGEERROR|Error:/;
let failures = 0;
const t0 = Date.now();
for (const script of scripts) {
  const started = Date.now();
  const run = spawnSync(process.execPath, [path.join(toolsDir, script)], {
    encoding: 'utf8',
    timeout: 240_000,
  });
  const output = (run.stdout ?? '') + (run.stderr ?? '');
  fs.writeFileSync(path.join(logDir, script.replace(/^verify-|\.mjs$/g, '') + '.log'), output);
  const timedOut = run.error?.code === 'ETIMEDOUT';
  const bad = timedOut || run.status !== 0 || RED.test(output);
  const secs = ((Date.now() - started) / 1000).toFixed(0);
  if (bad) {
    failures++;
    const why = timedOut ? 'TIMEOUT' : run.status !== 0 ? `exit=${run.status}` : 'red output';
    console.log(`FAIL  ${script} (${why}, ${secs}s)`);
    for (const line of output.split('\n').filter((l) => RED.test(l)).slice(0, 3)) {
      console.log(`      ${line.trim().slice(0, 140)}`);
    }
  } else {
    console.log(`ok    ${script} (${secs}s)`);
  }
}

const mins = ((Date.now() - t0) / 60000).toFixed(1);
console.log(`\nBATTERY ${failures ? `FAILED — ${failures} red` : 'GREEN'} (${scripts.length} scripts, ${mins} min)`);
process.exit(failures ? 1 : 0);
