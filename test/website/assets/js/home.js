// Shi-Gai Home v1. This page only reads Website export JSON.
const homeElements = {
  worldSceneRender: document.querySelector("[data-world-scene-render]"),
  hero: document.querySelector("[data-home-hero]"),
  scene: document.querySelector("[data-home-scene]"),
  sceneBackground: document.querySelector("[data-home-background]"),
  sceneEnvironment: document.querySelector("[data-home-environment]"),
  worksGrid: document.getElementById("featuredWorksGrid"), workTemplate: document.getElementById("homeWorkTemplate"),
  worksEmpty: document.getElementById("featuredWorksEmpty"),
  charactersGrid: document.getElementById("charactersPreviewGrid"), characterTemplate: document.getElementById("homeCharacterTemplate"),
  charactersEmpty: document.getElementById("charactersPreviewEmpty")
};

const isReviewMode = new URLSearchParams(window.location.search).get("review") === "1";
let reviewPreviewDate = null;
let activeWorldEntranceScenes = [];
let activeWorldEntranceSceneId = "";
let suppressSceneInteractionUntil = 0;
let activeMobileViewport = null;
const welcomeSessionKey = "shi-gai:welcome-seen:v1";
function currentSceneLayout() { return window.matchMedia("(orientation: portrait)").matches ? "portrait" : "landscape"; }
function mobileViewportSettings(scene) {
  const source = scene?.metadata?.mobileViewport || {};
  const bounded = (value, min, max, fallback) => { const number = Number(value); return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback; };
  return { enabled: source.enabled !== false, width: bounded(source.width, 1, 3, 1.8), initialX: bounded(source.initialX, 0, 1, .5), autoPan: source.autoPan !== false, speed: bounded(source.speed, 4, 30, 9) };
}
function reviewUrl(path, parameters = {}) {
  const query = new URLSearchParams(parameters);
  if (isReviewMode) query.set("review", "1");
  const suffix = query.toString();
  return `${path}${suffix ? `?${suffix}` : ""}`;
}

function retainReviewLinks() {
  if (!isReviewMode) return;
  document.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || /^(?:[a-z]+:)?\/\//i.test(href)) return;
    const url = new URL(href, document.baseURI);
    if (!/\.(?:html)$/i.test(url.pathname)) return;
    url.searchParams.set("review", "1");
    link.href = `${url.pathname.split("/").pop()}?${url.searchParams.toString()}`;
  });
}

function applySceneState(element, dynamic) {
  if (!element) return;
  element.dataset.period = dynamic.period;
  element.dataset.characterState = dynamic.characterState;
  element.dataset.backgroundState = dynamic.backgroundState;
}

function applyHomeDynamicContent(date = new Date()) {
  const dynamic = window.ShiGaiHomeDynamic?.getCurrentHomeContent?.(date);
  if (!dynamic) return;
  const heroClasses = window.ShiGaiHomeDynamic.periods.map((item) => item.heroClass);
  if (homeElements.hero) {
    homeElements.hero.classList.remove(...heroClasses);
    homeElements.hero.classList.add(dynamic.heroClass);
  }
  [homeElements.scene, homeElements.sceneBackground, homeElements.sceneEnvironment].forEach((element) => applySceneState(element, dynamic));
}

const homeHeroComponent = { renderDynamicContent: applyHomeDynamicContent };

function sceneMediaUrl(source) {
  return source ? new URL("../" + source, document.baseURI).href : "";
}
function sceneBleedSource(scene) { return scene.background?.asset || ""; }
const sceneInteraction = window.ShiGaiSceneInteraction;
const sceneRender = window.ShiGaiSceneRender;

