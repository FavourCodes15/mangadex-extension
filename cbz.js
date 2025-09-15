// This file will contain the logic for creating CBZ files.
// It will use the JSZip library.

async function createCbz(imageUrls, mangaTitle, chapter) {
    const zip = new JSZip();
    const chapterFolder = zip.folder(chapter.name);

    const imagePromises = imageUrls.map(async (url, index) => {
        const response = await fetch(url);
        const blob = await response.blob();
        const filename = `${String(index + 1).padStart(3, '0')}.${blob.type.split('/')[1]}`;
        chapterFolder.file(filename, blob);
    });

    await Promise.all(imagePromises);

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const cbzFilename = `${mangaTitle} - ${chapter.name}.cbz`;

    const reader = new FileReader();
    reader.onload = function() {
        chrome.downloads.download({
            url: reader.result,
            filename: cbzFilename,
            saveAs: true
        });
    };
    reader.readAsDataURL(zipBlob);
}