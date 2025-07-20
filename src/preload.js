const { contextBridge, ipcRenderer } = require("electron")

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  // File operations
  getSampleModels: () => ipcRenderer.invoke("get-sample-models"),
  getModelPath: (filename) => ipcRenderer.invoke("get-model-path", filename),
  loadModelBuffer: (filePath) => ipcRenderer.invoke("load-model-buffer", filePath),
  getFileStats: (filePath) => ipcRenderer.invoke("get-file-stats", filePath),

  // Enhanced loading for large files
  prepareModelData: (filePath) => ipcRenderer.invoke("prepare-model-data", filePath),
  streamLargeModel: (filePath) => ipcRenderer.invoke("stream-large-model", filePath),

  // STL conversion support
  convertStlToGlb: (stlPath) => ipcRenderer.invoke("convert-stl-to-glb", stlPath),

  // Dialog operations
  showError: (title, message) => ipcRenderer.invoke("show-error", title, message),
  showInfo: (title, message) => ipcRenderer.invoke("show-info", title, message),

  // Add this line in the electronAPI object after the existing methods:
  openFileDialog: () => ipcRenderer.invoke("open-file-dialog"),

  // Add this to the electronAPI object after the existing methods:
  onStlConversionProgress: (callback) => ipcRenderer.on("stl-conversion-progress", callback),

  // Listen for menu actions
  onLoadModelFile: (callback) => ipcRenderer.on("load-model-file", callback),
  onLoadSampleModels: (callback) => ipcRenderer.on("load-sample-models", callback),
  onResetView: (callback) => ipcRenderer.on("reset-view", callback),
  onToggleAutoRotate: (callback) => ipcRenderer.on("toggle-auto-rotate", callback),
  onZoomIn: (callback) => ipcRenderer.on("zoom-in", callback),
  onZoomOut: (callback) => ipcRenderer.on("zoom-out", callback),

  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
})
