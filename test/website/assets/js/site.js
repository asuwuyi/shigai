// Shared Shi-Gai Website navigation and footer. No data is written or persisted.
const sitePage = document.body.dataset.page || "home";
const siteWebsiteRoot = new URL("../../", document.currentScript.src);
const siteEmbedded = window.parent !== window && new URLSearchParams(location.search).get("embed") === "home";
const siteHeader = siteEmbedded ? null : document.querySelector("[data-site-header]");
const siteFooter = document.querySelector("[data-site-footer]");
const siteReviewMode = new URLSearchParams(window.location.search).get("review") === "1";
let siteBrand = { siteName: "Shi-Gai", icon: "", nav: { home: "Home", journal: "Journal", works: "Works", characters: "Characters", games: "Games", tools: "工具 Tools", island:"Shi-Gai 島 Island", about: "作者工作室" }, pages: { journal: true, works: true, characters: true, games: true, tools: true, island:true, about: false }, controls: { globalBrand: true, homeNavigation: true, journalNavigation: true, worksNavigation: true, charactersNavigation: true, gamesNavigation: true, toolsNavigation: true, islandNavigation:true, aboutNavigation: true }, analytics: { enabled: false, provider: "gtm", containerId: "" }, system: { homeSuffix: "首頁", openMenuLabel: "開啟網站選單", closeMenuLabel: "關閉網站選單", primaryNavigationLabel: "主要導覽", footerNavigationLabel: "頁尾導覽" }, footerName: "Shi-Gai", copyright: "Shi-Gai" };
const siteLinks = [
  { id: "home", label: "Home", href: "index.html" },
  { id: "journal", label: "Journal", href: "journal.html" },
  { id: "works", label: "Works", href: "works.html" },
  { id: "characters", label: "Characters", href: "characters.html" },
  { id: "games", label: "Games", href: "games.html" },
  { id: "tools", label: "工具 Tools", href: "tools.html" },
  { id: "island", label: "Shi-Gai 島 Island", href: "island/" },
  { id: "about", label: "作者工作室", href: "about.html" }
];

function siteHref(href) {
  const url = new URL(href, siteWebsiteRoot);
  if (siteReviewMode) url.searchParams.set("review", "1");
  return new URL("./", location.href).href === siteWebsiteRoot.href ? `${url.pathname.slice(siteWebsiteRoot.pathname.length)}${url.search}${url.hash}` : url.href;
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
    const source = (asset) => siteAssetSource(asset);
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
  return siteAssetSource(siteBrand.icon) || new URL("assets/images/brand-icon.png", siteWebsiteRoot).href;
}
function siteAssetSource(source) { return typeof source === "string" && source.startsWith("assets/") && !source.split("/").includes("..") ? new URL(`../${source}`, siteWebsiteRoot).href : ""; }
function siteChromeLinks(href) {
  return [siteHeader, siteFooter].flatMap((root) => root ? [...root.querySelectorAll(`a[href^="${href}"]`)] : []);
}
function allSiteNavigationLinks(id, href) {
  return [...new Set([...siteChromeLinks(href), ...document.querySelectorAll(`[data-site-nav="${id}"]`)])];
}
function applyWebsiteButtonAssets() {
  applyScrollMenus();
  const selectors = { back: ".back-to-gallery", previous: ".work-side-previous, #previousPage", next: ".work-side-next, #nextPage" };
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

// One presentation adapter for existing navigation owners; routes, filters and
// consent remain in their original DOM and keep their original event handlers.
const scrollMenuBindings = new WeakMap();
function formatBilingualMenuLabel(element) {
  if (element.querySelector(":scope > .menu-label-zh")) return;
  const label = element.textContent.trim();
  // Keep the existing editable label as the only content source.
  const parts = /^(.*[\u3400-\u9fff][^A-Za-z]*?)\s+([A-Za-z].*)$/.exec(label);
  if (!parts) return;
  const chinese = document.createElement("span"), english = document.createElement("span");
  chinese.className = "menu-label-zh"; chinese.lang = "zh-Hant"; chinese.textContent = parts[1].trim();
  english.className = "menu-label-en"; english.lang = "en"; english.textContent = parts[2].trim();
  element.replaceChildren(chinese, document.createTextNode(" "), english);
}
function applyScrollMenus() {
  const pairs = [[".site-menu-toggle", "#sitePrimaryNav"]];
  pairs.forEach(([buttonSelector, panelSelector]) => {
    const button = document.querySelector(buttonSelector), panel = document.querySelector(panelSelector);
    if (!button || !panel) return;
    scrollMenuBindings.get(button)?.disconnect();
    const closedSource = siteAssetSource(siteBrand.buttonAssets?.menu?.fallbackAsset || siteBrand.buttonAssets?.menu?.asset) || new URL("assets/images/menu-closed-side-20261018.webp", siteWebsiteRoot).href;
    const openSource = siteAssetSource(siteBrand.buttonAssets?.menuOpen?.fallbackAsset || siteBrand.buttonAssets?.menuOpen?.asset) || new URL("assets/images/menu-open-side-20261018.webp", siteWebsiteRoot).href;
    let content = panel.querySelector(":scope > .scroll-menu-content");
    if (!content) {
      content = document.createElement("div"); content.className = "scroll-menu-content";
      content.append(...panel.childNodes); panel.append(content);
    }
    panel.querySelector(":scope > .scroll-menu-art")?.remove();
    panel.querySelector(":scope > .scroll-menu-paper")?.remove();
    const art = document.createElement("img"); art.className = "scroll-menu-art"; art.alt = ""; art.setAttribute("aria-hidden", "true");
    art.addEventListener("load", () => panel.classList.add("has-scroll-paper"));
    art.addEventListener("error", () => panel.classList.remove("has-scroll-paper"));
    art.src = openSource;
    const paper = document.createElement("span"); paper.className = "scroll-menu-paper"; paper.setAttribute("aria-hidden", "true");
    const sheet = document.createElement("img"); sheet.className = "scroll-menu-paper-art"; sheet.alt = ""; sheet.src = openSource;
    paper.append(sheet); panel.prepend(art, paper);
    panel.classList.add("scroll-menu-panel");
    const sync = () => {
      const open = panel.classList.contains("is-open");
      [...content.children].filter(node => node.matches("a, button")).forEach(formatBilingualMenuLabel);
      if (panel.id === "sitePrimaryNav") panel.style.setProperty("--scroll-menu-rows", String([...content.children].filter(node => node.matches("a, button") && !node.hidden).length || 6));
      button.classList.toggle("is-scroll-menu-open", open && panel.classList.contains("has-scroll-paper"));
      button.setAttribute("aria-label", open ? siteBrand.system.closeMenuLabel : siteBrand.system.openMenuLabel);
      if (!button.querySelector(".scroll-menu-icon")) {
        button.replaceChildren(document.createTextNode(open ? "×" : "☰"));
        const icon = document.createElement("img"); icon.className = "scroll-menu-icon"; icon.alt = ""; icon.setAttribute("aria-hidden", "true");
        icon.addEventListener("load", () => button.classList.add("has-scroll-icon"));
        icon.addEventListener("error", () => { button.classList.remove("has-scroll-icon"); icon.remove(); });
        button.append(icon);
      }
      const icon = button.querySelector(".scroll-menu-icon");
      const source = open && panel.classList.contains("has-scroll-paper") ? openSource : closedSource;
      if (icon && icon.getAttribute("src") !== source) icon.src = source;
    };
    const observer = new MutationObserver(sync);
    observer.observe(panel, { attributes: true, attributeFilter: ["class"] });
    observer.observe(content, { childList: true });
    scrollMenuBindings.set(button, observer); sync();
    if (!button.dataset.scrollMenuBound) {
      button.dataset.scrollMenuBound = "true";
      panel.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || !panel.classList.contains("is-open") || event.defaultPrevented) return;
        event.preventDefault(); button.click(); button.focus();
      });
    }
  });
}

