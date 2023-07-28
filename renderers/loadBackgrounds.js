async function loadBackgrounds() {
  console.log(utils);
  window.loadedBackgrounds = await utils.fetchBackgrounds();
  console.log(window.loadedBackgrounds);
}

loadBackgrounds();
