import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const work = await mkdtemp(path.join(os.tmpdir(), 'ytds-pack-'));
const root = path.join(work, 'repo');
const out = path.join(work, 'dist');
await mkdir(path.join(root, 'scripts'), { recursive: true });
await writeFile(path.join(root, 'manifest.json'), JSON.stringify({
  manifest_version: 3,
  name: 'YT Dual Subs',
  version: '3.7.0',
  minimum_chrome_version: '111',
  permissions: ['storage', 'fontSettings'],
  background: { service_worker: 'background.js' },
  content_scripts: [
    { matches: ['https://www.youtube.com/*'], js: ['inject.js'], world: 'MAIN', run_at: 'document_start' },
    { matches: ['https://www.youtube.com/*'], js: ['vocab-levels.js', 'content.js', 'vocab-runtime.js'], run_at: 'document_idle' }
  ]
}, null, 2));
await writeFile(path.join(root, 'inject.js'), 'console.log("inject");\n');
await writeFile(path.join(root, 'vocab-levels.js'), 'self.YTDS_VOCAB = {};\n');
await writeFile(path.join(root, 'content.js'), 'console.log("content");\n');
await writeFile(path.join(root, 'vocab-runtime.js'), 'console.log("vocab runtime");\n');
await writeFile(path.join(root, 'background.js'), 'console.log("background");\n');
await writeFile(path.join(root, 'README.md'), 'dev only\n');

const script = path.resolve('scripts/build-browser-packages.mjs');
const result = spawnSync(process.execPath, [script, root, out], { encoding: 'utf8' });
assert.equal(result.status, 0, `packager failed:\n${result.stdout}\n${result.stderr}`);

const chromeManifest = JSON.parse(await readFile(path.join(out, 'chrome', 'manifest.json'), 'utf8'));
assert.equal(chromeManifest.minimum_chrome_version, '111');
assert.deepEqual(chromeManifest.permissions, ['storage', 'fontSettings']);
assert.ok(chromeManifest.content_scripts.some(s => Array.isArray(s.js) && s.js.includes('vocab-levels.js') && s.js.includes('vocab-runtime.js')));

const safariManifest = JSON.parse(await readFile(path.join(out, 'safari', 'manifest.json'), 'utf8'));
assert.equal(safariManifest.minimum_chrome_version, undefined);
assert.deepEqual(safariManifest.permissions, ['storage']);
assert.equal(safariManifest.browser_specific_settings.safari.strict_min_version, '18.0');
assert.equal(safariManifest.content_scripts[0].world, 'MAIN');
assert.ok(safariManifest.content_scripts.some(s => Array.isArray(s.js) && s.js.includes('vocab-levels.js') && s.js.includes('vocab-runtime.js')));

for (const browser of ['chrome', 'safari']) {
  await access(path.join(out, browser, 'inject.js'));
  await access(path.join(out, browser, 'vocab-levels.js'));
  await access(path.join(out, browser, 'vocab-runtime.js'));
}
let readmeMissing = false;
try { await access(path.join(out, 'chrome', 'README.md')); } catch { readmeMissing = true; }
assert.equal(readmeMissing, true, 'development docs must not ship in extension package');

console.log('PASS browser package generation');
