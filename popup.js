document.addEventListener('DOMContentLoaded', () => {
  const downloadChapterBtn = document.getElementById('downloadChapterBtn');
  const mangaView = document.getElementById('mangaView');
  const languageSelect = document.getElementById('languageSelect');
  const chapterListDiv = document.getElementById('chapterList');
  const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
  const statusDiv = document.getElementById('status');

  let currentTab;

  // 1. Determine which page we are on
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    currentTab = tabs[0];
    if (currentTab.url.includes('mangadex.org/chapter/')) {
      downloadChapterBtn.style.display = 'block';
      statusDiv.textContent = 'Ready to download this chapter.';
    } else if (currentTab.url.includes('mangadex.org/title/')) {
      mangaView.style.display = 'block';
      statusDiv.textContent = 'Select a language to load chapters.';
      // Automatically request chapters for the default language
      requestChaptersFromPage(languageSelect.value);
    } else {
      statusDiv.textContent = 'Not a valid MangaDex page.';
    }
  });

  // 2. Event Listeners
  downloadChapterBtn.addEventListener('click', () => {
    statusDiv.textContent = 'Starting chapter download...';
    chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      files: ['content.js']
    });
  });

  languageSelect.addEventListener('change', () => {
    requestChaptersFromPage(languageSelect.value);
  });

  downloadSelectedBtn.addEventListener('click', () => {
    const selectedChapters = [];
    chapterListDiv.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
      selectedChapters.push(checkbox.dataset.url);
    });

    if (selectedChapters.length > 0) {
      statusDiv.textContent = `Starting download for ${selectedChapters.length} chapters...`;
      chrome.runtime.sendMessage({
        action: 'downloadAllChapters',
        chapterUrls: selectedChapters
      });
      downloadSelectedBtn.disabled = true;
    }
  });

  // 3. Functions
  function requestChaptersFromPage(lang) {
    statusDiv.textContent = 'Loading chapters...';
    chapterListDiv.innerHTML = ''; // Clear previous list
    downloadSelectedBtn.disabled = true;
    
    chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      files: ['info_scraper.js'],
    }, () => {
      // After injecting, send a message to ask for chapters
      chrome.tabs.sendMessage(currentTab.id, {
        action: 'getChapters',
        language: lang
      });
    });
  }

  function populateChapterList(chapters) {
    if (chapters.length === 0) {
      statusDiv.textContent = 'No chapters found for this language.';
      return;
    }

    chapters.forEach(chapter => {
      const item = document.createElement('div');
      item.className = 'chapter-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `chapter-${chapter.url}`;
      checkbox.dataset.url = chapter.url;

      const label = document.createElement('label');
      label.setAttribute('for', `chapter-${chapter.url}`);
      label.textContent = chapter.title;

      item.appendChild(checkbox);
      item.appendChild(label);
      chapterListDiv.appendChild(item);
    });
    
    chapterListDiv.addEventListener('change', () => {
        const anyChecked = chapterListDiv.querySelector('input:checked') !== null;
        downloadSelectedBtn.disabled = !anyChecked;
    });

    statusDiv.textContent = `Found ${chapters.length} chapters.`;
  }

  // 4. Listen for messages from the content script
  const messageListener = (request, sender) => {
    // Ensure the message is from our active tab
    if (sender.tab && sender.tab.id === currentTab.id) {
      if (request.action === 'chapterList') {
        populateChapterList(request.chapters);
        // Important: Remove the listener after we get the list to prevent stacking.
        chrome.runtime.onMessage.removeListener(messageListener);
      }
    }
  };
  
  // We add the listener when we request, and remove it once we receive the data.
  // This is managed within the requestChaptersFromPage function now.
  function requestChaptersFromPage(lang) {
    statusDiv.textContent = 'Loading chapters...';
    chapterListDiv.innerHTML = ''; // Clear previous list
    downloadSelectedBtn.disabled = true;

    // Remove any lingering listeners before adding a new one.
    if (chrome.runtime.onMessage.hasListener(messageListener)) {
      chrome.runtime.onMessage.removeListener(messageListener);
    }
    chrome.runtime.onMessage.addListener(messageListener);
    
    chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      files: ['info_scraper.js'],
    }, () => {
      // After injecting, send a message to ask for chapters
      chrome.tabs.sendMessage(currentTab.id, {
        action: 'getChapters',
        language: lang
      });
    });
  }
});