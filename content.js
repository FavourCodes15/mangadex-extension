function startDownloadProcess() {
  const images = document.querySelectorAll('img.img.ls.limit-width.limit-height');

  if (images.length === 0) {
    console.log('No chapter images found yet, still waiting...');
    // If no images found after waiting, signal completion to avoid getting stuck
    setTimeout(() => {
        if (document.querySelectorAll('img.img.ls.limit-width.limit-height').length === 0) {
            console.log('Timeout reached, no images found. Signaling completion.');
            chrome.runtime.sendMessage({ action: 'chapterProcessingComplete' });
        }
    }, 15000); // 15-second final timeout
    return;
  }

  if (observer) {
    observer.disconnect();
  }

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
          
          // Send to background script to handle the download
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
    // Signal to the background script that this chapter is fully processed.
    chrome.runtime.sendMessage({ action: 'chapterProcessingComplete' });
  };

  queueAllImages();
}

let observer;
let imageLoadTimeout;

function debounceStartDownload() {
    clearTimeout(imageLoadTimeout);
    imageLoadTimeout = setTimeout(() => {
        console.log('Image loading settled. Starting download process.');
        if (observer) observer.disconnect();
        startDownloadProcess();
    }, 20000); // Wait 2.5 seconds after the last image detection
}

observer = new MutationObserver(() => {
    debounceStartDownload();
});

observer.observe(document.body, { childList: true, subtree: true });

// Initial check
debounceStartDownload();