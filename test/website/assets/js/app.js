// Shi-Gai Works Gallery data reader.
const desktopWorksPerPage = 50;
const mobileWorksPerPage = 24;
const mobileWorksQuery = matchMedia("(max-width: 767px)");
const state = { works: [], characters: [], categories: [], frames: [], filteredWorks: [], page: 1, pageSize: mobileWorksQuery.matches ? mobileWorksPerPage : desktopWorksPerPage, showFirstPage: true, showPreviousPage: true, showPagePicker: true, showNextPage: true, showLastPage: true };
const exhibitionWallpapers = ["burgundy-01", "sage-02", "navy-03", "ochre-04"];
let publishedCorridorScenes = [];

const elements = {
  grid: document.getElementById("worksGrid"), template: document.getElementById("workCardTemplate"),
  search: document.getElementById("searchInput"), characterFilter: document.getElementById("characterFilter"),
  categoryFilter: document.getElementById("categoryFilter"), yearFilter: document.getElementById("yearFilter"),
  clearFilters: document.getElementById("clearFilters"), browsePanel: document.querySelector(".browse-panel"),
  mobileSearchButton: document.getElementById("mobileSearchButton"), summary: document.getElementById("resultSummary"),
  empty: document.getElementById("emptyState"), error: document.getElementById("loadError")
};
elements.pagination = document.getElementById("worksPagination");
elements.previousPage = document.getElementById("previousPage");
elements.nextPage = document.getElementById("nextPage");
elements.firstPage = document.getElementById("firstPage");
elements.lastPage = document.getElementById("lastPage");
elements.pageSelect = document.getElementById("pageSelect");
elements.pageStatus = document.getElementById("pageStatus");
elements.menuPagination = document.getElementById("worksMenuPagination");
elements.menuPreviousPage = document.getElementById("menuPreviousPage");
elements.menuNextPage = document.getElementById("menuNextPage");
elements.menuPageSelect = document.getElementById("menuPageSelect");
elements.closeMenu = document.getElementById("closeWorksMenu");
elements.corridor = document.getElementById("worksCorridor");
elements.corridorScene = document.getElementById("worksCorridorScene");

function selectExhibitionWallpaper() {
  const key = "shi-gai:works-wallpaper:v1";
  let selected = sessionStorage.getItem(key);
  if (!exhibitionWallpapers.includes(selected)) {
    selected = exhibitionWallpapers[Math.floor(Math.random() * exhibitionWallpapers.length)];
    sessionStorage.setItem(key, selected);
  }
  // The variable is consumed by stylesheet CSS, so this URL resolves from assets/css/.
  document.body.style.setProperty("--works-wallpaper", `url("../images/wallpapers/salon-wallpaper-${selected}.webp")`);
  document.body.dataset.worksWallpaper = selected;
}

function sceneMediaUrl(source) { return source ? new URL(`../${source}`, document.baseURI).href : ""; }
function corridorInteractionFromNode(node) {
  return window.ShiGaiSceneInteraction?.normalize({
    enabled: node?.dataset.sceneInteractionEnabled === "true", action: node?.dataset.sceneInteractionAction,
    target: node?.dataset.sceneInteractionTarget, cursor: node?.dataset.sceneInteractionCursor,
    openMode: node?.dataset.sceneInteractionOpenMode
  });
}

