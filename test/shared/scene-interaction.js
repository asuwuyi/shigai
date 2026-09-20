// Shared Scene Object Interaction schema and route resolver. Studio and Website use this single contract.
(function exposeSceneInteraction(global) {
  const actions = Object.freeze(["none", "scene", "work", "character", "game", "about", "url", "previous-page", "next-page", "toggle-menu", "go-back", "previous-item", "next-item", "clear-filters", "media-toggle-play", "media-toggle-sound"]);
  const targetlessActions = Object.freeze(["about", "previous-page", "next-page", "toggle-menu", "go-back", "previous-item", "next-item", "clear-filters", "media-toggle-play", "media-toggle-sound"]);
  const openModes = Object.freeze(["same-tab", "new-tab", "scene-transition"]);
  const cursors = Object.freeze(["default", "pointer"]);
  const legacyActions = Object.freeze({ page: "url", external: "url" });
  // Kept as an empty compatibility field; Studio target options come from the Games Registry.
  const gameOptions = Object.freeze([]);
  const clean = (value, limit = 500) => typeof value === "string" ? value.trim().slice(0, limit) : "";
  const safeUrlTarget = (value) => {
    const target = clean(value);
    if (!target || target.startsWith("//") || target.includes("\\")) return "";
    try {
      const parsed = new URL(target, "https://shi-gai.invalid/");
      if (!['http:', 'https:'].includes(parsed.protocol)) return "";
      return parsed.origin === "https://shi-gai.invalid" ? target : parsed.href;
    } catch {
      return "";
    }
  };
  const action = (value) => actions.includes(value) ? value : (legacyActions[value] || "none");
  const normalize = (value) => {
    const source = value && typeof value === "object" ? value : {};
    const nextAction = action(source.action || source.type);
    const target = nextAction === "url" ? safeUrlTarget(source.target) : clean(source.target);
    return Object.freeze({
      enabled: source.enabled === undefined ? Boolean(nextAction !== "none" && target) : Boolean(source.enabled),
      cursor: cursors.includes(source.cursor) ? source.cursor : (nextAction !== "none" ? "pointer" : "default"),
      action: nextAction,
      target,
      openMode: openModes.includes(source.openMode) ? source.openMode : "same-tab"
    });
  };
  const isActionable = (value) => {
    const interaction = normalize(value);
    return interaction.enabled && interaction.action !== "none" && (targetlessActions.includes(interaction.action) || Boolean(interaction.target));
  };
  const route = (value) => {
    const interaction = normalize(value);
    if (!isActionable(interaction) || interaction.action === "scene") return "";
    if (interaction.action === "work") return "work.html?id=" + encodeURIComponent(interaction.target);
    if (interaction.action === "character") return "character.html?id=" + encodeURIComponent(interaction.target);
    if (interaction.action === "game") return "games.html#" + encodeURIComponent(interaction.target);
    if (interaction.action === "about") return "about.html";
    return interaction.target;
  };
  const api = Object.freeze({ actions, targetlessActions, openModes, cursors, gameOptions, safeUrlTarget, normalize, isActionable, route });
  if (global) global.ShiGaiSceneInteraction = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
