const { app, BrowserWindow, dialog, ipcMain, Menu } = require("electron")
const path = require("path")
const fs = require("fs")
const { spawn } = require("child_process")

let mainWindow
const isDev = process.argv.includes("--dev")

function createWindow() {
  // Increase memory limit significantly for large 3D models
  app.commandLine.appendSwitch("max-old-space-size", "8192") // 8GB
  app.commandLine.appendSwitch("max-semi-space-size", "256")
  app.commandLine.appendSwitch("js-flags", "--max-old-space-size=8192")

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, "preload.js"),
      webSecurity: false, // Allow loading local files
      experimentalFeatures: true,
      // Enhanced memory and performance settings
      v8CacheOptions: "code",
      backgroundThrottling: false,
    },
    icon: path.join(__dirname, "../assets/icon.png"),
    title: "3D Model Viewer - Enhanced",
    show: false,
    titleBarStyle: "default",
  })

  // Enhanced GPU acceleration and performance optimizations
  app.commandLine.appendSwitch("enable-gpu-rasterization")
  app.commandLine.appendSwitch("enable-zero-copy")
  app.commandLine.appendSwitch("disable-software-rasterizer")
  app.commandLine.appendSwitch("enable-webgl2-compute-context")
  app.commandLine.appendSwitch("enable-unsafe-webgpu")
  app.commandLine.appendSwitch("enable-features", "VaapiVideoDecoder")
  app.commandLine.appendSwitch("ignore-gpu-blacklist")
  app.commandLine.appendSwitch("enable-gpu-memory-buffer-video-frames")

  // Load the app
  mainWindow.loadFile("src/index.html")

  // Show window when ready
  mainWindow.once("ready-to-show", () => {
    mainWindow.show()

    if (isDev) {
      mainWindow.webContents.openDevTools()
    }
  })

  // Handle window closed
  mainWindow.on("closed", () => {
    mainWindow = null
  })

  // Create application menu
  createMenu()
}

function createMenu() {
  // Hide the default menu bar for a cleaner look
  Menu.setApplicationMenu(null)
}

// Function to ensure script is available in a writable location
function ensureScriptAvailable() {
  const isDev = process.argv.includes("--dev") || !app.isPackaged

  if (isDev) {
    // Development - use original script
    const devScriptPath = path.join(__dirname, "../scripts/stl_to_glb_converter.py")
    if (fs.existsSync(devScriptPath)) {
      return devScriptPath
    }
    throw new Error(`Development script not found: ${devScriptPath}`)
  }

  // Production - copy script to userData directory
  const userDataPath = app.getPath("userData")
  const scriptsDir = path.join(userDataPath, "scripts")
  const targetScriptPath = path.join(scriptsDir, "stl_to_glb_converter.py")

  // Create scripts directory if it doesn't exist
  if (!fs.existsSync(scriptsDir)) {
    fs.mkdirSync(scriptsDir, { recursive: true })
    console.log(`Created scripts directory: ${scriptsDir}`)
  }

  // If script already exists and is recent, use it
  if (fs.existsSync(targetScriptPath)) {
    console.log(`Using existing script: ${targetScriptPath}`)
    return targetScriptPath
  }

  // Find source script in packaged app
  const resourcesPath = process.resourcesPath
  const possibleSourcePaths = [
    // Try unpacked first
    path.join(resourcesPath, "scripts", "stl_to_glb_converter.py"),
    path.join(resourcesPath, "app", "scripts", "stl_to_glb_converter.py"),
    // Try in app.asar.unpacked
    path.join(resourcesPath, "app.asar.unpacked", "scripts", "stl_to_glb_converter.py"),
    // Try relative to main.js
    path.join(__dirname, "../scripts/stl_to_glb_converter.py"),
    path.join(__dirname, "scripts/stl_to_glb_converter.py"),
  ]

  console.log("Searching for source script in these paths:")
  let sourceScriptPath = null

  for (const testPath of possibleSourcePaths) {
    console.log(`  Checking: ${testPath}`)
    if (fs.existsSync(testPath)) {
      sourceScriptPath = testPath
      console.log(`✅ Found source script at: ${sourceScriptPath}`)
      break
    }
  }

  if (!sourceScriptPath) {
    console.error("❌ Source script not found in any location")
    possibleSourcePaths.forEach((p) => console.log(`  Tried: ${p}`))
    throw new Error("Python conversion script not found in packaged app")
  }

  // Copy script to userData directory
  try {
    const scriptContent = fs.readFileSync(sourceScriptPath, "utf8")
    fs.writeFileSync(targetScriptPath, scriptContent, "utf8")
    console.log(`✅ Copied script to: ${targetScriptPath}`)
    return targetScriptPath
  } catch (error) {
    console.error(`Failed to copy script: ${error.message}`)
    throw new Error(`Failed to copy conversion script: ${error.message}`)
  }
}

