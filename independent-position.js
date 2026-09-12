// independent-position.js
// Keeps the original (English) and translated (Chinese) subtitle lines at
// independent vertical positions. Values are percentages of the player height.
(function (root) {
  "use strict";

  const DEFAULT_ORIG_Y = 88;
  const DEFAULT_TRANS_Y = 12;
  const ORIG_KEY = "origYpct";
  const TRANS_KEY = "transYpct";

  function clampPercent(value, fallback) {
    let n = Number(value);
    if (!Number.isFinite(n)) n = Number(fallback);
    if (!Number.isFinite(n)) n = 50;
    return Math.max(0, Math.min(100, n));
  }

  function normalizePair(values) {
    let orig = clampPercent(values && values[ORIG_KEY], DEFAULT_ORIG_Y);
    let trans = clampPercent(values && values[TRANS_KEY], DEFAULT_TRANS_Y);

    // Smaller Y is higher on the video. Chinese must always stay above English.
    // Values written by the first fork version used the opposite defaults, so
    // an inverted pair is migrated by swapping it rather than collapsing both
    // lines around the old English position.
    if (trans > orig) [trans, orig] = [orig, trans];
    if (trans === orig) {
      if (orig < 100) orig += 1;
      else trans -= 1;
    }
    return { [ORIG_KEY]: orig, [TRANS_KEY]: trans };
  }

  function applyPositions(rootEl, values) {
    if (!rootEl || !rootEl.style) return normalizePair(values);
    const pair = normalizePair(values);
    rootEl.style.setProperty("--ytds-orig-y", pair[ORIG_KEY] + "%");
    rootEl.style.setProperty("--ytds-trans-y", pair[TRANS_KEY] + "%");
    return pair;
  }

  const api = {
    DEFAULT_ORIG_Y,
    DEFAULT_TRANS_Y,
    ORIG_KEY,
    TRANS_KEY,
    clampPercent,
    normalizePair,
    applyPositions
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.YTDS_INDEPENDENT_POSITION = api;

  if (!root.document || !root.chrome || !chrome.storage || !chrome.storage.sync) return;
  const rootEl = root.document.documentElement;

  function readPositions() {
    try {
      chrome.storage.sync.get(
        { [ORIG_KEY]: DEFAULT_ORIG_Y, [TRANS_KEY]: DEFAULT_TRANS_Y },
        (got) => {
          const pair = applyPositions(rootEl, got || {});
          if (got && (got[ORIG_KEY] !== pair[ORIG_KEY] || got[TRANS_KEY] !== pair[TRANS_KEY])) {
            chrome.storage.sync.set(pair);
          }
        }
      );
    } catch (_e) {
      applyPositions(rootEl, { [ORIG_KEY]: DEFAULT_ORIG_Y, [TRANS_KEY]: DEFAULT_TRANS_Y });
    }
  }

  readPositions();

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync" || (!changes[ORIG_KEY] && !changes[TRANS_KEY])) return;
      // Read both values together so changing one never loses the other.
      readPositions();
    });
  } catch (_e) { /* extension APIs unavailable: defaults stay in CSS */ }
})(typeof globalThis !== "undefined" ? globalThis : this);
