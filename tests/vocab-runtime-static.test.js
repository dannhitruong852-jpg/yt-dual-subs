const assert = require('assert');
const fs = require('fs');

const s = fs.readFileSync('vocab-runtime.js', 'utf8');
assert.match(s, /vocabBoldEnabled/);
assert.match(s, /if \(!enabled\) \{ restorePlain\(\); return; \}/);
assert.match(s, /YTDS_VOCAB/);
assert.match(s, /classifySentence/);
assert.match(s, /ytds-vocab-bold/);
assert.match(s, /createTextNode/);
assert.doesNotMatch(s, /\.innerHTML\s*=/);
assert.match(s, /type: "translate", text: marked\.text/);
assert.match(s, /parseMarkedTranslation/);
assert.match(s, /parsed\.spans\.length !== marked\.ids\.length/);

console.log('PASS vocabulary runtime static contract');
