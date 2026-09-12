const assert = require('assert');
const fs = require('fs');
const V = require('../vocab-levels.js');

// Marker parsing stays covered for backwards compatibility while the final
// color architecture uses local Chinese candidate matching instead of a second
// translation request.
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

// Final safety contract: the vocabulary layer may READ both subtitle lines for
// local color rendering, but it must never create translation traffic and must
// never use a MutationObserver that can feed its own DOM writes back into itself.
assert.doesNotMatch(runtime, /chrome\.runtime\.sendMessage\([\s\S]{0,120}type:\s*["']translate["']/i);
assert.doesNotMatch(runtime, /new\s+MutationObserver/);
assert.doesNotMatch(runtime, /\.observe\(/);
assert.match(runtime, /querySelector\(["']\.ytds-orig["']\)/);
assert.match(runtime, /querySelector\(["']\.ytds-trans["']\)/);
assert.match(runtime, /setInterval\(\(\) => repaint\(false\), 180\)/);
assert.match(runtime, /vocabHighlightEnabled/);
assert.match(runtime, /vocabOrigColor/);
assert.match(runtime, /vocabTransColor/);
assert.match(runtime, /ytds-vocab-highlight/);

console.log('PASS vocabulary color alignment safety');
