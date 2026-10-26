// Salon Games Hub. Reads the exported Games registry and optional published Game Scene only.
(async function loadGames() {
  const grid = document.getElementById("gamesGrid");
  const state = document.getElementById("gamesState");
  const backdrop = document.getElementById("gamesBackdrop");
  const backScene = document.getElementById("gamesBackScene");
  const front = document.getElementById("gamesFront");
  const frontScene = document.getElementById("gamesFrontScene");
  const copyDefaults = { eyebrow: "SHI-GAI PLAYROOM", title: "遊戲室", homeLabel: "← Home", homeAriaLabel: "返回首頁", previousLabel: "上一款遊戲", nextLabel: "下一款遊戲", selectLabel: "選擇遊戲", unnamedLabel: "未命名遊戲", startLabel: "開始遊戲", comingSoonLabel: "Coming Soon", loadingLabel: "正在載入遊戲資料。", emptyLabel: "目前還沒有遊戲。", errorLabel: "遊戲資料暫時無法載入。" };
  let copy = copyDefaults;
  const wallpapers = ["burgundy-01", "sage-02", "navy-03", "ochre-04"];
  const wallpaperKey = "shi-gai:works-wallpaper:v1";
  let wallpaper = wallpapers[0];
  try {
    const stored = sessionStorage.getItem(wallpaperKey);
    if (wallpapers.includes(stored)) wallpaper = stored;
    else { wallpaper = wallpapers[Math.floor(Math.random() * wallpapers.length)]; sessionStorage.setItem(wallpaperKey, wallpaper); }
  } catch { wallpaper = wallpapers[0]; } // Decoration must never block content.
  document.body.style.setProperty("--works-wallpaper", `url("assets/images/wallpapers/salon-wallpaper-${wallpaper}.webp")`);

  let games = [];
  const previews = { lottery: "lottery-preview.webp", goddess: "goddess-preview.webp", "spot-difference": "spot-difference-preview.webp" };
  const prefetched = new Set();
  function renderGames() {
    grid.replaceChildren();
    grid.setAttribute("aria-label", copy.selectLabel);
    games.forEach((game) => {
      const card = document.createElement("article"); card.className = "game-entry";
      card.id = `game-${game.id}`;
      const art = document.createElement("div"); art.className = "game-entry-art";
      const preview = game.icon ? new URL(`../${game.icon}`, document.baseURI).href : previews[game.id] ? `assets/images/games/${previews[game.id]}` : "";
      if (preview) {
        const image = document.createElement("img"); image.src = preview; image.alt = ""; image.loading = "lazy"; image.decoding = "async";
        image.addEventListener("error", () => { image.remove(); art.textContent = game.mark || "✦"; }, { once: true });
        art.append(image);
      } else art.textContent = game.mark || "✦";
      const content = document.createElement("div"); content.className = "game-entry-copy";
      const title = document.createElement("h2"); title.textContent = game.name || copy.unnamedLabel;
      const description = document.createElement("p"); description.textContent = game.description || "";
      const available = Boolean(game.url && game.status === "published");
      const action = document.createElement(available ? "a" : "span"); action.className = "game-entry-start";
      action.textContent = available ? copy.startLabel : copy.comingSoonLabel;
      if (available) {
        // Exported game routes are local pages; reject executable or remote schemes.
        const url = new URL(game.url, document.baseURI);
        if (url.origin === location.origin && ["http:", "https:", "file:"].includes(url.protocol)) {
          action.href = url.href;
          action.setAttribute("aria-label", `${copy.startLabel}：${title.textContent}`);
          action.addEventListener("click", () => window.ShiGaiAnalytics?.track("game_open", { game_id: game.id || "unknown", source: "games_hub" }));
          const prefetch = () => {
            if (prefetched.has(url.href)) return;
            prefetched.add(url.href);
            const link = document.createElement("link"); link.rel = "prefetch"; link.href = url.href; document.head.append(link);
          };
          action.addEventListener("pointerenter", prefetch, { once: true }); action.addEventListener("focus", prefetch, { once: true });
        } else action.setAttribute("aria-disabled", "true");
      } else action.setAttribute("aria-disabled", "true");
      content.append(title, description, action); card.append(art, content); grid.append(card);
    });
    highlightRequestedGame();
  }
  function highlightRequestedGame() {
    [...grid.children].forEach(card => card.classList.remove("is-requested"));
    let requestedId = "";
    try { requestedId = decodeURIComponent(location.hash.slice(1)); } catch { /* Ignore malformed links. */ }
    const target = [...grid.children].find(card => card.id === `game-${requestedId}`);
    if (target) { target.classList.add("is-requested"); target.scrollIntoView({ block: "nearest" }); }
  }
  window.addEventListener("hashchange", highlightRequestedGame);
  function renderGameScene(scenes) {
    const scene = (Array.isArray(scenes) ? scenes : []).filter((item) => item?.status === "published" && item?.type === "game").sort((a, b) => Number(a.order || 0) - Number(b.order || 0))[0];
    if (!scene || !backdrop || !backScene || !front || !frontScene || !window.ShiGaiSceneRenderer) return;
    const layout = matchMedia("(orientation: portrait)").matches ? "portrait" : "landscape";
    const common = {
      layout, fitMode: "stretch", applyBackground: false,
      resolveMediaSource: (object) => object.media?.src ? new URL(`../${object.media.src}`, document.baseURI).href : "",
      objectAttributes: (object) => ({ "aria-label": object.name || object.type || "遊戲室物件" })
    };
    const objects = Array.isArray(scene.objects) ? scene.objects : [];
    const isBackgroundObject = (object) => object?.type === "background" || object?.layer === "background";
    const backgroundScene = { ...scene, objects: objects.filter(isBackgroundObject) };
    const foregroundScene = { ...scene, objects: objects.filter((object) => !isBackgroundObject(object)) };
    backdrop.hidden = false;
    backdrop.style.backgroundColor = scene.background?.asset ? (scene.background?.color || "#4b382a") : "transparent";
    backdrop.style.backgroundImage = scene.background?.asset ? `url("${new URL(`../${scene.background.asset}`, document.baseURI).href}")` : "none";
    backdrop.style.backgroundSize = scene.background?.asset ? "cover" : "auto";
    front.hidden = foregroundScene.objects.length === 0 && !(scene.background?.effects||[]).some(v=>v.enabled!==false&&v.layer!=='back');
    window.ShiGaiSceneRenderer.renderScene({ ...common, container: backScene, scene: backgroundScene });
    window.ShiGaiSceneRenderer.renderScene({ ...common, container: frontScene, scene: foregroundScene });
    window.ShiGaiSceneEnvironment.bindBackground({container:backdrop,frontContainer:front,scene,onAttribution:config=>window.ShiGaiWeatherAttribution.set('games-room',config),resolveAsset:source=>new URL(`../${source}`,document.baseURI).href});
  }
  try {
    const settings = await window.ShiGaiWebsiteSettings.catch(() => ({}));
    copy = { ...copyDefaults, ...(settings?.websiteBrand?.games || {}) };
    document.title = `${copy.title} · ${settings?.websiteBrand?.siteName || "Shi-Gai"}`;
    document.querySelector(".games-room-heading .eyebrow").textContent = copy.eyebrow;
    document.getElementById("gamesTitle").textContent = copy.title;
    window.ShiGaiVisualText?.apply(document.getElementById("gamesTitle"), copy.title, settings?.websiteBrand?.visualTitles?.games);
    state.textContent = copy.loadingLabel;
    const [gamesResponse, scenesResponse] = await Promise.all([fetch("../database/website/games.json"), fetch("../database/website/scenes.json").catch(() => ({ ok: false }))]);
    if (!gamesResponse.ok) throw new Error("Games registry unavailable");
    games = (await gamesResponse.json()).filter((game) => game?.visible !== false).sort((a, b) => Number(a.order) - Number(b.order));
    if (!games.length) { state.textContent = copy.emptyLabel; return; }
    renderGames(); state.hidden = true;
    if (scenesResponse.ok) renderGameScene(await scenesResponse.json());
  } catch { state.hidden = false; state.textContent = copy.errorLabel; }
})();
