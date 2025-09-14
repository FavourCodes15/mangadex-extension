// This script is injected into the MangaDex chapter page.

// Find all image elements for the chapter pages.
// Use the correct selector provided by the user.
function startDownloadProcess() {
  const images = document.querySelectorAll('img.img.ls.limit-width.limit-height');

  if (images.length === 0) {
    console.log('No chapter images found yet, still waiting...');
    return; // Images not loaded yet
  }

  // Disconnect the observer once we have the images to prevent re-triggering
  if (observer) {
    observer.disconnect();
  }

  console.log(`Found ${images.length} images to download.`);
  
  const mangaTitleElement = document.querySelector('a.reader--header-manga');
  const chapterTitleElement = document.querySelector('div.reader--header-title');

  const mangaTitle = mangaTitleElement ? mangaTitleElement.textContent.trim().replace(/[<>:"/\\|?*]+/g, '') : 'Manga';
  const chapterTitle = chapterTitleElement ? chapterTitleElement.textContent.trim().replace(/[<>:"/\\|?*]+/g, '') : 'Chapter';

  const folderName = `${mangaTitle}/${chapterTitle}`;

  const downloadImage = async (img, index) => {
    const blobUrl = img.src;
    if (blobUrl.startsWith('blob:')) {
      try {
        const response = await fetch(blobUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        
        const filename = `${folderName}/${(index + 1).toString().padStart(3, '0')}.png`;

        chrome.runtime.sendMessage({
          action: 'download',
          url: url,
          filename: filename
        }, (response) => {
          if (response && response.status === 'success') {
            console.log(`Successfully initiated download for image ${index + 1}`);
          } else {
            console.error(`Failed to initiate download for image ${index + 1}:`, response ? response.error : 'No response');
          }
          window.URL.revokeObjectURL(url);
        });
      } catch (error) {
        console.error(`Failed to fetch blob for image ${index + 1}:`, error);
      }
    }
  };

  const downloadAll = async () => {
    for (let i = 0; i < images.length; i++) {
      await downloadImage(images[i], i);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    console.log(`Finished queuing ${images.length} images for download from this chapter.`);
    // Send a message to the background script that this tab is done.
    chrome.runtime.sendMessage({ action: 'downloadComplete' });
  };

  downloadAll();
}

// Use a MutationObserver to wait for all images to settle.
let observer;
let imageLoadTimeout;

function debounceStartDownload() {
    // Clear any existing timeout to reset the timer.
    clearTimeout(imageLoadTimeout);
    // Set a new timeout. If no new images are detected within this period, start the download.
    imageLoadTimeout = setTimeout(() => {
        console.log('Image loading appears to have settled. Starting download process.');
        if (observer) {
            observer.disconnect(); // Stop observing to prevent multiple triggers.
        }
        startDownloadProcess();
    }, 20000); // Wait 2 seconds after the last image was detected.
}

observer = new MutationObserver((mutationsList, obs) => {
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            // Check if any of the added nodes are our target images or contain them.
            let imageFound = false;
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1 && (node.matches('img.img.ls.limit-width.limit-height') || node.querySelector('img.img.ls.limit-width.limit-height'))) {
                    imageFound = true;
                }
            });

            if (imageFound) {
                console.log('Image detected, resetting debounce timer...');
                debounceStartDownload();
            }
        }
    }
});

// Start observing the document body for child node changes.
observer.observe(document.body, { childList: true, subtree: true });

// Initial check in case images are already loaded from cache.
debounceStartDownload();