function navigationLinks() {
  return siteLinks.filter((link) => (link.id === "home" || siteBrand.pages?.[link.id] !== false) && siteBrand.controls?.[`${link.id}Navigation`] !== false).map((link) => {
    const active = link.id === sitePage;
    return `<a data-site-nav="${link.id}" href="${siteHref(link.href)}"${active ? ' class="is-current" aria-current="page"' : ""}>${escapeSiteText(siteBrand.nav[link.id] || link.label)}</a>`;
  }).join("");
}

function renderSiteChrome() {
if (siteHeader) {
  siteHeader._menuAbort?.abort();siteHeader._menuAbort=new AbortController();
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
    if (!menuButton.querySelector(".scroll-menu-icon")) menuButton.textContent = "☰";
  };
  const openMenu = () => {
    window.dispatchEvent(new Event("shigai:navigation-open"));
    navigation.classList.add("is-open");
    menuButton.setAttribute("aria-expanded", "true");
    menuButton.setAttribute("aria-label", siteBrand.system.closeMenuLabel);
    if (!menuButton.querySelector(".scroll-menu-icon")) menuButton.textContent = "×";
  };
  menuButton.addEventListener("click", () => navigation.classList.contains("is-open") ? closeMenu() : openMenu());
  siteHeader.ownerDocument.addEventListener('pointerdown',event=>{if(navigation.classList.contains('is-open')&&!siteHeader.contains(event.target))closeMenu();},{signal:siteHeader._menuAbort.signal});
  navigation.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && navigation.classList.contains("is-open")) {
      event.preventDefault();
      closeMenu();
      menuButton.focus();
    }
  },{signal:siteHeader._menuAbort.signal});
}

if (siteFooter) {
  siteFooter.innerHTML = `
    <p class="site-footer-name">${escapeSiteText(siteBrand.footerName)}</p>
    <nav class="site-footer-nav" aria-label="${escapeSiteText(siteBrand.system.footerNavigationLabel)}">${navigationLinks()}</nav>
    <p>© ${new Date().getFullYear()} ${escapeSiteText(siteBrand.copyright)}</p>`;
}
applyWebsiteButtonAssets();
window.dispatchEvent(new Event("shigai:site-chrome-ready"));
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
