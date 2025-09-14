# MangaDex Downloader Extension

A powerful and customizable browser extension to download manga chapters from MangaDex.

## Features

-   **Download Current Chapter:** Quickly download all images from the chapter you are currently viewing.
-   **Selective Chapter Download:** On a manga's main information page, view a list of all available chapters, filter them by language, and select specific chapters to download.
-   **Configurable Concurrency:** Adjust the number of simultaneous chapter and image downloads to optimize for your internet speed and system resources.
-   **Robust Retry Mechanism:** Automatically retries failed image downloads, ensuring a more complete and reliable download experience.
-   **Intelligent Page Detection:** Smartly detects when all images on a chapter page have loaded before initiating the download, preventing incomplete downloads.
-   **Organized Folder Structure:** Downloads are saved into a clear folder structure: `Manga Title/Chapter Name/`.
-   **Configurable Stability Checks:** Fine-tune the image loading detection by setting how many consecutive checks the image count must remain stable before assuming all pages are loaded.
-   **Configurable Overall Timeout:** Adjust the maximum time the extension waits for a chapter to load its images, useful for very large chapters or slow connections.
-   **Modern User Interface:** A sleek, dark-themed popup interface with intuitive controls.

## Installation

1.  **Download/Clone:** Download or clone this repository to your local machine.
2.  **Open Extensions:** Open your browser's extension management page.
    -   For Chrome: Go to `chrome://extensions`
    -   For Edge: Go to `edge://extensions`
    -   For Brave: Go to `brave://extensions`
3.  **Enable Developer Mode:** Toggle on "Developer mode" in the top-right corner.
4.  **Load Unpacked:** Click the "Load unpacked" button (usually in the top-left or top-right).
5.  **Select Directory:** Navigate to and select the directory where you downloaded/cloned this extension.

The extension should now appear in your browser's toolbar.

## Usage

1.  **Navigate to MangaDex:** Go to `https://mangadex.org/` in your browser.
2.  **Open the Extension:** Click on the MangaDex Downloader icon in your browser's toolbar.

### On a Chapter Page

-   If you are on a specific chapter page (e.g., `mangadex.org/chapter/...`), the popup will display a "Download Current Chapter" button.
-   Click this button to download all images for that chapter. They will be saved into a folder named after the manga and chapter.

### On a Manga Information Page

-   If you are on a manga's main information page (e.g., `mangadex.org/title/...`), the popup will display:
    -   A **language selection dropdown**. Choose your preferred language.
    -   A **list of chapters** available in the selected language, with checkboxes.
    -   A "Download Selected" button.
-   **Select Chapters:** Check the boxes next to the chapters you wish to download.
-   **Start Download:** Click "Download Selected". The chapters will be downloaded sequentially in the background.

## Settings

Access the "Settings" tab in the extension popup to customize the following:

-   **Concurrent Chapters:** The number of chapters that will be processed simultaneously.
-   **Concurrent Images:** The number of images that will be downloaded simultaneously within a chapter.
-   **Retry Count:** How many times the extension will attempt to re-download a failed image.
-   **Retry Delay (ms):** The delay (in milliseconds) before retrying a failed image download.
-   **Stability Checks:** The number of consecutive checks the image count must remain stable before assuming all images are loaded (each check is 250ms). Increase this for slower connections or pages with lazy-loading issues.
-   **Overall Timeout (s):** The maximum time (in seconds) the extension will wait for a chapter's images to load before forcing a download of what's available or aborting if no images are found.

Remember to click "Save Settings" after making changes.

## Troubleshooting

-   **"No images found" or incomplete downloads:**
    -   Increase "Stability Checks" in the settings.
    -   Increase "Overall Timeout (s)" in the settings.
-   **Downloads not starting:** Ensure you are on a valid `mangadex.org` chapter or title page.
-   **Browser blocking downloads:** Check your browser's download settings or temporary disable any download managers.

## Contributing

Feel free to open issues or pull requests on the GitHub repository if you find bugs or have suggestions for new features.