function renderWorksCorridor(scenes, preferredId = "") {
  publishedCorridorScenes = (Array.isArray(scenes) ? scenes : []).filter((item) => item?.status === "published" && item?.type === "work").sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  const scene = publishedCorridorScenes.find((item) => item.id === preferredId) || publishedCorridorScenes[0];
  if (!scene || !elements.corridor || !elements.corridorScene || !window.ShiGaiSceneRenderer) return;
  elements.corridor.hidden = false;
  elements.corridor.style.backgroundColor = scene.background?.asset ? (scene.background?.color || "#4b382a") : "transparent";
  elements.corridor.style.backgroundImage = scene.background?.asset ? `url("${sceneMediaUrl(scene.background.asset)}")` : "none";
  elements.corridor.style.backgroundSize = scene.background?.asset ? "cover" : "auto";
  window.ShiGaiSceneRenderer.renderScene({
    container: elements.corridorScene,
    scene,
    layout: matchMedia("(orientation: portrait)").matches ? "portrait" : "landscape",
    fitMode: "cover",
    applyBackground: false,
    resolveMediaSource: (object) => object.media?.src ? sceneMediaUrl(object.media.src) : "",
    objectAttributes: (object) => {
      const interaction = window.ShiGaiSceneInteraction?.normalize(object.interaction);
      const actionable = window.ShiGaiSceneInteraction?.isActionable(interaction);
      return {
        "aria-label": object.name || object.type || "作品展廊物件",
        "data-scene-interaction-enabled": actionable ? "true" : "false",
        "data-scene-interaction-action": interaction.action,
        "data-scene-interaction-target": interaction.target,
        "data-scene-interaction-cursor": interaction.cursor,
        "data-scene-interaction-open-mode": interaction.openMode,
        role: actionable ? "button" : null,
        tabIndex: actionable ? 0 : null
      };
    }
  });
}

function handleCorridorInteraction(event) {
  const node = event.target.closest?.("[data-scene-interaction-enabled='true']");
  if (!node || !elements.corridorScene?.contains(node)) return;
  const interaction = corridorInteractionFromNode(node);
  if (!window.ShiGaiSceneInteraction?.isActionable(interaction)) return;
  event.preventDefault();
  if (interaction.action === "previous-page") { goToPage(state.page - 1); return; }
  if (interaction.action === "next-page") { goToPage(state.page + 1); return; }
  if (interaction.action === "scene") {
    renderWorksCorridor(publishedCorridorScenes, interaction.target);
    return;
  }
  const route = window.ShiGaiSceneInteraction.route(interaction);
  if (!route) return;
  if (interaction.openMode === "new-tab") {
    const opened = window.open(route, "_blank");
    if (opened) opened.opener = null;
  } else window.location.assign(route);
}

function splitTags(tags) {
  return (tags || []).flatMap((tag) => String(tag).split(/[、，,]/).map((item) => item.trim()).filter(Boolean));
}

function mediaUrl(work) {
  const youtube = work.externalMedia?.find((item) => item.platform === "youtube")?.url.match(/[?&]v=([A-Za-z0-9_-]{11})/)?.[1];
  return youtube ? `https://i.ytimg.com/vi/${youtube}/hqdefault.jpg` : new URL(`../${work.thumbnail || work.file}`, document.baseURI).href;
}

function characterColor(name) {
  const palette = ["#79B8E8", "#FF9B6A", "#8fc590", "#a98cda", "#e5a6bd", "#d2ad55"];
  const hash = [...name].reduce((total, character) => total + character.codePointAt(0), 0);
  return palette[hash % palette.length];
}

function renderCharacters(container, characters) {
  container.replaceChildren();
  (characters || []).forEach((name) => {
    const chip = document.createElement("span");
    chip.className = "character-chip";
    const symbol = document.createElement("span");
    symbol.className = "character-symbol";
    symbol.style.background = characterColor(name);
    symbol.textContent = [...name][0] || "•";
    symbol.setAttribute("aria-hidden", "true");
    chip.append(symbol, document.createTextNode(name));
    container.append(chip);
  });
}

function createMedia(work) {
  const usePoster = work.type === "video" && work.thumbnail;
  const media = document.createElement(work.type === "video" && !usePoster ? "video" : "img");
  media.src = media.tagName === "VIDEO" ? new URL(`../${work.file}`, document.baseURI).href : mediaUrl(work);
  media.alt = work.title || work.id;
  if (media.tagName === "IMG") { media.loading = "lazy"; media.decoding = "async"; }
  if (media.tagName === "VIDEO") {
    media.muted = true;
    media.playsInline = true;
    media.preload = "metadata";
    media.controls = false;
    ["muted", "playsinline"].forEach((attribute) => media.setAttribute(attribute, ""));
  }
  return media;
}

