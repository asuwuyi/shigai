(function () {
  'use strict';
  const P = window.ShiGaiWheelPhysics, rotor = new P.Rotor();
  const $ = id => document.getElementById(id), canvas = $('wheelCanvas'), ctx = canvas.getContext('2d');
  const drive = $('driveButton'), brake = $('brakeButton'), input = $('optionInput'), select = $('pointerPosition');
  const dialog = $('resultDialog'), status = $('wheelStatus'), feedback = $('settingsFeedback');
  const pointerHandle=$('pointerHandle');
  const angles = { top: 0, right: 90, bottom: 180, left: 270 };
  let options = [], colors = [], pointer = 'top', pointerDegrees=0, pointerDrag=null, ready = false, assetLoading = false, centerImage = null;
  let frame = 0, lastFrame = 0, roundActive = false, roundStart = 0, drag = null, holdId = null, keyboardHold = false, assetVersion = 0;
  const busy = () => rotor.mode !== 'idle';
  const segmenter=Intl.Segmenter?new Intl.Segmenter('zh-Hant',{granularity:'grapheme'}):null,labelCache=new Map();
  const graphemes=text=>segmenter?Array.from(segmenter.segment(text),part=>part.segment):Array.from(text);
  function labelLines(text,maxWidth,font){const key=text+'|'+maxWidth+'|'+font;if(labelCache.has(key))return labelCache.get(key);const lines=[];let line='';for(const char of graphemes(text)){if(line&&ctx.measureText(line+char).width>maxWidth){lines.push(line);line='';}line+=char;}if(line)lines.push(line);const shown=lines.slice(0,3);if(lines.length>3)shown[2]=graphemes(shown[2]).slice(0,-1).join('')+'…';if(labelCache.size>96)labelCache.clear();labelCache.set(key,shown);return shown;}
  function syncControls() {
    const locked = !ready || busy() || assetLoading;
    for (const id of ['applyOptions', 'pointerPosition', 'importOptions', 'centerImageInput', 'clearImage']) $(id).disabled = locked;
    pointerHandle.disabled=locked;pointerHandle.setAttribute('aria-label',locked?'箭頭已鎖定，停穩後可調整':'拖曳箭頭調整位置，或使用方向鍵');
    $('exportOptions').disabled = !ready;
    input.disabled = !ready;
    drive.disabled = !ready || assetLoading || rotor.mode === 'drag';
    brake.disabled = !busy();
    drive.classList.toggle('is-held', rotor.mode === 'hold');
    canvas.classList.toggle('is-dragging', rotor.mode === 'drag');
    $('wheelStage').setAttribute('aria-busy', String(busy()));
  }
  function announceMotion() {
    status.textContent = rotor.mode === 'hold' ? '正在加速，放開就會自然減速。' : rotor.mode === 'drag' ? '順著轉盤撥動，放開讓它轉。' : '慢慢轉，慢慢停…';
    feedback.textContent = '旋轉中會固定選項與箭頭，停穩後才能更改。';
  }
  function startRound() {
    endPointerDrag();
    if (!roundActive) { roundActive = true; roundStart = performance.now(); window.ShiGaiAnalytics?.track('game_start', { game_id: 'wheel', source: 'game_page' }); }
  }
  function paint() {
    if (!ctx || !options.length) return;
    const size = canvas.clientWidth || 360, ratio = Math.min(devicePixelRatio || 1, 2), pixels = Math.round(size * ratio);
    if (canvas.width !== pixels || canvas.height !== pixels) { canvas.width = pixels; canvas.height = pixels; }
    ctx.setTransform(pixels / 1000, 0, 0, pixels / 1000, 0, 0); ctx.clearRect(0, 0, 1000, 1000);
    ctx.save(); ctx.translate(500, 500);
    ctx.fillStyle = '#49372a'; ctx.beginPath(); ctx.arc(0, 0, 483, 0, P.TAU); ctx.fill();
    ctx.fillStyle = '#e6cf9e'; ctx.beginPath(); ctx.arc(0, 0, 471, 0, P.TAU); ctx.fill();
    ctx.save(); ctx.rotate(rotor.angle);
    const step = P.TAU / options.length, font = Math.max(22, Math.min(44, 240 / options.length + 10));
    for (let i = 0; i < options.length; i++) {
      const a = -Math.PI / 2 + i * step, b = a + step;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 454, a, b); ctx.closePath();
      ctx.fillStyle = colors[i % colors.length]; ctx.fill(); ctx.strokeStyle = '#fff4dcaa'; ctx.lineWidth = 3; ctx.stroke();
      ctx.save(); ctx.rotate((a + b) / 2); ctx.translate(307, 0); ctx.rotate(Math.PI / 2);
      ctx.font = `750 ${font}px "PingFang TC", "Microsoft JhengHei", sans-serif`; ctx.fillStyle = '#322a22'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const maxWidth = Math.max(62, Math.sin(step / 2) * 570 * .83), shown=labelLines(options[i],maxWidth,font);
      shown.forEach((text, row) => ctx.fillText(text, 0, (row - (shown.length - 1) / 2) * font * 1.18, maxWidth)); ctx.restore();
    }
    for (let i = 0; i < 36; i++) { const a = i * P.TAU / 36; ctx.beginPath(); ctx.arc(Math.cos(a) * 469, Math.sin(a) * 469, 3.5, 0, P.TAU); ctx.fillStyle = '#806544'; ctx.fill(); }
    ctx.restore();
    ctx.beginPath(); ctx.arc(0, 0, 97, 0, P.TAU); ctx.fillStyle = '#49372a'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 86, 0, P.TAU); ctx.fillStyle = '#fff4db'; ctx.fill();
    if (centerImage) { ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 78, 0, P.TAU); ctx.clip(); const scale = Math.min(156 / centerImage.naturalWidth, 156 / centerImage.naturalHeight); ctx.drawImage(centerImage, -centerImage.naturalWidth * scale / 2, -centerImage.naturalHeight * scale / 2, centerImage.naturalWidth * scale, centerImage.naturalHeight * scale); ctx.restore(); }
    else { ctx.fillStyle = '#a65037'; ctx.font = '700 22px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('SHI-GAI', 0, -13); ctx.font = '18px system-ui'; ctx.fillStyle = '#79694f'; ctx.fillText('轉一下', 0, 20); }
    ctx.restore();
  }
  function setPointer(value,degrees) {
    pointerDegrees=typeof degrees==='number'&&Number.isFinite(degrees)?((degrees%360)+360)%360:Object.hasOwn(angles,value)?angles[value]:0;
    pointer=Object.keys(angles).find(name=>Math.abs(angles[name]-pointerDegrees)<.0001)||'custom';select.value=pointer;
    $('pointerArm').style.setProperty('--pointer-rotation',pointerDegrees+'deg');
  }
  function pointerAt(event){const rect=$('wheelStage').getBoundingClientRect(),x=event.clientX-rect.left-rect.width/2,y=event.clientY-rect.top-rect.height/2;return {degrees:(Math.atan2(y,x)+Math.PI/2)*180/Math.PI,radius:Math.hypot(x,y),width:rect.width};}
  function endPointerDrag(){if(!pointerDrag)return;const id=pointerDrag.id;pointerDrag=null;$('wheelStage').classList.remove('is-positioning');if(pointerHandle.hasPointerCapture(id))pointerHandle.releasePointerCapture(id);}
  pointerHandle.addEventListener('pointerdown',event=>{if(!ready||busy()||assetLoading||pointerDrag||event.button!==0)return;event.preventDefault();event.stopPropagation();const point=pointerAt(event);pointerDrag={id:event.pointerId,offset:pointerDegrees-point.degrees};pointerHandle.setPointerCapture(event.pointerId);$('wheelStage').classList.add('is-positioning');feedback.textContent='沿轉盤邊緣拖到想要的位置，放開即可。';});
  pointerHandle.addEventListener('pointermove',event=>{if(!pointerDrag||event.pointerId!==pointerDrag.id||busy())return;event.preventDefault();event.stopPropagation();const point=pointerAt(event);if(point.radius<point.width*.15)return;setPointer('custom',point.degrees+pointerDrag.offset);});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])pointerHandle.addEventListener(name,event=>{if(pointerDrag?.id!==event.pointerId)return;event.stopPropagation();endPointerDrag();feedback.textContent='箭頭位置已設定；開始轉動後會鎖定。';});
  pointerHandle.addEventListener('keydown',event=>{if(busy()||!ready)return;const direction={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[event.key];if(!direction&&event.key!=='Home')return;event.preventDefault();event.stopPropagation();setPointer('custom',event.key==='Home'?0:pointerDegrees+direction*(event.shiftKey?15:5));feedback.textContent='箭頭位置已設定；開始轉動後會鎖定。';});
  function finishRound() {
    if (!roundActive || !options.length) return;
    roundActive = false; const index = P.selectedIndex(rotor.angle, pointerDegrees*Math.PI/180-Math.PI/2, options.length);
    $('resultValue').textContent = options[index]; dialog.dataset.resultIndex = String(index);
    status.textContent = '停穩了，這次選到「' + options[index] + '」。';
    feedback.textContent = '已固定 ' + options.length + ' 個選項。可編輯後再套用。';
    syncControls(); dialog.showModal();
    window.ShiGaiAnalytics?.track('game_complete', { game_id: 'wheel', source: 'game_page', duration_ms: Math.round(performance.now() - roundStart) });
  }
  function animate(now) {
    frame = 0; const dt = lastFrame ? Math.min((now - lastFrame) / 1000, .05) : 0; lastFrame = now;
    rotor.step(dt); paint();
    if (rotor.mode === 'idle') { syncControls(); finishRound(); return; }
    if (!document.hidden) frame = requestAnimationFrame(animate);
  }
  function wake() { if (!frame && !document.hidden) { lastFrame = 0; frame = requestAnimationFrame(animate); } }
  function beginHold() {
    if (!ready || assetLoading || drag || dialog.open) return;
    startRound(); rotor.hold(); syncControls(); announceMotion(); wake();
  }
  function endHold() {
    if (holdId === null && !keyboardHold && rotor.mode !== 'hold') return;
    holdId = null; keyboardHold = false; rotor.release(); syncControls(); announceMotion(); wake();
  }
  drive.addEventListener('pointerdown', event => {
    if (event.button !== 0 || holdId !== null || keyboardHold || drag) return;
    event.preventDefault(); holdId = event.pointerId; drive.setPointerCapture(event.pointerId); beginHold();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) drive.addEventListener(type, event => { if (event.pointerId === holdId) endHold(); });
  drive.addEventListener('keydown', event => { if (![' ', 'Enter'].includes(event.key)) return; event.preventDefault(); if (event.repeat || holdId !== null || keyboardHold) return; keyboardHold = true; beginHold(); });
  drive.addEventListener('keyup', event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); endHold(); } });
  drive.addEventListener('blur', () => { if (keyboardHold) endHold(); });
  function point(event) { const r = canvas.getBoundingClientRect(), x = event.clientX - r.left - r.width / 2, y = event.clientY - r.top - r.height / 2; return { angle: Math.atan2(y, x), radius: Math.hypot(x, y), r }; }
  canvas.addEventListener('pointerdown', event => {
    if (!ready || assetLoading || event.button !== 0 || drag || holdId !== null || keyboardHold || dialog.open) return;
    const p = point(event); if (p.radius < p.r.width * .12 || p.radius > p.r.width / 2) return;
    event.preventDefault(); canvas.setPointerCapture(event.pointerId); rotor.grab();
    drag = { id: event.pointerId, last: p.angle, samples: [{ at: performance.now(), angle: rotor.angle }], unwrapped: rotor.angle, moved: false };
    syncControls(); announceMotion();
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    const p = point(event); if (p.radius < p.r.width * .08) return;
    const now = performance.now(), delta = Math.atan2(Math.sin(p.angle - drag.last), Math.cos(p.angle - drag.last)); drag.last = p.angle; drag.unwrapped += delta;
    if (Math.abs(delta) > .001) { drag.moved = true; startRound(); }
    drag.samples.push({ at: now, angle: drag.unwrapped }); drag.samples = drag.samples.filter(s => now - s.at <= 120);
    const first = drag.samples[0], seconds = (now - first.at) / 1000;
    rotor.drag(delta, seconds > .003 ? (drag.unwrapped - first.angle) / seconds : rotor.omega); paint();
  });
  function releaseDrag(event) {
    if (!drag || drag.id !== event.pointerId) return;
    if (performance.now() - drag.samples.at(-1).at > 100) rotor.omega = 0;
    drag = null; rotor.release(); syncControls(); if(!roundActive){status.textContent='準備好了，按住按鈕或直接撥動轉盤。';feedback.textContent='可編輯選項後再套用。';}else announceMotion(); wake();
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, releaseDrag);
  brake.addEventListener('click', () => { if (!busy()) return; drag = null; holdId = null; keyboardHold = false; rotor.brake(); syncControls(); announceMotion(); wake(); });
  $('applyOptions').addEventListener('click', () => {
    if (busy() || !ready) return;
    try { const next = P.normalizeOptions(input.value); options = next; rotor.angle = 0; $('optionCount').textContent = options.length + ' 個選項'; paint(); canvas.setAttribute('aria-label', options.length + ' 個選項的轉盤；使用按住加速按鈕，或直接拖曳'); feedback.textContent = '已套用 ' + options.length + ' 個選項。'; status.textContent = '準備好了，按住按鈕或直接撥動轉盤。'; }
    catch (error) { feedback.textContent = error.message; input.focus(); }
  });
  select.addEventListener('change', () => { if (!busy()) { setPointer(select.value); feedback.textContent = '箭頭位置已固定；旋轉中不會移動。'; } });
  $('exportOptions').addEventListener('click', () => {
    try { const data = { options: P.normalizeOptions(input.value), pointer, ...(pointer==='custom'?{pointerDegrees}: {}) }, url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'shi-gai-wheel-options.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    catch (error) { feedback.textContent = error.message; }
  });
  $('importOptions').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file || busy()) return;
    try { if (file.size > 65536) throw Error('設定檔最大 64 KB。'); const data = JSON.parse(await file.text()); const next = P.normalizeOptions(Array.isArray(data) ? data : data.options); if (busy()) throw Error('請等轉盤停下後再讀取設定。'); input.value = next.join('\n'); options = next; setPointer(data.pointer,data.pointerDegrees); rotor.angle = 0; $('optionCount').textContent = options.length + ' 個選項'; paint(); feedback.textContent = '已讀取並套用選項設定。'; }
    catch (error) { feedback.textContent = '無法讀取設定：' + error.message; }
    finally { event.target.value = ''; }
  });
  async function imageFrom(source) { return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(Error('圖片無法讀取，請換一張 PNG、JPG 或 WebP。')); image.src = source; }); }
  $('centerImageInput').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file || busy()) return; const version = ++assetVersion;
    try { if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) throw Error('請選擇 3 MB 以下的 PNG、JPG 或 WebP。'); assetLoading = true; syncControls(); const url = URL.createObjectURL(file); try { const image = await imageFrom(url); if (image.naturalWidth * image.naturalHeight > 25000000) throw Error('圖片尺寸太大，請先縮小至 2500 萬像素以內。'); if (version === assetVersion) centerImage = image; } finally { URL.revokeObjectURL(url); } paint(); feedback.textContent = '中心圖片已替換；只作本次試用，不會上傳。'; }
    catch (error) { feedback.textContent = error.message; }
    finally { assetLoading = false; syncControls(); event.target.value = ''; }
  });
  $('clearImage').addEventListener('click', () => { if (!busy()) { assetVersion++; centerImage = null; paint(); feedback.textContent = '已恢復中心圖案。'; } });
  $('resultClose').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => drive.focus({ preventScroll: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { endPointerDrag(); if (frame) cancelAnimationFrame(frame); frame = 0; holdId = null; keyboardHold = false; drag = null; if (rotor.mode === 'hold' || rotor.mode === 'drag') rotor.release(); syncControls(); }
    else if (busy() || roundActive) wake();
  });
  window.addEventListener('blur', () => { endPointerDrag(); if (keyboardHold || holdId !== null) endHold(); if (drag) releaseDrag({ pointerId: drag.id }); });
  const resize = new ResizeObserver(() => paint()); resize.observe($('wheelStage'));
  window.addEventListener('pagehide', () => { endPointerDrag(); if (frame) cancelAnimationFrame(frame); frame = 0; lastFrame = 0; holdId = null; keyboardHold = false; drag = null; if (rotor.mode === 'hold' || rotor.mode === 'drag') rotor.release(); });
  window.addEventListener('pageshow', () => { if (busy() || roundActive) wake(); });
  async function load() {
    try {
      const data = await ShiGaiGameConfig.load('wheel','wheel-demo.json');if(data.pointerImage){const img=document.createElement('img');img.src=data.pointerImage;img.alt='';pointerHandle.replaceChildren(img);} options = P.normalizeOptions(data.options); colors = Array.isArray(data.colors) ? data.colors.filter(color => /^#[0-9a-f]{6}$/i.test(color)).slice(0,24) : []; if (!colors.length) colors = ['#e9bd62', '#8ba99a', '#c87a62'];
      input.value = options.join('\n'); setPointer(data.pointer,data.pointerDegrees); $('optionCount').textContent = options.length + ' 個選項';
      if (data.centerImage) { const url = new URL(data.centerImage, document.baseURI); if (url.origin === location.origin && ['http:', 'https:', 'file:'].includes(url.protocol)) try { centerImage = await imageFrom(url.href); } catch { feedback.textContent = '中心圖片讀取失敗，已使用原圖案。'; } }
      ready = true; syncControls(); paint(); status.textContent = '準備好了，按住按鈕或直接撥動轉盤。';
    } catch (error) { status.textContent = error.message + ' '; const retry = document.createElement('button'); retry.type = 'button'; retry.className = 'soft-button'; retry.textContent = '重新載入'; retry.onclick = () => { status.textContent = '正在重新載入…'; load(); }; status.append(retry); }
  }
  document.fonts?.ready.then(()=>{labelCache.clear();paint();});
  load();
  // Read-only state for diagnostics; never a second source of settings or a result setter.
  window.ShiGaiWheelDemo = Object.freeze({ state: () => ({ angle: rotor.angle, omega: rotor.omega, mode: rotor.mode, pointer, pointerDegrees, pointerLocked:busy()||!ready||assetLoading, options: [...options], ready, resultOpen: dialog.open, result: $('resultValue').textContent, centerImage: Boolean(centerImage) }) });
})();
