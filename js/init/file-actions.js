// File actions: Print and Project Save/Load (.kidpix).
// PNG export already lives in init/kiddopaint.js (`save_to_file`); this file adds the
// two newer affordances that hang off the statusbar.
//
// Canvas model is immediate-mode pixels (see js/util/display.js). There is no retained
// scene graph for stamps/text/strokes — once a tool commits to main_canvas it becomes
// plain pixels. So a project file is essentially a versioned PNG snapshot plus a tiny
// bit of session state (frame style); we ship a version field so we can grow later
// without a migration framework.

(function () {
  var KP_PROJECT_VERSION = 1;
  var KP_PROJECT_MAGIC = "kidpix-project";

  // ---- helpers --------------------------------------------------------------

  function formattedDate() {
    var d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
      String(d.getHours()).padStart(2, "0"),
      String(d.getMinutes()).padStart(2, "0"),
      String(d.getSeconds()).padStart(2, "0"),
    ].join("-");
  }

  function triggerDownload(href, filename) {
    var a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function openModal() {
    var m = document.getElementById("project-modal");
    if (m) m.style.display = "";
  }

  function closeModal() {
    var m = document.getElementById("project-modal");
    if (m) m.style.display = "none";
    var status = document.getElementById("project-modal-status");
    if (status) status.textContent = "";
  }

  // Apply a frame style class to #paint and update the toggle button label, mirroring
  // init_frame_toggle in init/kiddopaint.js (which is module-scoped and not reachable
  // from here). Allow-listed against KiddoPaint.FrameStyles by sanitizeProject.
  function applyFrameStyle(cls) {
    var paint = document.getElementById("paint");
    var btn = document.getElementById("frame-toggle");
    var styles = KiddoPaint.FrameStyles || [];
    if (!paint) return;
    styles.forEach(function (s) {
      paint.classList.remove(s.cls);
    });
    paint.classList.add(cls);
    try {
      localStorage.setItem("kiddopaint_frame", cls);
    } catch (e) {}
    if (btn) {
      for (var i = 0; i < styles.length; i++) {
        if (styles[i].cls === cls) {
          btn.textContent = "Frame: " + styles[i].label;
          break;
        }
      }
    }
  }

  function setStatus(msg, isError) {
    var status = document.getElementById("project-modal-status");
    if (!status) return;
    status.textContent = msg || "";
    status.style.color = isError ? "#d63031" : "#2171d6";
  }

  // ---- Print ---------------------------------------------------------------
  // Native window.print() with a print-specific stylesheet (see kidpix.css @media print).
  // Feature-detect; fall back to PNG export when print is unavailable (e.g. some
  // in-app browsers).
  function print_drawing() {
    if (typeof window.print !== "function") {
      fallback_png_export();
      return;
    }
    // Toggle a body class so the print stylesheet can isolate the canvas. Cleared on
    // afterprint so the screen view is untouched once the dialog closes.
    document.body.classList.add("printing");
    var cleanup = function () {
      document.body.classList.remove("printing");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    try {
      window.print();
    } catch (e) {
      cleanup();
      console.warn("print failed, falling back to PNG export", e);
      fallback_png_export();
    }
  }

  // Minimal PNG export used only when window.print is unavailable. Mirrors the format
  // of the main Save button but is intentionally separate so this module doesn't reach
  // into init/kiddopaint.js's module-scoped save_to_file.
  function fallback_png_export() {
    var main = KiddoPaint.Display && KiddoPaint.Display.main_canvas;
    if (!main) return;
    var src = main;
    if (typeof window.trimAndFlattenCanvas === "function") {
      try {
        src = window.trimAndFlattenCanvas(main);
      } catch (e) {
        src = main;
      }
    }
    try {
      var url = src.toDataURL("image/png");
      triggerDownload(url, "kidpix-" + formattedDate() + ".png");
    } catch (e) {
      console.warn("PNG export failed", e);
    }
  }

  // ---- Save Project --------------------------------------------------------
  function save_project() {
    var main = KiddoPaint.Display.main_canvas;
    if (!main) {
      setStatus("Nothing to save yet.", true);
      return;
    }
    var canvasPNG;
    try {
      canvasPNG = main.toDataURL("image/png");
    } catch (e) {
      setStatus("Could not read the canvas.", true);
      console.warn("toDataURL failed", e);
      return;
    }
    var frameCls = null;
    try {
      frameCls = localStorage.getItem("kiddopaint_frame");
    } catch (e) {}
    var project = {
      magic: KP_PROJECT_MAGIC,
      version: KP_PROJECT_VERSION,
      createdAt: new Date().toISOString(),
      canvas: {
        width: main.width,
        height: main.height,
        png: canvasPNG,
      },
      retainedState: {
        frame: frameCls,
      },
    };
    var json = JSON.stringify(project);
    var blob = new Blob([json], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    triggerDownload(url, "kidpix-" + formattedDate() + ".kidpix");
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 0);
    setStatus("Saved!");
  }

  // ---- Load Project --------------------------------------------------------
  // Boundary sanitization: any field we apply to the DOM/canvas is validated against an
  // allow-list. The PNG is loaded into an Image element, which decodes pixels and
  // discards anything that isn't a real bitmap — there is no script execution path for
  // a malformed data URL here.
  function sanitizeProject(raw) {
    if (!raw || typeof raw !== "object") throw new Error("not a project file");
    if (raw.magic !== KP_PROJECT_MAGIC) throw new Error("not a kidpix project");
    if (typeof raw.version !== "number" || raw.version < 1) {
      throw new Error("unknown project version");
    }
    if (raw.version > KP_PROJECT_VERSION) {
      throw new Error("project is newer than this build");
    }
    var c = raw.canvas;
    if (!c || typeof c.png !== "string") throw new Error("missing canvas image");
    if (c.png.indexOf("data:image/") !== 0) {
      throw new Error("canvas image is not a data URL");
    }
    var safeFrame = null;
    var rs = raw.retainedState;
    if (rs && typeof rs.frame === "string" && KiddoPaint.FrameStyles) {
      for (var i = 0; i < KiddoPaint.FrameStyles.length; i++) {
        if (KiddoPaint.FrameStyles[i].cls === rs.frame) {
          safeFrame = rs.frame;
          break;
        }
      }
    }
    return { png: c.png, frame: safeFrame };
  }

  function applyProject(safe) {
    var img = new Image();
    img.onload = function () {
      KiddoPaint.Display.saveUndo();
      KiddoPaint.Display.clearMain();
      KiddoPaint.Display.main_context.drawImage(img, 0, 0);
      KiddoPaint.Display.saveToLocalStorage();
      if (safe.frame) applyFrameStyle(safe.frame);
      setStatus("Loaded!");
      setTimeout(closeModal, 600);
    };
    img.onerror = function () {
      setStatus("Could not decode the saved picture.", true);
    };
    img.src = safe.png;
  }

  function load_project_from_file(file) {
    if (!file) return;
    if (typeof FileReader === "undefined") {
      setStatus("Your browser cannot read files.", true);
      return;
    }
    var reader = new FileReader();
    reader.onload = function (ev) {
      var text = ev.target.result;
      var raw;
      try {
        raw = JSON.parse(text);
      } catch (e) {
        setStatus("That file isn't a kidpix project.", true);
        return;
      }
      var safe;
      try {
        safe = sanitizeProject(raw);
      } catch (e) {
        setStatus(e.message, true);
        return;
      }
      applyProject(safe);
    };
    reader.onerror = function () {
      setStatus("Could not read the file.", true);
    };
    reader.readAsText(file);
  }

  // ---- Wiring --------------------------------------------------------------
  function wire() {
    var printBtn = document.getElementById("print-btn");
    if (printBtn) {
      printBtn.addEventListener("click", function () {
        if (KiddoPaint.Sounds && KiddoPaint.Sounds.mainmenu) {
          KiddoPaint.Sounds.mainmenu();
        }
        print_drawing();
      });
    }

    var projectBtn = document.getElementById("project-btn");
    if (projectBtn) {
      projectBtn.addEventListener("click", function () {
        if (KiddoPaint.Sounds && KiddoPaint.Sounds.mainmenu) {
          KiddoPaint.Sounds.mainmenu();
        }
        openModal();
      });
    }

    var saveProjBtn = document.getElementById("project-save");
    if (saveProjBtn) {
      saveProjBtn.addEventListener("click", function () {
        if (KiddoPaint.Sounds && KiddoPaint.Sounds.mainmenu) {
          KiddoPaint.Sounds.mainmenu();
        }
        save_project();
      });
    }

    var loadInput = document.getElementById("project-load-input");
    if (loadInput) {
      loadInput.addEventListener("change", function (ev) {
        var file = ev.target.files && ev.target.files[0];
        load_project_from_file(file);
        loadInput.value = "";
      });
    }

    var closeBtn = document.querySelector("#project-modal .close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeModal);
    }
    var modal = document.getElementById("project-modal");
    if (modal) {
      modal.addEventListener("click", function (ev) {
        if (ev.target === modal) closeModal();
      });
    }
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") {
        var m = document.getElementById("project-modal");
        if (m && m.style.display !== "none") closeModal();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }

  // Expose for tests / debugging.
  window.KiddoPaint = window.KiddoPaint || {};
  KiddoPaint.FileActions = {
    print: print_drawing,
    saveProject: save_project,
    loadProjectFromFile: load_project_from_file,
    sanitizeProject: sanitizeProject,
    PROJECT_VERSION: KP_PROJECT_VERSION,
    PROJECT_MAGIC: KP_PROJECT_MAGIC,
  };
})();