function setOptions(select, values, placeholder) {
  const currentValue = select.value;
  select.replaceChildren(new Option(placeholder, ""));
  values.forEach((value) => select.add(new Option(value, value)));
  select.value = values.includes(currentValue) ? currentValue : "";
}

function renderFilters() {
  const years = [...new Set(state.works.map((work) => (work.publishDate || work.createDate || "").slice(0, 4)).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  setOptions(elements.characterFilter, state.characters.map((character) => character.name).filter(Boolean), "全部角色");
  setOptions(elements.categoryFilter, state.categories, "全部分類");
  setOptions(elements.yearFilter, years, "全部年份");
}

function restoreFilters() {
  const query = new URLSearchParams(window.location.search);
  elements.search.value = query.get("q") || "";
  elements.characterFilter.value = query.get("character") || "";
  elements.categoryFilter.value = query.get("category") || "";
  elements.yearFilter.value = query.get("year") || "";
  state.page = Math.max(1, Number.parseInt(query.get("page") || "1", 10) || 1);
}

function galleryQuery() {
  const query = new URLSearchParams();
  if (elements.search.value.trim()) query.set("q", elements.search.value.trim());
  if (elements.characterFilter.value) query.set("character", elements.characterFilter.value);
  if (elements.categoryFilter.value) query.set("category", elements.categoryFilter.value);
  if (elements.yearFilter.value) query.set("year", elements.yearFilter.value);
  if (state.page > 1) query.set("page", String(state.page));
  if (new URLSearchParams(window.location.search).get("review") === "1") query.set("review", "1");
  return query;
}

function currentWorksPerPage() { return mobileWorksQuery.matches ? mobileWorksPerPage : desktopWorksPerPage; }
function closeWorksMenu() {
  if (elements.browsePanel.contains(document.activeElement)) document.activeElement.blur();
  elements.browsePanel.classList.remove("is-open");
  elements.mobileSearchButton.setAttribute("aria-expanded", "false");
}

function detailUrl(work) {
  const query = galleryQuery();
  query.set("pageSize", String(state.pageSize));
  query.set("id", work.id);
  return `work.html?${query.toString()}`;
}

function workGallerySize(work) {
  const hash = [...String(work.id || "")].reduce((total, character) => ((total * 31) + character.codePointAt(0)) >>> 0, 0);
  return hash % 5 === 0 ? "wide" : "standard";
}

function workFrameNumber(work) {
  const selected = String(work.frame?.id || "");
  if (/^salon-(?:0[1-9]|1[0-4])$/.test(selected)) return Number(selected.slice(-2));
  const hash = [...String(work.id || work.title || "")].reduce((total, character) => ((total * 33) + character.codePointAt(0)) >>> 0, 5381);
  return (hash % 12) + 1;
}
function customFrame(work) { return state.frames.find((frame) => frame.id === work.frame?.id) || null; }

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

function layoutWorkCard(card) {
  const media = card?.querySelector("img, video");
  if (!card || !media) return;
  const naturalWidth = media.naturalWidth || media.videoWidth;
  const naturalHeight = media.naturalHeight || media.videoHeight;
  const width = card.getBoundingClientRect().width;
  if (!naturalWidth || !naturalHeight || !width) return;
  const gridStyle = getComputedStyle(elements.grid);
  const rowValue = Number.parseFloat(gridStyle.gridAutoRows);
  const gapValue = Number.parseFloat(gridStyle.rowGap);
  const row = Number.isFinite(rowValue) ? rowValue : 4;
  const gap = Number.isFinite(gapValue) ? gapValue : 0;
  const renderedHeight = card.querySelector(".work-media").getBoundingClientRect().height || (width * naturalHeight / naturalWidth);
  card.style.gridRowEnd = `span ${Math.max(1, Math.ceil((renderedHeight + gap) / (row + gap)))}`;
}

function layoutWorkGallery() {
  elements.grid.querySelectorAll(".work-card").forEach(layoutWorkCard);
}

function getFilteredWorks() {
  const keyword = elements.search.value.trim().toLocaleLowerCase();
  return window.ShiGaiWorkOrder.newestFirst(state.works.filter((work) => {
    const searchable = [work.id, work.title, work.description, work.category, ...(work.characters || []), ...splitTags(work.tags), work.series].filter(Boolean).join(" ").toLocaleLowerCase();
    const date = work.publishDate || work.createDate || "";
    return (!keyword || searchable.includes(keyword))
      && (!elements.characterFilter.value || (work.characters || []).includes(elements.characterFilter.value))
      && (!elements.categoryFilter.value || work.category === elements.categoryFilter.value)
      && (!elements.yearFilter.value || date.startsWith(elements.yearFilter.value));
  }));
}

function renderWorks() {
  state.filteredWorks = getFilteredWorks();
  const pageSize = currentWorksPerPage();
  if (pageSize !== state.pageSize) {
    const previousStart = (state.page - 1) * state.pageSize;
    state.page = Math.floor(previousStart / pageSize) + 1;
    state.pageSize = pageSize;
  }
  const pageCount = Math.max(1, Math.ceil(state.filteredWorks.length / pageSize));
  state.page = Math.min(Math.max(1, state.page), pageCount);
  const pageStart = (state.page - 1) * pageSize;
  const visibleWorks = state.filteredWorks.slice(pageStart, pageStart + pageSize);
  elements.grid.replaceChildren();
  elements.empty.hidden = Boolean(state.works.length) && Boolean(state.filteredWorks.length);
  elements.summary.textContent = state.works.length && state.filteredWorks.length ? `顯示 ${pageStart + 1}–${pageStart + visibleWorks.length}／${state.filteredWorks.length} 件作品` : "";
  elements.pagination.hidden = pageCount <= 1 || ![state.showFirstPage, state.showPreviousPage, state.showPagePicker, state.showNextPage, state.showLastPage].some(Boolean);
  elements.menuPagination.hidden = pageCount <= 1 || ![state.showPreviousPage, state.showPagePicker, state.showNextPage].some(Boolean);
  elements.previousPage.hidden = !state.showPreviousPage;
  elements.nextPage.hidden = !state.showNextPage;
  elements.firstPage.hidden = !state.showFirstPage;
  elements.pageSelect.closest("label").hidden = !state.showPagePicker;
  elements.lastPage.hidden = !state.showLastPage;
  elements.menuPreviousPage.hidden = !state.showPreviousPage;
  elements.menuPageSelect.closest("label").hidden = !state.showPagePicker;
  elements.menuNextPage.hidden = !state.showNextPage;
  elements.previousPage.disabled = state.page <= 1;
  elements.nextPage.disabled = state.page >= pageCount;
  elements.firstPage.disabled = state.page <= 1;
  elements.lastPage.disabled = state.page >= pageCount;
  elements.menuPreviousPage.disabled = state.page <= 1;
  elements.menuNextPage.disabled = state.page >= pageCount;
  const pageOptionsChanged = elements.pageSelect.options.length !== pageCount;
  if (pageOptionsChanged) {
    elements.pageSelect.replaceChildren(...Array.from({ length: pageCount }, (_, index) => new Option(String(index + 1), String(index + 1))));
  }
  if (elements.menuPageSelect.options.length !== pageCount) {
    elements.menuPageSelect.replaceChildren(...Array.from({ length: pageCount }, (_, index) => new Option(String(index + 1), String(index + 1))));
  }
  elements.pageSelect.value = String(state.page);
  elements.menuPageSelect.value = String(state.page);
  elements.pageSelect.setAttribute("aria-label", `選擇作品頁碼，目前第 ${state.page} 頁，共 ${pageCount} 頁`);
  elements.menuPageSelect.setAttribute("aria-label", `快速選擇作品頁碼，目前第 ${state.page} 頁，共 ${pageCount} 頁`);
  elements.pageStatus.textContent = `${state.page}／${pageCount}`;
  if (state.works.length && !state.filteredWorks.length) {
    elements.empty.hidden = false;
    elements.empty.querySelector("h2").textContent = "沒有符合條件的作品。";
    elements.empty.querySelector("p").textContent = "試試看不同的搜尋或篩選條件。";
  }
  visibleWorks.forEach((work) => {
    const fragment = elements.template.content.cloneNode(true);
    const card = fragment.querySelector(".work-card");
    applyWorkFrame(card, work);
    card.classList.toggle("is-wide", workGallerySize(work) === "wide");
    const button = fragment.querySelector(".work-card-button");
    const openWork = () => {
      window.ShiGaiAnalytics?.track("select_work", { work_id: work.id, work_type: work.type || "unknown" });
      window.location.href = detailUrl(work);
    };
    button.setAttribute("aria-label", `開啟作品 ${work.title || work.id}`);
    const mediaContainer = fragment.querySelector(".work-media");
    const media = createMedia(work);
    const frameOpening = document.createElement("div");
    frameOpening.className = "work-frame-opening";
    frameOpening.append(media);
    mediaContainer.append(frameOpening);
    const syncMediaRatio = () => layoutWorkCard(card);
    media.addEventListener(media.tagName === "VIDEO" ? "loadedmetadata" : "load", syncMediaRatio, { once: true });
    if (media.tagName === "IMG" && media.complete) syncMediaRatio();
    if (["gif", "video"].includes(work.type)) {
      const type = document.createElement("span");
      type.className = "work-media-type";
      type.textContent = work.type === "video" ? "▶" : "GIF";
      type.setAttribute("aria-hidden", "true");
      mediaContainer.append(type);
    }
    const title = fragment.querySelector(".work-title");
    if (String(work.title || "").trim()) title.textContent = work.title; else title.remove();
    renderCharacters(fragment.querySelector(".character-list"), work.characters);
    button.addEventListener("click", openWork);
    elements.grid.append(fragment);
  });
  requestAnimationFrame(layoutWorkGallery);
}

function renderSkeletons() {
  elements.grid.replaceChildren(...Array.from({ length: 8 }, () => {
    const card = document.createElement("div");
    card.className = "skeleton-card";
    card.setAttribute("aria-hidden", "true");
    return card;
  }));
}

async function loadWebsiteData() {
  try {
    const [worksResponse, charactersResponse, categoriesResponse, tagsResponse, scenesResponse, framesResponse, settings] = await Promise.all([
      fetch("../database/website/works.json"), fetch("../database/website/characters.json"),
      fetch("../database/website/categories.json"), fetch("../database/website/tags.json"), fetch("../database/website/scenes.json"), fetch("../database/website/frames.json"), window.ShiGaiWebsiteSettings
    ]);
    if (![worksResponse, charactersResponse, categoriesResponse, tagsResponse].every((response) => response.ok)) throw new Error("Website export data could not be loaded.");
    const [works, characters, categories, tags, scenes, frames] = await Promise.all([worksResponse.json(), charactersResponse.json(), categoriesResponse.json(), tagsResponse.json(), scenesResponse.ok ? scenesResponse.json() : [], framesResponse.ok ? framesResponse.json() : []]);
    state.works = Array.isArray(works) ? works : [];
    state.characters = Array.isArray(characters) ? characters : [];
    state.categories = Array.isArray(categories) ? categories : [];
    state.frames = Array.isArray(frames) ? frames : [];
    const controls = settings?.websiteBrand?.controls || {};
    const legacyPagination = settings?.websiteBrand?.works?.showSystemPagination !== false;
    const publishedWorkActions = new Set((Array.isArray(scenes) ? scenes : []).filter((scene) => scene?.status === "published" && scene?.type === "work").flatMap((scene) => (scene.objects || []).filter((object) => object.visible !== false && window.ShiGaiSceneInteraction?.isActionable(object.interaction)).map((object) => object.interaction.action)));
    const previousRequested = controls.worksPreviousPage !== false && controls.worksPagination !== false && legacyPagination;
    const nextRequested = controls.worksNextPage !== false && controls.worksPagination !== false && legacyPagination;
    state.showFirstPage = controls.worksFirstPage !== false;
    state.showPreviousPage = previousRequested || !publishedWorkActions.has("previous-page");
    state.showPagePicker = controls.worksPagePicker !== false;
    state.showNextPage = nextRequested || !publishedWorkActions.has("next-page");
    state.showLastPage = controls.worksLastPage !== false;
    renderFilters();
    restoreFilters();
    renderWorks();
    renderWorksCorridor(scenes);
  } catch (error) {
    elements.grid.replaceChildren();
    elements.summary.textContent = "";
    elements.error.hidden = false;
  }
}

function resetPageAndRender() { state.page = 1; renderWorks(); }
function goToPage(nextPage) {
  const pageCount = Math.max(1, Math.ceil(state.filteredWorks.length / state.pageSize));
  state.page = Math.min(pageCount, Math.max(1, nextPage));
  const query = galleryQuery();
  history.replaceState(null, "", `works.html${query.toString() ? `?${query}` : ""}`);
  renderWorks();
  elements.grid.scrollIntoView({ behavior: "smooth", block: "start" });
}

elements.search.addEventListener("input", resetPageAndRender);
elements.search.addEventListener("keydown", (event) => {
  if (event.key === "Escape") { elements.search.value = ""; resetPageAndRender(); elements.search.blur(); }
});
[elements.characterFilter, elements.categoryFilter, elements.yearFilter].forEach((filter) => filter.addEventListener("change", resetPageAndRender));
elements.clearFilters.addEventListener("click", () => {
  elements.search.value = "";
  elements.characterFilter.value = "";
  elements.categoryFilter.value = "";
  elements.yearFilter.value = "";
  resetPageAndRender();
});
elements.previousPage.addEventListener("click", () => goToPage(state.page - 1));
elements.nextPage.addEventListener("click", () => goToPage(state.page + 1));
elements.firstPage.addEventListener("click", () => goToPage(1));
elements.lastPage.addEventListener("click", () => goToPage(Math.max(1, Math.ceil(state.filteredWorks.length / state.pageSize))));
elements.pageSelect.addEventListener("change", () => goToPage(Number(elements.pageSelect.value)));
elements.menuPreviousPage.addEventListener("click", () => { goToPage(state.page - 1); closeWorksMenu(); });
elements.menuNextPage.addEventListener("click", () => { goToPage(state.page + 1); closeWorksMenu(); });
elements.menuPageSelect.addEventListener("change", () => { goToPage(Number(elements.menuPageSelect.value)); closeWorksMenu(); });
elements.mobileSearchButton.addEventListener("click", () => {
  const isOpen = elements.browsePanel.classList.toggle("is-open");
  elements.mobileSearchButton.setAttribute("aria-expanded", String(isOpen));
});
elements.closeMenu.addEventListener("click", closeWorksMenu);
elements.corridorScene?.addEventListener("click", handleCorridorInteraction);
elements.corridorScene?.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); handleCorridorInteraction(event); }
});
if (typeof ResizeObserver === "function") new ResizeObserver(() => requestAnimationFrame(layoutWorkGallery)).observe(elements.grid);
else window.addEventListener("resize", () => requestAnimationFrame(layoutWorkGallery));
mobileWorksQuery.addEventListener?.("change", () => {
  renderWorks();
  const query = galleryQuery();
  history.replaceState(null, "", `works.html${query.toString() ? `?${query}` : ""}`);
});

selectExhibitionWallpaper();
renderSkeletons();
loadWebsiteData();