// STL to GLB conversion function with enhanced path handling for packaged app
async function convertStlToGlb(stlPath, progressCallback) {
  return new Promise((resolve, reject) => {
    // Determine if we're in development or production
    const isDev = process.argv.includes("--dev") || !app.isPackaged

    let outputDir, blenderPath, scriptPath, workingStlPath

    if (isDev) {
      // Development paths
      outputDir = path.join(__dirname, "../temp")
      workingStlPath = stlPath // Use original path in development
    } else {
      // Production paths - use app.getPath for reliable directory access
      const userDataPath = app.getPath("userData")
      outputDir = path.join(userDataPath, "temp")

      // Copy STL file to accessible location if it's inside app.asar
      if (stlPath.includes("app.asar")) {
        const stlFileName = path.basename(stlPath)
        workingStlPath = path.join(outputDir, "input_" + stlFileName)

        try {
          // Copy STL file to temp directory
          if (!fs.existsSync(workingStlPath)) {
            console.log(`Copying STL file from ${stlPath} to ${workingStlPath}`)
            fs.copyFileSync(stlPath, workingStlPath)
            console.log(`STL file copied successfully`)
          } else {
            console.log(`STL file already exists at ${workingStlPath}`)
          }
        } catch (copyError) {
          console.error(`Failed to copy STL file: ${copyError.message}`)
          reject(new Error(`Cannot copy STL file to accessible location: ${copyError.message}`))
          return
        }
      } else {
        workingStlPath = stlPath // Use original path if not in asar
      }
    }

    const outputFileName = path.basename(workingStlPath, ".stl") + "_converted.glb"
    const outputPath = path.join(outputDir, outputFileName)

    // Ensure temp directory exists with proper error handling
    try {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
        console.log(`Created temp directory: ${outputDir}`)
      }
    } catch (error) {
      console.error(`Failed to create temp directory: ${error.message}`)
      reject(new Error(`Cannot create temp directory: ${error.message}`))
      return
    }

    // Get Blender path with enhanced detection
    blenderPath = getBlenderPath()
    if (!blenderPath) {
      reject(new Error("Blender not found. Please ensure Blender is bundled with the application."))
      return
    }

    // Ensure script is available
    try {
      scriptPath = ensureScriptAvailable()
      console.log(`Using script: ${scriptPath}`)
    } catch (error) {
      console.error(`Script setup failed: ${error.message}`)
      reject(error)
      return
    }

    // Verify the working STL file exists and is accessible
    try {
      if (!fs.existsSync(workingStlPath)) {
        throw new Error(`Working STL file not found: ${workingStlPath}`)
      }
      const stats = fs.statSync(workingStlPath)
      if (stats.size === 0) {
        throw new Error(`Working STL file is empty: ${workingStlPath}`)
      }
      console.log(`Working STL file verified: ${workingStlPath} (${stats.size} bytes)`)
    } catch (verifyError) {
      console.error(`STL file verification failed: ${verifyError.message}`)
      reject(new Error(`STL file verification failed: ${verifyError.message}`))
      return
    }

    console.log(`Converting STL to GLB:`)
    console.log(`  Original STL: ${stlPath}`)
    console.log(`  Working STL: ${workingStlPath}`)
    console.log(`  Output: ${outputPath}`)
    console.log(`  Blender: ${blenderPath}`)
    console.log(`  Script: ${scriptPath}`)
    console.log(`  Temp Dir: ${outputDir}`)
    console.log(`  Is Dev: ${isDev}`)
    console.log(`  Is Packaged: ${app.isPackaged}`)

    // Report initial progress
    if (progressCallback) progressCallback(5, "Initializing Blender...")

    // Run Blender with conversion script and enhanced environment
    const blenderEnv = {
      ...process.env,
      // Disable TBB to avoid memory allocation issues
      TBB_MALLOC_DISABLE_REPLACEMENT: "1",
      // Set Blender specific environment variables
      BLENDER_USER_CONFIG: path.join(outputDir, "blender_config"),
      BLENDER_USER_SCRIPTS: path.join(outputDir, "blender_scripts"),
      // Disable problematic features
      BLENDER_SYSTEM_SCRIPTS: "",
    }

    const blenderArgs = [
      "--background",
      "--factory-startup", // Start with factory settings
      "--enable-autoexec", // Enable script execution
      "--python",
      scriptPath,
      "--",
      workingStlPath, // Use the accessible working path
      outputPath,
    ]

    console.log(`Blender command: ${blenderPath} ${blenderArgs.join(" ")}`)

    const blenderProcess = spawn(blenderPath, blenderArgs, {
      stdio: ["pipe", "pipe", "pipe"],
      env: blenderEnv,
      cwd: outputDir, // Set working directory to temp folder
    })

    let stdout = ""
    let stderr = ""
    let currentProgress = 5

    blenderProcess.stdout.on("data", (data) => {
      const output = data.toString()
      stdout += output
      console.log("Blender stdout:", output)

      // Parse progress from Blender output
      if (progressCallback) {
        if (output.includes("Importing STL file")) {
          currentProgress = 20
          progressCallback(currentProgress, "Importing STL file...")
        } else if (output.includes("Processing object")) {
          currentProgress = 40
          progressCallback(currentProgress, "Processing mesh geometry...")
        } else if (output.includes("Creating default material")) {
          currentProgress = 60
          progressCallback(currentProgress, "Creating materials...")
        } else if (output.includes("Exporting to GLB")) {
          currentProgress = 80
          progressCallback(currentProgress, "Exporting to GLB format...")
        } else if (output.includes("Successfully converted")) {
          currentProgress = 95
          progressCallback(currentProgress, "Finalizing conversion...")
        }
      }
    })

    blenderProcess.stderr.on("data", (data) => {
      stderr += data.toString()
      console.log("Blender stderr:", data.toString())
    })

    // Add timeout for conversion process
    const timeout = setTimeout(() => {
      blenderProcess.kill()
      reject(new Error("STL conversion timed out after 5 minutes"))
    }, 300000) // 5 minutes timeout

    blenderProcess.on("close", (code) => {
      clearTimeout(timeout)

      console.log(`Blender process exited with code: ${code}`)
      console.log(`Checking for output file: ${outputPath}`)

      // Clean up copied STL file if it was created
      if (!isDev && workingStlPath !== stlPath && fs.existsSync(workingStlPath)) {
        try {
          fs.unlinkSync(workingStlPath)
          console.log(`Cleaned up temporary STL file: ${workingStlPath}`)
        } catch (cleanupError) {
          console.log(`Warning: Could not clean up temporary STL file: ${cleanupError.message}`)
        }
      }

      // Check if output file exists and has content
      let fileExists = false
      let fileSize = 0

      try {
        if (fs.existsSync(outputPath)) {
          const stats = fs.statSync(outputPath)
          fileSize = stats.size
          fileExists = true
          console.log(`Output file found, size: ${fileSize} bytes`)
        } else {
          console.log("Output file does not exist")
        }
      } catch (error) {
        console.error("Error checking output file:", error)
      }

      // Success if file exists and has reasonable size (>100 bytes)
      if (fileExists && fileSize > 100) {
        console.log("STL conversion successful!")
        if (progressCallback) progressCallback(100, "Conversion completed!")
        resolve(outputPath)

        // Add converted model to samples folder
        const originalStlName = path.basename(stlPath)
        copyConvertedToSamples(outputPath, originalStlName)
        return
      }

      // Conversion failed - provide detailed error message
      let errorMessage = `STL conversion failed`

      if (code !== 0) {
        errorMessage += ` (Blender exit code: ${code})`
      }

      if (!fileExists) {
        errorMessage += ` - Output file not created`
      } else if (fileSize <= 100) {
        errorMessage += ` - Output file too small (${fileSize} bytes)`
      }

      if (stderr.includes("TBBmalloc")) {
        errorMessage += ` - Memory allocation error (install Visual C++ redistributables)`
      } else if (stderr.includes("ImportError")) {
        errorMessage += ` - Missing Python modules in Blender`
      } else if (stderr.includes("No module named")) {
        errorMessage += ` - Blender Python environment issue`
      } else if (stderr.includes("No such file or directory")) {
        errorMessage += ` - Script file not found by Blender`
      } else if (stderr.trim()) {
        errorMessage += ` - ${stderr.trim()}`
      }

      console.error("Conversion failed:", errorMessage)
      console.error("Full stderr:", stderr)
      console.error("Full stdout:", stdout)

      reject(new Error(errorMessage))
    })

    blenderProcess.on("error", (error) => {
      clearTimeout(timeout)
      console.error("Failed to start Blender process:", error)

      // Clean up copied STL file if it was created
      if (!isDev && workingStlPath !== stlPath && fs.existsSync(workingStlPath)) {
        try {
          fs.unlinkSync(workingStlPath)
          console.log(`Cleaned up temporary STL file after error: ${workingStlPath}`)
        } catch (cleanupError) {
          console.log(`Warning: Could not clean up temporary STL file: ${cleanupError.message}`)
        }
      }

      reject(error)
    })
  })
}

