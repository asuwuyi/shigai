(function gameAnalytics() {
  const gameId = location.pathname.split("/").filter(Boolean).find((part, index, parts) => parts[index - 1] === "games") || "unknown";
  let started = false, draws = 0, roundStart = 0;
  function track(name, parameters = {}) { window.ShiGaiAnalytics?.track(name, { ...parameters, game_id: gameId, source: new URLSearchParams(location.search).get("embed") === "home" ? "home_inline" : "game_page" }); }
  function start() { if (!started) { started = true; track("game_start"); } }
  window.ShiGaiGameAnalytics = Object.freeze({
    bind(root) {
      for (const [name, action] of [["playLottery", "draw"], ["btn_penguinGo", "begin"], ["btn_pickFishF", "choose_front"], ["btn_pickFishR", "choose_back"]]) {
        let last = -Infinity;
        root?.[name]?.addEventListener?.("click", () => {
          const now = performance.now(); if (now - last < 100) return; last = now;
          start();
          if (action === "draw") track("game_draw", { draw_count: ++draws });
          else track("game_interaction", { action });
        });
      }
    }
  });
  document.addEventListener("DOMContentLoaded", () => {
    const board = document.getElementById("gameBoard"), complete = document.getElementById("complete");
    if (!board || !complete) return;
    let wasPlaying = false, wasComplete = !complete.hidden;
    new MutationObserver(() => {
      const playing = board.classList.contains("is-playing");
      if (playing && !wasPlaying) { start(); roundStart = performance.now(); }
      wasPlaying = playing;
      const finished = !complete.hidden;
      if (finished && !wasComplete) track("game_complete", { duration_ms: Math.max(0, Math.round(performance.now() - roundStart)) });
      wasComplete = finished;
    }).observe(board, { attributes: true, attributeFilter: ["class"] });
    new MutationObserver(() => {
      const finished = !complete.hidden;
      if (finished && !wasComplete) track("game_complete", { duration_ms: Math.max(0, Math.round(performance.now() - roundStart)) });
      wasComplete = finished;
    }).observe(complete, { attributes: true, attributeFilter: ["hidden"] });
  });
})();
