"use strict";
// Presentation adapter: dispatch the authored button; never duplicate the draw algorithm.
window.ShiGaiWebsiteSettings?.then(settings => {
  const status = document.getElementById("gameStatus");
  if (!status.hidden) status.textContent = settings?.websiteBrand?.games?.lotteryLoadingLabel || status.textContent;
}).catch(() => {});
window.ShiGaiLotteryPresentation = {
  mount({ root, stage, canvas, container, overlay, preloader, tvCase }) {
    const defaults = {"lotteryBackLabel": "← 遊戲室", "lotteryHint": "讓六隻企鵝，幫你選六個號碼。", "lotteryDrawLabel": "幫我選號碼", "lotteryAgainLabel": "再選一次", "lotteryBusyLabel": "企鵝正在選號…", "lotteryResultLabel": "第 {count} 次：{numbers}", "lotteryLoadingLabel": "正在載入企鵝…"};
    let copy = defaults;
    window.ShiGaiWebsiteSettings?.then(settings => {
      copy = { ...defaults, ...(settings?.websiteBrand?.games || {}) };
      document.querySelector('.lottery-back').textContent = copy.lotteryBackLabel === '← 遊戲室' ? '← 工具箱' : copy.lotteryBackLabel;
      document.getElementById('lotteryHint').textContent = copy.lotteryHint;
      if (!drawCount) button.textContent = copy.lotteryDrawLabel;
    }).catch(() => {});
    const button = document.getElementById("lotteryDraw");
    const announcement = document.getElementById("lotteryAnnouncement");
    const cells = [...document.querySelectorAll("#lotteryNumbers span")];
    const balls = Array.from({ length: 6 }, (_, i) => root[`ball${i + 1}`]);
    if (!root.playLottery || balls.some(ball => !ball)) throw Error("Lottery presentation objects missing");
    const virtualWidth = 1080, virtualHeight = 1100;
    // Keep full animation bounds (including the jumping pose) inside the art area.
    root.children.forEach(child => { child.visible = balls.includes(child); child.mouseEnabled = false; });
    balls.forEach((ball, i) => {
      ball.x = 190 + (i % 3) * 350; ball.y = 320 + Math.floor(i / 3) * 510;
      ball.scaleX = ball.scaleY = .72; ball.regX = ball.regY = 0;
    });
    const resize = () => {
      const box = tvCase.parentElement.getBoundingClientRect();
      const ratio = Math.max(1, box.width) / virtualWidth, pixelRatio = Math.min(devicePixelRatio || 1, 2);
      const w = virtualWidth * ratio, h = virtualHeight * ratio;
      canvas.width = Math.round(w * pixelRatio); canvas.height = Math.round(h * pixelRatio);
      [canvas, container, overlay, preloader].forEach(el => { el.style.width = `${w}px`; el.style.height = `${h}px`; });
      canvas.style.background = "transparent";
      stage.scaleX = stage.scaleY = ratio * pixelRatio;
      stage.tickOnUpdate = false; stage.update(); stage.tickOnUpdate = true;
    };
    const observer = new ResizeObserver(resize); observer.observe(tvCase.parentElement); resize();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const originalPlay = balls.map(ball => ball.play);
    const motion = () => balls.forEach((ball, i) => { ball.play = reduced.matches ? function() { this.gotoAndStop(59); } : originalPlay[i]; });
    reduced.addEventListener("change", motion); motion();
    let release = 0, drawCount = 0;
    button.disabled = false;
    button.addEventListener("click", () => {
      if (button.disabled) return;
      button.disabled = true;
      root.playLottery.dispatchEvent("click");
      const numbers = balls.map((ball, i) => ball[`p${i + 1}`].text);
      cells.forEach((cell, i) => { cell.textContent = String(numbers[i]).padStart(2, "0"); });
      drawCount++;
      announcement.textContent = copy.lotteryResultLabel.replaceAll("{count}", String(drawCount)).replaceAll("{numbers}", numbers.join("、"));
      button.textContent = copy.lotteryBusyLabel;
      // The authored export schedules six starts through 2600ms; prevent overlapping draws.
      release = setTimeout(() => { button.disabled = false; button.textContent = copy.lotteryAgainLabel; }, 2750);
    });
    window.addEventListener("pagehide", event => { if (!event.persisted) { clearTimeout(release); observer.disconnect(); reduced.removeEventListener("change", motion); } });
    window.ShiGaiWebsiteSettings?.then(async () => {
      const response = await fetch("../../../database/website/games.json");
      if (!response.ok) return;
      const game = (await response.json()).find(item => item.id === "lottery");
      if (game) { document.getElementById("lotteryTitle").textContent = game.name; document.getElementById("lotteryDescription").textContent = game.description; document.title = `${game.name} · Shi-Gai`; }
    }).catch(() => {});
  }
};
