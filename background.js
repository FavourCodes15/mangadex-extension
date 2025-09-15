importScripts('lib/jszip.min.js', 'zip.js', 'cbz.js');

// --- Global State ---
let settings = {};
let chapterQueue = [];
let activeChapterWorkers = 0;

// --- Utility Functions ---
const DEFAULTS = {
  downloadAs: 'images',
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
    chapterQueue.unshift(...request.chapters);
    console.log(`Added ${request.chapters.length} chapters to the queue. Total: ${chapterQueue.length}`);
    processChapterQueue();
  } else if (request.action === 'queueImageDownload') {
    if (settings.downloadAs === 'images') {
        // This action will be called from the content script for each image
        downloadImageWithRetry(request.url, request.filename, settings.retryCount);
    }
  }
  return true; // Indicate async response
});

function processChapterQueue() {
  console.log(`Processing queue. Workers: ${activeChapterWorkers}/${settings.concurrentChapters}. Queue size: ${chapterQueue.length}`);
  while (activeChapterWorkers < settings.concurrentChapters && chapterQueue.length > 0) {
    activeChapterWorkers++;
    const chapter = chapterQueue.pop();
    console.log(`Starting worker for: ${chapter.url}`);
    processChapter(chapter);
  }

  if (chapterQueue.length === 0 && activeChapterWorkers === 0) {
    console.log('All chapters processed.');
  }
}

async function processChapter(chapter) {
    try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // If the active tab is the one we want to process, use it directly.
        // Otherwise, open a new background tab.
        const shouldUseActiveTab = activeTab && activeTab.url.includes(chapter.url);

        const tabToUse = shouldUseActiveTab
            ? activeTab
            : await new Promise(resolve => chrome.tabs.create({ url: chapter.url, active: false }, resolve));

        const processAndCleanup = (tabId) => {
            const messageListener = (request, sender) => {
                if (sender.tab && sender.tab.id === tabId && request.action === 'chapterProcessingComplete') {
                    console.log(`Chapter processing complete for tab ${tabId}.`);
                    if (settings.downloadAs === 'zip') {
                        createZip(request.imageUrls, chapter.mangaTitle, chapter);
                    } else if (settings.downloadAs === 'cbz') {
                        createCbz(request.imageUrls, chapter.mangaTitle, chapter);
                    }

                    // Only close the tab if we created a new one
                    if (!shouldUseActiveTab) {
                        chrome.tabs.remove(tabId);
                    }
                    chrome.runtime.onMessage.removeListener(messageListener);

                    activeChapterWorkers--;
                    processChapterQueue();
                }
            };
            chrome.runtime.onMessage.addListener(messageListener);

            chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js'],
            });
        };

        if (shouldUseActiveTab) {
            console.log(`Using active tab ${tabToUse.id} for processing.`);
            processAndCleanup(tabToUse.id);
        } else {
            // Listen for the new tab to finish loading before injecting script
            const tabUpdateListener = (tabId, info) => {
                if (tabId === tabToUse.id && info.status === 'complete') {
                    console.log(`Tab ${tabId} loaded. Injecting content script.`);
                    processAndCleanup(tabId);
                    chrome.tabs.onUpdated.removeListener(tabUpdateListener);
                }
            };
            chrome.tabs.onUpdated.addListener(tabUpdateListener);
        }

    } catch (error) {
        console.error(`Error processing chapter ${chapter.url}:`, error);
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