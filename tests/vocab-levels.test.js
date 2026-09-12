const assert = require('assert');
const V = require('../vocab-levels.js');

assert.strictEqual(V.LEVEL_BOLD_MIN, 5);
assert.ok(V.classifyToken('awkward', 'That was awkward.').level < 5);
assert.ok(V.classifyToken('address', 'My address is on the form.').level < 5);
assert.ok(V.classifyToken('address', 'We must address the structural problem.').level >= 5);
assert.ok(V.classifyToken('exacerbate', 'This may exacerbate inequality.').level >= 5);
assert.strictEqual(V.classifyToken('exacerbated', 'It exacerbated the problem.').lemma, 'exacerbate');
assert.ok(V.classifyToken('Google', 'Google released an update.').level < 5);
assert.ok(V.classifyToken('2026', 'In 2026 this changed.').level < 5);
assert.ok(V.classifyToken('https://example.com', 'See https://example.com').level < 5);

const multi = V.classifySentence('A preliminary policy may exacerbate inequality.');
assert.ok(multi.filter(x => x.level >= 5).length >= 2);

const marked = V.markSource('This may exacerbate inequality.', V.classifySentence('This may exacerbate inequality.'));
assert.ok(marked.text.includes('exacerbate'));
assert.ok(marked.ids.length >= 1);

const parsed = V.parseMarkedTranslation('这可能会⟦v0⟧加剧⟦/v0⟧不平等。');
assert.deepStrictEqual(parsed, { text: '这可能会加剧不平等。', spans: [{ id: 'v0', start: 4, end: 6 }] });
assert.strictEqual(V.parseMarkedTranslation('坏掉的⟦v0⟧标记'), null);

const tokens = V.tokenize("We're addressing risks in 2026.");
assert.ok(tokens.some(t => t.text === 'addressing'));
assert.ok(tokens.some(t => t.text === '2026'));

const properUnknown = V.classifyToken('Rivendell', 'Rivendell is beautiful.');
assert.ok(properUnknown.level < 5);

console.log('PASS vocabulary levels');
