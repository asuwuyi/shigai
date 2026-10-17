// V2-M4 Homepage composition host. Sections read existing Website exports only.
(function initializeHomeSections() {
  "use strict";

  const root = document.querySelector("[data-home-sections]");
  if (!root) return;

  const analyticsEvents = Object.freeze({
    sectionView: "home_section_view",
    sectionInteraction: "home_section_interaction",
    scrollDepth: "scroll_depth"
  });
  const dailyEngine = window.ShiGaiDailyComposition;
  if (!dailyEngine) return;
  const dailyContext = dailyEngine.createContext();
  const registry = new Map();
  // Share one request and parsed snapshot within this page; failures remain retryable.
  const publicDataRequests = new Map();
  function publicData(name, optional = false) {
    if (!publicDataRequests.has(name)) {
      const request = fetch(`../database/website/${name}.json`, { cache: "no-store" }).then(response => {
        if (!response.ok) throw new Error(`${name} export unavailable`);
        return response.json();
      }).catch(error => { publicDataRequests.delete(name); throw error; });
      publicDataRequests.set(name, request);
    }
    const request = publicDataRequests.get(name);
    return optional ? request.catch(() => []) : request;
  }
  const sectionDefinitions = Object.freeze([
    Object.freeze({ id: "latest-journal", type: "latest-journal", enabled: true, fixedOrder: 10 }),
    Object.freeze({ id: "daily-game", type: "habit-recommendation", enabled: true, fixedOrder: 20 }),
    Object.freeze({ id: "archive-discovery", type: "archive-discovery", enabled: true, fixedOrder: 30 })
  ]);
  const composition = dailyEngine.resolveSections(sectionDefinitions, dailyContext);
  const homeCopyDefaults = Object.freeze({
    "latest-journal": Object.freeze({ eyebrow: "TODAY IN SHI-GAI", title: "今天留下的片段", moreLabel: "走進 Journal →", actionLabel: "前往完整 Journal →", titleAsset: "" }),
    "daily-game": Object.freeze({ eyebrow: "TODAY'S GAME", title: "今天一起玩什麼？", moreLabel: "所有遊戲 →", intro: "直接在這裡玩今天推薦的遊戲。", actionLabel: "放大遊玩 →", titleAsset: "" }),
    "archive-discovery": Object.freeze({ eyebrow: "ARCHIVE DISCOVERY", title: "今天重新遇見的作品", moreLabel: "探索所有 Works →", actionLabel: "走進這件作品 →", refreshLabel: "再遇見一件", loadingLabel: "正在尋找…", retryLabel: "再試一次", titleAsset: "" })
  });
  async function homeCopy(sectionId) {
    const key = { "latest-journal": "latestJournal", "daily-game": "dailyGame", "archive-discovery": "archiveDiscovery" }[sectionId];
    const settings = await window.ShiGaiWebsiteSettings;
    return { ...homeCopyDefaults[sectionId], ...(settings?.websiteBrand?.home?.[key] || {}), visuals: Object.fromEntries(["eyebrow", "title", "moreLabel", "actionLabel"].map(field => [field, settings?.websiteBrand?.visualTitles?.[`home-${key}-${field}`]])), transition: settings?.websiteBrand?.homeTransitions?.[key] || null };
  }

  function track(eventName, parameters) {
    window.ShiGaiAnalytics?.track(eventName, {
      contract_version: "v2_analytics_1",
      daily_key: dailyContext.dateKey,
      weekday: dailyContext.weekday,
      ...parameters
    });
  }
  function safeMediaSource(work) {
    const source = work?.media?.optimized?.outputs?.primary || work?.file || "";
    return source.startsWith("assets/") && !source.split("/").includes("..") ? `../${source}` : "";
  }
  function safePosterSource(work) {
    const source = work?.media?.optimized?.outputs?.poster || work?.thumbnail || "";
    return source.startsWith("assets/") && !source.split("/").includes("..") ? `../${source}` : "";
  }
  const archiveMediaPreparation = new Map();
  function loadArchiveImage(source, timeout = 8000) {
    let image = new Image(), settled = false;
    image.fetchPriority = "low";
    let promote = () => {};
    const promise = new Promise((resolve, reject) => {
      const expire = () => finish(() => reject(new Error("Archive image timed out")));
      let timer = setTimeout(expire, timeout);
      const finish = (callback) => { if (settled) return; settled = true; clearTimeout(timer); image.onload = null; image.onerror = null; image = null; callback(); };
      promote = () => {
        if (settled || image.fetchPriority === "high") return;
        image.fetchPriority = "high";
        // A background preload's age must not consume the user's click budget.
        clearTimeout(timer); timer = setTimeout(expire, timeout);
      };
      image.decoding = "async";
      image.onload = () => {
        const decoded = typeof image.decode === "function" ? image.decode().catch(() => {}) : Promise.resolve();
        decoded.then(() => finish(resolve));
      };
      image.onerror = () => finish(() => reject(new Error("Archive image unavailable")));
      image.src = source;
    });
    return { promise, promote: () => promote() };
  }
  function loadArchiveVideoFrame(source, timeout = 8000) {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      const timer = setTimeout(() => reject(new Error("Archive video timed out")), timeout);
      const finish = (callback) => { clearTimeout(timer); video.onloadeddata = null; video.onerror = null; callback(); };
      video.preload = "auto"; video.muted = true; video.playsInline = true;
      video.onloadeddata = () => finish(resolve);
      video.onerror = () => finish(() => reject(new Error("Archive video unavailable")));
      video.src = source; video.load();
    });
  }
  function prepareArchiveWork(work, foreground = false) {
    const source = safeMediaSource(work);
    const poster = safePosterSource(work);
    const key = `${source}|${poster}`;
    if (!source) return Promise.reject(new Error("Archive media unavailable"));
    if (!archiveMediaPreparation.has(key)) {
      const preparation = work.type === "video" && !poster
        ? { promise: loadArchiveVideoFrame(source), promote: () => {} }
        : loadArchiveImage(work.type === "video" ? poster : source);
      preparation.promise = preparation.promise.catch((error) => {
        if (archiveMediaPreparation.get(key) === preparation) archiveMediaPreparation.delete(key);
        throw error;
      });
      archiveMediaPreparation.set(key, preparation);
    }
    const preparation = archiveMediaPreparation.get(key);
    if (foreground) preparation.promote();
    return preparation.promise;
  }
  function workDate(work) {
    return String(work?.publishDate || work?.createDate || "").replaceAll("-", " · ") || "今天";
  }
  function newestFirst(first, second) {
    const firstDate = Date.parse(first?.publishDate || first?.createDate || first?.createdAt || 0) || 0;
    const secondDate = Date.parse(second?.publishDate || second?.createDate || second?.createdAt || 0) || 0;
    return secondDate - firstDate || String(second?.id || "").localeCompare(String(first?.id || ""), undefined, { numeric: true });
  }
  function safeFrameSource(frame) {
    const source = String(frame?.asset || "");
    return source.startsWith("assets/") && !source.split("/").includes("..") ? new URL(`../${source}`, document.baseURI).href : "";
  }
  function workFrameNumber(work) {
    const selected = String(work?.frame?.id || "");
    if (/^salon-(?:0[1-9]|1[0-4])$/.test(selected)) return Number(selected.slice(-2));
    const hash = [...String(work?.id || work?.title || "")].reduce((total, character) => ((total * 33) + character.codePointAt(0)) >>> 0, 5381);
    return (hash % 12) + 1;
  }
  function framedMediaNode(work, frames, className = "home-journal-media") {
    const wrap = document.createElement("figure");
    wrap.className = className;
    const artwork = document.createElement("div");
    artwork.className = "home-journal-artwork work-card";
    const mediaShell = document.createElement("div");
    mediaShell.className = "work-media";
    const opening = document.createElement("div");
    opening.className = "work-frame-opening";
    const frame = work?.frame || {};
    const selectedFrame = frames.find((frame) => frame?.id === work?.frame?.id);
    const frameSource = safeFrameSource(selectedFrame);
    artwork.dataset.frame = frame.id === "none" ? "none" : frameSource ? "custom" : String(workFrameNumber(work)).padStart(2, "0");
    if (frameSource) {
      artwork.dataset.frameShape = selectedFrame.shape;
      artwork.style.setProperty("--salon-frame", `url("${frameSource}")`);
      artwork.style.setProperty("--custom-frame-opening-inset", `${Math.round(Number(selectedFrame.openingInset || .12) * 100)}%`);
      artwork.style.setProperty("--custom-frame-ratio", String(Number(selectedFrame.ratio) || 1));
    } else {
      artwork.removeAttribute("data-frame-shape");
    }
    artwork.style.setProperty("--work-frame-fit", frame.fit === "contain" ? "contain" : "cover");
    artwork.style.setProperty("--work-frame-scale", String(Number.isFinite(Number(frame.scale)) ? Number(frame.scale) : 1));
    artwork.style.setProperty("--work-frame-x", `${Number.isFinite(Number(frame.positionX)) ? Number(frame.positionX) : 50}%`);
    artwork.style.setProperty("--work-frame-y", `${Number.isFinite(Number(frame.positionY)) ? Number(frame.positionY) : 50}%`);
    const source = safeMediaSource(work);
    if (source) {
      const media = work.type === "video" ? document.createElement("video") : document.createElement("img");
      media.src = source;
      if (media.tagName === "VIDEO") { media.controls = true; media.playsInline = true; media.preload = "metadata"; media.poster = safePosterSource(work); }
      else { media.loading = "lazy"; media.alt = work.title || "今天留下的片段"; }
      opening.append(media);
    }
    mediaShell.append(opening);
    artwork.append(mediaShell);
    wrap.append(artwork);
    return wrap;
  }
  function archiveEntry(work, labels, frames, onRefresh) {
    const article = document.createElement("article");
    article.className = "home-archive-entry";
    article.dataset.contentId = work.id;
    const copy = document.createElement("div"); copy.className = "home-archive-copy";
    const meta = document.createElement("p"); meta.className = "home-living-card-date";
    meta.textContent = [workDate(work), work.category].filter(Boolean).join(" · ");
    const title = document.createElement("h3");
    const character = String(work.characters?.[0] || "").trim();
    title.textContent = work.title || ""; title.hidden = !title.textContent;
    const body = document.createElement("p"); body.className = "home-archive-body"; body.textContent = work.description || ""; body.hidden = !body.textContent;
    copy.classList.toggle("is-minimal", title.hidden && body.hidden);
    const actions = document.createElement("div"); actions.className = "home-archive-actions";
    const link = document.createElement("a"); link.className = "home-archive-link"; link.href = `work.html?id=${encodeURIComponent(work.id)}`; link.textContent = labels.actionLabel;
    window.ShiGaiVisualText?.apply(link, labels.actionLabel, labels.visuals?.actionLabel);
    link.addEventListener("click", () => track(analyticsEvents.sectionInteraction, { section_id: "archive-discovery", content_id: work.id, action: "open_archive_work" }));
    actions.append(link);
    if (onRefresh) {
      const refresh = document.createElement("button"); refresh.className = "home-archive-refresh"; refresh.type = "button"; refresh.textContent = labels.refreshLabel;
      refresh.addEventListener("click", () => onRefresh(refresh)); actions.append(refresh);
    }
    copy.append(meta, title, body, actions); article.append(framedMediaNode(work, frames, "home-archive-media"), copy);
    return article;
  }
  function latestJournalEntry(work, frames, labels) {
    const article = document.createElement("article");
    article.className = "home-journal-entry";
    article.dataset.contentId = work.id;
    const copy = document.createElement("div"); copy.className = "home-journal-copy";
    const date = document.createElement("p"); date.className = "home-living-card-date"; date.textContent = workDate(work);
    const title = document.createElement("h3"); title.textContent = work.title || work.id;
    const body = document.createElement("p"); body.className = "home-journal-body"; body.textContent = work.journal?.text || work.description || "今天留下了一個新的片段。";
    const link = document.createElement("a"); link.className = "home-journal-link"; link.href = `journal.html?id=${encodeURIComponent(work.id)}`; link.textContent = labels.actionLabel;
    window.ShiGaiVisualText?.apply(link, labels.actionLabel, labels.visuals?.actionLabel);
    link.addEventListener("click", () => track(analyticsEvents.sectionInteraction, { section_id: "latest-journal", content_id: work.id, action: "open_journal" }));
    copy.append(date, title, body, link); article.append(framedMediaNode(work, frames), copy);
    return article;
  }
  function sectionShell(config, labels, href) {
    const section = document.createElement("section"); section.className = "home-living-section"; section.dataset.homeSection = config.id; section.id = config.id;
    const connection = document.createElement("div"); connection.className = "home-level-connection"; connection.setAttribute("aria-hidden", "true");
    if (config.id === "latest-journal") connection.classList.add("is-journal-passage");
    const ladder = document.createElement("span"); ladder.className = "home-level-ladder"; connection.append(ladder); section.append(connection);
    const transition = labels.transition;
    const transitionAsset = String(transition?.asset || "");
    if (transition?.enabled === true && transitionAsset.startsWith("assets/") && !transitionAsset.split("/").includes("..")) {
      const decoration = document.createElement("div"); decoration.className = "home-section-transition"; decoration.setAttribute("aria-hidden", "true");
      const image = document.createElement("img"); image.dataset.transitionSource = `../${transitionAsset}`; image.alt = ""; image.decoding = "async"; image.fetchPriority = "low";
      ["mobile", "desktop"].forEach((layout) => {
        const value = transition[layout] || {};
        decoration.style.setProperty(`--transition-${layout}-x`, `${Number(value.x) || 0}%`);
        decoration.style.setProperty(`--transition-${layout}-y`, `${Number(value.y) || 0}px`);
        decoration.style.setProperty(`--transition-${layout}-scale`, Math.max(.2, Number(value.scale) || 1));
        decoration.style.setProperty(`--transition-${layout}-rotation`, `${Number(value.rotation) || 0}deg`);
        decoration.style.setProperty(`--transition-${layout}-parallax`, Math.max(0, Number(value.parallax) || 0));
      });
      decoration.append(image); section.append(decoration);
    }
    const heading = document.createElement("header"); heading.className = "home-living-heading";
    const copy = document.createElement("div");
    const label = document.createElement("p"); label.textContent = labels.eyebrow;
    const headingTitle = document.createElement("h2"); headingTitle.textContent = labels.title;
    const titleAsset = String(labels.titleAsset || "");
    if (!labels.visuals?.title?.asset && labels.visuals?.title?.mode !== "text" && titleAsset.startsWith("assets/") && !titleAsset.split("/").includes("..")) {
      const image = document.createElement("img"); image.className = "home-living-title-image"; image.src = `../${titleAsset}`; image.alt = labels.title;
      headingTitle.classList.add("has-title-image"); headingTitle.replaceChildren(image);
    }
    const more = document.createElement("a"); more.className = "home-living-more"; more.href = href; more.textContent = labels.moreLabel;
    for (const [field, node] of [["eyebrow", label], ["title", headingTitle], ["moreLabel", more]]) {
      if (labels.visuals?.[field]?.asset || labels.visuals?.[field]?.mobileAsset || labels.visuals?.[field]?.mode === "text") window.ShiGaiVisualText?.apply(node, labels[field], labels.visuals[field]);
    }
    more.addEventListener("click", () => track(analyticsEvents.sectionInteraction, { section_id: config.id, content_id: "", action: "open_all" }));
    copy.append(label, headingTitle); heading.append(copy, more); section.append(heading);
    return section;
  }
  function observeSection(section, sectionId) {
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= .35)) return;
      track(analyticsEvents.sectionView, { section_id: sectionId, content_id: section.dataset.contentId || "" });
      observer.disconnect();
    }, { threshold: .35 });
    observer.observe(section.querySelector(".home-living-heading") || section);
  }
  function observeScrollDepth() {
    const sent = new Set();
    let frame = 0;
    const report = () => {
      frame = 0;
      if (!root.children.length || scrollY <= 0 || document.body.classList.contains("is-home-loading")) return;
      const available = document.documentElement.scrollHeight - innerHeight;
      if (available <= 0) return;
      const depth = Math.round((scrollY / available) * 100);
      [25, 50, 75, 100].forEach((threshold) => {
        if (depth < threshold || sent.has(threshold)) return;
        sent.add(threshold); track(analyticsEvents.scrollDepth, { page: "home", percent: threshold });
      });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(report); };
    addEventListener("scroll", schedule, { passive: true });
    addEventListener("resize", schedule, { passive: true });
    root.addEventListener("load", schedule, true);
    window.addEventListener("shi-gai:home-sections-ready", schedule);
  }
  function enableTransitionParallax() {
    const transitions = [...document.querySelectorAll(".home-section-transition")];
    const sections = [...document.querySelectorAll(".home-living-section")];
    if ((!transitions.length && !sections.length) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      transitions.forEach((node) => {
        const rect = node.parentElement.getBoundingClientRect();
        const progress = Math.max(-1, Math.min(1, (innerHeight / 2 - rect.top) / innerHeight));
        const layout = matchMedia("(min-width: 780px)").matches ? "desktop" : "mobile";
        const strength = Number(getComputedStyle(node).getPropertyValue(`--transition-${layout}-parallax`)) || 0;
        node.style.setProperty("--transition-parallax-offset", `${(progress * strength).toFixed(2)}px`);
      });
      sections.forEach((section) => {
        const rect = section.getBoundingClientRect();
        const progress = Math.max(-1, Math.min(1, (innerHeight / 2 - rect.top) / innerHeight));
        const strength = matchMedia("(min-width: 780px)").matches ? 20 : 12;
        section.style.setProperty("--home-background-parallax-offset", `${(progress * strength).toFixed(2)}px`);
      });
    };
    addEventListener("scroll", () => { if (!frame) frame = requestAnimationFrame(update); }, { passive: true });
    update();
  }
  async function enableHomeCompanion() {
    const settings = await window.ShiGaiWebsiteSettings;
    const companion = settings?.websiteBrand?.homeCompanion;
    if (companion?.enabled !== true) return;
    const keyForSection = { "latest-journal": "latestJournal", "daily-game": "dailyGame", "archive-discovery": "archiveDiscovery" };
    const scene = document.querySelector("[data-home-scene]");
    const items = Array.isArray(companion.items) && companion.items.length ? companion.items : [{ id: "companion-1", enabled: true, playback: "loop", states: companion.states || {} }];
    // Ground objects reuse the managed companion media/settings, but belong to
    // document flow, not the viewport-following character's scroll path.
    items.filter(item => item.enabled !== false && item.attachment === "section").forEach(item => {
      const sectionId = Object.keys(keyForSection).find(id => keyForSection[id] === item.section);
      const section = sectionId && root.querySelector(`#${sectionId}`);
      const state = item.states?.[item.section];
      const asset = String(state?.asset || "");
      if (!section || !asset.startsWith("assets/") || asset.split("/").includes("..")) return;
      let ground = section.querySelector('.home-ground-strip');
      if (!ground) { ground = document.createElement('div'); ground.className = 'home-ground-strip'; ground.setAttribute('aria-hidden', 'true'); section.append(ground); }
      const object = document.createElement('div'); object.className = 'home-ground-object'; object.dataset.companionId = item.id;
      for (const device of ['mobile', 'desktop']) {
        const value = state[device] || {};
        for (const [key, fallback, suffix] of [['x',50,'%'],['y',50,'%'],['scale',1,''],['rotation',0,'deg'],['opacity',1,'']]) {
          const number = Number.isFinite(Number(value[key])) ? Number(value[key]) : fallback;
          object.style.setProperty(`--ground-${device}-${key}`, `${number}${suffix}`);
        }
        object.style.setProperty(`--ground-${device}-flip`, value.flipX ? -1 : 1);
      }
      const video = /\.(webm|mp4)$/i.test(asset);
      const media = document.createElement(video ? 'video' : 'img'); media.src = `../${asset}`; media.alt = ''; media.decoding = 'async'; media.loading = 'lazy';
      if (video) { media.muted = true; media.loop = true; media.playsInline = true; media.preload = 'none';
        const observer = new IntersectionObserver(entries => entries.forEach(entry => {
          if (entry.isIntersecting && !matchMedia('(prefers-reduced-motion: reduce)').matches) media.play().catch(() => {}); else media.pause();
        })); observer.observe(media);
      }
      media.addEventListener('error', () => { object.remove(); if (!ground.children.length) ground.remove(); }, { once: true });
      object.append(media); ground.append(object);
    });
    const rendered = items.filter((item) => item.enabled !== false && item.attachment !== "section").map((item) => {
      const host = document.createElement("div"); host.className = "home-companion"; host.setAttribute("aria-hidden", "true"); host.dataset.motion = companion.motion === "fade" ? "fade" : "straight"; host.dataset.companionId = item.id || "companion"; document.body.append(host);
      return { item, host, media: null, currentAsset: "" };
    });
    let frame = 0;
    const safeAsset = (value) => String(value || "").startsWith("assets/") && !String(value).split("/").includes("..") ? `../${value}` : "";
    const update = () => {
      frame = 0;
      const rootRect = root.getBoundingClientRect(); const sceneRect = scene?.getBoundingClientRect();
      const layout = matchMedia("(min-width: 780px)").matches ? "desktop" : "mobile";
      const pageProgress = Math.max(0, Math.min(1, (innerHeight - rootRect.top) / Math.max(1, rootRect.height + innerHeight)));
      const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
      rendered.forEach((entry) => {
        const { item, host } = entry; const pageTop = sceneRect?.top ?? rootRect.top; host.hidden = pageTop >= innerHeight || rootRect.bottom <= 0; if (host.hidden) { entry.media?.pause?.(); return; }
        const sections = [...(scene ? [scene] : []), ...root.querySelectorAll(".home-living-section")];
        const baseState = item.states?.todayScene || item.states?.latestJournal; const hasKeyframes = Object.values(item.states || {}).some((state) => Array.isArray(state?.[layout]?.path) && state[layout].path.length > 0);
        const anchors = sections.map((section) => ({ state: hasKeyframes ? (section === scene ? baseState : item.states?.[keyForSection[section.id]]) : baseState, center: section.getBoundingClientRect().top + (section.getBoundingClientRect().height / 2) })).filter((anchor) => anchor.state);
        if (!anchors.length) return;
        const viewportCenter = innerHeight / 2; let from = anchors[0]; let to = anchors[anchors.length - 1];
        for (let index = 0; index < anchors.length - 1; index += 1) if (viewportCenter >= anchors[index].center && viewportCenter <= anchors[index + 1].center) { from = anchors[index]; to = anchors[index + 1]; break; }
        if (viewportCenter < anchors[0].center) from = to = anchors[0]; if (viewportCenter > anchors[anchors.length - 1].center) from = to = anchors[anchors.length - 1];
        const progress = from === to ? 0 : Math.max(0, Math.min(1, (viewportCenter - from.center) / Math.max(1, to.center - from.center)));
        const first = from.state[layout] || {}; const second = to.state[layout] || first; const numeric = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
        const path = (Array.isArray(second.path) ? second.path : []).slice(0, 6);
        const route = [{ x: numeric(first.x, 50), y: numeric(first.y, 60), scale: numeric(first.scale, 1), opacity: numeric(first.opacity, 1), rotation: numeric(first.rotation, 0), offset: 0 }].concat(path.map((point, index) => ({ x: numeric(point?.x, 50), y: numeric(point?.y, 60), scale: numeric(point?.scale, first.scale), opacity: numeric(point?.opacity, 1), rotation: numeric(first.rotation, 0), offset: Math.max(.001, Math.min(.999, numeric(point?.offset, (index + 1) / (path.length + 1)))) }))).concat([{ x: numeric(second.x, 50), y: numeric(second.y, 60), scale: numeric(second.scale, 1), opacity: numeric(second.opacity, 1), rotation: numeric(second.rotation, 0), offset: 1 }]).sort((a, b) => a.offset - b.offset);
        const foundIndex = route.findIndex((point, index) => index < route.length - 1 && progress >= point.offset && progress <= route[index + 1].offset); const routeIndex = Math.max(0, Math.min(route.length - 2, foundIndex)); const part = Math.max(0, Math.min(1, (progress - route[routeIndex].offset) / Math.max(.0001, route[routeIndex + 1].offset - route[routeIndex].offset)));
        const interpolate = (key, fallback) => numeric(route[routeIndex]?.[key], fallback) + ((numeric(route[routeIndex + 1]?.[key], fallback) - numeric(route[routeIndex]?.[key], fallback)) * part);
        const selected = progress < .5 ? from.state : to.state; const selectedLayout = progress < .5 ? first : second; const asset = safeAsset(selected.asset);
        if (asset && asset !== entry.currentAsset) { entry.currentAsset = asset; const isVideo = /\.(webm|mp4)(?:$|\?)/i.test(asset); const media = document.createElement(isVideo ? "video" : "img"); media.alt = ""; media.src = asset; if (isVideo) { media.muted = true; media.playsInline = true; media.loop = item.playback !== "scroll"; } host.replaceChildren(media); entry.media = media; host.classList.remove("is-changing"); void host.offsetWidth; host.classList.add("is-changing"); }
        const x = companion.motion === "fade" ? numeric(selectedLayout.x, 50) : interpolate("x", 50); const y = companion.motion === "fade" ? numeric(selectedLayout.y, 60) : interpolate("y", 60); const scale = companion.motion === "fade" ? numeric(selectedLayout.scale, 1) : interpolate("scale", 1); const opacity = companion.motion === "fade" ? numeric(selectedLayout.opacity, 1) : interpolate("opacity", 1); const rotation = companion.motion === "fade" ? numeric(selectedLayout.rotation, 0) : interpolate("rotation", 0); const flipX = selectedLayout.flipX === true ? -1 : 1;
        host.style.setProperty("--companion-x", `${x}%`); host.style.setProperty("--companion-y", `${y}%`); host.style.setProperty("--companion-scale", scale.toFixed(3)); host.style.setProperty("--companion-opacity", Math.max(0, Math.min(1, opacity)).toFixed(3)); host.style.setProperty("--companion-rotation", `${rotation.toFixed(2)}deg`); host.style.setProperty("--companion-flip-x", flipX);
        if (entry.media?.tagName === "VIDEO") { if (item.playback === "scroll" || reduceMotion) { entry.media.pause(); const setTime = () => { if (Number.isFinite(entry.media.duration)) entry.media.currentTime = reduceMotion ? 0 : Math.min(entry.media.duration, Math.max(0, entry.media.duration * pageProgress)); }; entry.media.readyState >= 1 ? setTime() : entry.media.addEventListener("loadedmetadata", setTime, { once: true }); } else entry.media.play().catch(() => {}); }
      });
    };
    addEventListener("scroll", () => { if (!frame) frame = requestAnimationFrame(update); }, { passive: true });
    addEventListener("resize", () => { if (!frame) frame = requestAnimationFrame(update); }, { passive: true });
    update();
  }

  registry.set("latest-journal", async (config) => {
    const copy = await homeCopy(config.id);
    const section = sectionShell(config, copy, "journal.html");
    const content = document.createElement("div"); content.className = "home-journal-content"; section.append(content);
    try {
      const [works, frames] = await Promise.all([publicData("works"), publicData("frames", true)]);
      const work = works.filter((item) => item?.status === "published" && item?.journal?.enabled === true).sort(newestFirst)[0];
      if (work) { section.dataset.contentId = work.id; content.append(latestJournalEntry(work, frames, copy)); }
      else { const empty = document.createElement("p"); empty.className = "home-living-empty"; empty.textContent = "今天的故事還在路上。先在 Scene 裡四處看看吧。"; content.append(empty); }
    } catch {
      const empty = document.createElement("p"); empty.className = "home-living-empty"; empty.textContent = "今天的訊號暫時沒有接上，稍後再回來看看。"; content.append(empty);
    }
    observeSection(section, config.id);
    return section;
  });

  registry.set("habit-recommendation", async (config) => {
    const copy = await homeCopy(config.id);
    const section = sectionShell(config, copy, "games.html");
    const grid = document.createElement("div"); grid.className = "home-habit-grid"; section.append(grid);
    try {
      const response = await fetch("../database/website/games.json", { cache: "no-store" });
      if (!response.ok) throw new Error("Games export unavailable");
      const games = (await response.json())
        .filter((item) => item?.status === "published" && item?.visible !== false && item?.url)
        .sort((first, second) => Number(first.order || 0) - Number(second.order || 0) || String(first.id).localeCompare(String(second.id)));
      const game = games[dailyEngine.selectIndex(games.length, dailyContext, "daily-game")];
      if (!game) throw new Error("Habit interaction unavailable");
      section.dataset.contentId = game.id;
      const panel = document.createElement("div"); panel.className = "home-game-embed"; panel.dataset.gameId = game.id;
      const intro = document.createElement("p"); intro.className = "home-game-embed-intro"; intro.textContent = game.description || copy.intro;
      const frameStage = document.createElement("div"); frameStage.className = "home-game-frame-stage";
      const frame = document.createElement("iframe"); frame.className = "home-game-frame"; frame.src = `${game.url}${game.url.includes("?") ? "&" : "?"}embed=home`; frame.title = `${game.name || game.id} 完整遊戲`; frame.loading = "lazy"; frame.allow = "fullscreen";
      let gameStarted = false;
      window.addEventListener("message", event => {
        if (event.origin !== location.origin || event.source !== frame.contentWindow || event.data?.type !== "shi-gai:game-analytics") return;
        const name = event.data.event;
        if (!["game_start", "game_draw", "game_interaction", "game_complete"].includes(name)) return;
        if (name === "game_start") { if (gameStarted) return; gameStarted = true; }
        const supplied = event.data.parameters || {};
        const safe = Object.fromEntries(["action", "draw_count", "duration_ms", "level_id"].filter(key => ["string", "number"].includes(typeof supplied[key])).map(key => [key, supplied[key]]));
        track(name, { ...safe, game_id: game.id, section_id: config.id, source: "home_inline" });
      });
      if (game.id === "spot-difference") {
        frameStage.classList.add("is-awaiting-activation");
        const activate = document.createElement("button"); activate.className = "home-game-activate"; activate.type = "button";
        const activateLabel = document.createElement("span"); activateLabel.textContent = "開始遊玩找找不同 →"; activate.append(activateLabel);
        activate.addEventListener("click", () => {
          frameStage.classList.remove("is-awaiting-activation");
          activate.remove();
          frame.contentWindow?.postMessage({ type: "shi-gai:start-embedded-game" }, location.origin);
          track(analyticsEvents.sectionInteraction, { section_id: config.id, content_id: game.id, action: "activate_inline_game" });
        });
        frameStage.append(frame, activate);
      } else frameStage.append(frame);
      const controls = document.createElement("div"); controls.className = "home-game-embed-controls";
      const full = document.createElement("a"); full.className = "home-game-full"; full.href = game.url; full.textContent = copy.actionLabel;
      window.ShiGaiVisualText?.apply(full, copy.actionLabel, copy.visuals?.actionLabel);
      frame.addEventListener("load", () => track(analyticsEvents.sectionInteraction, { section_id: config.id, content_id: game.id, action: "load_original_game_inline" }));
      full.addEventListener("click", () => track(analyticsEvents.sectionInteraction, { section_id: config.id, content_id: game.id, action: "open_full_game" }));
      controls.append(full); panel.append(intro, frameStage, controls); grid.append(panel);
    } catch {
      const empty = document.createElement("p"); empty.className = "home-living-empty"; empty.textContent = "今天的互動正在準備，仍可前往遊戲室看看。"; grid.append(empty);
    }
    observeSection(section, config.id);
    return section;
  });

  registry.set("archive-discovery", async (config) => {
    const copy = await homeCopy(config.id);
    const section = sectionShell(config, copy, "works.html");
    const content = document.createElement("div"); content.className = "home-archive-content"; section.append(content);
    try {
      const [allWorks, frames] = await Promise.all([publicData("works"), publicData("frames", true)]);
      const works = allWorks.filter((item) => item?.status === "published" && safeMediaSource(item));
      let index = dailyEngine.selectIndex(works.length, dailyContext, "archive-discovery");
      let revealCount = 0;
      if (index < 0) throw new Error("Archive discovery unavailable");
      const nextIndex = (fromIndex, count) => {
        const offset = 1 + dailyEngine.selectIndex(works.length - 1, dailyContext, `archive-discovery-refresh-${count}`);
        return (fromIndex + offset) % works.length;
      };
      const preloadUpcoming = () => {
        if (works.length < 2) return;
        let projectedIndex = index;
        for (let step = 1; step <= 2; step += 1) {
          projectedIndex = nextIndex(projectedIndex, revealCount + step);
          prepareArchiveWork(works[projectedIndex]).catch(() => {});
        }
      };
      const renderWork = (animate = false) => {
        section.dataset.contentId = works[index].id;
        const refresh = works.length > 1 ? async (button) => {
          const targetCount = revealCount + 1;
          const targetIndex = nextIndex(index, targetCount);
          button.disabled = true; button.textContent = copy.loadingLabel;
          content.setAttribute("aria-busy", "true");
          try {
            await prepareArchiveWork(works[targetIndex], true);
            revealCount = targetCount; index = targetIndex;
            track(analyticsEvents.sectionInteraction, { section_id: "archive-discovery", content_id: works[index].id, action: "refresh_archive_work" });
            renderWork(true); preloadUpcoming();
          } catch {
            button.disabled = false; button.textContent = copy.retryLabel;
          } finally { content.removeAttribute("aria-busy"); }
        } : null;
        const entry = archiveEntry(works[index], copy, frames, refresh);
        if (animate) entry.classList.add("is-revealing");
        content.replaceChildren(entry);
      };
      renderWork();
      // Recommendation media should not compete with the first Scene.
      if ("IntersectionObserver" in window) {
        const preloader = new IntersectionObserver(entries => {
          if (entries.some(entry => entry.isIntersecting)) { preloadUpcoming(); preloader.disconnect(); }
        }, { rootMargin: "200px" });
        preloader.observe(section);
      }
    } catch {
      const empty = document.createElement("p"); empty.className = "home-living-empty"; empty.textContent = "今天的作品發現暫時沒有接上，仍可前往 Works 探索。"; content.append(empty);
    }
    observeSection(section, config.id);
    return section;
  });

  Promise.all(composition.filter((section) => section.enabled).sort((a, b) => a.order - b.order).map(async (config) => {
    const renderer = registry.get(config.type);
    return renderer ? renderer(config) : null;
  })).then((sections) => {
    sections.filter(Boolean).forEach((section, index) => { section.dataset.undergroundDepth = String(index); });
    root.replaceChildren(...sections.filter(Boolean));
    const transitions = root.querySelectorAll("[data-transition-source]");
    const loadTransition = image => { image.src = image.dataset.transitionSource; delete image.dataset.transitionSource; };
    if ("IntersectionObserver" in window) {
      const loader = new IntersectionObserver(entries => entries.forEach(entry => {
        if (entry.isIntersecting) { loadTransition(entry.target); loader.unobserve(entry.target); }
      }), { rootMargin: "150px" });
      transitions.forEach(image => loader.observe(image));
    } else transitions.forEach(loadTransition);
    enableTransitionParallax();
    enableHomeCompanion();
    window.dispatchEvent(new CustomEvent("shi-gai:home-sections-ready"));
    if (location.hash) scrollToHomeSectionFromHash();
  });
  function scrollToHomeSectionFromHash() {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) target.scrollIntoView({ behavior: "auto", block: "start" });
  }
  observeScrollDepth();

  window.ShiGaiHomeSections = Object.freeze({ registry, composition, dailyContext, analyticsEvents });
})();
