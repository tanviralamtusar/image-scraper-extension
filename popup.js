const scrapeBtn = document.getElementById("scrapeBtn");
const statusEl = document.getElementById("status");
const gridEl = document.getElementById("grid");
const filterRow = document.getElementById("filterRow");
const qualityFilter = document.getElementById("qualityFilter");
const selectRow = document.getElementById("selectRow");
const downloadRow = document.getElementById("downloadRow");
const downloadBtn = document.getElementById("downloadBtn");
const selectAllBtn = document.getElementById("selectAllBtn");
const selectNoneBtn = document.getElementById("selectNoneBtn");

let images = []; // { url, width, height }
let selected = new Set();
let currentTab = null;

function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").slice(0, 100);
}

function filenameForUrl(url, index) {
  try {
    if (url.startsWith("data:")) {
      const match = url.match(/^data:image\/(\w+);/);
      const ext = match ? match[1] : "png";
      return `image_${index}.${ext}`;
    }
    const parsed = new URL(url);
    let name = parsed.pathname.split("/").filter(Boolean).pop() || `image_${index}`;
    name = sanitizeFilename(decodeURIComponent(name));
    if (!/\.[a-zA-Z0-9]+$/.test(name)) name += ".jpg";
    return name;
  } catch {
    return `image_${index}.jpg`;
  }
}

function qualityLabel(width, height) {
  const minSide = Math.min(width, height);
  if (minSide === 0) return { text: "?", cls: "low" };
  if (minSide >= 800) return { text: `${width}×${height}`, cls: "high" };
  if (minSide >= 300) return { text: `${width}×${height}`, cls: "medium" };
  return { text: `${width}×${height}`, cls: "low" };
}

function passesFilter(img) {
  const minSide = Math.min(img.width, img.height);
  return minSide >= Number(qualityFilter.value);
}

function updateDownloadButton() {
  downloadBtn.textContent = `Download Selected (${selected.size})`;
  downloadBtn.disabled = selected.size === 0;
}

function renderGrid() {
  gridEl.innerHTML = "";
  images.forEach((img, i) => {
    if (!passesFilter(img)) return;

    const thumb = document.createElement("div");
    thumb.className = "thumb" + (selected.has(i) ? " selected" : "");
    thumb.dataset.index = String(i);

    const imgEl = document.createElement("img");
    imgEl.src = img.url;
    imgEl.loading = "lazy";

    const check = document.createElement("div");
    check.className = "check";
    check.textContent = "✓";

    const quality = qualityLabel(img.width, img.height);
    const qualityEl = document.createElement("div");
    qualityEl.className = `quality ${quality.cls}`;
    qualityEl.textContent = quality.text;

    thumb.appendChild(imgEl);
    thumb.appendChild(check);
    thumb.appendChild(qualityEl);

    thumb.addEventListener("click", () => {
      if (selected.has(i)) {
        selected.delete(i);
        thumb.classList.remove("selected");
      } else {
        selected.add(i);
        thumb.classList.add("selected");
      }
      updateDownloadButton();
    });

    gridEl.appendChild(thumb);
  });
  updateDownloadButton();
}

scrapeBtn.addEventListener("click", async () => {
  scrapeBtn.disabled = true;
  statusEl.textContent = "Scraping...";
  gridEl.innerHTML = "";
  filterRow.style.display = "none";
  selectRow.style.display = "none";
  downloadRow.style.display = "none";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab");
    currentTab = tab;

    statusEl.textContent = "Scraping and measuring image quality...";

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });

    images = result || [];

    if (images.length === 0) {
      statusEl.textContent = "No images found.";
      return;
    }

    selected = new Set(images.map((_, i) => i));
    qualityFilter.value = "0";
    renderGrid();
    filterRow.style.display = "flex";
    selectRow.style.display = "flex";
    downloadRow.style.display = "flex";
    statusEl.textContent = `Found ${images.length} images. Select which to download.`;
  } catch (err) {
    console.error(err);
    statusEl.textContent = `Error: ${err.message}`;
  } finally {
    scrapeBtn.disabled = false;
  }
});

qualityFilter.addEventListener("change", () => {
  const visibleIndices = images
    .map((img, i) => (passesFilter(img) ? i : -1))
    .filter((i) => i !== -1);
  selected = new Set(visibleIndices);
  renderGrid();
});

selectAllBtn.addEventListener("click", () => {
  const visibleIndices = images
    .map((img, i) => (passesFilter(img) ? i : -1))
    .filter((i) => i !== -1);
  selected = new Set(visibleIndices);
  renderGrid();
});

selectNoneBtn.addEventListener("click", () => {
  selected = new Set();
  renderGrid();
});

downloadBtn.addEventListener("click", async () => {
  if (selected.size === 0 || !currentTab) return;
  downloadBtn.disabled = true;

  const indices = Array.from(selected).sort((a, b) => a - b);
  let host = "images";
  try {
    host = new URL(currentTab.url).hostname.replace(/[^a-zA-Z0-9.-]/g, "_");
  } catch {}

  let downloaded = 0;
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i];
    const url = images[idx].url;
    const filename = `image-scraper/${host}/${filenameForUrl(url, idx + 1)}`;
    try {
      await chrome.downloads.download({ url, filename, conflictAction: "uniquify" });
      downloaded++;
    } catch (err) {
      console.warn("Failed to download", url, err);
    }
    statusEl.textContent = `Downloading ${i + 1}/${indices.length}...`;
  }

  statusEl.textContent = `Done. Downloaded ${downloaded}/${indices.length} images.`;
  downloadBtn.disabled = false;
});
