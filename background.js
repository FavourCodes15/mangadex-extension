// --- Global State ---
let settings = {};
let chapterQueue = [];
let activeChapterWorkers = 0;

// --- Utility Functions ---
const DEFAULTS = {
  concurrentChapters: 3,
  concurrentImages: 5,
  retryCount: 3,
  retryDelay: 1000
};

async function getSettings() {
  return new Promise(resolve => {
    chrome.storage.sync.get(DEFAULTS, settings => resolve(settings));
  });
}

async function loadSettings() {
  settings = await getSettings();
  console.log('Settings loaded:', settings);
}

// --- Main Logic ---
// Load settings on startup
loadSettings();

// Listen for settings changes
chrome.storage.onChanged.addListener(loadSettings);

// Listen for messages from the popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadAllChapters') {
    // Add new chapters to the front of the queue
    chapterQueue.unshift(...request.chapterUrls);
    console.log(`Added ${request.chapterUrls.length} chapters to the queue. Total: ${chapterQueue.length}`);
    processChapterQueue();
  } else if (request.action === 'queueImageDownload') {
    // This action will be called from the content script for each image
    downloadImageWithRetry(request.url, request.filename, settings.retryCount);
  }
  return true; // Indicate async response
});

function processChapterQueue() {
  console.log(`Processing queue. Workers: ${activeChapterWorkers}/${settings.concurrentChapters}. Queue size: ${chapterQueue.length}`);
  while (activeChapterWorkers < settings.concurrentChapters && chapterQueue.length > 0) {
    activeChapterWorkers++;
    const chapterUrl = chapterQueue.pop();
    console.log(`Starting worker for: ${chapterUrl}`);
    processChapter(chapterUrl);
  }

  if (chapterQueue.length === 0 && activeChapterWorkers === 0) {
    console.log('All chapters processed.');
  }
}

async function processChapter(chapterUrl) {
  try {
    const tab = await new Promise(resolve => chrome.tabs.create({ url: chapterUrl, active: false }, resolve));
    
    // Listen for tab completion
    const tabUpdateListener = (tabId, info) => {
      if (tabId === tab.id && info.status === 'complete') {
        console.log(`Tab ${tab.id} loaded. Injecting content script.`);
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        });
        chrome.tabs.onUpdated.removeListener(tabUpdateListener);
      }
    };
    chrome.tabs.onUpdated.addListener(tabUpdateListener);

    // Add a listener for when the content script is done
    const messageListener = (request, sender) => {
      if (sender.tab && sender.tab.id === tab.id && request.action === 'chapterProcessingComplete') {
        console.log(`Chapter processing complete for tab ${tab.id}. Closing.`);
        chrome.tabs.remove(tab.id);
        chrome.runtime.onMessage.removeListener(messageListener);
        
        // Worker is now free
        activeChapterWorkers--;
        // Check if more chapters are in the queue
        processChapterQueue();
      }
    };
    chrome.runtime.onMessage.addListener(messageListener);

  } catch (error) {
    console.error(`Error processing chapter ${chapterUrl}:`, error);
    activeChapterWorkers--;
    processChapterQueue();
  }
}

async function downloadImageWithRetry(url, filename, retries) {
  try {
    await new Promise((resolve, reject) => {
      chrome.downloads.download({ url, filename, conflictAction: 'overwrite' }, (downloadId) => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        // Monitor download status
        const downloadListener = (delta) => {
          if (delta.id === downloadId && delta.state) {
            if (delta.state.current === 'complete') {
              chrome.downloads.onChanged.removeListener(downloadListener);
              resolve();
            } else if (delta.state.current === 'interrupted') {
              chrome.downloads.onChanged.removeListener(downloadListener);
              reject(new Error(`Download interrupted. Reason: ${delta.error.current}`));
            }
          }
        };
        chrome.downloads.onChanged.addListener(downloadListener);
      });
    });
    console.log(`Successfully downloaded ${filename}`);
  } catch (error) {
    console.error(`Download failed for ${filename}:`, error.message);
    if (retries > 0) {
      console.log(`Retrying... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, settings.retryDelay));
      await downloadImageWithRetry(url, filename, retries - 1);
    } else {
      console.error(`All retries failed for ${filename}.`);
    }
  }
}