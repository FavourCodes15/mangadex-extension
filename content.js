function startDownloadProcess(settings) {
  const images = document.querySelectorAll('img.img.ls.limit-width.limit-height');
  console.log(`Found ${images.length} images.`);

  if (settings.downloadAs === 'images') {
    console.log('Queuing images for individual download.');
    const mangaTitleElement = document.querySelector('a.reader--header-manga');
    const chapterTitleElement = document.querySelector('div.reader--header-title');
    const mangaTitle = mangaTitleElement ? mangaTitleElement.textContent.trim().replace(/[<>:"/\\|?*]+/g, '') : 'Manga';
    const chapterTitle = chapterTitleElement ? chapterTitleElement.textContent.trim().replace(/[<>:"/\\|?*]+/g, '') : 'Chapter';
    const folderName = `${mangaTitle}/${chapterTitle}`;

    const queueImageDownloads = async () => {
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
      chrome.runtime.sendMessage({ action: 'chapterProcessingComplete', imageUrls: [] }); // Send empty array for consistency
    };
    queueImageDownloads();

  } else {
    console.log('Collecting image data URLs for archival.');
    const imagePromises = Array.from(images).map(img => {
      return new Promise(async (resolve) => {
        try {
          const response = await fetch(img.src);
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => resolve(null); // Resolve with null on error
          reader.readAsDataURL(blob);
        } catch (e) {
          console.error('Failed to fetch image for data URL conversion:', e);
          resolve(null);
        }
      });
    });

    Promise.all(imagePromises).then(dataUrls => {
      // Filter out any nulls from failed conversions
      const validDataUrls = dataUrls.filter(url => url !== null);
      console.log(`Sending ${validDataUrls.length} data URLs to background script.`);
      chrome.runtime.sendMessage({ action: 'chapterProcessingComplete', imageUrls: validDataUrls });
    });
  }
}

function init() {
  // Fetch the user-defined settings, with a fallback to the DEFAULTS.
  // Note: DEFAULTS is not defined here, so we must provide a default object.
  // Fetch all relevant settings
  chrome.storage.sync.get({ downloadAs: 'images', stabilityChecks: 8, overallTimeoutSeconds: 30 }, (settings) => {
    let stableCount = 0;
    let lastImageCount = 0;
    let totalPages = -1; // Use -1 to indicate "not yet determined"
    let hasStarted = false;

    console.log(`Using stability check count: ${settings.stabilityChecks}, Overall timeout: ${settings.overallTimeoutSeconds}s`);

    const checkInterval = setInterval(() => {
      if (hasStarted) {
        console.log("Download already started, clearing interval.");
        clearInterval(checkInterval);
        return;
      }

      // Attempt to get total pages if not yet determined
      if (totalPages === -1) {
        const totalPagesElement = document.querySelector('div.page-number:last-child');
        if (totalPagesElement) {
          totalPages = parseInt(totalPagesElement.textContent, 10);
          console.log(`Determined total pages: ${totalPages}`);
        } else {
          console.log("Total pages element not found yet.");
        }
      }

      const loadedImages = document.querySelectorAll('img.img.ls.limit-width.limit-height');
      console.log(`Checking images: Loaded=${loadedImages.length}, Total=${totalPages}, StableCount=${stableCount}`);

      // Condition 1: Page count is known and all images are loaded
      if (totalPages > 0 && loadedImages.length >= totalPages) {
        console.log(`SUCCESS: All ${loadedImages.length}/${totalPages} images loaded. Starting download.`);
        hasStarted = true;
        clearInterval(checkInterval);
        clearTimeout(safetyTimeout);
        startDownloadProcess(settings);
        return;
      }

      // Condition 2: Image count has stabilized
      if (loadedImages.length > lastImageCount) {
        console.log(`Image count increased from ${lastImageCount} to ${loadedImages.length}. Resetting stability counter.`);
        lastImageCount = loadedImages.length;
        stableCount = 0;
      } else if (loadedImages.length > 0) {
        stableCount++;
        console.log(`Image count stable at ${lastImageCount}. Stability check ${stableCount}/${settings.stabilityChecks}`);
      }

      if (stableCount >= settings.stabilityChecks) {
        console.log(`SUCCESS: Image count stabilized at ${lastImageCount} for ${settings.stabilityChecks} checks. Starting download.`);
        hasStarted = true;
        clearInterval(checkInterval);
        clearTimeout(safetyTimeout);
        startDownloadProcess(settings);
      }
    }, 250);

    const safetyTimeout = setTimeout(() => {
      console.log("Safety timeout reached.");
      if (hasStarted) {
        console.log("Download already started, doing nothing.");
        return;
      }
      
      hasStarted = true;
      clearInterval(checkInterval);
      const loadedImages = document.querySelectorAll('img.img.ls.limit-width.limit-height');
      
      if (loadedImages.length > 0) {
          console.warn(`TIMEOUT: Found ${loadedImages.length} images. Attempting download anyway.`);
          startDownloadProcess(settings);
      } else {
          console.error("TIMEOUT: No images found. Aborting this chapter.");
          chrome.runtime.sendMessage({ action: 'chapterProcessingComplete' });
      }
    }, settings.overallTimeoutSeconds * 1000); // Use the configured timeout
  });
}

init();