// Shared Shi-Gai Website navigation and footer. No data is written or persisted.
const sitePage = document.body.dataset.page || "home";
const siteHeader = document.querySelector("[data-site-header]");
const siteFooter = document.querySelector("[data-site-footer]");
const siteReviewMode = new URLSearchParams(window.location.search).get("review") === "1";
let analyticsReady = false;
const pendingAnalyticsEvents = [];
let siteBrand = { siteName: "Shi-Gai", icon: "", nav: { home: "Home", journal: "Journal", works: "Works", characters: "Characters", games: "Games", about: "作者工作室" }, pages: { journal: true, works: true, characters: true, games: true, about: false }, controls: { globalBrand: true, homeNavigation: true, journalNavigation: true, worksNavigation: true, charactersNavigation: true, gamesNavigation: true, aboutNavigation: true }, analytics: { enabled: false, provider: "gtm", containerId: "" }, footerName: "Shi-Gai", copyright: "Shi-Gai" };
const siteLinks = [
  { id: "home", label: "Home", href: "index.html" },
  { id: "journal", label: "Journal", href: "journal.html" },
  { id: "works", label: "Works", href: "works.html" },
  { id: "characters", label: "Characters", href: "characters.html" },
  { id: "games", label: "Games", href: "games.html" }
  ,{ id: "about", label: "作者工作室", href: "about.html" }
];

function siteHref(href) {
  if (!siteReviewMode) return href;
  const url = new URL(href, document.baseURI);
  url.searchParams.set("review", "1");
  return `${url.pathname.split("/").pop()}?${url.searchParams.toString()}`;
}

