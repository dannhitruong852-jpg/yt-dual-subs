const assert = require('assert');
const fs = require('fs');

const s = fs.readFileSync('vocab-runtime.js', 'utf8');
assert.match(s, /vocabHighlightEnabled/);
assert.match(s, /vocabOrigColor/);
assert.match(s, /vocabTransColor/);
assert.match(s, /YTDS_VOCAB/);
assert.match(s, /classifySentence/);
assert.match(s, /ytds-vocab-highlight/);
assert.match(s, /createTextNode/);
assert.match(s, /span\.style\.color = color/);
assert.doesNotMatch(s, /\.innerHTML\s*=/);
assert.doesNotMatch(s, /font-weight|fontWeight|font-size|fontSize/i);

// Presentation-only invariant: no extra translation request and no observer
// feedback loop while YouTube or the user switches translation engines.
assert.doesNotMatch(s, /chrome\.runtime\.sendMessage\([\s\S]{0,120}type:\s*["']translate["']/i);
assert.doesNotMatch(s, /new\s+MutationObserver/);
assert.doesNotMatch(s, /\.observe\(/);
assert.match(s, /plainRestore\(\)/);
assert.match(s, /if \(!settings\.vocabHighlightEnabled\)/);

console.log('PASS vocabulary color runtime static contract');