function selectWorldEntranceScene(scenes, preferredId = "", randomValue = Math.random()) {
  const published = (Array.isArray(scenes) ? scenes : [])
    .filter((scene) => scene?.status === "published")
    .sort((first, second) => Number(first.order || 0) - Number(second.order || 0));
  // A direct Scene interaction may select any published Scene; initial load remains World Entrance only.
  if (preferredId) return published.find((scene) => scene.id === preferredId) || null;
  const entrances = published.filter((scene) => scene.type === "world-entrance");
  if (!entrances.length) return null;
  const index = Math.min(entrances.length - 1, Math.max(0, Math.floor(Number(randomValue || 0) * entrances.length)));
  return entrances[index];
}
function interactionFromNode(node) {
  return sceneInteraction?.normalize({
    enabled: node?.dataset.sceneInteractionEnabled === "true",
    action: node?.dataset.sceneInteractionAction,
    target: node?.dataset.sceneInteractionTarget,
    cursor: node?.dataset.sceneInteractionCursor,
    openMode: node?.dataset.sceneInteractionOpenMode
  });
}
function openInteractionRoute(interaction) {
  const route = sceneInteraction?.route(interaction);
  if (!route) return;
  if (interaction.openMode === "new-tab") {
    const opened = window.open(route, "_blank");
    if (opened) opened.opener = null;
    return;
  }
  window.location.assign(route);
}
function handleWorldSceneInteraction(event) {
  if (Date.now() < suppressSceneInteractionUntil) { event.preventDefault(); return; }
  const container = homeElements.worldSceneRender;
  const node = event.target.closest?.("[data-scene-interaction-enabled='true']");
  if (!container || !node || !container.contains(node)) return;
  const interaction = interactionFromNode(node);
  if (!sceneInteraction?.isActionable(interaction)) return;
  window.ShiGaiAnalytics?.track("navigation_click", { from_page: "home", interaction_type: interaction.action || "unknown", target_id: interaction.target || "" });
  event.preventDefault();
  if (interaction.action === "scene") {
    const target = selectWorldEntranceScene(activeWorldEntranceScenes, interaction.target);
    if (target?.id === interaction.target) renderWorldEntranceScene(activeWorldEntranceScenes, target.id);
    return;
  }
  openInteractionRoute(interaction);
}
function renderWorldEntranceScene(scenes, preferredSceneId = activeWorldEntranceSceneId) {
  activeWorldEntranceScenes = Array.isArray(scenes) ? scenes : [];
  const scene = selectWorldEntranceScene(activeWorldEntranceScenes, preferredSceneId);
  const container = homeElements.worldSceneRender;
  if (!container || !homeElements.hero) return;
  // Never clear the active Scene when a stale, hidden or unpublished target is requested.
  if (!scene) return false;
  container.replaceChildren();
  homeElements.hero.classList.remove("has-world-scene");
  homeElements.hero.classList.remove("has-scene-background");
  homeElements.hero.classList.remove("has-scene-bleed");
  homeElements.hero.style.removeProperty("--scene-world-background");
  homeElements.hero.style.removeProperty("--scene-bleed-image");
  document.body.style.removeProperty("--scene-world-background");
  homeElements.hero.style.setProperty("--scene-peek-x", "0px");
  homeElements.hero.style.setProperty("--scene-peek-y", "0px");
  activeWorldEntranceSceneId = scene.id;
  window.ShiGaiAnalytics?.track("scene_enter", { scene_id: scene.id || "unknown", scene_type: scene.type || "world-entrance" });
  homeElements.hero.classList.add("has-world-scene");

  const background = String(scene.background?.color || "").toUpperCase();
  if (/^#[0-9A-F]{6}$/.test(background) && background !== "#F7F9FC") {
    homeElements.hero.style.setProperty("--scene-world-background", background);
    document.body.style.setProperty("--scene-world-background", background);
    homeElements.hero.classList.add("has-scene-background");
  }
  const layout = currentSceneLayout();
  const bleedSource = sceneBleedSource(scene);
  if (bleedSource) {
    homeElements.hero.style.setProperty("--scene-bleed-image", `url("${sceneMediaUrl(bleedSource)}")`);
    homeElements.hero.classList.add("has-scene-bleed");
  }
  container.dataset.sceneId = scene.id;
  const unifiedRenderer = window.ShiGaiSceneRenderer;
  if (!unifiedRenderer) throw new Error("Unified Scene Renderer is required.");
  const mobileViewport = mobileViewportSettings(scene);
  const useMobileViewport = layout === "portrait" && window.matchMedia("(max-width: 767px) and (pointer: coarse)").matches && mobileViewport.enabled && mobileViewport.width > 1;
  const renderResult = unifiedRenderer.renderScene({
    container,
    scene,
    layout,
    fitMode: "cover",
    frameWidthMultiplier: useMobileViewport ? mobileViewport.width : 1,
    applyBackground: false,
    resolveMediaSource: (object) => object.media?.src ? sceneMediaUrl(object.media.src) : "",
    objectAttributes: (object) => {
      const interaction = sceneInteraction?.normalize(object.interaction);
      const actionable = sceneInteraction?.isActionable(interaction);
      return {
        "aria-label": object.name || object.type || "Scene Object",
        "data-scene-interaction-enabled": actionable ? "true" : "false",
        "data-scene-interaction-action": interaction.action,
        "data-scene-interaction-target": interaction.target,
        "data-scene-interaction-cursor": interaction.cursor,
        "data-scene-interaction-open-mode": interaction.openMode,
        "data-scene-peek-layer": object.layer || "mid",
        role: actionable ? "button" : null,
        tabIndex: actionable ? 0 : null
      };
    }
  });
  activeMobileViewport = useMobileViewport ? { ...mobileViewport, surfaceWidth: renderResult.surfaceWidth } : null;
  configureMobileSceneCamera();
}