// Add this function after the convertStlToGlb function
function copyConvertedToSamples(glbPath, originalStlName) {
  try {
    const modelsDir = path.join(__dirname, "../models")

    // Ensure models directory exists
    if (!fs.existsSync(modelsDir)) {
      fs.mkdirSync(modelsDir, { recursive: true })
      console.log(`Created models directory: ${modelsDir}`)
    }

    // Create a clean filename for the sample
    const cleanName = originalStlName.replace(/\.stl$/i, "") + "_converted.glb"
    const samplePath = path.join(modelsDir, cleanName)

    // Copy the converted file to samples if it doesn't exist
    if (!fs.existsSync(samplePath)) {
      fs.copyFileSync(glbPath, samplePath)
      console.log(`✅ Added converted model to samples: ${cleanName}`)
      return true
    }

    return false
  } catch (error) {
    console.error(`Error copying converted model to samples: ${error.message}`)
    return false
  }
}

// Enhanced Blender path detection for both development and production
function getBlenderPath() {
  const isDev = process.argv.includes("--dev") || !app.isPackaged

  let possiblePaths = []

  if (isDev) {
    // Development paths
    possiblePaths = [
      path.join(__dirname, "../resources/blender/blender.exe"),
      path.join(__dirname, "../resources/blender/blender"),
    ]
  } else {
    // Production paths - check multiple possible locations
    const resourcesPath = process.resourcesPath || path.join(process.cwd(), "resources")
    const appPath = path.dirname(process.execPath)

    possiblePaths = [
      // Inside app resources
      path.join(resourcesPath, "resources", "blender", "blender.exe"),
      path.join(resourcesPath, "resources", "blender", "blender"),
      path.join(resourcesPath, "app", "resources", "blender", "blender.exe"),
      path.join(resourcesPath, "app", "resources", "blender", "blender"),
      // Relative to app executable
      path.join(appPath, "resources", "blender", "blender.exe"),
      path.join(appPath, "resources", "blender", "blender"),
      // Legacy paths for compatibility
      path.join(__dirname, "../resources/blender/blender.exe"),
      path.join(__dirname, "../resources/blender/blender"),
    ]
  }

  // Add system paths as fallback
  possiblePaths.push(
    "blender", // If in PATH
    "C:\\Program Files\\Blender Foundation\\Blender 3.6\\blender.exe",
    "C:\\Program Files\\Blender Foundation\\Blender 4.0\\blender.exe",
    "/usr/bin/blender",
    "/usr/local/bin/blender",
    "/Applications/Blender.app/Contents/MacOS/Blender",
  )

  console.log("Searching for Blender in these paths:")
  for (const blenderPath of possiblePaths) {
    console.log(`  Checking: ${blenderPath}`)
    try {
      if (fs.existsSync(blenderPath)) {
        console.log(`✅ Found Blender at: ${blenderPath}`)
        return blenderPath
      }
    } catch (error) {
      console.log(`  Error checking path: ${error.message}`)
    }
  }

  console.error("❌ Blender not found in any expected location")
  return null
}

