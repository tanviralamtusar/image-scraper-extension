const scrapeBtn = document.getElementById("scrapeBtn");
const statusEl = document.getElementById("status");
const gridEl = document.getElementById("grid");
const selectRow = document.getElementById("selectRow");
const downloadRow = document.getElementById("downloadRow");
const downloadBtn = document.getElementById("downloadBtn");
const selectAllBtn = document.getElementById("selectAllBtn");
const selectNoneBtn = document.getElementById("selectNoneBtn");

let imageUrls = [];
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

function updateDownloadButton() {
  downloadBtn.textContent = `Download Selected (${selected.size})`;
  downloadBtn.disabled = selected.size === 0;
}

function renderGrid() {
  gridEl.innerHTML = "";
  imageUrls.forEach((url, i) => {
    const thumb = document.createElement("div");
    thumb.className = "thumb selected";
    thumb.dataset.index = String(i);

    const img = document.createElement("img");
    img.src = url;
    img.loading = "lazy";

    const check = document.createElement("div");
    check.className = "check";
    check.textContent = "✓";

    thumb.appendChild(img);
    thumb.appendChild(check);

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
}

scrapeBtn.addEventListener("click", async () => {
  scrapeBtn.disabled = true;
  statusEl.textContent = "Scraping...";
  gridEl.innerHTML = "";
  selectRow.style.display = "none";
  downloadRow.style.display = "none";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab");
    currentTab = tab;

    const [{ result: urls }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });

    imageUrls = urls || [];

    if (imageUrls.length === 0) {
      statusEl.textContent = "No images found.";
      return;
    }

    selected = new Set(imageUrls.map((_, i) => i));
    renderGrid();
    selectRow.style.display = "flex";
    downloadRow.style.display = "flex";
    updateDownloadButton();
    statusEl.textContent = `Found ${imageUrls.length} images. Select which to download.`;
  } catch (err) {
    console.error(err);
    statusEl.textContent = `Error: ${err.message}`;
  } finally {
    scrapeBtn.disabled = false;
  }
});

selectAllBtn.addEventListener("click", () => {
  selected = new Set(imageUrls.map((_, i) => i));
  document.querySelectorAll(".thumb").forEach((el) => el.classList.add("selected"));
  updateDownloadButton();
});

selectNoneBtn.addEventListener("click", () => {
  selected = new Set();
  document.querySelectorAll(".thumb").forEach((el) => el.classList.remove("selected"));
  updateDownloadButton();
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
    const url = imageUrls[idx];
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
