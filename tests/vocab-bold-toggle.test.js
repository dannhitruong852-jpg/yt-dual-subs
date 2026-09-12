const assert = require('assert');
const fs = require('fs');

const skins = fs.readFileSync('skins.js', 'utf8');
assert.match(skins, /const KEY = "vocabBoldEnabled"/);
assert.match(skins, /\[KEY\]: true/);
assert.match(skins, /chrome\.storage\.sync\.set\(\{ \[KEY\]: input\.checked \}\)/);
assert.match(skins, /高阶词汇加粗/);
assert.match(skins, /高階詞彙加粗/);
assert.match(skins, /Bold advanced vocabulary/);

console.log('PASS vocabulary bold toggle');