async function openFileDialog() {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [
      { name: "3D Models", extensions: ["glb", "gltf", "stl"] }, // Added STL support
      { name: "GLB Files", extensions: ["glb"] },
      { name: "GLTF Files", extensions: ["gltf"] },
      { name: "STL Files", extensions: ["stl"] }, // New STL filter
      { name: "All Files", extensions: ["*"] },
    ],
  })

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0]
    mainWindow.webContents.send("load-model-file", filePath)
  }
}

function loadSampleModels() {
  const modelsDir = path.join(__dirname, "../models")

  if (fs.existsSync(modelsDir)) {
    const files = fs.readdirSync(modelsDir).filter((file) => {
      const ext = file.toLowerCase()
      return ext.endsWith(".glb") || ext.endsWith(".gltf") || ext.endsWith(".stl") // Added STL support
    })

    mainWindow.webContents.send("load-sample-models", files)
  } else {
    dialog.showMessageBox(mainWindow, {
      type: "warning",
      title: "No Models Found",
      message: "No models directory found",
      detail: 'Please create a "models" folder in the application directory and add .glb, .gltf, or .stl files',
    })
  }
}

// IPC handlers
ipcMain.handle("get-sample-models", () => {
  const modelsDir = path.join(__dirname, "../models")

  if (fs.existsSync(modelsDir)) {
    return fs.readdirSync(modelsDir).filter((file) => {
      const ext = file.toLowerCase()
      return ext.endsWith(".glb") || ext.endsWith(".gltf") || ext.endsWith(".stl") // Added STL support
    })
  }
  return []
})

