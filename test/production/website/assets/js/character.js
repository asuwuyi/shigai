// Character entries lead to the same filtered exhibition wall used by Works.
const query = new URLSearchParams(window.location.search);
const characterId = query.get("id");
const loading = document.getElementById("characterDetailLoading");
const error = document.getElementById("characterDetailError");

function worksUrl(characterName) {
  const destination = new URLSearchParams();
  destination.set("character", characterName);
  if (query.get("review") === "1") destination.set("review", "1");
  return `works.html?${destination}`;
}

async function openCharacterWorks() {
  if (!characterId) { loading.hidden = true; error.hidden = false; return; }
  try {
    const response = await fetch("../database/website/characters.json");
    if (!response.ok) throw new Error("Character export unavailable.");
    const characters = await response.json();
    const character = Array.isArray(characters) ? characters.find((item) => item.id === characterId) : null;
    if (!character?.name) throw new Error("Character not found.");
    window.location.replace(worksUrl(character.name));
  } catch {
    loading.hidden = true;
    error.hidden = false;
  }
}

openCharacterWorks();
