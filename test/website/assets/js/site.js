// Shared Shi-Gai Website navigation and footer. No data is written or persisted.
const sitePage = document.body.dataset.page || "home";
const siteHeader = document.querySelector("[data-site-header]");
const siteFooter = document.querySelector("[data-site-footer]");
const siteReviewMode = new URLSearchParams(window.location.search).get("review") === "1";
let siteBrand = { siteName: "Shi-Gai", icon: "", nav: { home: "Home", journal: "Journal", works: "Works", characters: "Characters", games: "Games", about: "作者工作室" }, pages: { journal: true, works: true, characters: true, games: true, about: false }, controls: { globalBrand: true, homeNavigation: true, journalNavigation: true, worksNavigation: true, charactersNavigation: true, gamesNavigation: true, aboutNavigation: true }, analytics: { enabled: false, provider: "gtm", containerId: "" }, system: { homeSuffix: "首頁", openMenuLabel: "開啟網站選單", closeMenuLabel: "關閉網站選單", primaryNavigationLabel: "主要導覽", footerNavigationLabel: "頁尾導覽" }, footerName: "Shi-Gai", copyright: "Shi-Gai" };
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

function trackSiteEvent(eventName, parameters = {}) {
  window.ShiGaiAnalytics?.track(eventName, parameters);
}

window.ShiGaiVisualText = Object.freeze({
  deviceListeners: new WeakMap(),
  apply(element, title, settings = {}) {
    if (!element) return;
    window.ShiGaiVisualText.deviceListeners.get(element)?.();
    const device = matchMedia("(max-width: 700px)");
    const original = settings;
    if (settings.mobileAsset) {
      const change = () => window.ShiGaiVisualText.apply(element, title, original);
      device.addEventListener("change", change);
      window.ShiGaiVisualText.deviceListeners.set(element, () => device.removeEventListener("change", change));
      if (device.matches) settings = { ...settings, asset: settings.mobileAsset, fallbackAsset: settings.mobileFallbackAsset };
    }
    element.replaceChildren(document.createTextNode(title));
    if (settings.mode === "text") return;
    const source = (asset) => typeof asset === "string" && asset.startsWith("assets/") && !asset.split("/").includes("..") ? new URL(`../${asset}`, document.baseURI).href : "";
    const asset = source(settings.asset);
    if (!asset) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const size = (node) => {
      if (!node.style || !settings.mobileWidth) return;
      node.classList.add("site-visual-sized");
      node.style.setProperty("--visual-mobile-width", `${settings.mobileWidth}px`);
      node.style.setProperty("--visual-desktop-width", `${settings.desktopWidth}px`);
    };
    let media;
    const textFallback = () => element.replaceChildren(document.createTextNode(title));
    const showFallback = () => {
      media?.pause?.();
      const fallback = source(settings.fallbackAsset);
      if (!fallback) return textFallback();
      const image = document.createElement("img"); image.className = "site-visual-title"; image.src = fallback; image.alt = title;
      size(image);
      image.addEventListener("error", textFallback, { once: true }); element.replaceChildren(image);
    };
    if (/\.(webm|mp4)$/i.test(asset)) {
      if (reduced.matches) return showFallback();
      media = document.createElement("video"); media.muted = true; media.autoplay = true; media.loop = true; media.playsInline = true;
      media.setAttribute("aria-label", title); media.setAttribute("role", "img");
      media.addEventListener("error", showFallback, { once: true });
      reduced.addEventListener("change", () => { if (reduced.matches) showFallback(); }, { once: true });
    } else {
      media = document.createElement("img"); media.alt = title; media.addEventListener("error", textFallback, { once: true });
    }
    media.className = "site-visual-title"; media.src = asset;
    size(media);
    element.replaceChildren(media);
    if (media.tagName === "VIDEO") media.play().catch(showFallback);
  }
});

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
    <a class="site-brand" href="${siteHref("index.html")}" aria-label="${escapeSiteText(siteBrand.siteName)} ${escapeSiteText(siteBrand.system.homeSuffix)}">
      <span>${escapeSiteText(siteBrand.siteName)}</span>
    </a>
    <button class="site-menu-toggle" type="button" aria-label="${escapeSiteText(siteBrand.system.openMenuLabel)}" aria-expanded="false" aria-controls="sitePrimaryNav">☰</button>
    <nav id="sitePrimaryNav" class="site-nav" aria-label="${escapeSiteText(siteBrand.system.primaryNavigationLabel)}">${navigationLinks()}</nav>`;

  const menuButton = siteHeader.querySelector(".site-menu-toggle");
  const navigation = siteHeader.querySelector(".site-nav");
  siteHeader.classList.toggle("is-brand-hidden", siteBrand.controls?.globalBrand === false);
  if (siteBrand.controls?.globalBrand === false) siteHeader.querySelector(".site-brand")?.remove();
  const closeMenu = () => {
    navigation.classList.remove("is-open");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", siteBrand.system.openMenuLabel);
    if (!menuButton.classList.contains("has-custom-button-media")) menuButton.textContent = "☰";
  };
  const openMenu = () => {
    navigation.classList.add("is-open");
    menuButton.setAttribute("aria-expanded", "true");
    menuButton.setAttribute("aria-label", siteBrand.system.closeMenuLabel);
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
    <nav class="site-footer-nav" aria-label="${escapeSiteText(siteBrand.system.footerNavigationLabel)}">${navigationLinks()}</nav>
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
      system: { ...siteBrand.system, ...(incoming.system || {}) },
      buttonAssets: { ...(siteBrand.buttonAssets || {}), ...(incoming.buttonAssets || {}) },
      footerName: incoming.footerName || siteBrand.footerName,
      copyright: incoming.copyright || siteBrand.copyright
    };
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
  .catch(() => {});

document.addEventListener("click", (event) => {
  const link = event.target.closest?.("a[href]");
  if (!link) return;
  let destination = "";
  try { destination = new URL(link.href, document.baseURI).pathname.split("/").pop() || "index.html"; } catch { return; }
  trackSiteEvent("navigation_click", { from_page: sitePage, destination });
});

document.documentElement.classList.add("site-ready");
