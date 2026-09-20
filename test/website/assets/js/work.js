// Shi-Gai Work Detail data reader. This page only reads Website export JSON.
const query = new URLSearchParams(window.location.search);
let activeWorkId = query.get("id");
let loadedWorks = [];
let loadedFrames = [];
let activeVideo = null;
let workDetailUiScene = null;
let workDetailControls = {};
const exhibitionWallpapers = ["burgundy-01", "sage-02", "navy-03", "ochre-04"];
const elements = {
  loading: document.getElementById("detailLoading"), detail: document.getElementById("workDetail"),
  error: document.getElementById("detailError"), media: document.getElementById("detailMedia"),
  mediaWrap: document.getElementById("workMediaWrap"),
  videoControls: document.getElementById("videoControls"), playPause: document.getElementById("playPause"),
  soundToggle: document.getElementById("soundToggle"), id: document.getElementById("workId"),
  title: document.getElementById("workTitle"), description: document.getElementById("workDescription"), content: document.querySelector("#workDetail .work-detail-content"),
  meta: document.getElementById("workMeta"), characters: document.getElementById("workCharacters"),
  tags: document.getElementById("workTags"), tagsGroup: document.getElementById("workTags")?.closest(".detail-group"), previous: document.getElementById("previousWork"),
  next: document.getElementById("nextWork"), back: document.getElementById("backToGallery"),
  uiLayer: document.getElementById("workDetailUiLayer"), corridorViewport: document.getElementById("workCorridorViewport"),
  corridorTrack: document.getElementById("workCorridorTrack")
};
let corridorResetting = false;
let corridorSettleTimer = 0;
let corridorLayoutFrame = 0;
let corridorDrag = null;

function sceneMediaUrl(source) { return source ? new URL(`../${source}`, document.baseURI).href : ""; }
function uiSceneActions() {
  return new Set((workDetailUiScene?.objects || []).filter((object) => object.visible !== false && window.ShiGaiSceneInteraction?.isActionable(object.interaction)).map((object) => object.interaction.action));
}
function showSystemControl(id, requiredActions = []) {
  if (workDetailControls[id] !== false) return true;
  const actions = uiSceneActions();
  return !requiredActions.every((action) => actions.has(action));
}
function syncSystemControlVisibility(hasNavigation = loadedWorks.length > 1) {
  elements.back.hidden = !showSystemControl("workDetailBack", ["go-back"]);
  elements.previous.hidden = !hasNavigation || !showSystemControl("workDetailPrevious", ["previous-item"]);
  elements.next.hidden = !hasNavigation || !showSystemControl("workDetailNext", ["next-item"]);
  const showPlayPause = showSystemControl("workDetailPlayPause", ["media-toggle-play"]);
  const showSound = showSystemControl("workDetailSound", ["media-toggle-sound"]);
  elements.playPause.hidden = !showPlayPause;
  elements.soundToggle.hidden = !showSound;
  elements.videoControls.hidden = !activeVideo || (!showPlayPause && !showSound);
}
function renderWorkDetailUi(scenes) {
  workDetailUiScene = (Array.isArray(scenes) ? scenes : []).filter((scene) => scene?.status === "published" && scene?.metadata?.uiSurface === "work-detail").sort((a, b) => Number(a.order || 0) - Number(b.order || 0))[0] || null;
  if (!elements.uiLayer || !window.ShiGaiSceneRenderer || !workDetailUiScene) {
    if (elements.uiLayer) { elements.uiLayer.hidden = true; elements.uiLayer.replaceChildren(); }
    return;
  }
  elements.uiLayer.hidden = false;
  window.ShiGaiSceneRenderer.renderScene({
    container: elements.uiLayer,
    scene: workDetailUiScene,
    layout: matchMedia("(orientation: portrait)").matches ? "portrait" : "landscape",
    fitMode: "cover",
    applyBackground: false,
    resolveMediaSource: (object) => object.media?.src ? sceneMediaUrl(object.media.src) : "",
    objectAttributes: (object) => {
      const interaction = window.ShiGaiSceneInteraction.normalize(object.interaction);
      const actionable = window.ShiGaiSceneInteraction.isActionable(interaction);
      return { "aria-label": object.name || "作品內頁操作", "data-ui-action": interaction.action, role: actionable ? "button" : null, tabIndex: actionable ? 0 : null };
    }
  });
}
function moveWorkDetail(direction) {
  const target = direction < 0 ? elements.previous : elements.next;
  if (target?.dataset.workId) showWorkWithoutReload(target.dataset.workId, { reveal: true });
}
function toggleActiveVideoPlay() {
  if (!activeVideo) return;
  if (activeVideo.paused) activeVideo.play().catch(() => {}); else activeVideo.pause();
}
function toggleActiveVideoSound() {
  if (!activeVideo) return;
  activeVideo.muted = !activeVideo.muted;
  elements.soundToggle.textContent = activeVideo.muted ? "🔇" : "🔊";
  elements.soundToggle.setAttribute("aria-label", activeVideo.muted ? "開啟影片聲音" : "關閉影片聲音");
  if (!activeVideo.paused) activeVideo.play().catch(() => {});
}
function handleWorkDetailUiInteraction(event) {
  const node = event.target.closest?.("[data-ui-action]");
  if (!node || !elements.uiLayer?.contains(node)) return;
  const action = node.dataset.uiAction;
  event.preventDefault();
  if (action === "go-back") window.location.href = galleryUrl();
  else if (action === "previous-item") moveWorkDetail(-1);
  else if (action === "next-item") moveWorkDetail(1);
  else if (action === "media-toggle-play") toggleActiveVideoPlay();
  else if (action === "media-toggle-sound") toggleActiveVideoSound();
}

