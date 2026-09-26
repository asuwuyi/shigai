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
  const sectionDefinitions = Object.freeze([
    Object.freeze({ id: "latest-journal", type: "latest-journal", enabled: true, fixedOrder: 10 }),
    Object.freeze({ id: "daily-game", type: "habit-recommendation", enabled: true, dailySlot: true }),
    Object.freeze({ id: "archive-discovery", type: "archive-discovery", enabled: true, dailySlot: true })
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
    return { ...homeCopyDefaults[sectionId], ...(settings?.websiteBrand?.home?.[key] || {}), transition: settings?.websiteBrand?.homeTransitions?.[key] || null };
  }

  function track(eventName, parameters) {
    window.ShiGaiAnalytics?.track(eventName, {
      contract_version: "v2_m4",
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
    return new Promise((resolve, reject) => {
      const image = new Image();
      const timer = setTimeout(() => reject(new Error("Archive image timed out")), timeout);
      const finish = (callback) => { clearTimeout(timer); image.onload = null; image.onerror = null; callback(); };
      image.decoding = "async";
      image.onload = () => {
        const decoded = typeof image.decode === "function" ? image.decode().catch(() => {}) : Promise.resolve();
        decoded.then(() => finish(resolve));
      };
      image.onerror = () => finish(() => reject(new Error("Archive image unavailable")));
      image.src = source;
    });
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
  function prepareArchiveWork(work) {
    const source = safeMediaSource(work);
    const poster = safePosterSource(work);
    const key = `${source}|${poster}`;
    if (!source) return Promise.reject(new Error("Archive media unavailable"));
    if (!archiveMediaPreparation.has(key)) {
      const preparation = (work.type === "video" ? (poster ? loadArchiveImage(poster) : loadArchiveVideoFrame(source)) : loadArchiveImage(source))
        .catch((error) => { archiveMediaPreparation.delete(key); throw error; });
      archiveMediaPreparation.set(key, preparation);
    }
    return archiveMediaPreparation.get(key);
  }
  function workDate(work) {
    return String(work?.publishDate || work?.createDate || "").replaceAll("-", " · ") || "今天";
  }
  function newestFirst(first, second) {
    const firstDate = Date.parse(first?.publishDate || first?.createDate || first?.createdAt || 0) || 0;
    const secondDate = Date.parse(second?.publishDate || second?.createDate || second?.createdAt || 0) || 0;
    return secondDate - firstDate || String(second?.id || "").localeCompare(String(first?.id || ""), undefined, { numeric: true });
  }
  function mediaNode(work, className = "home-journal-media") {
    const wrap = document.createElement("figure");
    wrap.className = className;
    const source = safeMediaSource(work);
    if (!source) return wrap;
    const media = work.type === "video" ? document.createElement("video") : document.createElement("img");
    media.src = source;
    if (media.tagName === "VIDEO") { media.controls = true; media.playsInline = true; media.preload = "metadata"; media.poster = safePosterSource(work); }
    else { media.loading = "lazy"; media.alt = ""; }
    wrap.append(media);
    return wrap;
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
    link.addEventListener("click", () => track(analyticsEvents.sectionInteraction, { section_id: "latest-journal", content_id: work.id, action: "open_journal" }));
    copy.append(date, title, body, link); article.append(framedMediaNode(work, frames), copy);
    return article;
  }
  function sectionShell(config, labels, href) {
    const section = document.createElement("section"); section.className = "home-living-section"; section.dataset.homeSection = config.id; section.id = config.id;
    const transition = labels.transition;
    const transitionAsset = String(transition?.asset || "");
    if (transition?.enabled === true && transitionAsset.startsWith("assets/") && !transitionAsset.split("/").includes("..")) {
      const decoration = document.createElement("div"); decoration.className = "home-section-transition"; decoration.setAttribute("aria-hidden", "true");
      const image = document.createElement("img"); image.src = `../${transitionAsset}`; image.alt = "";
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
    if (titleAsset.startsWith("assets/") && !titleAsset.split("/").includes("..")) {
      const image = document.createElement("img"); image.className = "home-living-title-image"; image.src = `../${titleAsset}`; image.alt = labels.title;
      headingTitle.classList.add("has-title-image"); headingTitle.replaceChildren(image);
    }
    const more = document.createElement("a"); more.className = "home-living-more"; more.href = href; more.textContent = labels.moreLabel;
    more.addEventListener("click", () => track(analyticsEvents.sectionInteraction, { section_id: config.id, content_id: "", action: "open_all" }));
    copy.append(label, headingTitle); heading.append(copy, more); section.append(heading);
    return section;
  }
  function observeSection(section, sectionId) {
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      track(analyticsEvents.sectionView, { section_id: sectionId });
      observer.disconnect();
    }, { threshold: .35 });
    observer.observe(section);
  }
  function observeScrollDepth() {
    const sent = new Set();
    const report = () => {
      const available = document.documentElement.scrollHeight - innerHeight;
      if (available <= 0) return;
      const depth = Math.round((scrollY / available) * 100);
      [25, 50, 75, 100].forEach((threshold) => {
        if (depth < threshold || sent.has(threshold)) return;
        sent.add(threshold); track(analyticsEvents.scrollDepth, { page: "home", percent: threshold });
      });
    };
    addEventListener("scroll", report, { passive: true });
    report();
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
    const host = document.createElement("div"); host.className = "home-companion"; host.setAttribute("aria-hidden", "true"); host.dataset.motion = companion.motion === "fade" ? "fade" : "straight";
    const image = document.createElement("img"); image.alt = ""; host.append(image); document.body.append(host);
    let currentAsset = ""; let frame = 0;
    const safeAsset = (value) => String(value || "").startsWith("assets/") && !String(value).split("/").includes("..") ? `../${value}` : "";
    const update = () => {
      frame = 0;
      const rootRect = root.getBoundingClientRect();
      host.hidden = rootRect.top >= innerHeight || rootRect.bottom <= 0;
      if (host.hidden) return;
      const layout = matchMedia("(min-width: 780px)").matches ? "desktop" : "mobile";
      const anchors = [...root.querySelectorAll(".home-living-section")].map((section) => ({ section, state: companion.states?.[keyForSection[section.id]], center: section.getBoundingClientRect().top + (section.getBoundingClientRect().height / 2) })).filter((item) => item.state);
      if (!anchors.length) return;
      const viewportCenter = innerHeight / 2;
      let from = anchors[0]; let to = anchors[anchors.length - 1];
      for (let index = 0; index < anchors.length - 1; index += 1) if (viewportCenter >= anchors[index].center && viewportCenter <= anchors[index + 1].center) { from = anchors[index]; to = anchors[index + 1]; break; }
      if (viewportCenter < anchors[0].center) from = to = anchors[0];
      if (viewportCenter > anchors[anchors.length - 1].center) from = to = anchors[anchors.length - 1];
      const distance = Math.max(1, to.center - from.center); const progress = from === to ? 0 : Math.max(0, Math.min(1, (viewportCenter - from.center) / distance));
      const first = from.state[layout] || {}; const second = to.state[layout] || first;
      const numeric = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
      const interpolate = (key, fallback) => numeric(first[key], fallback) + ((numeric(second[key], fallback) - numeric(first[key], fallback)) * progress);
      const selected = progress < .5 ? from.state : to.state; const asset = safeAsset(selected.asset);
      if (asset && asset !== currentAsset) { currentAsset = asset; image.src = asset; host.classList.remove("is-changing"); void host.offsetWidth; host.classList.add("is-changing"); }
      const selectedLayout = progress < .5 ? first : second;
      const x = companion.motion === "fade" ? numeric(selectedLayout.x, 50) : interpolate("x", 50);
      const y = companion.motion === "fade" ? numeric(selectedLayout.y, 60) : interpolate("y", 60);
      const scale = companion.motion === "fade" ? numeric(selectedLayout.scale, 1) : interpolate("scale", 1);
      host.style.setProperty("--companion-x", `${x}%`); host.style.setProperty("--companion-y", `${y}%`); host.style.setProperty("--companion-scale", scale.toFixed(3));
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
      const [worksResponse, framesResponse] = await Promise.all([
        fetch("../database/website/works.json", { cache: "no-store" }),
        fetch("../database/website/frames.json", { cache: "no-store" })
      ]);
      if (!worksResponse.ok) throw new Error("Works export unavailable");
      const frames = framesResponse.ok ? await framesResponse.json() : [];
      const work = (await worksResponse.json()).filter((item) => item?.status === "published" && item?.journal?.enabled === true).sort(newestFirst)[0];
      if (work) content.append(latestJournalEntry(work, frames, copy));
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
      const panel = document.createElement("div"); panel.className = "home-game-embed"; panel.dataset.gameId = game.id;
      const intro = document.createElement("p"); intro.className = "home-game-embed-intro"; intro.textContent = game.description || copy.intro;
      const frameStage = document.createElement("div"); frameStage.className = "home-game-frame-stage";
      const frame = document.createElement("iframe"); frame.className = "home-game-frame"; frame.src = `${game.url}${game.url.includes("?") ? "&" : "?"}embed=home`; frame.title = `${game.name || game.id} 完整遊戲`; frame.loading = "lazy"; frame.allow = "fullscreen";
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
      const [worksResponse, framesResponse] = await Promise.all([fetch("../database/website/works.json", { cache: "no-store" }), fetch("../database/website/frames.json", { cache: "no-store" })]);
      if (!worksResponse.ok) throw new Error("Works export unavailable");
      const frames = framesResponse.ok ? await framesResponse.json() : [];
      const works = (await worksResponse.json()).filter((item) => item?.status === "published" && safeMediaSource(item));
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
        const refresh = works.length > 1 ? async (button) => {
          const targetCount = revealCount + 1;
          const targetIndex = nextIndex(index, targetCount);
          button.disabled = true; button.textContent = copy.loadingLabel;
          content.setAttribute("aria-busy", "true");
          try {
            await prepareArchiveWork(works[targetIndex]);
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
      renderWork(); preloadUpcoming();
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
    root.replaceChildren(...sections.filter(Boolean));
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
