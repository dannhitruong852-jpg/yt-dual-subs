// independent-position.js
// Keeps the original (English) and translated (Chinese) subtitle lines at
// independent vertical positions. Values are percentages of the player height.
(function (root) {
  "use strict";

  const DEFAULT_ORIG_Y = 12;
  const DEFAULT_TRANS_Y = 88;
  const ORIG_KEY = "origYpct";
  const TRANS_KEY = "transYpct";

  function clampPercent(value, fallback) {
    let n = Number(value);
    if (!Number.isFinite(n)) n = Number(fallback);
    if (!Number.isFinite(n)) n = 50;
    return Math.max(0, Math.min(100, n));
  }

  function applyPositions(rootEl, values) {
    if (!rootEl || !rootEl.style) return;
    const orig = clampPercent(values && values[ORIG_KEY], DEFAULT_ORIG_Y);
    const trans = clampPercent(values && values[TRANS_KEY], DEFAULT_TRANS_Y);
    rootEl.style.setProperty("--ytds-orig-y", orig + "%");
    rootEl.style.setProperty("--ytds-trans-y", trans + "%");
  }

  const api = {
    DEFAULT_ORIG_Y,
    DEFAULT_TRANS_Y,
    ORIG_KEY,
    TRANS_KEY,
    clampPercent,
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
        (got) => applyPositions(rootEl, got || {})
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
