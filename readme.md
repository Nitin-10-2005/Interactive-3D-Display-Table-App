# Interactive 3D Display Table App

An offline-first, high-performance 3D model viewer built with Electron and Three.js, designed for industrial applications. This desktop application provides a seamless solution for visualizing large-scale `.stl` models by leveraging a bundled instance of Blender for automatic, on-the-fly conversion to the web-optimized `.glb` format.

The application is optimized for performance on low-spec hardware, such as industrial touchscreen systems, and is fully functional without an internet connection, making it ideal for factory floors and other isolated environments.

### Key Features

* **Offline STL to GLB Conversion:** Automatically converts `.stl` files to `.glb` using a bundled Blender instance and a custom Python script.
* **Large Model Handling:** Capable of loading and rendering industrial models over 270MB with optimized memory handling.
* **High-Performance Rendering:** Utilizes Three.js and GPU acceleration to achieve smooth frame rates (45-60 FPS) even on modest hardware.
* **Intuitive Controls:** Full support for mouse and touchscreen controls, including zoom, pan, rotate, and view reset.
* **Cross-Platform:** Built with Electron and can be packaged for Windows, macOS, and Linux.
* **Standalone Operation:** The entire application, including the conversion pipeline, is designed to work completely offline.

### Tech Stack

* **Framework:** Electron.js
* **3D Rendering:** Three.js
* **3D Model Conversion:** Blender (via Python scripting)
* **Frontend:** HTML, CSS, JavaScript
* **Packaging:** Electron Builder

### Getting Started

Follow these instructions to get a development environment running.

**Prerequisites**

* [Node.js](https://nodejs.org/) (v16.0.0 or later recommended)
* [npm](https://www.npmjs.com/) (usually comes with Node.js)

**Installation**

1.  Clone the repository:
    ```sh
    git clone [https://github.com/your-username/interactive-3d-display-table-app.git](https://github.com/your-username/interactive-3d-display-table-app.git)
    ```
2.  Navigate to the project directory:
    ```sh
    cd interactive-3d-display-table-app
    ```
3.  Install the dependencies:
    ```sh
    npm install
    ```

**Running the Application**

To start the application in development mode, run:

```sh
npm run start
