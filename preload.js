'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const listeners = new Set();
ipcRenderer.on('chat:event', (_e, msg) => listeners.forEach(fn => { try { fn(msg); } catch {} }));
const ttsListeners = new Set();
ipcRenderer.on('tts:state', (_e, on) => ttsListeners.forEach(fn => { try { fn(on); } catch {} }));

contextBridge.exposeInMainWorld('assistant', {
  isDesktop: true,
  chatStart: payload => ipcRenderer.invoke('chat:start', payload),
  chatAbort: id => ipcRenderer.invoke('chat:abort', id),
  onChat: fn => { listeners.add(fn); return () => listeners.delete(fn); },
  ttsInfo: () => ipcRenderer.invoke('tts:info'),
  ttsSpeak: text => ipcRenderer.invoke('tts:speak', String(text || '')),
  ttsStop: () => ipcRenderer.invoke('tts:stop'),
  onTts: fn => { ttsListeners.add(fn); return () => ttsListeners.delete(fn); },
});
