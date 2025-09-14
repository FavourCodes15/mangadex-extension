// This script is injected into the MangaDex title page to scrape chapter info.

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getChapters') {
    const language = request.language;
    
    // Use a more specific selector to target the chapter entry container.
    const chapterRows = document.querySelectorAll('div.chapter[data-v-fdb22da6]');
    
    let chapters = [];
    let seenUrls = new Set(); // Use a Set to prevent any possible duplicates

    chapterRows.forEach(row => {
      const langImg = row.querySelector(`img[src$="/${language}.svg"]`);
      const link = row.querySelector('a[href^="/chapter/"]');
      
      if (langImg && link && !seenUrls.has(link.href)) {
        const titleElement = row.querySelector('.chapter-link');
        const title = titleElement ? titleElement.textContent.trim() : 'Unknown Chapter';
        chapters.push({
          title: title,
          url: link.href
        });
        seenUrls.add(link.href);
      }
    });

    // Send the structured chapter list back to the popup.
    chrome.runtime.sendMessage({
      action: 'chapterList',
      chapters: chapters.reverse() // Reverse to show Chapter 1 at the top.
    });
  }
});