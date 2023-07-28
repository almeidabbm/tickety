async function loadBackgrounds() {
  window.loadedBackgrounds = await utils.fetchBackgrounds();
}

loadBackgrounds();