function selectExhibitionWallpaper() {
  const key = "shi-gai:works-wallpaper:v1";
  let selected = sessionStorage.getItem(key);
  if (!exhibitionWallpapers.includes(selected)) {
    selected = exhibitionWallpapers[Math.floor(Math.random() * exhibitionWallpapers.length)];
    sessionStorage.setItem(key, selected);
  }
  document.body.style.setProperty("--works-wallpaper", `url("../images/wallpapers/salon-wallpaper-${selected}.webp")`);
  document.body.dataset.worksWallpaper = selected;
}

function splitTags(tags) { return (tags || []).flatMap((tag) => String(tag).split(/[、，,]/).map((item) => item.trim()).filter(Boolean)); }
function workFrameNumber(work) {
  const selected = String(work.frame?.id || "");
  if (/^salon-(?:0[1-9]|1[0-4])$/.test(selected)) return Number(selected.slice(-2));
  const hash = [...String(work.id || work.title || "")].reduce((total, character) => ((total * 33) + character.codePointAt(0)) >>> 0, 5381);
  return (hash % 12) + 1;
}
function customFrame(work) { return loadedFrames.find((frame) => frame.id === work.frame?.id) || null; }
function applyWorkFrame(container, work) {
  const frame = work.frame || {};
  const custom = customFrame(work);
  container.dataset.frame = frame.id === "none" ? "none" : custom ? "custom" : String(workFrameNumber(work)).padStart(2, "0");
  if (custom) {
    container.dataset.frameShape = custom.shape;
    container.style.setProperty("--salon-frame", `url("${new URL(`../${custom.asset}`, document.baseURI).href}")`);
    container.style.setProperty("--custom-frame-opening-inset", `${Math.round(Number(custom.openingInset || .12) * 100)}%`);
    container.style.setProperty("--custom-frame-ratio", String(Number(custom.ratio) || 1));
  } else container.removeAttribute("data-frame-shape");
  container.style.setProperty("--work-frame-fit", frame.fit === "contain" ? "contain" : "cover");
  container.style.setProperty("--work-frame-scale", String(Number.isFinite(Number(frame.scale)) ? Number(frame.scale) : 1));
  container.style.setProperty("--work-frame-x", `${Number.isFinite(Number(frame.positionX)) ? Number(frame.positionX) : 50}%`);
  container.style.setProperty("--work-frame-y", `${Number.isFinite(Number(frame.positionY)) ? Number(frame.positionY) : 50}%`);
}
function createWorkFrameOverlay() {
  const overlay = document.createElement("span");
  overlay.className = "work-frame-overlay";
  overlay.setAttribute("aria-hidden", "true");
  return overlay;
}
function corridorPreviewSource(work) {
  if (work.type === "video") return work.thumbnail ? new URL(`../${work.thumbnail}`, document.baseURI).href : "";
  return mediaUrl(work);
}
function hasLongWorkDescription(value) {
  const text = String(value || "").trim();
  return text.length > 220 || text.split(/\r?\n/).length > 8;
}
function createCorridorNeighbor(work) {
  const panel = document.createElement("article");
  panel.className = "work-corridor-panel work-corridor-neighbor";
  panel.dataset.workId = work.id;
  const mediaWrap = document.createElement("div"); mediaWrap.className = "work-detail-media-wrap";
  const media = document.createElement("div"); media.className = "work-detail-media"; applyWorkFrame(media, work);
  const opening = document.createElement("div"); opening.className = "work-frame-opening";
  const source = corridorPreviewSource(work);
  if (source) {
    const image = document.createElement("img"); image.src = source; image.alt = work.title || work.id; image.loading = "lazy"; image.decoding = "async"; image.draggable = false; opening.append(image);
  } else {
    const placeholder = document.createElement("span"); placeholder.className = "detail-loading"; placeholder.textContent = "影片封面準備中"; opening.append(placeholder);
  }
  media.append(opening, createWorkFrameOverlay()); mediaWrap.append(media);
  const content = document.createElement("article"); content.className = "work-detail-content"; content.classList.toggle("is-long-description", hasLongWorkDescription(work.description));
  const id = document.createElement("p"); id.className = "work-id"; id.textContent = work.id;
  const title = document.createElement("h1"); title.textContent = work.title || ""; title.hidden = !String(work.title || "").trim();
  const description = document.createElement("p"); description.className = "work-description"; description.textContent = work.description || ""; description.hidden = !work.description;
  const meta = document.createElement("dl"); meta.className = "work-meta";
  const addNeighborMeta = (label, value) => {
    if (!value) return;
    const term = document.createElement("dt"); const definition = document.createElement("dd");
    term.textContent = label; definition.textContent = value; meta.append(term, definition);
  };
  addNeighborMeta("分類", work.category);
  addNeighborMeta("日期", formatDate(work.publishDate || work.createDate || work.createdAt || work.updatedAt || work.updatedDate));
  const stage = document.createElement("div"); stage.className = "work-detail-stage";
  const exhibit = document.createElement("div"); exhibit.className = "work-detail-exhibit";
  content.append(id, title, description, meta); exhibit.append(mediaWrap, content); stage.append(exhibit); panel.append(stage);
  return panel;
}
function corridorIsVertical() { return matchMedia("(max-width: 767px)").matches; }
function corridorPanelPosition(panel) { return corridorIsVertical() ? panel?.offsetTop || 0 : panel?.offsetLeft || 0; }
function scheduleCorridorLayout() {
  cancelAnimationFrame(corridorLayoutFrame);
  corridorLayoutFrame = requestAnimationFrame(() => requestAnimationFrame(syncCorridorCardBaseline));
}

