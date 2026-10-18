// Salon Games Hub. Reads the exported Games registry and optional published Game Scene only.
(async function loadGames() {
  const tvScreen = document.getElementById("gamesTvScreen");
  const choices = document.getElementById("gamesChoices");
  const selectedName = document.getElementById("selectedGameName");
  const selectedPosition = document.getElementById("selectedGamePosition");
  const startGame = document.getElementById("startGame");
  const state = document.getElementById("gamesState");
  const previous = document.getElementById("previousGame");
  const next = document.getElementById("nextGame");
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
  document.body.style.setProperty("--works-wallpaper", `url("../images/wallpapers/salon-wallpaper-${wallpaper}.webp")`);

  let games = [], activeIndex = 0, touchStartX = null;
  const prefetched = new Set();
  const routeToGame = (game) => {
    if (!game?.url || game.status !== "published") return;
    window.ShiGaiAnalytics?.track("game_open", { game_id: game.id || "unknown", source: "games_hub" });
    window.location.assign(game.url);
  };
  function prefetchGame(game) {
    if (!game?.url || game.status !== "published") return;
    [game.url, "games/shared/createjs.min.js", "games/game-runtime.js"].forEach((href) => {
      if (prefetched.has(href)) return;
      prefetched.add(href);
      const link = document.createElement("link"); link.rel = "prefetch"; link.href = href; document.head.append(link);
    });
  }
  function renderTv() {
    const game = games[activeIndex]; if (!game) return;
    tvScreen.replaceChildren();
    const mark = document.createElement("span"); mark.className = "games-tv-mark"; mark.ariaHidden = "true";
    if (game.icon) { const image=document.createElement("img"); image.src=new URL(`../${game.icon}`,document.baseURI).href; image.alt=""; mark.append(image); } else mark.textContent = game.mark || "✦";
    const description = document.createElement("p"); description.textContent = game.description || "";
    tvScreen.append(mark, description);
    selectedName.textContent = game.name || copy.unnamedLabel;
    selectedPosition.textContent = `${activeIndex + 1} / ${games.length}`;
    const available = Boolean(game.url && game.status === "published");
    startGame.disabled = !available; startGame.textContent = available ? copy.startLabel : copy.comingSoonLabel;
    prefetchGame(game);
  }
  function selectGame(index, { updateHash = true, direction = "" } = {}) {
    if (!games.length) return;
    const previousIndex = activeIndex;
    activeIndex = (index + games.length) % games.length;
    renderTv(); renderChoices();
    const tv = document.getElementById("gamesTv");
    tv?.setAttribute("data-slide-direction", direction || (activeIndex === previousIndex ? "none" : (activeIndex > previousIndex ? "next" : "previous")));
    tv?.classList.remove("is-switching"); void tv?.offsetWidth; tv?.classList.add("is-switching");
    if (updateHash && games[activeIndex]?.id) history.replaceState(null, "", `#${encodeURIComponent(games[activeIndex].id)}`);
  }
  function renderChoices() {
    if (choices.children.length !== games.length) {
      choices.replaceChildren();
      games.forEach((game, index) => {
        const choice = document.createElement("button"); choice.type = "button"; choice.className = "games-tuner-choice"; choice.role = "tab";
        choice.setAttribute("aria-label", `${copy.selectLabel} ${game.name || copy.unnamedLabel}`);
        choice.addEventListener("click", () => selectGame(index, { direction: index < activeIndex ? "previous" : "next" })); choices.append(choice);
      });
    }
    Array.from(choices.children).forEach((choice, index) => choice.setAttribute("aria-selected", index === activeIndex ? "true" : "false"));
  }
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
    front.hidden = foregroundScene.objects.length === 0;
    window.ShiGaiSceneRenderer.renderScene({ ...common, container: backScene, scene: backgroundScene });
    window.ShiGaiSceneRenderer.renderScene({ ...common, container: frontScene, scene: foregroundScene });
  }
  previous?.addEventListener("click", () => selectGame(activeIndex - 1, { direction: "previous" }));
  next?.addEventListener("click", () => selectGame(activeIndex + 1, { direction: "next" }));
  startGame?.addEventListener("click", () => routeToGame(games[activeIndex]));
  tvScreen?.addEventListener("touchstart", (event) => { touchStartX = event.changedTouches[0]?.clientX ?? null; }, { passive: true });
  tvScreen?.addEventListener("touchend", (event) => {
    if (touchStartX === null) return;
    const distance = (event.changedTouches[0]?.clientX ?? touchStartX) - touchStartX; touchStartX = null;
    if (Math.abs(distance) < 42) return;
    selectGame(activeIndex + (distance < 0 ? 1 : -1), { direction: distance < 0 ? "next" : "previous" });
  }, { passive: true });
  try {
    const settings = await window.ShiGaiWebsiteSettings.catch(() => ({}));
    copy = { ...copyDefaults, ...(settings?.websiteBrand?.games || {}) };
    document.title = `${copy.title} · ${settings?.websiteBrand?.siteName || "Shi-Gai"}`;
    document.querySelector(".games-room-heading .eyebrow").textContent = copy.eyebrow;
    document.getElementById("gamesTitle").textContent = copy.title;
    window.ShiGaiVisualText?.apply(document.getElementById("gamesTitle"), copy.title, settings?.websiteBrand?.visualTitles?.games);
    const home = document.querySelector(".games-home-return"); home.textContent = copy.homeLabel; home.setAttribute("aria-label", copy.homeAriaLabel);
    previous.setAttribute("aria-label", copy.previousLabel); next.setAttribute("aria-label", copy.nextLabel);
    choices.setAttribute("aria-label", copy.selectLabel); state.textContent = copy.loadingLabel;
    const [gamesResponse, scenesResponse] = await Promise.all([fetch("../database/website/games.json"), fetch("../database/website/scenes.json").catch(() => ({ ok: false }))]);
    if (!gamesResponse.ok) throw new Error("Games registry unavailable");
    games = (await gamesResponse.json()).filter((game) => game?.visible !== false).sort((a, b) => Number(a.order) - Number(b.order));
    if (!games.length) { state.textContent = copy.emptyLabel; return; }
    let requestedId = "";
    try { requestedId = decodeURIComponent(location.hash.slice(1)); } catch { /* Invalid deep links use the first game. */ }
    const requestedIndex = games.findIndex((game) => game.id === requestedId);
    if (requestedIndex >= 0) activeIndex = requestedIndex;
    renderChoices(); renderTv(); state.hidden = true;
    if (scenesResponse.ok) renderGameScene(await scenesResponse.json());
  } catch { state.hidden = false; state.textContent = copy.errorLabel; }
})();
