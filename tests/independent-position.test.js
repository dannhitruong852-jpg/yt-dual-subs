const assert = require('assert');
const pos = require('../independent-position.js');

assert.ok(pos.DEFAULT_TRANS_Y < pos.DEFAULT_ORIG_Y,
  `Chinese must default above English: trans=${pos.DEFAULT_TRANS_Y}, orig=${pos.DEFAULT_ORIG_Y}`);

assert.strictEqual(typeof pos.normalizePair, 'function', 'normalizePair must exist');
const migrated = pos.normalizePair({ origYpct: 12, transYpct: 88 });
assert.deepStrictEqual(migrated, { origYpct: 88, transYpct: 12 },
  'legacy inverted values should be swapped');

const crossed = pos.normalizePair({ origYpct: 40, transYpct: 60 });
assert.ok(crossed.transYpct < crossed.origYpct,
  `Chinese must stay above English after normalization: ${JSON.stringify(crossed)}`);

const equal = pos.normalizePair({ origYpct: 50, transYpct: 50 });
assert.ok(equal.transYpct < equal.origYpct,
  `equal positions must be separated: ${JSON.stringify(equal)}`);

const props = {};
const rootEl = { style: { setProperty: (k, v) => { props[k] = v; } } };
pos.applyPositions(rootEl, { origYpct: 20, transYpct: 80 });
assert.deepStrictEqual(props, { '--ytds-orig-y': '80%', '--ytds-trans-y': '20%' });

console.log('PASS: Chinese remains above English');