function syncCorridorCardBaseline() {
  if (!elements.corridorTrack) return;
  if (corridorIsVertical()) {
    elements.corridorTrack.style.removeProperty("--corridor-card-top");
    return;
  }
  const bottoms = [...elements.corridorTrack.children].map((panel) => {
    const stage = panel.querySelector(".work-detail-stage");
    const media = panel.querySelector(".work-detail-media");
    if (!stage || !media) return 0;
    return media.getBoundingClientRect().bottom - stage.getBoundingClientRect().top;
  });
  const baseline = Math.max(0, ...bottoms) + 16;
  elements.corridorTrack.style.setProperty("--corridor-card-top", `${baseline}px`);
}
function resetCorridorPosition() {
  if (!elements.corridorViewport) return;
  corridorResetting = true;
  const amount = corridorPanelPosition(elements.detail);
  elements.corridorViewport.scrollTo(corridorIsVertical() ? { top: amount, behavior: "auto" } : { left: amount, behavior: "auto" });
  requestAnimationFrame(() => { corridorResetting = false; });
}
function renderVirtualCorridor(works, currentWork) {
  if (!elements.corridorTrack || !elements.corridorViewport || works.length < 1) return;
  const currentIndex = works.findIndex((item) => item.id === currentWork.id);
  const requestedPageSize = Number.parseInt(query.get("pageSize") || "", 10);
  const pageSize = [24, 50].includes(requestedPageSize) ? requestedPageSize : (corridorIsVertical() ? 24 : 50);
  const pageStart = Math.floor(Math.max(0, currentIndex) / pageSize) * pageSize;
  const corridorWorks = works.slice(pageStart, pageStart + pageSize);
  const panels = corridorWorks.map((work) => {
    if (work.id !== currentWork.id) return createCorridorNeighbor(work);
    elements.detail.dataset.workId = work.id;
    elements.detail.dataset.corridorCurrent = "true";
    elements.detail.dataset.corridorActive = "true";
    return elements.detail;
  });
  corridorResetting = true;
  elements.corridorTrack.replaceChildren(...panels);
  elements.corridorViewport.hidden = false;
  resetCorridorPosition();
  scheduleCorridorLayout();
}
function settleVirtualCorridor() {
  if (corridorResetting || elements.corridorViewport.hidden) return;
  const position = corridorIsVertical() ? elements.corridorViewport.scrollTop : elements.corridorViewport.scrollLeft;
  const panels = [...elements.corridorTrack.children];
  const panelIndex = panels.reduce((closest, panel, index) => (
    Math.abs(corridorPanelPosition(panel) - position) < Math.abs(corridorPanelPosition(panels[closest]) - position) ? index : closest
  ), 0);
  const target = panels[panelIndex];
  if (target?.dataset.workId === activeWorkId) return;
  if (target?.dataset.workId && target.dataset.workId !== activeWorkId) {
    activateCorridorPanel(target);
  }
}
function activateCorridorPanel(target, { push = true } = {}) {
  const nextWork = loadedWorks.find((work) => work.id === target?.dataset.workId);
  const previousWork = loadedWorks.find((work) => work.id === activeWorkId);
  if (!nextWork || !previousWork || target?.dataset.workId === activeWorkId) return false;
  if (corridorIsVertical()) return activateMobileCorridorPanel(target, nextWork, { push });
  const previousPanel = createCorridorNeighbor(previousWork);
  elements.detail.replaceWith(previousPanel);
  target.replaceWith(elements.detail);
  activeWorkId = nextWork.id;
  query.set("id", nextWork.id);
  elements.detail.dataset.workId = nextWork.id;
  elements.detail.dataset.corridorCurrent = "true";
  renderWork(nextWork, filteredWorks(loadedWorks), { preserveCorridor: true });
  if (push) window.history.pushState({ workId: nextWork.id }, "", workUrl(nextWork.id));
  scheduleCorridorLayout();
  return true;
}
function activateMobileCorridorPanel(target, work, { push = true } = {}) {
  activeVideo?.pause?.();
  activeVideo = null;
  elements.videoControls.hidden = true;
  elements.corridorTrack.querySelector("[data-corridor-active='true']")?.removeAttribute("data-corridor-active");
  target.dataset.corridorActive = "true";
  const media = target.querySelector(".work-detail-media");
  const opening = media?.querySelector(".work-frame-opening");
  const overlay = media?.querySelector(".work-frame-overlay");
  if (media && opening && (work.type === "video" || youtubeVideoId(work))) {
    upgradeMobileOpeningMedia(opening, work);
    media.append(elements.videoControls);
    if (overlay) media.append(overlay);
  }
  activeWorkId = work.id;
  query.set("id", work.id);
  document.title = `${work.title || work.id} · Shi-Gai`;
  const works = filteredWorks(loadedWorks);
  const index = works.findIndex((item) => item.id === work.id);
  const hasNavigation = works.length > 1;
  if (hasNavigation) {
    elements.previous.href = workUrl(works[(index - 1 + works.length) % works.length].id);
    elements.next.href = workUrl(works[(index + 1) % works.length].id);
    elements.previous.dataset.workId = works[(index - 1 + works.length) % works.length].id;
    elements.next.dataset.workId = works[(index + 1) % works.length].id;
  }
  syncSystemControlVisibility(hasNavigation);
  window.ShiGaiAnalytics?.track("view_work", { work_id: work.id, work_type: work.type || "unknown" });
  if (push) window.history.pushState({ workId: work.id }, "", workUrl(work.id));
  return true;
}
function upgradeMobileOpeningMedia(opening, work) {
  if (opening.dataset.liveWorkId === work.id) return;
  const previewNodes = [...opening.children];
  const liveMedia = createMedia(work);
  liveMedia.classList.add("work-frame-live-media");
  opening.dataset.liveWorkId = work.id;
  opening.append(liveMedia);
  const reveal = () => {
    if (!liveMedia.isConnected) return;
    liveMedia.classList.add("is-ready");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!liveMedia.isConnected) return;
      previewNodes.forEach((node) => {
        node.style.visibility = "hidden";
        node.setAttribute("aria-hidden", "true");
      });
    }));
  };
  const readinessTarget = liveMedia.matches("video") ? liveMedia : liveMedia.querySelector("iframe");
  if (readinessTarget?.matches("video") && readinessTarget.readyState >= 2) reveal();
  else readinessTarget?.addEventListener(readinessTarget.matches("video") ? "loadeddata" : "load", reveal, { once: true });
}
function mediaUrl(work) {
  if (work.thumbnail || work.file) return new URL(`../${work.thumbnail || work.file}`, document.baseURI).href;
  const youtube = youtubeVideoId(work);
  return youtube ? `https://i.ytimg.com/vi/${youtube}/hqdefault.jpg` : "";
}
function youtubeVideoId(work) {
  const source = work.externalMedia?.find((item) => item.platform === "youtube")?.url;
  if (!source) return "";
  try {
    const url = new URL(source); const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const id = host === "youtu.be" ? url.pathname.split("/").filter(Boolean)[0] : url.searchParams.get("v") || (url.pathname.match(/^\/(?:shorts|embed)\/([^/?#]+)/) || [])[1];
    return /^[A-Za-z0-9_-]{11}$/.test(id || "") ? id : "";
  } catch { return ""; }
}
function characterColor(name) {
  const palette = ["#79B8E8", "#FF9B6A", "#8fc590", "#a98cda", "#e5a6bd", "#d2ad55"];
  return palette[[...name].reduce((total, character) => total + character.codePointAt(0), 0) % palette.length];
}
function galleryUrl() {
  const galleryQuery = new URLSearchParams(query);
  galleryQuery.delete("id");
  galleryQuery.delete("pageSize");
  const suffix = galleryQuery.toString();
  return `works.html${suffix ? `?${suffix}` : ""}`;
}
function workUrl(id) {
  const workQuery = new URLSearchParams(query);
  workQuery.set("id", id);
  return `work.html?${workQuery.toString()}`;
}
function showWorkWithoutReload(id, { push = true, reveal = false } = {}) {
  const work = loadedWorks.find((item) => item.id === id);
  if (!work) return false;
  const existingPanel = [...(elements.corridorTrack?.children || [])].find((panel) => panel.dataset.workId === id);
  if (existingPanel && existingPanel.dataset.workId !== activeWorkId) {
    const activated = activateCorridorPanel(existingPanel, { push });
    if (activated && reveal) {
      const revealPanel = corridorIsVertical() ? existingPanel : elements.detail;
      const amount = corridorPanelPosition(revealPanel);
      elements.corridorViewport.scrollTo(corridorIsVertical() ? { top: amount, behavior: "smooth" } : { left: amount, behavior: "smooth" });
    }
    return activated;
  }
  activeWorkId = id;
  query.set("id", id);
  renderWork(work, filteredWorks(loadedWorks));
  if (push) window.history.pushState({ workId: id }, "", workUrl(id));
  return true;
}
function renderCharacters(characters) {
  elements.characters.replaceChildren();
  if (!characters?.length) return elements.characters.append(emptyText("尚未標記角色。"));
  characters.forEach((name) => {
    const chip = document.createElement("span"); chip.className = "character-chip";
    const symbol = document.createElement("span"); symbol.className = "character-symbol";
    symbol.style.background = characterColor(name); symbol.textContent = [...name][0] || "•";
    symbol.setAttribute("aria-hidden", "true"); chip.append(symbol, document.createTextNode(name)); elements.characters.append(chip);
  });
}
function emptyText(message) { const text = document.createElement("p"); text.className = "detail-empty"; text.textContent = message; return text; }
function addMeta(label, value) {
  if (!value) return;
  const term = document.createElement("dt"); const definition = document.createElement("dd");
  term.textContent = label; definition.textContent = value; elements.meta.append(term, definition);
}
function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat("zh-Hant", { dateStyle: "medium" }).format(date);
}
function filteredWorks(works) {
  const keyword = (query.get("q") || "").trim().toLocaleLowerCase();
  const character = query.get("character") || "";
  const category = query.get("category") || "";
  const year = query.get("year") || "";
  return window.ShiGaiWorkOrder.newestFirst(works.filter((work) => {
    const searchable = [work.id, work.title, work.description, work.category, ...(work.characters || []), ...splitTags(work.tags), work.series].filter(Boolean).join(" ").toLocaleLowerCase();
    const date = work.publishDate || work.createDate || "";
    return (!keyword || searchable.includes(keyword)) && (!character || work.characters?.includes(character))
      && (!category || work.category === category) && (!year || date.startsWith(year));
  }));
}
function createMedia(work) {
  activeVideo = null;
  elements.videoControls.hidden = true;
  const youtubeId = youtubeVideoId(work);
  const hasPublishedVideo = work.type === "video" && Boolean(work.file);
  if (youtubeId && !hasPublishedVideo) {
    window.ShiGaiAnalytics?.track("play_media", { work_id: work.id, media_type: "youtube" });
    const wrapper = document.createElement("div");
    wrapper.className = "work-youtube-embed";
    const frame = document.createElement("iframe");
    frame.className = "work-youtube-player";
    const pageOrigin = location.origin && location.origin !== "null" ? location.origin : "";
    const originParameter = pageOrigin ? `&origin=${encodeURIComponent(pageOrigin)}` : "";
    frame.src = `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1&controls=0&autoplay=1&mute=1&playsinline=1${originParameter}`;
    frame.title = `${work.title || work.id} YouTube 影片`;
    frame.loading = "lazy";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    frame.allowFullscreen = true;
    const fallback = document.createElement("a");
    fallback.className = "work-youtube-fallback";
    fallback.href = `https://www.youtube.com/watch?v=${youtubeId}`;
    fallback.target = "_blank";
    fallback.rel = "noopener noreferrer";
    fallback.textContent = "無法播放？在 YouTube 開啟";
    fallback.hidden = true;
    frame.addEventListener("error", () => { fallback.hidden = false; });
    wrapper.append(frame, fallback);
    elements.videoControls.hidden = true;
    return wrapper;
  }
  const media = document.createElement(work.type === "video" ? "video" : "img");
  media.src = work.type === "video" ? new URL(`../${work.file}`, document.baseURI).href : mediaUrl(work); media.alt = work.title || work.id;
  media.draggable = false;
  if (work.type !== "video") return media;
  if (work.thumbnail) media.poster = new URL(`../${work.thumbnail}`, document.baseURI).href;
  media.autoplay = true; media.muted = true; media.loop = true; media.playsInline = true; media.preload = "metadata"; media.controls = false;
  activeVideo = media;
  ["autoplay", "muted", "loop", "playsinline"].forEach((attribute) => media.setAttribute(attribute, ""));
  media.addEventListener("canplay", () => media.play().catch(() => {}), { once: true });
  elements.videoControls.hidden = false;
  const syncPlayButton = () => {
    const paused = media.paused;
    elements.playPause.textContent = paused ? "▶" : "❚❚";
    elements.playPause.setAttribute("aria-label", paused ? "播放影片" : "暫停影片");
  };
  media.addEventListener("play", syncPlayButton); media.addEventListener("pause", syncPlayButton);
  media.addEventListener("play", () => window.ShiGaiAnalytics?.track("play_media", { work_id: work.id, media_type: "video" }), { once: true });
  syncPlayButton();
  return media;
}
function renderWork(work, works, { preserveCorridor = false } = {}) {
  window.ShiGaiAnalytics?.track("view_work", { work_id: work.id, work_type: work.type || "unknown" });
  document.title = `${work.title || work.id} · Shi-Gai`;
  elements.id.textContent = work.id; elements.title.textContent = work.title || ""; elements.title.hidden = !String(work.title || "").trim();
  elements.description.textContent = work.description || ""; elements.description.hidden = !work.description;
  elements.content.classList.toggle("is-long-description", hasLongWorkDescription(work.description));
  applyWorkFrame(elements.media, work);
  const opening = document.createElement("div");
  opening.className = "work-frame-opening";
  opening.append(createMedia(work));
  elements.media.replaceChildren(opening, elements.videoControls, createWorkFrameOverlay());
  elements.meta.replaceChildren();
  addMeta("分類", work.category);
  addMeta("日期", formatDate(work.publishDate || work.createDate || work.createdAt || work.updatedAt || work.updatedDate));
  renderCharacters(work.characters);
  const tags = splitTags(work.tags); elements.tags.replaceChildren();
  elements.tagsGroup.hidden = tags.length === 0;
  if (tags.length) tags.forEach((tag) => { const chip = document.createElement("span"); chip.className = "tag-chip"; chip.textContent = tag; elements.tags.append(chip); });
  const index = works.findIndex((item) => item.id === work.id);
  const hasNavigation = works.length > 1;
  if (hasNavigation) {
    elements.previous.href = workUrl(works[(index - 1 + works.length) % works.length].id);
    elements.next.href = workUrl(works[(index + 1) % works.length].id);
    elements.previous.dataset.workId = works[(index - 1 + works.length) % works.length].id;
    elements.next.dataset.workId = works[(index + 1) % works.length].id;
  }
  syncSystemControlVisibility(hasNavigation);
  elements.detail.hidden = false;
  if (!preserveCorridor) renderVirtualCorridor(works, work);
}
function showError() { elements.loading.hidden = true; elements.error.hidden = false; }

const backUrl = galleryUrl();
elements.back.href = backUrl;

async function loadWork() {
  if (!activeWorkId) return showError();
  try {
    const [worksResponse, scenesResponse, framesResponse, settings] = await Promise.all([fetch("../database/website/works.json"), fetch("../database/website/scenes.json"), fetch("../database/website/frames.json"), window.ShiGaiWebsiteSettings]);
    if (!worksResponse.ok) throw new Error("Website export data could not be loaded.");
    const [works, scenes, frames] = await Promise.all([worksResponse.json(), scenesResponse.ok ? scenesResponse.json() : [], framesResponse.ok ? framesResponse.json() : []]);
    loadedWorks = works;
    loadedFrames = Array.isArray(frames) ? frames : [];
    workDetailControls = settings?.websiteBrand?.controls || {};
    renderWorkDetailUi(scenes);
    const currentWork = works.find((work) => work.id === activeWorkId);
    if (!currentWork) return showError();
    renderWork(currentWork, filteredWorks(works));
    elements.loading.hidden = true;
  } catch (error) { showError(); }
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") window.location.href = backUrl;
  else if (!corridorIsVertical() && event.key === "ArrowLeft") { event.preventDefault(); moveWorkDetail(-1); }
  else if (!corridorIsVertical() && event.key === "ArrowRight") { event.preventDefault(); moveWorkDetail(1); }
  else if (corridorIsVertical() && event.key === "ArrowUp") { event.preventDefault(); moveWorkDetail(-1); }
  else if (corridorIsVertical() && event.key === "ArrowDown") { event.preventDefault(); moveWorkDetail(1); }
});
elements.playPause.addEventListener("click", toggleActiveVideoPlay);
elements.soundToggle.addEventListener("click", toggleActiveVideoSound);
elements.uiLayer?.addEventListener("click", handleWorkDetailUiInteraction);
elements.uiLayer?.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") handleWorkDetailUiInteraction(event); });
matchMedia("(orientation: portrait)").addEventListener?.("change", () => { if (workDetailUiScene) renderWorkDetailUi([workDetailUiScene]); });
const corridorSupportsScrollEnd = elements.corridorViewport && "onscrollend" in elements.corridorViewport;
elements.corridorViewport?.addEventListener("scroll", () => {
  if (corridorResetting) return;
  if (corridorIsVertical() && corridorSupportsScrollEnd) return;
  window.clearTimeout(corridorSettleTimer);
  corridorSettleTimer = window.setTimeout(settleVirtualCorridor, corridorIsVertical() ? 220 : 140);
}, { passive: true });
if (corridorSupportsScrollEnd) elements.corridorViewport.addEventListener("scrollend", settleVirtualCorridor, { passive: true });
elements.corridorViewport?.addEventListener("pointerdown", (event) => {
  if (corridorIsVertical() || event.button !== 0 || event.target.closest("a, button, video, iframe, .work-detail-content")) return;
  event.preventDefault();
  corridorDrag = { pointerId: event.pointerId, x: event.clientX, scrollLeft: elements.corridorViewport.scrollLeft };
  elements.corridorViewport.setPointerCapture(event.pointerId);
  elements.corridorViewport.classList.add("is-dragging");
});
elements.corridorViewport?.addEventListener("pointermove", (event) => {
  if (!corridorDrag || corridorDrag.pointerId !== event.pointerId) return;
  event.preventDefault();
  elements.corridorViewport.scrollLeft = corridorDrag.scrollLeft + corridorDrag.x - event.clientX;
});
function finishCorridorDrag(event) {
  if (!corridorDrag || corridorDrag.pointerId !== event.pointerId) return;
  corridorDrag = null;
  elements.corridorViewport.classList.remove("is-dragging");
  window.clearTimeout(corridorSettleTimer);
  corridorSettleTimer = window.setTimeout(settleVirtualCorridor, 80);
}
elements.corridorViewport?.addEventListener("pointerup", finishCorridorDrag);
elements.corridorViewport?.addEventListener("pointercancel", finishCorridorDrag);
elements.corridorViewport?.addEventListener("mousedown", (event) => {
  if (corridorIsVertical() || event.button !== 0 || corridorDrag || event.target.closest("a, button, video, iframe, .work-detail-content")) return;
  event.preventDefault();
  corridorDrag = { pointerId: null, x: event.clientX, scrollLeft: elements.corridorViewport.scrollLeft };
  elements.corridorViewport.classList.add("is-dragging");
});
window.addEventListener("mousemove", (event) => {
  if (!corridorDrag || corridorDrag.pointerId !== null) return;
  event.preventDefault();
  elements.corridorViewport.scrollLeft = corridorDrag.scrollLeft + corridorDrag.x - event.clientX;
});
window.addEventListener("mouseup", () => {
  if (!corridorDrag || corridorDrag.pointerId !== null) return;
  corridorDrag = null;
  elements.corridorViewport.classList.remove("is-dragging");
  window.clearTimeout(corridorSettleTimer);
  corridorSettleTimer = window.setTimeout(settleVirtualCorridor, 80);
});
elements.corridorViewport?.addEventListener("wheel", (event) => {
  if (corridorIsVertical() || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
  const readableCard = event.target.closest(".work-detail-content");
  if (readableCard && readableCard.scrollHeight > readableCard.clientHeight) {
    const canScrollUp = event.deltaY < 0 && readableCard.scrollTop > 0;
    const canScrollDown = event.deltaY > 0 && readableCard.scrollTop + readableCard.clientHeight < readableCard.scrollHeight - 1;
    if (canScrollUp || canScrollDown) return;
  }
  event.preventDefault();
  elements.corridorViewport.scrollLeft += event.deltaY;
}, { passive: false });
elements.corridorTrack?.addEventListener("load", scheduleCorridorLayout, true);
elements.corridorTrack?.addEventListener("loadedmetadata", scheduleCorridorLayout, true);
window.addEventListener("resize", scheduleCorridorLayout, { passive: true });
[elements.previous, elements.next].forEach((link) => link.addEventListener("click", (event) => {
  if (!link.dataset.workId || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  showWorkWithoutReload(link.dataset.workId, { reveal: true });
}));
window.addEventListener("popstate", () => {
  const id = new URLSearchParams(window.location.search).get("id");
  if (id) showWorkWithoutReload(id, { push: false, reveal: true });
});
selectExhibitionWallpaper();
loadWork();
