function collectImageUrls() {
  const urls = new Set();

  document.querySelectorAll("img").forEach((img) => {
    if (img.currentSrc) urls.add(img.currentSrc);
    else if (img.src) urls.add(img.src);

    const srcset = img.getAttribute("srcset");
    if (srcset) {
      srcset.split(",").forEach((part) => {
        const url = part.trim().split(" ")[0];
        if (url) urls.add(new URL(url, document.baseURI).href);
      });
    }
  });

  document.querySelectorAll("source").forEach((source) => {
    const srcset = source.getAttribute("srcset");
    if (srcset) {
      srcset.split(",").forEach((part) => {
        const url = part.trim().split(" ")[0];
        if (url) urls.add(new URL(url, document.baseURI).href);
      });
    }
  });

  document.querySelectorAll("*").forEach((el) => {
    const bg = getComputedStyle(el).backgroundImage;
    if (bg && bg !== "none") {
      const matches = bg.matchAll(/url\((['"]?)(.*?)\1\)/g);
      for (const match of matches) {
        if (match[2]) urls.add(new URL(match[2], document.baseURI).href);
      }
    }
  });

  return Array.from(urls).filter(
    (url) => url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")
  );
}

collectImageUrls();