function escapeSiteText(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function loadGoogleTagManager(analytics) {
  const containerId = String(analytics?.containerId || "").trim().toUpperCase();
  if (analytics?.enabled !== true || !/^GTM-[A-Z0-9]+$/.test(containerId) || document.querySelector("script[data-shigai-gtm]")) return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const script = document.createElement("script");
  script.async = true;
  script.dataset.shigaiGtm = containerId;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`;
  document.head.append(script);
}

function sanitizeAnalyticsParameters(parameters) {
  return Object.fromEntries(Object.entries(parameters || {}).filter(([key, value]) => /^[a-z][a-z0-9_]{0,39}$/.test(key) && ["string", "number", "boolean"].includes(typeof value)).map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 100) : value]));
}

function trackSiteEvent(eventName, parameters = {}) {
  if (!/^[a-z][a-z0-9_]{0,39}$/.test(eventName)) return;
  const entry = { event: eventName, ...sanitizeAnalyticsParameters(parameters) };
  if (!analyticsReady) { pendingAnalyticsEvents.push(entry); return; }
  if (siteBrand.analytics?.enabled === true) window.dataLayer?.push(entry);
}

window.ShiGaiAnalytics = Object.freeze({ track: trackSiteEvent });

function brandIconSource() {
  return siteBrand.icon.startsWith("assets/") && !siteBrand.icon.split("/").includes("..") ? `../${siteBrand.icon}` : "assets/images/brand-icon.png";
}
function siteAssetSource(source) { return source?.startsWith("assets/") && !source.split("/").includes("..") ? `../${source}` : ""; }
function siteChromeLinks(href) {
  return [siteHeader, siteFooter].flatMap((root) => root ? [...root.querySelectorAll(`a[href^="${href}"]`)] : []);
}
function allSiteNavigationLinks(id, href) {
  return [...new Set([...siteChromeLinks(href), ...document.querySelectorAll(`[data-site-nav="${id}"]`)])];
}
function applyWebsiteButtonAssets() {
  const selectors = { menu: ".site-menu-toggle, .works-exhibition-menu-button, .characters-menu-button", back: ".back-to-gallery", previous: ".work-side-previous, #previousPage", next: ".work-side-next, #nextPage" };
  Object.entries(selectors).forEach(([id, selector]) => {
    const source = siteAssetSource(siteBrand.buttonAssets?.[id]?.asset);
    document.querySelectorAll(selector).forEach((button) => {
      button.querySelector(":scope > .custom-button-media")?.remove();
      button.classList.toggle("has-custom-button-media", Boolean(source));
      if (!source) return;
      const media = /\.(?:webm|mp4)(?:$|[?#])/i.test(source) ? document.createElement("video") : document.createElement("img");
      media.className = "custom-button-media"; media.src = source; media.setAttribute("aria-hidden", "true");
      if (media.tagName === "VIDEO") { media.autoplay = true; media.loop = true; media.muted = true; media.playsInline = true; }
      button.append(media);
    });
  });
}

function navigationLinks() {
  return siteLinks.filter((link) => (link.id === "home" || siteBrand.pages?.[link.id] !== false) && siteBrand.controls?.[`${link.id}Navigation`] !== false).map((link) => {
    const active = link.id === sitePage;
    return `<a href="${siteHref(link.href)}"${active ? ' class="is-current" aria-current="page"' : ""}>${escapeSiteText(siteBrand.nav[link.id] || link.label)}</a>`;
  }).join("");
}

function renderSiteChrome() {
if (siteHeader) {
  siteHeader.innerHTML = `
    <a class="site-brand" href="${siteHref("index.html")}" aria-label="${escapeSiteText(siteBrand.siteName)} 首頁">
      <span>${escapeSiteText(siteBrand.siteName)}</span>
    </a>
    <button class="site-menu-toggle" type="button" aria-label="開啟網站選單" aria-expanded="false" aria-controls="sitePrimaryNav">☰</button>
    <nav id="sitePrimaryNav" class="site-nav" aria-label="主要導覽">${navigationLinks()}</nav>`;

  const menuButton = siteHeader.querySelector(".site-menu-toggle");
  const navigation = siteHeader.querySelector(".site-nav");
  siteHeader.classList.toggle("is-brand-hidden", siteBrand.controls?.globalBrand === false);
  if (siteBrand.controls?.globalBrand === false) siteHeader.querySelector(".site-brand")?.remove();
  const closeMenu = () => {
    navigation.classList.remove("is-open");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "開啟網站選單");
    if (!menuButton.classList.contains("has-custom-button-media")) menuButton.textContent = "☰";
  };
  const openMenu = () => {
    navigation.classList.add("is-open");
    menuButton.setAttribute("aria-expanded", "true");
    menuButton.setAttribute("aria-label", "關閉網站選單");
    if (!menuButton.classList.contains("has-custom-button-media")) menuButton.textContent = "×";
  };
  menuButton.addEventListener("click", () => navigation.classList.contains("is-open") ? closeMenu() : openMenu());
  navigation.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && navigation.classList.contains("is-open")) {
      closeMenu();
      menuButton.focus();
    }
  });
}

if (siteFooter) {
  siteFooter.innerHTML = `
    <p class="site-footer-name">${escapeSiteText(siteBrand.footerName)}</p>
    <nav class="site-footer-nav" aria-label="頁尾導覽">${navigationLinks()}</nav>
    <p>© ${new Date().getFullYear()} ${escapeSiteText(siteBrand.copyright)}</p>`;
}
applyWebsiteButtonAssets();
}

renderSiteChrome();
window.ShiGaiWebsiteSettings
  .then((settings) => {
    const incoming = settings?.websiteBrand || {};
    siteBrand = {
      siteName: incoming.siteName || siteBrand.siteName,
      icon: incoming.icon || "",
      nav: { ...siteBrand.nav, ...(incoming.nav || {}) },
      pages: { ...siteBrand.pages, ...(incoming.pages || {}) },
      about: { ...(siteBrand.about || {}), ...(incoming.about || {}) },
      controls: { ...siteBrand.controls, ...(incoming.controls || {}) },
      analytics: { ...siteBrand.analytics, ...(incoming.analytics || {}) },
      buttonAssets: { ...(siteBrand.buttonAssets || {}), ...(incoming.buttonAssets || {}) },
      footerName: incoming.footerName || siteBrand.footerName,
      copyright: incoming.copyright || siteBrand.copyright
    };
    loadGoogleTagManager(siteBrand.analytics);
    analyticsReady = true;
    if (siteBrand.analytics?.enabled === true) {
      window.dataLayer = window.dataLayer || [];
      pendingAnalyticsEvents.splice(0).forEach((entry) => window.dataLayer.push(entry));
    } else pendingAnalyticsEvents.length = 0;
    document.querySelectorAll('link[rel~="icon"]').forEach((link) => { link.href = brandIconSource(); });
    Object.entries(siteBrand.pages).forEach(([page, enabled]) => {
      if (enabled !== false) return;
      allSiteNavigationLinks(page, `${page}.html`).forEach((link) => { link.hidden = true; });
    });
    siteLinks.forEach(({ id, href }) => { if (siteBrand.controls?.[`${id}Navigation`] === false) allSiteNavigationLinks(id, href).forEach((link) => { link.hidden = true; }); });
    siteLinks.forEach(({ id, href, label }) => allSiteNavigationLinks(id, href).forEach((link) => { link.textContent = siteBrand.nav[id] || label; }));
    if (sitePage !== "home" && siteBrand.pages?.[sitePage] === false) {
      window.location.replace(siteHref("index.html"));
      return;
    }
    renderSiteChrome();
  })
  .catch(() => { analyticsReady = true; pendingAnalyticsEvents.length = 0; });

document.addEventListener("click", (event) => {
  const link = event.target.closest?.("a[href]");
  if (!link) return;
  let destination = "";
  try { destination = new URL(link.href, document.baseURI).pathname.split("/").pop() || "index.html"; } catch { return; }
  trackSiteEvent("navigation_click", { from_page: sitePage, destination });
});

document.documentElement.classList.add("site-ready");
