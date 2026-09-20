(function exposeWorkOrder(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ShiGaiWorkOrder = api;
})(typeof window !== "undefined" ? window : globalThis, function createWorkOrder() {
  function timestamp(work) {
    const value = work?.publishDate || work?.createDate || work?.createdAt || "";
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function compareNewest(first, second) {
    return timestamp(second) - timestamp(first)
      || String(second?.id || "").localeCompare(String(first?.id || ""), undefined, { numeric: true });
  }

  function newestFirst(works) {
    return [...(Array.isArray(works) ? works : [])].sort(compareNewest);
  }

  return Object.freeze({ timestamp, compareNewest, newestFirst });
});
