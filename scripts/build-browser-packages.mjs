import { cp, mkdir, readFile, rm, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] || process.cwd());
const out = path.resolve(process.argv[3] || path.join(root, 'dist'));
const chromeDir = path.join(out, 'chrome');
const safariDir = path.join(out, 'safari');

const DROP_TOP_LEVEL = new Set([
  '.git', '.github', 'docs', 'tests', 'scripts', 'dist', 'node_modules'
]);
const DROP_FILES = [/^README(?:\..+)?\.md$/i, /^LICENSE$/i, /^PRIVACY\.md$/i];

function shouldCopy(name) {
  if (DROP_TOP_LEVEL.has(name)) return false;
  return !DROP_FILES.some((re) => re.test(name));
}

async function copyExtensionTree(target) {
  await mkdir(target, { recursive: true });
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!shouldCopy(entry.name)) continue;
    const from = path.join(root, entry.name);
    const to = path.join(target, entry.name);
    await cp(from, to, { recursive: true, force: true });
  }
}

await rm(out, { recursive: true, force: true });
await copyExtensionTree(chromeDir);
await copyExtensionTree(safariDir);

const sourceManifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
const safariManifest = structuredClone(sourceManifest);

delete safariManifest.minimum_chrome_version;
if (Array.isArray(safariManifest.permissions)) {
  safariManifest.permissions = safariManifest.permissions.filter((p) => p !== 'fontSettings');
}
safariManifest.browser_specific_settings = {
  ...(safariManifest.browser_specific_settings || {}),
  safari: {
    ...((safariManifest.browser_specific_settings || {}).safari || {}),
    strict_min_version: '18.0'
  }
};

await writeFile(
  path.join(safariDir, 'manifest.json'),
  JSON.stringify(safariManifest, null, 2) + '\n',
  'utf8'
);

console.log(`Chrome package: ${chromeDir}`);
console.log(`Safari package: ${safariDir}`);
