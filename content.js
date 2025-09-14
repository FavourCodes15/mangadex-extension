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

function waitForAllImages() {
  let stableCount = 0;
  let lastImageCount = 0;
  let totalPages = 0;

  const checkInterval = setInterval(() => {
    // Try to get total pages every time, as it might load late.
    if (totalPages === 0) {
      const totalPagesElement = document.querySelector('div.page-number:last-child');
      if (totalPagesElement) {
        totalPages = parseInt(totalPagesElement.textContent, 10);
        console.log(`Determined total pages: ${totalPages}`);
      }
    }

    const loadedImages = document.querySelectorAll('img.img.ls.limit-width.limit-height');
    
    // --- Condition 1: We have a total page count and the loaded images match ---
    if (totalPages > 0 && loadedImages.length >= totalPages) {
      console.log(`Success: Loaded image count (${loadedImages.length}) matches total pages (${totalPages}).`);
      clearInterval(checkInterval);
      startDownloadProcess();
      return;
    }

    // --- Condition 2 (Fallback): The number of images has stabilized ---
    if (loadedImages.length > lastImageCount) {
      lastImageCount = loadedImages.length;
      stableCount = 0; // Reset stability counter
      console.log(`Image count increased to ${lastImageCount}.`);
    } else if (loadedImages.length > 0) {
      stableCount++;
      console.log(`Image count stable at ${lastImageCount}. Stability: ${stableCount}/8`);
    }

    // If stable for 20 checks (5 seconds), assume it's done.
    if (stableCount >= 20) {
      console.log(`Success: Image count has stabilized at ${lastImageCount}. Assuming all loaded.`);
      clearInterval(checkInterval);
      startDownloadProcess();
    }

  }, 250); // Check every 250ms

  // Final safety net to prevent infinite loops.
  setTimeout(() => {
    const loadedImages = document.querySelectorAll('img.img.ls.limit-width.limit-height');
    if (loadedImages.length > 0) {
        console.warn("Timeout reached, but images were found. Attempting download anyway.");
        startDownloadProcess();
    } else {
        console.error("Timeout reached and no images found. Aborting this chapter.");
        chrome.runtime.sendMessage({ action: 'chapterProcessingComplete' });
    }
    clearInterval(checkInterval);
  }, 30000); // 30-second hard limit
}

waitForAllImages();