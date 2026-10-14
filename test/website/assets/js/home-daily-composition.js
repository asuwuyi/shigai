(function exposeDailyComposition(root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ShiGaiDailyComposition = api;
})(typeof window !== "undefined" ? window : globalThis, function createDailyCompositionApi() {
  "use strict";

  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function stableHash(value) {
    let hash = 2166136261;
    for (const character of String(value)) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function createContext(date = new Date()) {
    const dateKey = localDateKey(date);
    return Object.freeze({ dateKey, weekday: date.getDay(), seed: stableHash(dateKey) });
  }

  function selectIndex(length, context, salt) {
    if (!Number.isInteger(length) || length <= 0) return -1;
    return stableHash(`${context.dateKey}:${salt}`) % length;
  }

  function resolveSections(definitions, context) {
    // Calendar context selects content, not the placement of the three rooms.
    return Object.freeze(definitions.map((section, index) => Object.freeze({
      ...section,
      order: section.fixedOrder ?? (index + 1) * 10
    })));
  }

  return Object.freeze({ localDateKey, stableHash, createContext, selectIndex, resolveSections });
});
