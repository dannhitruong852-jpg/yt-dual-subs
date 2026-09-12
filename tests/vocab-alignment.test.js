const assert = require('assert');
const fs = require('fs');
const V = require('../vocab-levels.js');

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
assert.match(runtime, /const myEpoch = epoch/);
assert.match(runtime, /myEpoch !== epoch/);
assert.match(runtime, /origRaw !== source/);
assert.match(runtime, /if \(!enabled\) restorePlain\(\)/);
assert.match(runtime, /parsed\.spans\.length !== marked\.ids\.length/);

console.log('PASS vocabulary alignment');
