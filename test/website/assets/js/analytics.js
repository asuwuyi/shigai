// One analytics owner per top-level document. Embedded games relay, never load GTM.
(function initializeAnalytics() {
  "use strict";
  if (window.ShiGaiAnalytics) return;
  const settingsUrl = new URL("../../../database/website/settings.json", document.currentScript.src);
  const embedded = window.parent !== window && new URLSearchParams(location.search).get("embed") === "home";
  const pendingAnalyticsEvents = [];
  const onceKeys = new Set();
  let analyticsReady = embedded, enabled = embedded;
  function sanitizeAnalyticsParameters(parameters) {
    return Object.fromEntries(Object.entries(parameters || {}).filter(([key, value]) => key !== "event" && /^[a-z][a-z0-9_]{0,39}$/.test(key) && ["string", "number", "boolean"].includes(typeof value) && (typeof value !== "number" || Number.isFinite(value))).slice(0, 20).map(([key,value]) => [key, typeof value === "string" ? value.slice(0,100) : value]));
  }
  function deliver(entry) {
    if (!enabled) return;
    if (embedded) {
      if (["game_start", "game_draw", "game_interaction", "game_complete"].includes(entry.event)) window.parent.postMessage({ type: "shi-gai:game-analytics", event: entry.event, parameters: sanitizeAnalyticsParameters(entry) }, location.origin);
    } else {
      // GTM retains previous dataLayer values; clear attribution not supplied by this event.
      const cleared = Object.fromEntries(["section_id", "content_id", "game_id", "work_id", "character_id", "scene_id", "scene_type", "source", "action", "percent", "weekday", "daily_key", "contract_version", "draw_count", "duration_ms", "level_id"].map(key => [key, null]));
      (window.dataLayer ||= []).push({ ...cleared, ...entry });
    }
  }
  function track(eventName, parameters = {}, onceKey = "") {
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(eventName)) return;
    if (onceKey) { if (onceKeys.has(onceKey)) return; onceKeys.add(onceKey); }
    const entry = { ...sanitizeAnalyticsParameters(parameters), event: eventName };
    if (!analyticsReady) { if (pendingAnalyticsEvents.length < 100) pendingAnalyticsEvents.push(entry); return; }
    deliver(entry);
  }
  window.ShiGaiAnalytics = Object.freeze({ track });
  if (embedded) return;
  const settings = window.ShiGaiWebsiteSettings || fetch(settingsUrl).then(response => response.ok ? response.json() : {}).catch(() => ({}));
  Promise.resolve(settings).then(settings => {
    const analytics = settings?.websiteBrand?.analytics;
    const containerId = String(analytics?.containerId || "").trim().toUpperCase();
    enabled = analytics?.enabled === true && /^GTM-[A-Z0-9]+$/.test(containerId);
    if (enabled && !document.querySelector("script[data-shigai-gtm]")) {
      (window.dataLayer ||= []).push({ "gtm.start": Date.now(), event: "gtm.js" });
      const script = document.createElement("script"); script.async = true; script.dataset.shigaiGtm = containerId;
      script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`; document.head.append(script);
    }
    analyticsReady = true; pendingAnalyticsEvents.splice(0).forEach(deliver);
  }).catch(() => { analyticsReady = true; enabled = false; pendingAnalyticsEvents.length = 0; });
})();
