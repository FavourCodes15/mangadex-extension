document.addEventListener('DOMContentLoaded', () => {
  // Main View Elements
  const downloadChapterBtn = document.getElementById('downloadChapterBtn');
  const mangaView = document.getElementById('mangaView');
  const languageSelect = document.getElementById('languageSelect');
  const chapterListDiv = document.getElementById('chapterList');
  const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
  const statusDiv = document.getElementById('status');

  // Settings View Elements
  const concurrentChaptersInput = document.getElementById('concurrentChapters');
  const concurrentImagesInput = document.getElementById('concurrentImages');
  const retryCountInput = document.getElementById('retryCount');
  const retryDelayInput = document.getElementById('retryDelay');
  const stabilityChecksInput = document.getElementById('stabilityChecks');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const settingsStatusDiv = document.getElementById('settingsStatus');

  // Tab Elements
  const tabLinks = document.querySelectorAll('.tab-link');
  const tabContents = document.querySelectorAll('.tab-content');

  let currentTab;

  // --- Initialization ---
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    currentTab = tabs[0];
    if (currentTab.url.includes('mangadex.org/chapter/')) {
      downloadChapterBtn.style.display = 'block';
    } else if (currentTab.url.includes('mangadex.org/title/')) {
      mangaView.style.display = 'block';
      requestChaptersFromPage(languageSelect.value);
    } else {
      statusDiv.textContent = 'Not a valid MangaDex page.';
    }
  });

  loadAndDisplaySettings();

  // --- Event Listeners ---
  // Tab switching
  tabLinks.forEach(link => {
    link.addEventListener('click', () => {
      const tabId = link.dataset.tab;

      tabLinks.forEach(l => l.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      link.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    });
  });

  // Main View Listeners
  downloadChapterBtn.addEventListener('click', () => {
    statusDiv.textContent = 'Starting chapter download...';
    chrome.scripting.executeScript({ target: { tabId: currentTab.id }, files: ['content.js'] });
  });

  languageSelect.addEventListener('change', () => {
    requestChaptersFromPage(languageSelect.value);
  });

  downloadSelectedBtn.addEventListener('click', () => {
    const selectedChapters = Array.from(chapterListDiv.querySelectorAll('input:checked'))
                                  .map(cb => cb.dataset.url);
    if (selectedChapters.length > 0) {
      statusDiv.textContent = `Queuing ${selectedChapters.length} chapters...`;
      chrome.runtime.sendMessage({ action: 'downloadAllChapters', chapterUrls: selectedChapters });
      downloadSelectedBtn.disabled = true;
    }
  });

  // Settings View Listeners
  saveSettingsBtn.addEventListener('click', async () => {
    const newSettings = {
      concurrentChapters: parseInt(concurrentChaptersInput.value, 10),
      concurrentImages: parseInt(concurrentImagesInput.value, 10),
      retryCount: parseInt(retryCountInput.value, 10),
      retryDelay: parseInt(retryDelayInput.value, 10),
      stabilityChecks: parseInt(stabilityChecksInput.value, 10)
    };
    await saveSettings(newSettings);
    settingsStatusDiv.textContent = 'Settings saved!';
    setTimeout(() => { settingsStatusDiv.textContent = ''; }, 2000);
  });

  // --- Functions ---
  async function loadAndDisplaySettings() {
    const settings = await getSettings();
    concurrentChaptersInput.value = settings.concurrentChapters;
    concurrentImagesInput.value = settings.concurrentImages;
    retryCountInput.value = settings.retryCount;
    retryDelayInput.value = settings.retryDelay;
    stabilityChecksInput.value = settings.stabilityChecks;
  }
  
  const messageListener = (request, sender) => {
    if (sender.tab && sender.tab.id === currentTab.id && request.action === 'chapterList') {
      populateChapterList(request.chapters);
      chrome.runtime.onMessage.removeListener(messageListener);
    }
  };
  
  function requestChaptersFromPage(lang) {
    statusDiv.textContent = 'Loading chapters...';
    chapterListDiv.innerHTML = '';
    downloadSelectedBtn.disabled = true;

    if (chrome.runtime.onMessage.hasListener(messageListener)) {
      chrome.runtime.onMessage.removeListener(messageListener);
    }
    chrome.runtime.onMessage.addListener(messageListener);
    
    chrome.scripting.executeScript({
      target: { tabId: currentTab.id },
      files: ['info_scraper.js'],
    }, () => {
      chrome.tabs.sendMessage(currentTab.id, { action: 'getChapters', language: lang });
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
});