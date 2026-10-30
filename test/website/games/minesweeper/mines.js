(() => {
  'use strict';
  const $ = id => document.getElementById(id), engine = window.ShiGaiMines;
  const boardElement = $('board'), dialog = $('resultDialog');
  let levels = [], levelIndex = 0, board, buttons = [], mode = 'reveal', startedAt = 0, elapsed = 0, ended = false;
  let focusIndex = 0, press = null, suppressClick = null;
  const completed = new Set(), art = { mine: '', flag: '' }, uploadVersion = { mine: 0, flag: 0 }, uploadUrls = new Set();
  const clock = () => Math.floor((startedAt && !ended ? performance.now() - startedAt : elapsed) / 1000);
  function timeText(seconds) { return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0'); }
  function updateClock() { $('timer').textContent = timeText(clock()); }
  function cancelPress() { if (press) clearTimeout(press.timer); press = null; }
  function cellTarget(event) { const target = event.target.closest('.cell'); return target && boardElement.contains(target) ? target : null; }
  function setMode(next) { mode = next; $('revealMode').setAttribute('aria-pressed', String(mode === 'reveal')); $('flagMode').setAttribute('aria-pressed', String(mode === 'flag')); }
  function setArt(button, kind, fallback) {
    if (!art[kind]) { button.textContent = fallback; return; }
    if (button.firstElementChild?.src === art[kind]) return;
    const image = document.createElement('img'); image.src = art[kind]; image.alt = ''; image.draggable = false; button.replaceChildren(image);
  }
  function render() {
    if (!board) return;
    const over = ['won', 'lost'].includes(board.status);
    board.cells.forEach((cell, index) => {
      const button = buttons[index], mine = over && cell.mine, wrong = board.status === 'lost' && cell.flag && !cell.mine;
      button.className = 'cell' + (cell.open ? ' open' : '') + (cell.flag ? ' flagged' : '') + (mine ? ' mine' : '') + (wrong ? ' wrong' : '') + (board.exploded === index ? ' exploded' : '');
      button.dataset.number = cell.open && !cell.mine ? String(cell.count) : '';
      if (mine && board.status === 'lost') setArt(button, 'mine', '✳');
      else if (wrong) button.textContent = '×';
      else if (cell.flag) setArt(button, 'flag', '⚑');
      else button.textContent = cell.open && cell.count ? String(cell.count) : '';
      const description = mine ? '地雷' : wrong ? '插錯旗' : cell.flag ? '已插旗' : cell.open ? cell.count ? '周圍 ' + cell.count + ' 顆地雷' : '空白' : '未翻開';
      button.setAttribute('aria-label', `第 ${Math.floor(index / board.cols) + 1} 列、第 ${index % board.cols + 1} 欄，${description}`);
      button.setAttribute('aria-disabled', String(over)); button.tabIndex = index === focusIndex ? 0 : -1;
    });
    $('remaining').textContent = String(board.mines - board.flags); updateClock();
    $('nextLevel').disabled = board.status !== 'won' || levelIndex === levels.length - 1;
  }
  function finishIfNeeded() {
    if (ended || !['won', 'lost'].includes(board.status)) return;
    elapsed = startedAt ? performance.now() - startedAt : 0; ended = true; cancelPress();
    const won = board.status === 'won';
    if (won) { completed.add(levelIndex); $('levelSelect').options[levelIndex].textContent = levelLabel(levelIndex); }
    $('gameStatus').textContent = won ? '所有安全格都找到了！' : '踩到地雷了。可以查看棋盤，再試一次。';
    $('resultTitle').textContent = won ? '第 ' + (levelIndex + 1) + ' 關完成！' : '差一點，再試一次';
    $('resultText').textContent = `用時 ${timeText(clock())}。` + (won ? levelIndex === levels.length - 1 ? '已完成最後一關，還能選關重新挑戰。' : '準備挑戰更難的棋盤嗎？' : '翻開安全格、善用周圍數字與旗子。');
    $('continueGame').hidden = !won || levelIndex === levels.length - 1;
    $('retryGame').textContent = won ? '重玩本關' : '再試一次';
    render(); dialog.showModal();
    window.ShiGaiAnalytics?.track('game_complete', { game_id: 'minesweeper', source: 'game_page', duration_ms: Math.round(elapsed) });
  }
  function act(index, flag = mode === 'flag') {
    if (!board || dialog.open || ['won', 'lost'].includes(board.status)) return;
    const previous = board.status;
    if (flag) board.toggleFlag(index);
    else if (board.cells[index]?.open) board.chord(index);
    else board.reveal(index);
    if (previous === 'ready' && board.status !== 'ready') {
      startedAt = performance.now();
      window.ShiGaiAnalytics?.track('game_start', { game_id: 'minesweeper', source: 'game_page' });
    }
    focusIndex = index;
    $('gameStatus').textContent = board.status === 'ready' ? '翻開第一格開始，第一格附近保證安全。' : mode === 'flag' ? '插旗模式：再點一次可取消旗子。' : '依數字判斷周圍地雷；右鍵或長按插旗。';
    render(); finishIfNeeded();
  }
  function levelLabel(index) {
    const l = levels[index]; return `${completed.has(index) ? '✓ ' : ''}${String(index + 1).padStart(2, '0')} · ${l.cols}×${l.rows} · ${l.mines} 雷`;
  }
  function newBoard(index) {
    if (!levels[index]) return;
    cancelPress(); suppressClick = null; if (dialog.open) dialog.close();
    levelIndex = index; board = new engine.Board(levels[index]); ended = false; startedAt = 0; elapsed = 0; focusIndex = 0;
    $('levelSelect').value = String(index); $('dimensions').textContent = `${board.cols} × ${board.rows} 格 · ${board.mines} 顆地雷`;
    boardElement.style.setProperty('--cols', board.cols); boardElement.setAttribute('aria-rowcount', board.rows); boardElement.setAttribute('aria-colcount', board.cols);
    buttons = board.cells.map((_, i) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'cell'; button.dataset.index = i; button.setAttribute('role', 'gridcell');
      button.setAttribute('aria-rowindex', Math.floor(i / board.cols) + 1); button.setAttribute('aria-colindex', i % board.cols + 1); return button;
    });
    const rows = Array.from({ length: board.rows }, (_, row) => { const element = document.createElement('div'); element.setAttribute('role', 'row'); element.style.display = 'contents'; element.append(...buttons.slice(row * board.cols, (row + 1) * board.cols)); return element; });
    boardElement.replaceChildren(...rows); $('boardViewport').scrollLeft = 0;
    $('gameStatus').textContent = '翻開第一格開始，第一格附近保證安全。'; render();
  }
  boardElement.addEventListener('click', event => {
    const target = cellTarget(event); if (!target) return;
    if (suppressClick?.index === Number(target.dataset.index) && performance.now() < suppressClick.until) { suppressClick = null; return; }
    suppressClick = null; act(Number(target.dataset.index));
  });
  boardElement.addEventListener('contextmenu', event => { const target = cellTarget(event); if (!target) return; event.preventDefault(); cancelPress(); const index = Number(target.dataset.index); if (suppressClick?.index === index && performance.now() < suppressClick.until) return; act(index, true); });
  boardElement.addEventListener('pointerdown', event => {
    cancelPress(); suppressClick = null; const target = cellTarget(event); if (!target || event.pointerType === 'mouse' || event.button !== 0 || !board || ['won', 'lost'].includes(board.status)) return;
    const current = { id: event.pointerId, index: Number(target.dataset.index), x: event.clientX, y: event.clientY };
    current.timer = setTimeout(() => { if (press !== current) return; suppressClick = { index: current.index, until: performance.now() + 1200 }; act(current.index, true); press = null; }, 480); press = current;
  });
  boardElement.addEventListener('pointermove', event => { if (press && (Math.abs(event.clientX - press.x) > 8 || Math.abs(event.clientY - press.y) > 8)) cancelPress(); });
  for (const name of ['pointerup', 'pointercancel', 'pointerleave']) boardElement.addEventListener(name, cancelPress);
  boardElement.addEventListener('keydown', event => {
    const target = cellTarget(event); if (!target || !board) return; const index = Number(target.dataset.index), row = Math.floor(index / board.cols), col = index % board.cols;
    let next = index;
    if (event.key === 'ArrowRight') next = row * board.cols + Math.min(col + 1, board.cols - 1);
    else if (event.key === 'ArrowLeft') next = row * board.cols + Math.max(col - 1, 0);
    else if (event.key === 'ArrowDown') next = Math.min(row + 1, board.rows - 1) * board.cols + col;
    else if (event.key === 'ArrowUp') next = Math.max(row - 1, 0) * board.cols + col;
    else if (event.key.toLowerCase() === 'f') { event.preventDefault(); act(index, true); return; }
    else return;
    event.preventDefault(); focusIndex = next; buttons[index].tabIndex = -1; buttons[next].tabIndex = 0; buttons[next].focus();
  });
  $('revealMode').onclick = () => setMode('reveal'); $('flagMode').onclick = () => setMode('flag');
  $('levelSelect').onchange = event => newBoard(Number(event.target.value)); $('restart').onclick = () => newBoard(levelIndex);
  $('nextLevel').onclick = () => { if (board.status === 'won') newBoard(levelIndex + 1); };
  $('continueGame').onclick = () => { if (board.status === 'won') newBoard(levelIndex + 1); };
  $('retryGame').onclick = () => newBoard(levelIndex); $('closeResult').onclick = () => dialog.close();
  $('cellSize').onchange = event => boardElement.style.setProperty('--cell-size', event.target.value + 'px');
  function releaseUpload(url) { if (uploadUrls.delete(url)) URL.revokeObjectURL(url); }
  async function upload(kind, input) {
    const file = input.files?.[0]; input.value = ''; if (!file) return;
    const version = ++uploadVersion[kind]; let url;
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) throw Error('請使用不超過 3 MB 的 PNG、JPG 或 WebP。');
      url = URL.createObjectURL(file); uploadUrls.add(url); const image = new Image(); image.src = url; await image.decode();
      if (version !== uploadVersion[kind]) { releaseUpload(url); return; }
      if (image.naturalWidth > 8192 || image.naturalHeight > 8192) throw Error('圖片邊長請小於或等於 8192 像素。');
      releaseUpload(art[kind]); art[kind] = url; render(); $('artStatus').textContent = '已替換' + (kind === 'mine' ? '地雷' : '旗子') + '圖案，只供本次試用。';
    } catch (error) { if (url) releaseUpload(url); if (version === uploadVersion[kind]) $('artStatus').textContent = error.message; }
  }
  $('mineUpload').onchange = event => upload('mine', event.target); $('flagUpload').onchange = event => upload('flag', event.target);
  $('resetArt').onclick = () => { for (const kind of ['mine', 'flag']) { uploadVersion[kind]++; releaseUpload(art[kind]); art[kind] = ''; } render(); $('artStatus').textContent = '已恢復預設圖案。'; };
  async function load() {
    try {
      const config = await ShiGaiGameConfig.load('minesweeper','mines-demo.json'); if (!Array.isArray(config.levels) || !config.levels.length || config.levels.length > 200) throw Error('關卡設定需為 1～200 關。');
      levels = config.levels.map(engine.validateLevel);
      for (const kind of ['mine', 'flag']) if (config[kind + 'Image']) {
        const url = new URL(config[kind + 'Image'], document.baseURI); if (url.origin !== location.origin || !['http:', 'https:'].includes(url.protocol)) throw Error('圖案必須使用網站內的圖片。');
        try { const image = new Image(); image.src = url.href; await image.decode(); art[kind] = url.href; } catch { $('artStatus').textContent = '預設圖片讀取失敗，已使用示範符號。'; }
      }
      $('levelSelect').replaceChildren(...levels.map((_, index) => { const option = document.createElement('option'); option.value = index; option.textContent = levelLabel(index); return option; }));
      for (const id of ['levelSelect', 'restart', 'revealMode', 'flagMode']) $(id).disabled = false; newBoard(0);
    } catch (error) { $('gameStatus').textContent = error.message; const retry = document.createElement('button'); retry.textContent = '重新載入'; retry.onclick = () => { retry.remove(); load(); }; $('gameStatus').append(' ', retry); }
  }
  setInterval(() => { if (!document.hidden && board?.status === 'playing') updateClock(); }, 1000);
  document.addEventListener('visibilitychange', () => { cancelPress(); updateClock(); }); window.addEventListener('blur', cancelPress); window.addEventListener('pagehide', cancelPress);
  window.ShiGaiMinesDemo = Object.freeze({ state: () => ({ ready: !!board, level: levelIndex + 1, totalLevels: levels.length, completed: [...completed].map(i => i + 1), mode, seconds: clock(), status: board?.status, rows: board?.rows, cols: board?.cols, mines: board?.mines, flags: board?.flags, opened: board?.opened, cells: board?.cells.map(c => ({ ...c })), art: { mine: !!art.mine, flag: !!art.flag }, resultOpen: dialog.open }) });
  load();
})();
