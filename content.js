function startDownloadProcess() {
  const images = document.querySelectorAll('img.img.ls.limit-width.limit-height');
  
  console.log(`Found ${images.length} images. Queuing for download.`);
  
  const mangaTitleElement = document.querySelector('a.reader--header-manga');
  const chapterTitleElement = document.querySelector('div.reader--header-title');
  const mangaTitle = mangaTitleElement ? mangaTitleElement.textContent.trim().replace(/[<>:"/\\|?*]+/g, '') : 'Manga';
  const chapterTitle = chapterTitleElement ? chapterTitleElement.textContent.trim().replace(/[<>:"/\\|?*]+/g, '') : 'Chapter';
  const folderName = `${mangaTitle}/${chapterTitle}`;

  const queueAllImages = async () => {
    const imagePromises = Array.from(images).map(async (img, index) => {
      const blobUrl = img.src;
      if (blobUrl.startsWith('blob:')) {
        try {
          const response = await fetch(blobUrl);
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const filename = `${folderName}/${(index + 1).toString().padStart(3, '0')}.png`;
          
          chrome.runtime.sendMessage({
            action: 'queueImageDownload',
            url: url,
            filename: filename
          });
        } catch (error) {
          console.error(`Failed to process blob for image ${index + 1}:`, error);
        }
      }
    });

    await Promise.all(imagePromises);
    
    console.log(`All ${images.length} images for this chapter have been queued.`);
    chrome.runtime.sendMessage({ action: 'chapterProcessingComplete' });
  };

  queueAllImages();
}

function init() {
  // Fetch the user-defined settings, with a fallback to the DEFAULTS.
  // Note: DEFAULTS is not defined here, so we must provide a default object.
  chrome.storage.sync.get({ stabilityChecks: 8 }, (settings) => {
    let stableCount = 0;
    let lastImageCount = 0;
    let totalPages = 0;
    let hasStarted = false;

    console.log(`Using stability check count: ${settings.stabilityChecks}`);

    const checkInterval = setInterval(() => {
      if (hasStarted) return;

      if (totalPages === 0) {
        const totalPagesElement = document.querySelector('div.page-number:last-child');
        if (totalPagesElement) {
          totalPages = parseInt(totalPagesElement.textContent, 10);
          console.log(`Determined total pages: ${totalPages}`);
        }
      }

      const loadedImages = document.querySelectorAll('img.img.ls.limit-width.limit-height');
      
      if (totalPages > 0 && loadedImages.length >= totalPages) {
        hasStarted = true;
        console.log(`Success: Loaded image count (${loadedImages.length}) matches total pages (${totalPages}).`);
        clearInterval(checkInterval);
        startDownloadProcess();
        return;
      }

      if (loadedImages.length > lastImageCount) {
        lastImageCount = loadedImages.length;
        stableCount = 0;
        console.log(`Image count increased to ${lastImageCount}.`);
      } else if (loadedImages.length > 0) {
        stableCount++;
        console.log(`Image count stable at ${lastImageCount}. Stability: ${stableCount}/${settings.stabilityChecks}`);
      }

      if (stableCount >= settings.stabilityChecks) {
        hasStarted = true;
        console.log(`Success: Image count has stabilized at ${lastImageCount}. Assuming all loaded.`);
        clearInterval(checkInterval);
        startDownloadProcess();
      }
    }, 250);

    setTimeout(() => {
      if (hasStarted) return;
      hasStarted = true;
      clearInterval(checkInterval);
      const loadedImages = document.querySelectorAll('img.img.ls.limit-width.limit-height');
      if (loadedImages.length > 0) {
          console.warn("Timeout reached, but images were found. Attempting download anyway.");
          startDownloadProcess();
      } else {
          console.error("Timeout reached and no images found. Aborting this chapter.");
          chrome.runtime.sendMessage({ action: 'chapterProcessingComplete' });
      }
    }, 30000);
  });
}

init();