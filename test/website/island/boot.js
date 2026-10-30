'use strict';
function showIslandFailure(message) {
  document.getElementById('islandLoading').hidden = true;
  const notice = document.getElementById('islandWarning'); notice.textContent = message; notice.hidden = false;
  document.getElementById('placesList').hidden = false;
  document.getElementById('placesToggle').setAttribute('aria-expanded', 'true');
  for (const id of ['viewReset', 'zoomOut', 'zoomIn', 'lightToggle', 'motionToggle']) document.getElementById(id).disabled = true;
}
window.ShiGaiIslandFailure = showIslandFailure;
const list = document.getElementById('placesList'), toggle = document.getElementById('placesToggle');
toggle.addEventListener('click', () => { list.hidden = !list.hidden; toggle.setAttribute('aria-expanded', String(!list.hidden)); });
document.getElementById('placesClose').addEventListener('click', () => { list.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); });
const help = document.getElementById('islandHelp');
document.getElementById('helpOpen').addEventListener('click', () => help.showModal());
document.getElementById('helpClose').addEventListener('click', () => help.close());
import('./island.js?v=island-20261030').catch(error => { console.error('Shi-Gai island:', error); showIslandFailure('小島暫時無法顯示。你仍可從地點清單前往作品、日誌與遊戲。'); });