ipcMain.handle("get-model-path", (event, filename) => {
  return path.join(__dirname, "../models", filename)
})

ipcMain.handle("show-error", (event, title, message) => {
  dialog.showErrorBox(title, message)
})

ipcMain.handle("show-info", (event, title, message) => {
  dialog.showMessageBox(mainWindow, {
    type: "info",
    title: title,
    message: message,
  })
})

// Enhanced IPC handler for STL conversion with progress
ipcMain.handle("convert-stl-to-glb", async (event, stlPath) => {
  try {
    console.log(`Received STL conversion request for: ${stlPath}`)

    const progressCallback = (progress, message) => {
      event.sender.send("stl-conversion-progress", { progress, message })
    }

    const glbPath = await convertStlToGlb(stlPath, progressCallback)
    return glbPath
  } catch (error) {
    console.error("STL conversion error:", error)
    throw error
  }
})

// Enhanced file handling for large models - similar to Android version
ipcMain.handle("prepare-model-data", async (event, filePath) => {
  try {
    // Check if file is STL and needs conversion
    if (filePath.toLowerCase().endsWith(".stl")) {
      console.log("STL file detected, converting to GLB...")
      try {
        const convertedPath = await convertStlToGlb(filePath)
        filePath = convertedPath // Use converted GLB file
        console.log("STL conversion completed, using:", filePath)
      } catch (conversionError) {
        console.error("STL conversion failed:", conversionError)
        throw new Error(`Failed to convert STL file: ${conversionError.message}`)
      }
    }

    const stats = fs.statSync(filePath)
    const fileSizeInMB = stats.size / (1024 * 1024)

    console.log(`Preparing model: ${path.basename(filePath)} (${fileSizeInMB.toFixed(2)} MB)`)

    // For very large files (>100MB), use direct file URL approach
    if (fileSizeInMB > 100) {
      return {
        type: "file-url",
        data: `file://${filePath.replace(/\\/g, "/")}`,
        size: stats.size,
        sizeMB: fileSizeInMB,
      }
    }
    // For medium files (20-100MB), use streaming buffer approach
    else if (fileSizeInMB > 20) {
      return {
        type: "stream-buffer",
        data: filePath,
        size: stats.size,
        sizeMB: fileSizeInMB,
      }
    }
    // For small files (<20MB), read into memory
    else {
      const buffer = fs.readFileSync(filePath)
      return {
        type: "buffer",
        data: Array.from(buffer),
        size: stats.size,
        sizeMB: fileSizeInMB,
      }
    }
  } catch (error) {
    console.error("Error preparing model data:", error)
    throw error
  }
})

