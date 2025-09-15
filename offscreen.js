chrome.runtime.onMessage.addListener(async (request) => {
  if (request.action === 'createPdfOffscreen') {
    const { imageUrls, mangaTitle, chapter } = request;
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();

    for (let i = 0; i < imageUrls.length; i++) {
      const url = imageUrls[i];
      const response = await fetch(url);
      const blob = await response.blob();
      const reader = new FileReader();
      await new Promise(resolve => {
        reader.onload = function () {
          const img = new Image();
          img.src = reader.result;
          img.onload = function () {
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const ratio = Math.min(pageWidth / img.width, pageHeight / img.height);
            const imgWidth = img.width * ratio;
            const imgHeight = img.height * ratio;
            const x = (pageWidth - imgWidth) / 2;
            const y = (pageHeight - imgHeight) / 2;
            if (i > 0) {
              pdf.addPage();
            }
            pdf.addImage(img, 'PNG', x, y, imgWidth, imgHeight);
            resolve();
          }
        };
        reader.readAsDataURL(blob);
      });
    }

    const pdfBlob = pdf.output('blob');
    const pdfFilename = `${mangaTitle} - ${chapter.name}.pdf`;

    const reader = new FileReader();
    reader.onload = function () {
      // Send the data URL back to the service worker to handle the download
      chrome.runtime.sendMessage({
        action: 'downloadPdf',
        url: reader.result,
        filename: pdfFilename
      });
    };
    reader.readAsDataURL(pdfBlob);
  }
});