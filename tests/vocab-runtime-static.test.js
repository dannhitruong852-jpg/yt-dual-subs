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

// Vocabulary emphasis is presentation-only. It must never create a second
// translation request of its own: doing that doubles traffic for every
// qualifying line and can push the shared free Google lane into rate limiting.
assert.doesNotMatch(s, /chrome\.runtime\.sendMessage\(\{\s*type:\s*["']translate["']/);
assert.doesNotMatch(s, /text:\s*marked\.text/);

console.log('PASS vocabulary runtime static contract');
