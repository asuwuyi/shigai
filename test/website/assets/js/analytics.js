// One analytics owner per document. Basic consent: no Google request before grant.
(function initializeAnalytics() {
  "use strict";
  if (window.ShiGaiAnalytics) return;
  const scriptUrl = new URL(document.currentScript.src);
  const websiteRoot = new URL("../../", scriptUrl);
  const settingsUrl = new URL("../../../database/website/settings.json", scriptUrl);
  const embedded = window.parent !== window && new URLSearchParams(location.search).get("embed") === "home";
  const preferenceName = "shigai_analytics_consent";
  const preferenceAge = 180 * 24 * 60 * 60;
  const onceKeys = new Set();
  let configured = false, loaded = false, containerId = "", choice = "unknown", preferences;
  const channel = typeof window.BroadcastChannel === "function" ? new window.BroadcastChannel("shigai-consent:" + websiteRoot.pathname) : null;
  function readChoice() {
    try {
      const match = document.cookie.split(";").map(value => value.trim()).find(value => value.startsWith(preferenceName + "="));
      const parts = (match?.slice(preferenceName.length + 1) || "").split(".");
      const age = Date.now() - Number(parts[2]);
      return parts[0] === "v1" && ["granted", "denied"].includes(parts[1]) && Number.isFinite(age) && age >= 0 && age < preferenceAge * 1000 ? parts[1] : "unknown";
    } catch { return "unknown"; }
  }
  function remember(value) {
    // A device preference only, never CMS content or a generated visitor identifier.
    try { document.cookie = `${preferenceName}=v1.${value}.${Date.now()}; Max-Age=${preferenceAge}; Path=${websiteRoot.pathname}; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`; } catch { /* Page-only choice if storage is blocked. */ }
  }
  function isEnabled() {
    if (embedded) { try { return window.parent.ShiGaiAnalytics?.isEnabled() === true; } catch { return false; } }
    return configured && choice === "granted";
  }
  function sanitizeAnalyticsParameters(parameters) {
    return Object.fromEntries(Object.entries(parameters || {}).filter(([key, value]) => key !== "event" && /^[a-z][a-z0-9_]{0,39}$/.test(key) && ["string", "number", "boolean"].includes(typeof value) && (typeof value !== "number" || Number.isFinite(value))).slice(0, 20).map(([key,value]) => [key, typeof value === "string" ? value.slice(0,100) : value]));
  }
  function track(eventName, parameters = {}, onceKey = "") {
    // No pre-consent queue: never replay earlier actions after a later grant.
    if (!isEnabled() || !/^[a-z][a-z0-9_]{0,39}$/.test(eventName)) return false;
    if (onceKey) { if (onceKeys.has(onceKey)) return false; onceKeys.add(onceKey); }
    const entry = { ...sanitizeAnalyticsParameters(parameters), event: eventName };
    if (embedded) {
      if (!["game_start", "game_draw", "game_interaction", "game_complete"].includes(entry.event)) return false;
      window.parent.postMessage({ type: "shi-gai:game-analytics", event: entry.event, parameters: sanitizeAnalyticsParameters(entry) }, location.origin);
    } else {
      const cleared = Object.fromEntries(["section_id", "content_id", "game_id", "work_id", "character_id", "scene_id", "scene_type", "source", "action", "percent", "weekday", "daily_key", "contract_version", "draw_count", "duration_ms", "level_id"].map(key => [key, null]));
      (window.dataLayer ||= []).push({ ...cleared, ...entry });
    }
    return true;
  }
  function consentCommand(command, state) {
    (window.dataLayer ||= []).push((function () { return arguments; })("consent", command, { analytics_storage: state, ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" }));
  }
  function initializeGoogle() {
    if (!isEnabled() || loaded) return;
    loaded = true;
    consentCommand("default", "denied");
    consentCommand("update", "granted");
    (window.dataLayer ||= []).push({ "gtm.start": Date.now(), event: "gtm.js" });
    const script = document.createElement("script"); script.async = true; script.dataset.shigaiGtm = containerId;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`; document.head.append(script);
  }
  function clearAnalyticsCookies() {
    const paths = new Set(["/", websiteRoot.pathname]);
    const segments = location.pathname.split("/").filter(Boolean); segments.pop();
    while (segments.length) { paths.add("/" + segments.join("/")); paths.add("/" + segments.join("/") + "/"); segments.pop(); }
    const domains = [""], parts = location.hostname.split(".");
    while (parts.length > 1) { domains.push(parts.join("."), "." + parts.join(".")); parts.shift(); }
    try {
      const names = document.cookie.split(";").map(value => value.trim().split("=")[0]).filter(name => /^(_ga(?:_|$)|_gid$|_gat(?:_|$))/.test(name));
      for (const name of names) for (const path of paths) for (const domain of domains) document.cookie = `${name}=; Max-Age=0; Path=${path}; SameSite=Lax${domain ? "; Domain=" + domain : ""}${location.protocol === "https:" ? "; Secure" : ""}`;
    } catch { /* No access to HttpOnly or third-party cookies is attempted. */ }
  }
  function choose(value) {
    if (!["granted", "denied"].includes(value)) return;
    const withdrawing = loaded && value === "denied";
    choice = value; remember(value); preferences?.close();
    channel?.postMessage("changed");
    if (value === "granted") initializeGoogle();
    else { onceKeys.clear(); if (loaded) consentCommand("update", "denied"); clearAnalyticsCookies(); }
    window.dispatchEvent(new CustomEvent("shigai:analytics-consent", { detail: { enabled: isEnabled() } }));
    // Removing a script does not stop its timers; a fresh document enforces withdrawal.
    if (withdrawing) location.reload();
  }
  function showPreferences() { preferences?.open(); }
  window.ShiGaiAnalytics = Object.freeze({ track, isEnabled, getConsent: () => embedded ? "parent" : choice, showPreferences });
  if (embedded) return;
  function renderPreferences(brand) {
    const contract = window.ShiGaiConsentCopy;
    if (!contract || document.querySelector("[data-analytics-preferences]")) return;
    const copy = Object.fromEntries(Object.entries(contract.defaults).map(([key, fallback]) => [key, typeof brand.privacy?.[key] === "string" && brand.privacy[key].trim() ? brand.privacy[key] : fallback]));
    const stylesheet = document.createElement("link"); stylesheet.rel = "stylesheet"; stylesheet.href = new URL("../css/analytics-consent.css?v=consent-menu-20261017", scriptUrl).href; document.head.append(stylesheet);
    const host = document.createElement("aside"); host.className = "analytics-preferences"; host.dataset.analyticsPreferences = "";
    const panel = document.createElement("section"); panel.className = "analytics-preferences-panel"; panel.hidden = true; panel.setAttribute("aria-labelledby", "analytics-preferences-title");
    const title = document.createElement("h2"); title.id = "analytics-preferences-title"; title.textContent = copy.title;
    const description = document.createElement("p"); description.textContent = configured ? copy.description : copy.disabledDescription;
    const details = document.createElement("details"), summary = document.createElement("summary"), policy = document.createElement("p");
    summary.textContent = copy.policyLabel; policy.className = "analytics-policy-body"; policy.textContent = copy.policyBody; details.append(summary, policy);
    const actions = document.createElement("div"); actions.className = "analytics-preferences-actions";
    const button = (label, action) => { const node = document.createElement("button"); node.type = "button"; node.textContent = label; node.addEventListener("click", action); return node; };
    const accept = button(copy.acceptLabel, () => choose("granted")), reject = button(copy.rejectLabel, () => choose("denied"));
    accept.dataset.analyticsChoice = "granted"; reject.dataset.analyticsChoice = "denied"; actions.append(accept, reject);
    const close = button(copy.closeLabel, () => preferences.close()); close.className = "analytics-preferences-close";
    let returnFocus;
    const opener = button(copy.settingsLabel, () => {
      const toggle = document.querySelector('.site-menu-toggle, .works-exhibition-menu-button, .characters-menu-button');
      returnFocus = toggle?.getClientRects().length ? toggle : fallbackMenu?.querySelector("summary") || opener;
      if (toggle?.getAttribute("aria-expanded") === "true") toggle.click();
      if (fallbackMenu) fallbackMenu.open = false;
      showPreferences(); title.focus();
    });
    opener.className = "analytics-preferences-open"; opener.setAttribute("aria-expanded", "false"); opener.setAttribute("aria-controls", "analytics-preferences-panel"); panel.id = "analytics-preferences-panel"; title.tabIndex = -1;
    let fallbackMenu;
    const mountOpener = () => {
      const navigation = document.querySelector('#sitePrimaryNav, .works-exhibition-nav');
      if (navigation) { navigation.append(opener); fallbackMenu?.remove(); fallbackMenu = null; return; }
      // Standalone game pages have no shared navigation; keep a small collapsed
      // menu instead of leaving a permanently visible privacy label over gameplay.
      if (opener.isConnected) return;
      fallbackMenu = document.createElement("details"); fallbackMenu.className = "analytics-preferences-menu";
      const menuToggle = document.createElement("summary"); menuToggle.textContent = "☰";
      menuToggle.setAttribute("aria-label", brand.system?.openMenuLabel || "開啟網站選單");
      fallbackMenu.append(menuToggle, opener); document.body.append(fallbackMenu);
      fallbackMenu.addEventListener("keydown", event => { if (event.key === "Escape") { fallbackMenu.open = false; menuToggle.focus(); } });
    };
    preferences = { open() { panel.hidden = false; opener.setAttribute("aria-expanded", "true"); }, close() { const restore = panel.contains(document.activeElement); panel.hidden = true; opener.setAttribute("aria-expanded", "false"); if (restore) (returnFocus?.isConnected ? returnFocus : document.querySelector('.site-menu-toggle, .works-exhibition-menu-button, .characters-menu-button') || fallbackMenu?.querySelector("summary"))?.focus(); } };
    panel.addEventListener("keydown", event => { if (event.key === "Escape") { event.preventDefault(); preferences.close(); } });
    panel.append(title, description, actions, details, close); host.append(panel); document.body.append(host);
    mountOpener(); window.addEventListener("shigai:site-chrome-ready", mountOpener);
    if (configured && choice === "unknown") preferences.open();
  }
  const settings = window.ShiGaiWebsiteSettings || fetch(settingsUrl).then(response => response.ok ? response.json() : {}).catch(() => ({}));
  Promise.resolve(settings).then(settings => {
    const brand = settings?.websiteBrand || {}, analytics = brand.analytics;
    containerId = String(analytics?.containerId || "").trim().toUpperCase();
    configured = analytics?.enabled === true && /^GTM-[A-Z0-9]+$/.test(containerId);
    choice = readChoice(); initializeGoogle();
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => renderPreferences(brand), { once: true });
    else renderPreferences(brand);
  }).catch(() => { configured = false; });
  function syncChoice(force = false) {
    if (document.visibilityState === "hidden" && force !== true) return;
    const stored = readChoice();
    if (stored === choice) return;
    if (loaded && stored !== "granted") { choice = stored; consentCommand("update", "denied"); clearAnalyticsCookies(); location.reload(); return; }
    choice = stored; initializeGoogle();
    window.dispatchEvent(new CustomEvent("shigai:analytics-consent", { detail: { enabled: isEnabled() } }));
  }
  document.addEventListener("visibilitychange", syncChoice);
  window.addEventListener("pageshow", syncChoice);
  window.addEventListener("focus", syncChoice);
  if (channel) channel.onmessage = () => syncChoice(true);
})();
