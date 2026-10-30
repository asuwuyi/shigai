(() => {
  'use strict';
  const $ = id => document.getElementById(id), engine = window.ShiGaiMemory, grid = $('board'), dialog = $('resultDialog');
  let faces = [], fallbackFaces = [], workPool = [], faceSource = 'demo', levels = [], round, levelIndex = 0, buttons = [], paused = false;
  let preparing = false, roundToken = 0, lastWorkIds = new Set(); const workUrls = new Set();
  let playedMs = 0, startedAt = 0, mismatchTimer = 0, mismatchDue = 0, mismatchRemaining = 0, resultTimer = 0;
  let backImage = ''; const best = new Map(), customImages = new Map(), versions = new Map(), blobUrls = new Set();
  const milliseconds = () => playedMs + (startedAt ? performance.now() - startedAt : 0);
  const seconds = () => Math.floor(milliseconds() / 1000);
  const timeText = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  function stopClock() { if (startedAt) playedMs += performance.now() - startedAt; startedAt = 0; }
  function showTime() { $('timer').textContent = timeText(seconds()); }
  function picture(element, url, symbol, color) {
    if (url) {
      if (element.firstElementChild?.tagName === 'IMG' && element.firstElementChild.src === url) return;
      const image = new Image(); image.src = url; image.alt = ''; image.draggable = false; element.replaceChildren(image);
    } else {
      if (element.dataset.symbol === symbol && element.firstElementChild?.tagName === 'SPAN') return;
      const span = document.createElement('span'); span.textContent = symbol; if (color) span.style.color = color; element.replaceChildren(span); element.dataset.symbol = symbol;
    }
  }
  function faceUrl(face) { return customImages.get(face.id) || face.image || ''; }
  function render() {
    if (!round || preparing) return;
    round.cards.forEach((card, index) => {
      const button = buttons[index], face = faces.find(f => f.id === card.face);
      button.classList.toggle('is-open', card.open); button.classList.toggle('is-matched', card.matched);
      button.setAttribute('aria-label', '第 ' + (index + 1) + ' 張，' + (card.matched ? '已配對：' + face.name : card.open ? face.name : '未翻開'));
      button.setAttribute('aria-disabled', String(paused || card.open || round.pending.length > 0 || round.status === 'won'));
      picture(button.querySelector('.card-front'), faceUrl(face), face.symbol, face.color);
      picture(button.querySelector('.card-back'), backImage, '✦');
    });
    $('matches').textContent = round.matches + ' / ' + round.level.pairs; $('moves').textContent = String(round.moves); showTime();
    $('nextLevel').disabled = round.status !== 'won' || levelIndex === levels.length - 1;
    $('pause').disabled = round.status !== 'playing'; $('pause').textContent = paused ? '繼續' : '暫停';
    grid.closest('.board-wrap').classList.toggle('is-paused', paused); grid.inert = paused; $('pauseCover').hidden = !paused;
  }
  function scheduleMismatch(delay = 900) {
    clearTimeout(mismatchTimer); mismatchRemaining = delay; mismatchDue = performance.now() + delay;
    mismatchTimer = setTimeout(() => { mismatchTimer = 0; mismatchRemaining = 0; round.settle(); render(); $('gameStatus').textContent = '再看看，記住它們的位置。'; }, delay);
  }
  function pauseRound() {
    if (!round || round.status !== 'playing' || paused) return;
    paused = true; stopClock();
    if (mismatchTimer) { mismatchRemaining = Math.max(0, mismatchDue - performance.now()); clearTimeout(mismatchTimer); mismatchTimer = 0; }
    $('gameStatus').textContent = '已暫停，卡牌與計時都會等你回來。'; render();
  }
  function resumeRound() {
    if (!paused || document.hidden || round.status !== 'playing') return;
    paused = false; startedAt = performance.now(); if (round.pending.length) scheduleMismatch(mismatchRemaining);
    $('gameStatus').textContent = '繼續找出相同的圖案。'; render();
  }
  function levelLabel(index) { const level = levels[index], score = best.get(index); return `${String(index + 1).padStart(2, '0')} · ${level.pairs * 2} 張${score ? ' · ' + '★'.repeat(score) : ''}`; }
  function finish() {
    stopClock(); const rating = engine.stars(round.level, seconds(), round.moves);
    best.set(levelIndex, Math.max(best.get(levelIndex) || 0, rating)); $('levelSelect').options[levelIndex].textContent = levelLabel(levelIndex);
    $('gameStatus').textContent = '全部配對成功！可以進下一關，或重新挑戰星等。'; render();
    const level = levelIndex; clearTimeout(resultTimer);
    resultTimer = setTimeout(() => {
      resultTimer = 0; if (levelIndex !== level || round.status !== 'won') return;
      $('resultTitle').textContent = '第 ' + (levelIndex + 1) + ' 關完成！';
      $('resultStars').textContent = '★'.repeat(rating) + '☆'.repeat(3 - rating); $('resultStars').setAttribute('aria-label', '獲得 ' + rating + ' 顆星，共三顆星');
      $('resultText').textContent = `用時 ${timeText(seconds())}，翻牌 ${round.moves} 次。` + (levelIndex === levels.length - 1 ? '完成最後一關了，也能回頭挑戰三星！' : '準備好迎接下一關了嗎？');
      $('continueGame').hidden = levelIndex === levels.length - 1; dialog.showModal();
    }, 420);
    window.ShiGaiAnalytics?.track('game_complete', { game_id: 'memory', source: 'game_page', duration_ms: Math.round(milliseconds()) });
  }
  function pick(index) {
    if (!round || preparing || paused || dialog.open) return;
    const before = round.status, result = round.pick(index); if (result === 'ignored') return;
    if (before === 'ready') { startedAt = performance.now(); window.ShiGaiAnalytics?.track('game_start', { game_id: 'memory', source: 'game_page' }); }
    $('gameStatus').textContent = result === 'first' ? '記住這張，另一張在哪裡？' : result === 'match' ? '找到一對！' : '這兩張不一樣，記住後再試。';
    render(); if (round.status === 'won') finish(); else if (result === 'mismatch') scheduleMismatch();
  }
  function releaseWorks() { for (const url of workUrls) URL.revokeObjectURL(url); workUrls.clear(); }
  async function workFace(face, token, deadline) {
    for (const asset of face.sources) {
      if (token !== roundToken || performance.now() >= deadline) return null;
      let image;
      try {
        image = await boundedImage(new URL('../../../' + asset, document.baseURI).href, Math.max(1, Math.min(2000, deadline - performance.now())));
        if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 32000000) throw Error('作品圖片太大。');
        const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight)), canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .88)); image.src = '';
        if (!blob || token !== roundToken) return null;
        return { ...face, image: URL.createObjectURL(blob), asset };
      } catch { if (image) image.src = ''; }
    }
    return null;
  }
  async function roundFaces(count, token) {
    if (faceSource !== 'works') return fallbackFaces;
    const available = workPool.length >= count * 2 ? workPool.filter(face => !lastWorkIds.has(face.workId)) : workPool;
    const pool = engine.shuffle(available).slice(0, count * 3), selected = [], deadline = performance.now() + 6500;
    for (let i = 0; i < pool.length && selected.length < count && performance.now() < deadline;) {
      const size = Math.min(3, count - selected.length), batch = await Promise.all(pool.slice(i, i + size).map(face => workFace(face, token, deadline)));
      i += size; selected.push(...batch.filter(Boolean));
      if (token !== roundToken) { for (const face of selected) URL.revokeObjectURL(face.image); return []; }
      $('gameStatus').textContent = '正在準備作品卡面 ' + selected.length + ' / ' + count + '…';
    }
    return [...selected, ...engine.shuffle(fallbackFaces).slice(0, count - selected.length)];
  }
  async function newRound(index) {
    if (!levels[index]) return;
    const token = ++roundToken; preparing = true; stopClock();
    clearTimeout(mismatchTimer); clearTimeout(resultTimer); mismatchTimer = 0; resultTimer = 0; mismatchRemaining = 0;
    if (dialog.open) dialog.close();
    for (const face of faces) versions.set(face.id, (versions.get(face.id) || 0) + 1);
    for (const url of customImages.values()) releaseBlob(url); customImages.clear(); releaseWorks();
    round = null; grid.replaceChildren(); $('faceLibrary').replaceChildren(); grid.setAttribute('aria-busy', 'true');
    for (const id of ['levelSelect','restart','pause','nextLevel','backUpload']) $(id).disabled = true;
    $('gameStatus').textContent = faceSource === 'works' ? '正在隨機抽選作品卡面…' : '正在準備卡面…';
    const selected = await roundFaces(levels[index].pairs, token); if (token !== roundToken) return;
    faces = selected; for (const face of faces) if (face.workId) workUrls.add(face.image);
    lastWorkIds = new Set(faces.filter(face => face.workId).map(face => face.workId));
    levelIndex = index; round = new engine.Round(levels[index], faces.map(face => face.id)); paused = false; playedMs = 0; startedAt = 0;
    preparing = false; grid.removeAttribute('aria-busy');
    for (const id of ['levelSelect','restart','backUpload']) $(id).disabled = false;
    $('artSourceNote').textContent = faceSource !== 'works' ? '目前使用示範圖案。' : lastWorkIds.size === levels[index].pairs ? '本局從 ' + workPool.length + ' 件公開作品抽出 ' + lastWorkIds.size + ' 件；重玩會重新抽選。' : '可用作品不足或圖片載入失敗，這局部分卡面以示範圖案補齊。';
    buildLibrary();
    $('levelSelect').value = String(index); const level = levels[index];
    $('targetText').textContent = `三星目標：${level.targetSeconds} 秒內、${level.targetMoves} 次內完成。超過目標仍可過關。`;
    grid.style.setProperty('--columns', level.pairs <= 3 ? 2 : level.pairs > 8 ? 6 : 4);
    grid.style.setProperty('--mobile-columns', level.pairs <= 3 ? 2 : 4);
    grid.style.maxWidth = level.pairs <= 3 ? '340px' : level.pairs <= 6 ? '560px' : '720px';
    buttons = round.cards.map((card, i) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'card'; button.dataset.index = i;
      const inner = document.createElement('span'); inner.className = 'card-inner';
      for (const side of ['back', 'front']) { const element = document.createElement('span'); element.className = 'card-side card-' + side; element.setAttribute('aria-hidden', 'true'); inner.append(element); }
      button.append(inner); return button;
    });
    grid.replaceChildren(...buttons); $('gameStatus').textContent = '翻開第一張開始，不急，先記住它。'; render();
  }
  grid.addEventListener('click', event => { const button = event.target.closest('.card'); if (button && grid.contains(button)) pick(Number(button.dataset.index)); });
  $('levelSelect').onchange = event => newRound(Number(event.target.value)); $('restart').onclick = () => newRound(levelIndex);
  $('pause').onclick = () => paused ? resumeRound() : pauseRound(); $('resume').onclick = resumeRound;
  $('nextLevel').onclick = () => { if (round.status === 'won') newRound(levelIndex + 1); }; $('continueGame').onclick = () => { if (round.status === 'won') newRound(levelIndex + 1); };
  $('retryGame').onclick = () => newRound(levelIndex); $('closeResult').onclick = () => dialog.close();
  function releaseBlob(url) { if (blobUrls.delete(url)) URL.revokeObjectURL(url); }
  function buildLibrary() {
    $('faceLibrary').replaceChildren(...faces.map((face, index) => {
      const label = document.createElement('label'); label.className = 'face-upload';
      const preview = document.createElement('span'); preview.className = 'face-preview'; preview.id = 'preview-' + face.id;
      const name = document.createElement('span'); name.className = 'face-name'; name.textContent = face.name; name.title = face.name;
      const input = document.createElement('input'); input.type = 'file'; input.id = 'faceUpload' + index; input.accept = 'image/png,image/jpeg,image/webp'; input.setAttribute('aria-label', '替換' + face.name + '卡面'); input.onchange = () => upload(face.id, input);
      label.append(preview, name, input); return label;
    })); renderLibrary();
  }
  function renderLibrary() {
    for (const face of faces) { const preview = document.getElementById('preview-' + face.id); if (preview) picture(preview, faceUrl(face), face.symbol, face.color); }
  }
  async function upload(id, input) {
    const file = input.files?.[0]; input.value = ''; if (!file) return;
    pauseRound(); const version = (versions.get(id) || 0) + 1; versions.set(id, version); let url;
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) throw Error('請使用不超過 3 MB 的 PNG、JPG 或 WebP。');
      url = URL.createObjectURL(file); blobUrls.add(url); const image = new Image(); image.src = url; await image.decode();
      if (versions.get(id) !== version) { releaseBlob(url); return; }
      if (image.naturalWidth > 8192 || image.naturalHeight > 8192) throw Error('圖片邊長請小於或等於 8192 像素。');
      if (image.naturalWidth > 1024 || image.naturalHeight > 1024) {
        const scale = Math.min(1024 / image.naturalWidth, 1024 / image.naturalHeight), canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .9)); if (!blob) throw Error('圖片準備失敗，請換一張再試。');
        releaseBlob(url); url = URL.createObjectURL(blob); blobUrls.add(url);
        if (versions.get(id) !== version) { releaseBlob(url); return; }
      }
      if (id === 'back') { releaseBlob(backImage); backImage = url; } else { releaseBlob(customImages.get(id)); customImages.set(id, url); }
      render(); renderLibrary(); $('artStatus').textContent = '已替換' + (id === 'back' ? '共用牌背' : '這一組卡面') + '，本次試用；遊戲已暫停時請按繼續。';
    } catch (error) { if (url) releaseBlob(url); if (versions.get(id) === version) $('artStatus').textContent = error.message; }
  }
  $('backUpload').onchange = event => upload('back', event.target);
  $('resetArt').onclick = () => {
    for (const id of [...faces.map(f => f.id), 'back']) versions.set(id, (versions.get(id) || 0) + 1);
    for (const url of [...blobUrls]) releaseBlob(url); customImages.clear(); backImage = defaultBack; render(); renderLibrary(); $('artStatus').textContent = '已恢復本局卡面與預設牌背。';
  };
  let defaultBack = '';
  function boundedImage(source, timeout = 4000) {
    return new Promise((resolve, reject) => {
      const image = new Image(); image.decoding = 'async';
      const timer = setTimeout(() => { image.src = ''; reject(Error('圖片載入逾時。')); }, timeout);
      image.onload = () => { clearTimeout(timer); resolve(image); }; image.onerror = () => { clearTimeout(timer); reject(Error('圖片無法載入。')); }; image.src = source;
    });
  }
  async function sameOriginImage(path) {
    if (!path) return '';
    const url = new URL(path, document.baseURI); if (url.origin !== location.origin || !['http:', 'https:'].includes(url.protocol)) throw Error('預設圖片必須使用網站內的圖片。');
    try { await boundedImage(url.href); return url.href; }
    catch { $('artStatus').textContent = '部分預設圖片讀取失敗，已使用示範圖案。'; return ''; }
  }
  async function load() {
    try {
      const response = await fetch('memory-demo.json', { cache: 'no-cache' }); if (!response.ok) throw Error('無法載入記憶翻牌設定。');
      const config = await response.json();
      if (!Array.isArray(config.faces) || config.faces.length < 2 || config.faces.length > 36 || !Array.isArray(config.levels) || !config.levels.length || config.levels.length > 200) throw Error('請檢查卡面與關卡設定。');
      fallbackFaces = config.faces.map(face => {
        if (!face || typeof face.id !== 'string' || !/^[a-zA-Z0-9_-]{1,40}$/.test(face.id) || face.id === 'back' || typeof face.name !== 'string' || !face.name.trim() || face.name.length > 80 || typeof face.symbol !== 'string' || !face.symbol || face.symbol.length > 12) throw Error('卡面 ID、名稱或示範符號不正確。');
        return { id: face.id, name: face.name, symbol: face.symbol, color: /^#[0-9a-f]{6}$/i.test(face.color) ? face.color : '#648474', image: typeof face.image === 'string' ? face.image : '' };
      });
      if (new Set(fallbackFaces.map(f => f.id)).size !== fallbackFaces.length) throw Error('卡面 ID 不可重複。');
      levels = config.levels.map(level => engine.validateLevel(level, fallbackFaces.length));
      await Promise.all(fallbackFaces.map(async face => { face.image = await sameOriginImage(face.image); })); backImage = defaultBack = await sameOriginImage(config.backImage);
      faceSource = config.faceSource === 'works' ? 'works' : 'demo';
      if (faceSource === 'works') {
        const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 4500);
        try { const response = await fetch('../../../database/website/works.json', { cache: 'no-cache', signal: controller.signal }); if (response.ok) workPool = window.ShiGaiMemoryWorks.candidates(await response.json()); }
        catch { workPool = []; } finally { clearTimeout(timer); }
      }
      $('levelSelect').replaceChildren(...levels.map((_, index) => { const option = document.createElement('option'); option.value = index; option.textContent = levelLabel(index); return option; }));
      await newRound(0);
    } catch (error) { $('gameStatus').textContent = error.message; const retry = document.createElement('button'); retry.textContent = '重新載入'; retry.onclick = () => { retry.remove(); load(); }; $('gameStatus').append(' ', retry); }
  }
  setInterval(() => { if (!document.hidden && startedAt) showTime(); }, 500);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pauseRound(); }); window.addEventListener('pagehide', pauseRound);
  window.ShiGaiMemoryDemo = Object.freeze({ state: () => ({ ready: !!round && !preparing, preparing, faceSource, poolCount: workPool.length, drawnWorkIds: faces.filter(face=>face.workId).map(face=>face.workId), faceImages: faces.map(face=>({id:face.id,image:face.image,asset:face.asset||'',workId:face.workId||''})), level: levelIndex + 1, totalLevels: levels.length, cards: round?.cards.map(c => ({ ...c })), status: round?.status, pending: round?.pending.length, moves: round?.moves, matches: round?.matches, seconds: milliseconds() / 1000, paused, resultOpen: dialog.open, best: Object.fromEntries([...best].map(([index, value]) => [index + 1, value])), customFaces: [...customImages.keys()], customBack: blobUrls.has(backImage) }) });
  load();
  window.ShiGaiWebsiteSettings?.then(async () => { const response = await fetch('../../../database/website/games.json'); if (!response.ok) return; const entry = (await response.json()).find(game => game.id === 'memory'); if (entry) { $('gameTitle').textContent = entry.name; $('gameDescription').textContent = entry.description; document.title = entry.name + ' · Shi-Gai'; } }).catch(() => {});
})();
