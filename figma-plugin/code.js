/**
 * Portfolio Importer – plugin main thread
 *
 * Receives image data from ui.html, creates one Figma frame per page/viewport
 * with an IMAGE fill, then zooms the viewport to show all imported frames.
 */

figma.showUI(__html__, { width: 420, height: 520, title: 'Portfolio Importer' });

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'cancel') {
    figma.closePlugin();
    return;
  }

  if (msg.type === 'import') {
    const { pages } = msg;
    const GAP = 80; // horizontal gap between frames
    let cursorX = 0;

    for (const page of pages) {
      for (const file of page.files) {
        const frame = figma.createFrame();
        frame.name = `${page.name} — ${file.viewport}`;
        frame.resize(file.width, file.height);
        frame.x = cursorX;
        frame.y = 0;
        frame.clipsContent = true;

        // Upload the raw PNG bytes and set as an image fill.
        const image = figma.createImage(new Uint8Array(file.imageData));
        frame.fills = [
          {
            type: 'IMAGE',
            scaleMode: 'FILL',
            imageHash: image.hash,
          },
        ];

        figma.currentPage.appendChild(frame);
        cursorX += file.width + GAP;
      }

      // Extra gap between pages.
      cursorX += GAP;
    }

    // Zoom to show all newly created frames.
    figma.viewport.scrollAndZoomIntoView(figma.currentPage.children);
    figma.closePlugin('Portfolio imported — all pages added as frames.');
  }
};
