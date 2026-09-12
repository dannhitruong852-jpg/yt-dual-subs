const assert = require('assert');
const fs = require('fs');
const V = require('../vocab-levels.js');

// Keep the marker parser covered: it will be reused when Chinese alignment is
// moved into the normal translation pipeline rather than a second request.
assert.deepStrictEqual(
  V.parseMarkedTranslation('该政策可能⟦v0⟧加剧⟦/v0⟧⟦v1⟧不平等⟦/v1⟧。'),
  { text: '该政策可能加剧不平等。', spans: [
    { id: 'v0', start: 5, end: 7 },
    { id: 'v1', start: 7, end: 10 }
  ] }
);
const reordered = V.parseMarkedTranslation('先⟦v1⟧结果⟦/v1⟧再⟦v0⟧原因⟦/v0⟧');
assert.deepStrictEqual(reordered.spans.map(x => x.id), ['v1', 'v0']);
assert.strictEqual(V.parseMarkedTranslation('⟦v0⟧甲⟦/v0⟧⟦v0⟧乙⟦/v0⟧'), null);
assert.strictEqual(V.parseMarkedTranslation('⟦v0⟧甲'), null);
assert.strictEqual(V.parseMarkedTranslation('甲⟦/v0⟧'), null);
assert.ok(!V.parseMarkedTranslation('⟦v0⟧甲⟦/v0⟧').text.includes('⟦'));

const runtime = fs.readFileSync('vocab-runtime.js', 'utf8');

// Stabilization contract: the presentation layer owns the English line only.
// It must not issue translation requests or observe/rewrite the Chinese line.
assert.doesNotMatch(runtime, /chrome\.runtime\.sendMessage\(\{\s*type:\s*["']translate["']/);
assert.doesNotMatch(runtime, /querySelector\(["']\.ytds-trans["']\)/);
assert.doesNotMatch(runtime, /observe\(t,/);

// Its own DOM write must be idempotent, otherwise MutationObserver can feed
// replaceChildren() back into itself until the YouTube tab freezes/crashes.
assert.match(runtime, /alreadyRendered/);
assert.match(runtime, /if \(!alreadyRendered\) renderRanges/);
assert.match(runtime, /if \(!enabled\) \{ restorePlain\(\); return; \}/);

console.log('PASS vocabulary alignment safety');
