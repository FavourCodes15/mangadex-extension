let downloadQueue = [];
let isDownloading = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'download') {
    const { url, filename } = request;
    chrome.downloads.download({
      url: url,
      filename: filename,
      conflictAction: 'overwrite'
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error(`Download failed for ${filename}:`, chrome.runtime.lastError.message);
        sendResponse({ status: 'failed', error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ status: 'success', downloadId: downloadId });
      }
    });
    return true;
  } else if (request.action === 'downloadAllChapters') {
    downloadQueue = request.chapterUrls.reverse(); // Reverse to download from Ch 1 upwards
    processQueue();
    sendResponse({ status: 'started' });
  } else if (request.action === 'downloadComplete') {
    // This message is sent from content.js when it's done.
    console.log(`Download complete for tab ${sender.tab.id}. Closing tab.`);
    chrome.tabs.remove(sender.tab.id);
    isDownloading = false;
    // Process the next chapter in the queue.
    setTimeout(processQueue, 1000); // Small delay before starting next chapter.
  }
});

async function processQueue() {
  if (isDownloading || downloadQueue.length === 0) {
    if (downloadQueue.length === 0 && !isDownloading) {
      console.log('All chapters have been processed.');
    }
    return;
  }

  isDownloading = true;
  const chapterUrl = downloadQueue.pop();

  // Open the chapter in a new, inactive tab
  chrome.tabs.create({ url: chapterUrl, active: false }, async (tab) => {
    // Wait for the tab to finish loading
    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId === tab.id && info.status === 'complete') {
        // Remove the listener to avoid it firing multiple times
        chrome.tabs.onUpdated.removeListener(listener);

        console.log(`Tab ${tab.id} loaded. Injecting content script.`);
        // Inject the content script to scrape and download images
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        });
      }
    });
  });
}