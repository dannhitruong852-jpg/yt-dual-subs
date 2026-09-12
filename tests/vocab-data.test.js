const assert = require('assert');
global.self = global;
require('../vocab-data.js');
const V = require('../vocab-levels.js');

const D = global.YTDS_VOCAB_DATA;
assert.ok(D && D.levels && D.zh);
assert.strictEqual(V.LEVEL_HIGHLIGHT_MIN, 5);
assert.ok(Object.keys(D.levels).length >= 5000,
  'runtime vocabulary data should contain at least 5000 classified lemmas');
assert.ok(Object.keys(D.zh).length >= 1000,
  'Chinese counterpart data should cover at least 1000 advanced lemmas');

for (const [lemma, level] of Object.entries(D.levels)) {
  assert.ok(/^[a-z][a-z'-]*$/.test(lemma), `bad lemma: ${lemma}`);
  assert.ok(Number.isInteger(level) && level >= 1 && level <= 9,
    `bad level for ${lemma}`);
}

assert.ok(V.classifyToken('awkward', 'That was awkward.').level < 5);
assert.ok(V.classifyToken('determine', 'We must determine the cause.').level >= 5);
assert.ok(V.classifyToken('essential', 'This is essential.').level >= 5);
assert.ok(V.classifyToken('significant', 'The effect was significant.').level >= 5);
assert.ok(V.classifyToken('various', 'There are various reasons.').level >= 5);
assert.ok(V.classifyToken('address', 'My address is on the form.').level < 5);
assert.ok(V.classifyToken('address', 'We must address the structural problem.').level >= 5);
assert.ok(V.classifyToken('exacerbate', 'This may exacerbate inequality.').level >= 5);
assert.strictEqual(V.classifyToken('exacerbated', 'It exacerbated the problem.').lemma, 'exacerbate');

for (const lemma of ['determine', 'essential', 'significant', 'various', 'exacerbate']) {
  assert.ok(Array.isArray(D.zh[lemma]) && D.zh[lemma].length > 0,
    `missing Chinese counterpart candidates for ${lemma}`);
}
assert.ok(D.zh.exacerbate.includes('加剧'));

console.log('PASS vocabulary data coverage');
