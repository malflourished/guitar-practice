/**
 * The main-process half of Notes: the page asks, this captures the window and
 * writes the files. The page's half is `window.vibratoNotes` (preload.cjs).
 */
const { saveSheet, listSheets, removeNote } = require('./notesFiles.cjs');

/** Screenshots wider than this are scaled down: enough to read small labels, light to open. */
const MAX_SHOT_WIDTH = 2400;
const JPEG_QUALITY = 88;

async function captureWindow(contents, nativeImage, viewportWidth) {
  try {
    let image = await contents.capturePage();
    if (image.isEmpty()) return null;
    let jpeg = image.toJPEG(JPEG_QUALITY);
    let width = nativeImage.createFromBuffer(jpeg).getSize().width;
    if (width > MAX_SHOT_WIDTH) {
      // Sizes here are in the capture's own units, so scale by the ratio.
      const size = image.getSize();
      const ratio = MAX_SHOT_WIDTH / width;
      image = image.resize({
        width: Math.round(size.width * ratio),
        height: Math.round(size.height * ratio),
        quality: 'best',
      });
      jpeg = image.toJPEG(JPEG_QUALITY);
      width = nativeImage.createFromBuffer(jpeg).getSize().width;
    }
    const scale = viewportWidth > 0 ? Math.round((width / viewportWidth) * 1000) / 1000 : 1;
    return { jpeg, scale };
  } catch {
    return null;
  }
}

/** `getDir` is called on every request, so the folder can be made late. */
function registerNotesIpc({ ipcMain, nativeImage, shell }, getDir) {
  const fromPage = (event) => event.senderFrame === event.sender.mainFrame;

  ipcMain.handle('notes:save', async (event, sheet) => {
    if (!fromPage(event)) throw new Error('Not allowed');
    const viewportWidth = Number(sheet?.context?.viewport?.width) || 0;
    const shot = await captureWindow(event.sender, nativeImage, viewportWidth);
    const dir = getDir();
    const saved = saveSheet(dir, sheet, shot?.jpeg ?? null, shot?.scale);
    return { sheet: saved, sheets: listSheets(dir) };
  });

  ipcMain.handle('notes:list', (event) => (fromPage(event) ? listSheets(getDir()) : []));

  ipcMain.handle('notes:remove', (event, id, n) => {
    if (!fromPage(event)) throw new Error('Not allowed');
    const dir = getDir();
    removeNote(dir, id, Number(n));
    return listSheets(dir);
  });

  ipcMain.handle('notes:reveal', async (event) => {
    if (!fromPage(event)) return;
    const dir = getDir();
    require('node:fs').mkdirSync(dir, { recursive: true });
    await shell.openPath(dir);
  });

  ipcMain.handle('notes:where', (event) => (fromPage(event) ? getDir() : ''));
}

module.exports = { registerNotesIpc };
