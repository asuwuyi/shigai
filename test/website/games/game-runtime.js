"use strict";
(function runShiGaiGame() {
  const body = document.body, status = document.getElementById("gameStatus"), canvas = document.getElementById("canvas"), container = document.getElementById("animation_container"), overlay = document.getElementById("dom_overlay_container"), preloader = document.getElementById("_preload_div_");
  const requestedLayout = new URLSearchParams(location.search).get("layout");
  const embeddedMode = new URLSearchParams(location.search).get("embed");
  if (embeddedMode) document.documentElement.dataset.gameEmbed = embeddedMode;
  const mobile = requestedLayout === "mobile" || (requestedLayout !== "desktop" && (matchMedia("(orientation: portrait)").matches || (navigator.maxTouchPoints > 0 && innerWidth <= 1024)));
  const width = mobile ? 1080 : 1920, height = mobile ? 1920 : 1080;
  const scriptPath = mobile ? body.dataset.mobileScript : body.dataset.desktopScript;
  const exportName = mobile ? body.dataset.mobileExport : body.dataset.desktopExport;
  const tvCase = document.createElement("div");
  tvCase.className = "game-tv-case";
  container.parentNode.insertBefore(tvCase, container);
  tvCase.append(container);
  document.documentElement.dataset.gameLayout = mobile ? "mobile" : "desktop";
  const wallpapers = ["burgundy-01", "sage-02", "navy-03", "ochre-04"];
  const wallpaperKey = "shi-gai:works-wallpaper:v1";
  let wallpaper = sessionStorage.getItem(wallpaperKey);
  if (!wallpapers.includes(wallpaper)) { wallpaper = wallpapers[Math.floor(Math.random() * wallpapers.length)]; sessionStorage.setItem(wallpaperKey, wallpaper); }
  body.style.setProperty("--game-wallpaper", `url("../assets/images/wallpapers/salon-wallpaper-${wallpaper}.webp")`);
  [container, canvas, overlay, preloader].forEach((element) => { element.style.width = `${width}px`; element.style.height = `${height}px`; });
  canvas.width = width; canvas.height = height;

  const nativeOpen = window.open.bind(window);
  window.open = (url, target, features = "") => {
    if (/^\.\.\/\.\.\/index\.html(?:[?#].*)?$/.test(String(url || ""))) { location.assign("../../games.html"); return window; }
    if (target === "_blank") { const opened = nativeOpen(url, target, [features, "noopener", "noreferrer"].filter(Boolean).join(",")); if (opened) opened.opener = null; return opened; }
    return nativeOpen(url, target, features);
  };

  let stage = null, tickerAttached = false;
  const legacyFooterNames = ["mail_b", "facebook_b", "ig_b", "twitter_b", "youtube_b", "giphy_b", "lineStore_b", "behance_b", "btn_backHome"];
  function removeLegacyFooter(root) {
    legacyFooterNames.forEach((name) => {
      const item = root?.[name];
      if (!item) return;
      item.visible = false;
      item.mouseEnabled = false;
      item.removeAllEventListeners?.();
    });
  }
  function simplifyMobileGameArtwork(root) {
    if (!mobile || !root) return;
    if (exportName === "lotteryM" && root.shape_8) {
      root.shape_8.visible = false;
      root.shape_8.mouseEnabled = false;
    }
    if (exportName === "goddessM") {
      ["shape_8", "shape_9", "instance_1", "instance_3", "instance_4"].forEach((name) => {
        const item = root[name];
        if (!item) return;
        item.visible = false;
        item.mouseEnabled = false;
      });
    }
  }
  function setTicker(active) {
    if (!stage || !window.createjs) return;
    if (active && !tickerAttached) { createjs.Ticker.addEventListener("tick", stage); tickerAttached = true; }
    if (!active && tickerAttached) { createjs.Ticker.removeEventListener("tick", stage); tickerAttached = false; }
  }
  function bridgeScaledCanvasButton(root, buttonName) {
    const button = root?.[buttonName];
    if (!button?.dispatchEvent || !button?.getTransformedBounds) return;
    let lastCreateJsClick = 0;
    button.addEventListener("click", () => { lastCreateJsClick = performance.now(); });
    canvas.addEventListener("click", (event) => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const point = {
        x: (event.clientX - rect.left) * width / rect.width,
        y: (event.clientY - rect.top) * height / rect.height
      };
      const bounds = button.getTransformedBounds();
      const insideCreateJsBounds = bounds && point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
      const lotteryFallback = exportName === "lotteryM"
        ? point.x >= 390 && point.x <= 690 && point.y >= 1190 && point.y <= 1570
        : exportName === "lotteryD" && point.x >= 1390 && point.x <= 1650 && point.y >= 470 && point.y <= 770;
      if (!insideCreateJsBounds && !lotteryFallback) return;
      setTimeout(() => {
        if (performance.now() - lastCreateJsClick > 120) button.dispatchEvent("click");
      }, 0);
    });
  }
  function makeExhibitResponsive(library) {
    const resize = () => {
      if (mobile) {
        const availableWidth = Math.max(1, innerWidth);
        const availableHeight = Math.max(1, innerHeight);
        const ratio = Math.min(availableWidth / width, availableHeight / height);
        const screenWidth = width * ratio;
        const screenHeight = height * ratio;
        const pixelRatio = window.devicePixelRatio || 1;
        tvCase.style.width = `${availableWidth}px`; tvCase.style.height = `${availableHeight}px`;
        container.style.left = `${(availableWidth - screenWidth) / 2}px`;
        container.style.top = `${(availableHeight - screenHeight) / 2}px`;
        canvas.width = screenWidth * pixelRatio; canvas.height = screenHeight * pixelRatio;
        [canvas, preloader, container, overlay].forEach((element) => { element.style.width = `${screenWidth}px`; element.style.height = `${screenHeight}px`; });
        stage.scaleX = pixelRatio * ratio; stage.scaleY = pixelRatio * ratio;
        stage.tickOnUpdate = false; stage.update(); stage.tickOnUpdate = true;
        return;
      }
      const gutter = mobile ? 18 : Math.min(92, Math.max(34, innerWidth * .055));
      const availableWidth = Math.max(1, innerWidth - gutter * 2);
      const availableHeight = Math.max(1, innerHeight - gutter * 2);
      const screen = { left: .125, top: .117, width: .75, height: .633 };
      const screenWidthLimit = availableWidth * screen.width;
      const screenHeightLimit = availableHeight * screen.height;
      const ratio = Math.min(screenWidthLimit / width, screenHeightLimit / height);
      const screenWidth = width * ratio;
      const screenHeight = height * ratio;
      const caseWidth = screenWidth / screen.width;
      const caseHeight = screenHeight / screen.height;
      const pixelRatio = window.devicePixelRatio || 1;
      tvCase.style.width = `${caseWidth}px`; tvCase.style.height = `${caseHeight}px`;
      container.style.left = `${caseWidth * screen.left}px`;
      container.style.top = `${caseHeight * screen.top}px`;
      canvas.width = screenWidth * pixelRatio; canvas.height = screenHeight * pixelRatio;
      [canvas, preloader, container, overlay].forEach((element) => { element.style.width = `${screenWidth}px`; element.style.height = `${screenHeight}px`; });
      stage.scaleX = pixelRatio * ratio; stage.scaleY = pixelRatio * ratio;
      stage.tickOnUpdate = false; stage.update(); stage.tickOnUpdate = true;
    };
    window.addEventListener("resize", resize); resize();
  }
  document.addEventListener("visibilitychange", () => setTicker(!document.hidden));
  function fail(message, source = "runtime") { status.hidden = false; status.dataset.debug = source; status.textContent = message || "遊戲暫時無法載入，請返回 Games 後再試一次。"; }
  function start() {
    try {
      const composition = AdobeAn.getComposition("A5B6BD83314E464EB04BFB621AF8E955"), library = composition.getLibrary(), loader = new createjs.LoadQueue(false);
      loader.addEventListener("fileload", (event) => { if (event?.item?.type === "image") composition.getImages()[event.item.id] = event.result; });
      loader.addEventListener("error", (event) => fail("遊戲素材載入失敗，請返回 Games 後再試一次。", `asset:${event?.item?.src || "unknown"}`));
      loader.addEventListener("complete", (event) => {
        try {
          const sheets = composition.getSpriteSheet();
          library.ssMetadata.forEach((item) => { sheets[item.name] = new createjs.SpriteSheet({ images: [event.target.getResult(item.name)], frames: item.frames }); });
          const GameExport = library[exportName]; if (typeof GameExport !== "function") throw new Error("Game export missing");
          window.exportRoot = new GameExport();
          // Legacy desktop games reserve a large empty stage around their playable art.
          // Zoom the presentation layer only; source Animate exports remain untouched.
          const presentationScale = 1;
          window.exportRoot.scaleX = presentationScale; window.exportRoot.scaleY = presentationScale;
          window.exportRoot.x = (width - width * presentationScale) / 2;
          window.exportRoot.y = (height - height * presentationScale) / 2;
          removeLegacyFooter(window.exportRoot);
          simplifyMobileGameArtwork(window.exportRoot);
          stage = new library.Stage(canvas);
          canvas.style.background = mobile && body.dataset.mobileStageBackground
            ? body.dataset.mobileStageBackground
            : (body.dataset.stageBackground || library.properties.color || "#17110d");
          window.stage = stage;
          stage.enableMouseOver(); stage.addChild(window.exportRoot);
          bridgeScaledCanvasButton(window.exportRoot, "playLottery");
          createjs.Ticker.framerate = library.properties.fps; setTicker(true);
          preloader.hidden = true; canvas.style.display = "block"; status.hidden = true;
          makeExhibitResponsive(library); AdobeAn.compositionLoaded(library.properties.id);
        } catch (error) { console.error("Shi-Gai game initialization failed", error); fail(undefined, `initialization:${String(error?.message || error)}`); }
      });
      loader.loadManifest(library.properties.manifest);
    } catch (error) { console.error("Shi-Gai game runtime failed", error); fail(undefined, `runtime:${String(error?.message || error)}`); }
  }
  const runtime = document.createElement("script"); runtime.src = "../shared/createjs.min.js";
  runtime.addEventListener("error", () => fail("遊戲引擎載入失敗，請返回 Games 後再試一次。", "createjs-script"), { once: true });
  runtime.addEventListener("load", () => { const game = document.createElement("script"); game.src = scriptPath; game.addEventListener("error", () => fail("遊戲程式載入失敗，請返回 Games 後再試一次。", "game-script"), { once: true }); game.addEventListener("load", start, { once: true }); document.head.append(game); }, { once: true });
  document.head.append(runtime);
})();