const mobileSceneCamera = { pointerId: null, startX: 0, startOffset: 0, offset: 0, maxOffset: 0, moved: false, direction: -1, lastFrame: 0, resumeAt: 0, boundaryUntil: 0, frame: 0 };
function setMobileSceneCameraOffset(value) {
  const camera = mobileSceneCamera;
  camera.offset = Math.max(-camera.maxOffset, Math.min(camera.maxOffset, Number(value) || 0));
  homeElements.hero?.style.setProperty("--scene-camera-x", `${camera.offset.toFixed(2)}px`);
}
function mobileSceneCameraFrame(time) {
  const camera = mobileSceneCamera;
  camera.frame = window.requestAnimationFrame(mobileSceneCameraFrame);
  if (!activeMobileViewport?.autoPan || camera.pointerId !== null || time < camera.resumeAt || time < camera.boundaryUntil || document.hidden || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { camera.lastFrame = time; return; }
  const elapsed = camera.lastFrame ? Math.min(50, time - camera.lastFrame) / 1000 : 0;
  camera.lastFrame = time;
  const next = camera.offset + camera.direction * activeMobileViewport.speed * elapsed;
  setMobileSceneCameraOffset(next);
  if (Math.abs(camera.offset) >= camera.maxOffset - .5) { camera.direction *= -1; camera.boundaryUntil = time + 1200; }
}
function configureMobileSceneCamera() {
  const hero = homeElements.hero;
  const container = homeElements.worldSceneRender;
  const active = Boolean(hero && container && activeMobileViewport && window.matchMedia("(max-width: 767px) and (pointer: coarse)").matches);
  hero?.toggleAttribute("data-mobile-scene-viewport", active);
  if (!active) { mobileSceneCamera.maxOffset = 0; setMobileSceneCameraOffset(0); return; }
  mobileSceneCamera.maxOffset = Math.max(0, (activeMobileViewport.surfaceWidth - container.clientWidth) / 2);
  setMobileSceneCameraOffset((.5 - activeMobileViewport.initialX) * mobileSceneCamera.maxOffset * 2);
  mobileSceneCamera.direction = activeMobileViewport.initialX >= .5 ? -1 : 1;
  mobileSceneCamera.resumeAt = performance.now() + 2000;
  mobileSceneCamera.lastFrame = 0;
  if (!mobileSceneCamera.frame) mobileSceneCamera.frame = window.requestAnimationFrame(mobileSceneCameraFrame);
}

function enableMobileSceneViewport() {
  const hero = homeElements.hero;
  if (!hero) return;
  hero.addEventListener("pointerdown", (event) => {
    if (!hero.hasAttribute("data-mobile-scene-viewport") || event.pointerType !== "touch" || event.isPrimary === false) return;
    const camera = mobileSceneCamera;
    camera.pointerId = event.pointerId; camera.startX = event.clientX; camera.startOffset = camera.offset; camera.moved = false;
    camera.resumeAt = Infinity; hero.classList.add("is-scene-camera-dragging"); hero.setPointerCapture?.(event.pointerId);
  });
  hero.addEventListener("pointermove", (event) => {
    const camera = mobileSceneCamera;
    if (event.pointerId !== camera.pointerId) return;
    const deltaX = event.clientX - camera.startX;
    if (Math.abs(deltaX) > 7) camera.moved = true;
    setMobileSceneCameraOffset(camera.startOffset + deltaX);
  });
  const finish = (event) => {
    const camera = mobileSceneCamera;
    if (event.pointerId !== camera.pointerId) return;
    if (camera.moved) suppressSceneInteractionUntil = Date.now() + 450;
    camera.pointerId = null; camera.resumeAt = performance.now() + 3000; camera.lastFrame = 0; hero.classList.remove("is-scene-camera-dragging");
  };
  hero.addEventListener("pointerup", finish); hero.addEventListener("pointercancel", finish);
}

function enableTouchCameraPeek() {
  const hero = homeElements.hero;
  if (!hero || !window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const peek = { pointerId: null, startX: 0, startY: 0, moved: false };
  const reset = () => {
    peek.pointerId = null;
    hero.classList.remove("is-camera-peeking");
    hero.style.setProperty("--scene-peek-x", "0px");
    hero.style.setProperty("--scene-peek-y", "0px");
  };
  hero.addEventListener("pointerdown", (event) => {
    if (hero.hasAttribute("data-mobile-scene-viewport")) return;
    if (event.pointerType !== "touch" || event.isPrimary === false) return;
    peek.pointerId = event.pointerId; peek.startX = event.clientX; peek.startY = event.clientY; peek.moved = false;
    hero.classList.add("is-camera-peeking");
    hero.setPointerCapture?.(event.pointerId);
  });
  hero.addEventListener("pointermove", (event) => {
    if (hero.hasAttribute("data-mobile-scene-viewport")) return;
    if (event.pointerId !== peek.pointerId) return;
    const deltaX = event.clientX - peek.startX;
    const deltaY = event.clientY - peek.startY;
    if (Math.hypot(deltaX, deltaY) > 7) peek.moved = true;
    const x = Math.max(-26, Math.min(26, deltaX * .23));
    const y = Math.max(-16, Math.min(16, deltaY * .16));
    hero.style.setProperty("--scene-peek-x", `${x.toFixed(2)}px`);
    hero.style.setProperty("--scene-peek-y", `${y.toFixed(2)}px`);
  });
  const finish = (event) => {
    if (event.pointerId !== peek.pointerId) return;
    if (peek.moved) suppressSceneInteractionUntil = Date.now() + 450;
    reset();
  };
  hero.addEventListener("pointerup", finish);
  hero.addEventListener("pointercancel", finish);
  window.addEventListener("blur", reset);
}
function homeMediaUrl(work) { const youtube = work.externalMedia?.find((item) => item.platform === "youtube")?.url.match(/[?&]v=([A-Za-z0-9_-]{11})/)?.[1]; return youtube ? `https://i.ytimg.com/vi/${youtube}/hqdefault.jpg` : new URL(`../${work.thumbnail || work.file}`, document.baseURI).href; }
function homeCharacterColor(name) {
  const palette = ["#79B8E8", "#FF9B6A", "#8fc590", "#a98cda", "#e5a6bd", "#d2ad55"];
  const hash = [...name].reduce((total, character) => total + character.codePointAt(0), 0);
  return palette[hash % palette.length];
}
function homeWorkDate(work) {
  const value = work.publishDate || work.createDate || work.createdAt || "";
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}
function latestWorks(works) {
  const published = works.filter((work) => work.status === "published");
  return window.ShiGaiWorkOrder.newestFirst(published).slice(0, 6);
}
function homeCharacterWorks(works, name) { return works.filter((work) => (work.characters || []).includes(name)); }
function representativeArtwork(works) { return works.find((work) => work.type === "image" || work.type === "gif") || works[0] || null; }
function createHomeMedia(work) {
  const media = document.createElement(work.type === "video" ? "video" : "img");
  media.src = work.type === "video" ? new URL(`../${work.file}`, document.baseURI).href : homeMediaUrl(work);
  media.alt = work.title || work.id;
  if (work.type === "video") {
    if (work.thumbnail) media.poster = new URL(`../${work.thumbnail}`, document.baseURI).href;
    media.autoplay = true; media.muted = true; media.loop = true; media.playsInline = true; media.preload = "metadata"; media.controls = false;
    ["autoplay", "muted", "loop", "playsinline"].forEach((attribute) => media.setAttribute(attribute, ""));
    media.addEventListener("canplay", () => media.play().catch(() => {}), { once: true });
  }
  return media;
}
function renderWorks(works) {
  homeElements.worksGrid.replaceChildren();
  homeElements.worksEmpty.hidden = Boolean(works.length);
  works.forEach((work) => {
    const fragment = homeElements.workTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".home-work-card");
    card.href = reviewUrl("work.html", { id: work.id });
    card.setAttribute("aria-label", `開啟作品 ${work.title || work.id}`);
    fragment.querySelector(".home-work-media").append(createHomeMedia(work));
    const title = fragment.querySelector(".home-work-title");
    if (String(work.title || "").trim()) title.textContent = work.title; else title.remove();
    homeElements.worksGrid.append(fragment);
  });
}
function homeCharacterImageUrl(character) {
  const image = String(character.image || "").trim();
  if (!image) return "";
  if (/^(?:[a-z]+:)?\/\//i.test(image) || image.startsWith("/")) return new URL(image, document.baseURI).href;
  return new URL(`../${image}`, document.baseURI).href;
}

function renderCharacterPlaceholder(container, character) {
  const placeholder = document.createElement("span");
  placeholder.className = "home-character-placeholder";
  placeholder.style.background = homeCharacterColor(character.name || "?");
  placeholder.textContent = [...(character.name || "?")][0];
  placeholder.setAttribute("aria-label", `${character.name} 的角色占位圖`);
  container.append(placeholder);
}

function renderCharacterMedia(container, character, works) {
  const artwork = representativeArtwork(works);
  const sources = [homeCharacterImageUrl(character), artwork ? homeMediaUrl(artwork) : ""].filter(Boolean);
  const renderSource = (index) => {
    if (!sources[index]) {
      renderCharacterPlaceholder(container, character);
      return;
    }
    const image = document.createElement("img");
    image.src = sources[index];
    image.alt = `${character.name} 的角色圖片`;
    image.loading = "lazy";
    image.decoding = "async";
    image.addEventListener("error", () => {
      image.remove();
      renderSource(index + 1);
    }, { once: true });
    container.append(image);
  };
  renderSource(0);
}
function renderCharacters(characters, works) {
  const preview = [...characters]
    .sort((first, second) => String(first.name || "").localeCompare(String(second.name || ""), "zh-Hant"))
    .slice(0, 4);
  homeElements.charactersGrid.replaceChildren();
  homeElements.charactersEmpty.hidden = Boolean(preview.length);
  preview.forEach((character) => {
    const fragment = homeElements.characterTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".home-character-card");
    const characterWorks = homeCharacterWorks(works, character.name);
    card.href = reviewUrl("character.html", { id: character.id });
    card.setAttribute("aria-label", `查看 ${character.name} 的角色詳細頁`);
    renderCharacterMedia(fragment.querySelector(".home-character-media"), character, characterWorks);
    fragment.querySelector(".home-character-name").textContent = character.name || "未命名角色";
    fragment.querySelector(".home-character-count").textContent = `${characterWorks.length} 件作品`;
    homeElements.charactersGrid.append(fragment);
  });
}
function reviewText(value) { return String(value || "").trim(); }
function reviewWorkTags(work) {
  const tags = Array.isArray(work.tags) ? work.tags : [work.tags];
  return tags.flatMap((tag) => reviewText(tag).split(/[、,]/)).map((tag) => tag.trim()).filter(Boolean);
}
function reviewStatus(label, type = "ready") {
  const status = document.createElement("span");
  status.className = `content-review-status is-${type}`;
  status.textContent = label;
  return status;
}
function reviewRow(container, label, status, href = "") {
  const row = document.createElement(href ? "a" : "div");
  row.className = "content-review-row";
  if (href) row.href = href;
  const name = document.createElement("span");
  name.textContent = label;
  row.append(name, reviewStatus(status.label, status.type));
  container.append(row);
}
function reviewSection(container, title) {
  const section = document.createElement("section");
  section.className = "content-review-section";
  const heading = document.createElement("h3");
  heading.textContent = title;
  section.append(heading);
  container.append(section);
  return section;
}
function characterReviewState(character, works) {
  const characterWorks = homeCharacterWorks(works, character.name);
  const artwork = representativeArtwork(characterWorks);
  const hasImage = Boolean(reviewText(character.image));
  const hasShortDescription = Boolean(reviewText(character.shortDescription));
  const hasDescription = Boolean(reviewText(character.description));
  return { characterWorks, hasImage, hasShortDescription, hasDescription, fallback: !hasImage && Boolean(artwork), missingImage: !hasImage && !artwork };
}
function workReviewIssues(work) {
  const issues = [];
  if (!reviewText(work.title)) issues.push("title");
  if (!reviewText(work.description)) issues.push("description");
  if (!reviewText(work.category)) issues.push("category");
  if (!(work.characters || []).length) issues.push("character");
  if (!reviewWorkTags(work).length) issues.push("tag");
  return issues;
}
function createReviewPanel() {
  if (!isReviewMode || document.querySelector("[data-content-review]")) return null;
  document.body.classList.add("is-review-mode");
  const panel = document.createElement("aside");
  panel.className = "content-review-panel";
  panel.dataset.contentReview = "";
  panel.setAttribute("aria-label", "Content Review Mode");
  const details = document.createElement("details");
  details.className = "content-review-details";
  if (window.matchMedia("(min-width: 1200px)").matches) details.open = true;
  const summary = document.createElement("summary");
  summary.textContent = "Content Review";
  const content = document.createElement("div");
  content.className = "content-review-content";
  const steps = document.createElement("ol");
  steps.className = "content-review-steps";
  ["開啟 Studio", "編輯 Character 或 Work", "匯出 Website JSON", "回到瀏覽器重新整理", "在 Review Mode 檢查結果"].forEach((step) => {
    const item = document.createElement("li");
    item.textContent = step;
    steps.append(item);
  });
  const controls = document.createElement("div");
  controls.className = "content-review-controls";
  (window.ShiGaiHomeDynamic?.periods || []).forEach((period) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${period.period.charAt(0).toUpperCase()}${period.period.slice(1)}`;
    button.addEventListener("click", () => {
      reviewPreviewDate = new Date();
      reviewPreviewDate.setHours(period.startHour, 0, 0, 0);
      homeHeroComponent.renderDynamicContent(reviewPreviewDate);
    });
    controls.append(button);
  });
  const resetButton = document.createElement("button");
  resetButton.type = "button";
  resetButton.className = "content-review-reset";
  resetButton.textContent = "Use Current Time";
  resetButton.addEventListener("click", () => {
    reviewPreviewDate = null;
    homeHeroComponent.renderDynamicContent();
  });
  controls.append(resetButton);
  const links = document.createElement("nav");
  links.className = "content-review-links";
  links.setAttribute("aria-label", "Review quick navigation");
  [["Home", "index.html"], ["Works", "works.html"], ["Characters", "characters.html"], ["Games", "games.html"], ["作者工作室", "about.html"]].forEach(([label, href]) => {
    const link = document.createElement("a");
    link.textContent = label;
    link.href = reviewUrl(href);
    links.append(link);
  });
  content.append(steps, controls, links);
  details.append(summary, content);
  panel.append(details);
  document.querySelector(".home-main")?.prepend(panel);
  return content;
}
function renderReviewPanel(content, { works, characters, categories, tags, scenes }) {
  if (!content) return;
  const brand = reviewSection(content, "Brand");
  reviewRow(brand, "Logo", { label: "Placeholder", type: "placeholder" });
  reviewRow(brand, "Favicon", { label: document.querySelector('link[rel~="icon"]') ? "Ready" : "Missing", type: document.querySelector('link[rel~="icon"]') ? "ready" : "missing" });
  reviewRow(brand, "Open Graph Image", { label: document.querySelector('meta[property="og:image"]') ? "Ready" : "Missing", type: document.querySelector('meta[property="og:image"]') ? "ready" : "missing" });

  const home = reviewSection(content, "Home");
  const worldEntrance = selectWorldEntranceScene(scenes);
  const hasSceneMedia = Boolean(worldEntrance?.objects?.some((object) => String(object.media?.src || "").trim()));
  reviewRow(home, "World Entrance Scene media", { label: hasSceneMedia ? "Ready" : "Missing", type: hasSceneMedia ? "ready" : "missing" });
  (window.ShiGaiHomeDynamic?.periods || []).forEach((period) => reviewRow(home, `${period.period.charAt(0).toUpperCase()}${period.period.slice(1)} scene`, { label: "Ready", type: "ready" }));
  const aboutText = document.querySelector(".home-about")?.textContent || "";
  const aboutPlaceholder = /替換|暫時|未來/.test(aboutText);
  reviewRow(home, "About copy", { label: aboutPlaceholder ? "Placeholder" : "Ready", type: aboutPlaceholder ? "placeholder" : "ready" });
  reviewRow(home, "Latest Works", { label: works.length ? `${works.length} works` : "Missing", type: works.length ? "ready" : "missing" });
  reviewRow(home, "Character Preview", { label: characters.length ? `${characters.length} characters` : "Missing", type: characters.length ? "ready" : "missing" });

  const charactersSection = reviewSection(content, "Characters");
  characters.forEach((character) => {
    const state = characterReviewState(character, works);
    const missing = !state.hasImage || !state.hasShortDescription || !state.hasDescription;
    const summary = `${character.id} · ${character.name} · Image ${state.hasImage ? "Ready" : state.fallback ? "Fallback" : "Missing"} · Short ${state.hasShortDescription ? "Ready" : "Missing"} · Description ${state.hasDescription ? "Ready" : "Missing"} · ${state.characterWorks.length} works`;
    reviewRow(charactersSection, summary, { label: state.missingImage ? "Missing" : missing ? state.fallback ? "Fallback" : "Missing" : "Ready", type: state.missingImage ? "missing" : missing ? state.fallback ? "fallback" : "missing" : "ready" }, reviewUrl("character.html", { id: character.id }));
  });

  const worksSection = reviewSection(content, "Works");
  const published = works.filter((work) => work.status === "published");
  const countByType = (type) => published.filter((work) => work.type === type).length;
  const metrics = [["Published", published.length], ["Image", countByType("image")], ["GIF", countByType("gif")], ["Video", countByType("video")], ["Missing title", published.filter((work) => !reviewText(work.title)).length], ["Missing description", published.filter((work) => !reviewText(work.description)).length], ["Missing category", published.filter((work) => !reviewText(work.category)).length], ["Missing character", published.filter((work) => !(work.characters || []).length).length], ["Missing tag", published.filter((work) => !reviewWorkTags(work).length).length]];
  metrics.forEach(([label, value]) => reviewRow(worksSection, label, { label: String(value), type: label.startsWith("Missing") && value ? "missing" : "ready" }));
  published.filter((work) => workReviewIssues(work).length).forEach((work) => reviewRow(worksSection, `${work.id}: ${workReviewIssues(work).join(", ")}`, { label: "Missing", type: "missing" }, reviewUrl("work.html", { id: work.id })));

  const games = reviewSection(content, "Games");
  const data = document.createElement("p");
  data.className = "content-review-data-note";
  data.textContent = `Review reads Website export only: ${categories.length} categories · ${tags.length} tags.`;
  content.append(data);
}
async function loadHome() {
  const reviewContent = createReviewPanel();
  try {
    const [scenesResponse, settings] = await Promise.all([fetch("../database/website/scenes.json"), window.ShiGaiWebsiteSettings]);
    if (!scenesResponse.ok) throw new Error("Website Scene export could not be loaded.");
    const scenesData = await scenesResponse.json();
    renderWorldEntranceScene(scenesData);
    renderWelcomeLogo(settings?.websiteBrand?.welcome);
    if (reviewContent) {
      const [worksResponse, charactersResponse, categoriesResponse, tagsResponse] = await Promise.all([
        fetch("../database/website/works.json"), fetch("../database/website/characters.json"),
        fetch("../database/website/categories.json"), fetch("../database/website/tags.json")
      ]);
      const works = worksResponse.ok ? await worksResponse.json() : [];
      const characters = charactersResponse.ok ? await charactersResponse.json() : [];
      const categories = categoriesResponse.ok ? await categoriesResponse.json() : [];
      const tags = tagsResponse.ok ? await tagsResponse.json() : [];
      renderReviewPanel(reviewContent, { works: Array.isArray(works) ? works : [], characters: Array.isArray(characters) ? characters : [], categories: Array.isArray(categories) ? categories : [], tags: Array.isArray(tags) ? tags : [], scenes: Array.isArray(scenesData) ? scenesData : [] });
    }
  } catch (error) {}
}

function renderWelcomeLogo(value) {
  const welcome = value && typeof value === "object" ? value : {};
  if (!welcome.enabled || !welcome.asset || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  try { if (sessionStorage.getItem(welcomeSessionKey)) return; sessionStorage.setItem(welcomeSessionKey, "1"); } catch {}
  const overlay = document.createElement("div"); overlay.className = "home-welcome-overlay";
  const interaction = sceneInteraction?.normalize(welcome.interaction);
  const interactive = sceneInteraction?.isActionable(interaction);
  const control = document.createElement(interactive ? "button" : "div"); control.className = "home-welcome-control"; if (control.tagName === "BUTTON") control.type = "button";
  const isIOSWebKit = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const selectedAsset = isIOSWebKit && welcome.fallbackAsset ? welcome.fallbackAsset : welcome.asset;
  const source = new URL(`../${selectedAsset}`, document.baseURI).href;
  const video = /\.(?:webm|mp4)(?:[?#].*)?$/i.test(source);
  const media = document.createElement(video ? "video" : "img"); media.className = "home-welcome-media"; media.src = source; media.alt = "Shi-Gai Welcome";
  const animation = welcome.animation || {};
  if (animation.enabled) {
    media.classList.add("has-welcome-animation");
    media.style.setProperty("--welcome-x", `${Math.max(-100, Math.min(100, Number(animation.x) || 0))}vw`);
    media.style.setProperty("--welcome-y", `${Math.max(-100, Math.min(100, Number(animation.y) || 0))}vh`);
    const scale = Math.max(.1, Math.min(3, Number(animation.scale) || 1));
    media.style.setProperty("--welcome-scale", scale);
    media.style.setProperty("--welcome-scale-x", animation.flipX ? -scale : scale);
    media.style.setProperty("--welcome-animation-duration", `${Math.max(.1, Math.min(120, Number(animation.duration) || 3))}s`);
    media.style.setProperty("--welcome-animation-easing", animation.easing === "linear" ? "linear" : "ease-in-out");
    media.style.animationDirection = animation.mode === "continuous" ? "normal" : "alternate";
  }
  if (video) { media.autoplay = true; media.muted = true; media.playsInline = true; media.loop = true; media.setAttribute("muted", ""); media.setAttribute("playsinline", ""); media.setAttribute("loop", ""); }
  let removed = false; const dismiss = () => { if (removed) return; removed = true; overlay.classList.add("is-leaving"); window.setTimeout(() => overlay.remove(), 420); };
  if (interactive) control.addEventListener("click", () => {
    dismiss();
    if (interaction.action === "scene") { renderWorldEntranceScene(activeWorldEntranceScenes, interaction.target); return; }
    const route = sceneInteraction.route(interaction);
    if (!route) return;
    if (interaction.openMode === "new-tab") window.open(route, "_blank", "noopener"); else window.location.assign(route);
  }, { once: true });
  control.append(media); overlay.append(control); document.body.append(overlay);
  if (video) { media.addEventListener("error", dismiss, { once: true }); media.play().catch(dismiss); }
  window.setTimeout(dismiss, Math.max(.5, Math.min(30, Number(welcome.duration) || 3)) * 1000);
}

homeHeroComponent.renderDynamicContent();
window.addEventListener("DOMContentLoaded", retainReviewLinks, { once: true });
window.addEventListener("resize", () => { if (activeWorldEntranceScenes.length) renderWorldEntranceScene(activeWorldEntranceScenes); });
window.setInterval(() => {
  if (!reviewPreviewDate) homeHeroComponent.renderDynamicContent();
}, 60 * 1000);
if (homeElements.worldSceneRender) {
  homeElements.worldSceneRender.addEventListener("click", handleWorldSceneInteraction);
  homeElements.worldSceneRender.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleWorldSceneInteraction(event);
    }
  });
}

enableTouchCameraPeek();
enableMobileSceneViewport();
loadHome();
