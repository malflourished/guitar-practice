/**
 * The only bridge between the page and the Mac app: saving the owner's notes
 * (src/notes) as files. The page gets these five calls and nothing else.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vibratoNotes', {
  save: (sheet) => ipcRenderer.invoke('notes:save', sheet),
  list: () => ipcRenderer.invoke('notes:list'),
  remove: (id, n) => ipcRenderer.invoke('notes:remove', id, n),
  reveal: () => ipcRenderer.invoke('notes:reveal'),
  where: () => ipcRenderer.invoke('notes:where'),
});
