// File actions: editable project Save/Open (.kidpix), PNG export, and Print.
//
// Kid Pix is an immediate-mode pixel editor (see js/util/display.js), so the
// editable file is deliberately small in concept: a versioned, full-canvas PNG
// snapshot plus the frame style. Reopening restores the exact pixels and then
// ordinary tools continue editing that raster. PNG remains an explicit flattened
// interchange format, not a second project format.

(function () {
  var KP_PROJECT_VERSION = 1;
  var KP_PROJECT_MAGIC = "kidpix-project";
  var KP_PROJECT_WIDTH = 1300;
  var KP_PROJECT_HEIGHT = 650;
  var MAX_PROJECT_BYTES = 20 * 1024 * 1024;

  function actionError(code, message) {
    var error = new Error(message);
    error.code = code;
    return error;
  }

  function formattedDate(date) {
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
      String(date.getHours()).padStart(2, "0"),
      String(date.getMinutes()).padStart(2, "0"),
      String(date.getSeconds()).padStart(2, "0"),
    ].join("-");
  }

  function setStatus(message, isError) {
    var status = document.getElementById("statusbar-text");
    if (!status) return;
    status.textContent = message || "";
    status.style.color = isError ? "#b42318" : "";
  }

  function setDownloadFallback(callback) {
    var button = document.getElementById("download-fallback-btn");
    if (!button) return;
    button.hidden = !callback;
    button.onclick = callback
      ? function () {
          button.hidden = true;
          button.onclick = null;
          callback();
        }
      : null;
  }

  function triggerBlobDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  // One click produces at most one externally-visible effect. Touch devices with
  // file sharing get the native sheet (including iPad's Save to Files); an aborted
  // share exposes a separate Download button instead of silently firing a second
  // save action.
  function deliverBlob(blob, filename, title) {
    var nav = window.navigator;
    var file =
      typeof File === "function"
        ? new File([blob], filename, { type: blob.type })
        : null;
    var canShare = false;
    if (
      file &&
      nav.maxTouchPoints > 0 &&
      typeof nav.share === "function" &&
      typeof nav.canShare === "function"
    ) {
      try {
        canShare = nav.canShare({ files: [file] });
      } catch (error) {
        canShare = false;
      }
    }

    setDownloadFallback(null);
    if (!canShare) {
      triggerBlobDownload(blob, filename);
      setStatus("Saved " + filename);
      return Promise.resolve({ delivery: "download", filename: filename });
    }

    setStatus("Choose Save to Files in the share sheet.");
    var shareOperation;
    try {
      // Call while the click's transient user activation is still live. In
      // particular, Safari rejects share() if it is deferred to a later task.
      shareOperation = nav.share({ files: [file], title: title });
    } catch (error) {
      shareOperation = Promise.reject(error);
    }
    return Promise.resolve(shareOperation)
      .then(function () {
        setStatus("Saved " + filename);
        return { delivery: "share", filename: filename };
      })
      .catch(function () {
        setStatus("Share closed. Tap Download instead if you still want the file.");
        setDownloadFallback(function () {
          triggerBlobDownload(blob, filename);
          setStatus("Saved " + filename);
        });
        return { delivery: "share-cancelled", filename: filename };
      });
  }

  function applyFrameStyle(className) {
    var paint = document.getElementById("paint");
    var button = document.getElementById("frame-toggle");
    var styles = KiddoPaint.FrameStyles || [];
    if (!paint) return;
    styles.forEach(function (style) {
      paint.classList.remove(style.cls);
    });
    paint.classList.add(className);
    try {
      localStorage.setItem("kiddopaint_frame", className);
    } catch (error) {}
    if (button) {
      for (var i = 0; i < styles.length; i++) {
        if (styles[i].cls === className) {
          button.textContent = "Frame: " + styles[i].label;
          break;
        }
      }
    }
    if (typeof window.fitCanvasToStage === "function") {
      window.fitCanvasToStage();
    }
  }

  function currentFrameStyle() {
    try {
      return localStorage.getItem("kiddopaint_frame");
    } catch (error) {
      return null;
    }
  }

  function createProject(canvas, frame, createdAt) {
    return {
      magic: KP_PROJECT_MAGIC,
      version: KP_PROJECT_VERSION,
      createdAt: createdAt.toISOString(),
      canvas: {
        width: canvas.width,
        height: canvas.height,
        png: canvas.toDataURL("image/png"),
      },
      retainedState: { frame: frame },
    };
  }

  function saveProject() {
    var canvas = KiddoPaint.Display && KiddoPaint.Display.main_canvas;
    if (!canvas) {
      var missing = actionError("canvas_unavailable", "Nothing to save yet.");
      setStatus(missing.message, true);
      return Promise.reject(missing);
    }
    var now = new Date();
    var project;
    try {
      project = createProject(canvas, currentFrameStyle(), now);
    } catch (error) {
      var unreadable = actionError("canvas_unreadable", "Could not read the canvas.");
      setStatus(unreadable.message, true);
      return Promise.reject(unreadable);
    }
    var filename = "kidpix-" + formattedDate(now) + ".kidpix";
    var blob = new Blob([JSON.stringify(project)], { type: "application/json" });
    return deliverBlob(blob, filename, "Kid Pix project");
  }

  function canvasToPNGBlob(canvas) {
    var dataURL = canvas.toDataURL("image/png");
    var encoded = dataURL.slice(dataURL.indexOf(",") + 1);
    var binary = window.atob(encoded);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: "image/png" });
  }

  function exportPNG() {
    var main = KiddoPaint.Display && KiddoPaint.Display.main_canvas;
    if (!main) {
      var missing = actionError("canvas_unavailable", "Nothing to export yet.");
      setStatus(missing.message, true);
      return Promise.reject(missing);
    }
    var source = main;
    if (typeof window.trimAndFlattenCanvas === "function") {
      try {
        source = window.trimAndFlattenCanvas(main);
      } catch (error) {
        source = main;
      }
    }
    var now = new Date();
    var filename = "kidpix-" + formattedDate(now) + ".png";
    try {
      return deliverBlob(
        canvasToPNGBlob(source),
        filename,
        "Kid Pix picture",
      );
    } catch (error) {
      var failed = actionError("png_encode_failed", "Could not make a PNG.");
      setStatus(failed.message, true);
      return Promise.reject(failed);
    }
  }

  function sanitizeProject(raw) {
    if (!raw || typeof raw !== "object") {
      throw actionError("invalid_project", "That is not a project file.");
    }
    if (raw.magic !== KP_PROJECT_MAGIC) {
      throw actionError("invalid_magic", "That is not a Kid Pix project.");
    }
    if (!Number.isInteger(raw.version) || raw.version < 1) {
      throw actionError("invalid_version", "Unknown project version.");
    }
    if (raw.version > KP_PROJECT_VERSION) {
      throw actionError("future_version", "This project is newer than this Kid Pix build.");
    }
    var canvas = raw.canvas;
    if (
      !canvas ||
      !Number.isInteger(canvas.width) ||
      !Number.isInteger(canvas.height) ||
      canvas.width !== KP_PROJECT_WIDTH ||
      canvas.height !== KP_PROJECT_HEIGHT ||
      typeof canvas.png !== "string"
    ) {
      throw actionError(
        "invalid_canvas",
        "The project canvas must be 1300 by 650 pixels.",
      );
    }
    if (canvas.png.indexOf("data:image/png;base64,") !== 0) {
      throw actionError("invalid_canvas_image", "The project canvas is not a PNG.");
    }
    var safeFrame = null;
    var retained = raw.retainedState;
    if (retained && typeof retained.frame === "string" && KiddoPaint.FrameStyles) {
      for (var i = 0; i < KiddoPaint.FrameStyles.length; i++) {
        if (KiddoPaint.FrameStyles[i].cls === retained.frame) {
          safeFrame = retained.frame;
          break;
        }
      }
    }
    return {
      width: canvas.width,
      height: canvas.height,
      png: canvas.png,
      frame: safeFrame,
    };
  }

  function applyProject(project) {
    return new Promise(function (resolve, reject) {
      var image = new Image();
      image.onload = function () {
        if (
          image.naturalWidth !== project.width ||
          image.naturalHeight !== project.height
        ) {
          reject(actionError("dimension_mismatch", "The project image size does not match its file."));
          return;
        }
        var display = KiddoPaint.Display;
        display.saveUndo();
        display.clearTmp();
        display.clearPreview();
        display.clearMain();
        display.main_context.drawImage(image, 0, 0);
        display.saveToLocalStorage();
        if (project.frame) applyFrameStyle(project.frame);
        setStatus("Project opened. Keep drawing!");
        resolve();
      };
      image.onerror = function () {
        reject(actionError("decode_failed", "Could not decode the saved picture."));
      };
      image.src = project.png;
    });
  }

  function loadProjectFromFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(actionError("missing_file", "Choose a project file first."));
        return;
      }
      if (file.size > MAX_PROJECT_BYTES) {
        reject(actionError("project_too_large", "That project file is too large."));
        return;
      }
      if (typeof FileReader === "undefined") {
        reject(actionError("file_reader_unavailable", "This browser cannot read files."));
        return;
      }
      var reader = new FileReader();
      reader.onerror = function () {
        reject(actionError("read_failed", "Could not read the project file."));
      };
      reader.onload = function (event) {
        var raw;
        try {
          raw = JSON.parse(event.target.result);
        } catch (error) {
          reject(actionError("invalid_json", "That file is not a Kid Pix project."));
          return;
        }
        var safe;
        try {
          safe = sanitizeProject(raw);
        } catch (error) {
          reject(error);
          return;
        }
        applyProject(safe).then(resolve, reject);
      };
      reader.readAsText(file);
    });
  }

  function isProjectFile(file) {
    if (!file) return false;
    var name = String(file.name || "").toLowerCase();
    return (
      name.slice(-7) === ".kidpix" ||
      file.type === "application/json" ||
      file.type === "application/vnd.kidpix+json"
    );
  }

  function openFile(file) {
    setDownloadFallback(null);
    var operation = isProjectFile(file)
      ? loadProjectFromFile(file)
      : KiddoPaint.ImageImport.openFile(file).then(function () {
          setStatus("Picture opened. Keep drawing!");
        });
    return operation.catch(function (error) {
      setStatus(error.message || "Could not open that file.", true);
      throw error;
    });
  }

  function triggerOpenPicker() {
    var input = document.getElementById("open-picture-input");
    if (!input) return;
    input.value = "";
    input.click();
  }

  function printDrawing() {
    if (typeof window.print !== "function") return exportPNG();
    document.body.classList.add("printing");
    var cleanup = function () {
      document.body.classList.remove("printing");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    try {
      window.print();
      return Promise.resolve();
    } catch (error) {
      cleanup();
      return exportPNG();
    }
  }

  function report(operation, label) {
    operation.catch(function (error) {
      console.warn(label + ":", error && error.code ? error.code : error);
    });
  }

  function wire() {
    var printButton = document.getElementById("print-btn");
    if (printButton) {
      printButton.addEventListener("click", function () {
        if (KiddoPaint.Sounds && KiddoPaint.Sounds.mainmenu) KiddoPaint.Sounds.mainmenu();
        report(printDrawing(), "Print failed");
      });
    }
    var exportButton = document.getElementById("export-png-btn");
    if (exportButton) {
      exportButton.addEventListener("click", function () {
        if (KiddoPaint.Sounds && KiddoPaint.Sounds.mainmenu) KiddoPaint.Sounds.mainmenu();
        report(exportPNG(), "PNG export failed");
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }

  window.KiddoPaint = window.KiddoPaint || {};
  KiddoPaint.FileActions = {
    print: printDrawing,
    saveProject: saveProject,
    exportPNG: exportPNG,
    openFile: openFile,
    triggerOpenPicker: triggerOpenPicker,
    loadProjectFromFile: loadProjectFromFile,
    sanitizeProject: sanitizeProject,
    isProjectFile: isProjectFile,
    PROJECT_VERSION: KP_PROJECT_VERSION,
    PROJECT_MAGIC: KP_PROJECT_MAGIC,
  };
})();