// Stream large model in chunks
ipcMain.handle("stream-large-model", async (event, filePath) => {
  try {
    const stats = fs.statSync(filePath)
    const chunkSize = 1024 * 1024 * 5 // 5MB chunks
    const totalChunks = Math.ceil(stats.size / chunkSize)

    return {
      filePath: filePath,
      totalSize: stats.size,
      chunkSize: chunkSize,
      totalChunks: totalChunks,
    }
  } catch (error) {
    console.error("Error setting up streaming:", error)
    throw error
  }
})

// Legacy support - enhanced version
ipcMain.handle("load-model-buffer", async (event, filePath) => {
  try {
    // Check if file is STL and needs conversion
    if (filePath.toLowerCase().endsWith(".stl")) {
      console.log("STL file detected, converting to GLB...")
      try {
        const convertedPath = await convertStlToGlb(filePath)
        filePath = convertedPath // Use converted GLB file
        console.log("STL conversion completed, using:", filePath)
      } catch (conversionError) {
        console.error("STL conversion failed:", conversionError)
        throw new Error(`Failed to convert STL file: ${conversionError.message}`)
      }
    }

    const stats = fs.statSync(filePath)
    const fileSizeInMB = stats.size / (1024 * 1024)

    console.log(`Loading model: ${path.basename(filePath)} (${fileSizeInMB.toFixed(2)} MB)`)

    // Enhanced threshold - use file URL for files >30MB
    if (fileSizeInMB > 30) {
      return {
        type: "file-url",
        data: filePath,
        size: stats.size,
      }
    } else {
      // For smaller files, read into buffer
      const buffer = fs.readFileSync(filePath)
      return {
        type: "buffer",
        data: Array.from(buffer),
        size: stats.size,
      }
    }
  } catch (error) {
    console.error("Error loading model buffer:", error)
    throw error
  }
})

ipcMain.handle("get-file-stats", async (event, filePath) => {
  try {
    const stats = fs.statSync(filePath)
    return {
      size: stats.size,
      sizeMB: stats.size / (1024 * 1024),
    }
  } catch (error) {
    throw error
  }
})

// Add file dialog handler
ipcMain.handle("open-file-dialog", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile"],
    filters: [
      { name: "3D Models", extensions: ["glb", "gltf", "stl"] }, // Added STL support
      { name: "GLB Files", extensions: ["glb"] },
      { name: "GLTF Files", extensions: ["gltf"] },
      { name: "STL Files", extensions: ["stl"] }, // New STL filter
      { name: "All Files", extensions: ["*"] },
    ],
  })

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0]
  }
  return null
})

// App event handlers
app.whenReady().then(createWindow)

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Security: Prevent new window creation
app.on("web-contents-created", (event, contents) => {
  contents.on("new-window", (event, navigationUrl) => {
    event.preventDefault()
  })
})
