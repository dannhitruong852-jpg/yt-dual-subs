const assert = require('assert');
const fs = require('fs');

const skins = fs.readFileSync('skins.js', 'utf8');

assert.match(skins, /vocabHighlightEnabled/);
assert.match(skins, /vocabOrigColor/);
assert.match(skins, /vocabTransColor/);
assert.match(skins, /vocabBoldEnabled/); // one-time compatibility source
assert.match(skins, /#FFD54F/);
assert.match(skins, /#80DEEA/);
assert.match(skins, /高阶词汇标色/);
assert.match(skins, /高階詞彙標色/);
assert.match(skins, /Highlight advanced vocabulary/);
assert.match(skins, /英文高阶词颜色/);
assert.match(skins, /中文对应词颜色/);
assert.match(skins, /exacerbate/);
assert.match(skins, /加剧/);
assert.match(skins, /input\.type="color"/);
assert.doesNotMatch(skins, /高阶词汇加粗|高階詞彙加粗|Bold advanced vocabulary/);

console.log('PASS vocabulary highlight controls');
