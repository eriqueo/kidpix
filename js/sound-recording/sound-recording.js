// Record Sound / Play Sound — Kid Pix manual-fidelity fan reproduction.
//
// Adds two buttons to the main toolbar: a microphone (Record Sound) and a
// speaker (Play Sound). Captures mic audio with MediaRecorder, persists it
// out-of-band in IndexedDB keyed by drawing id, plays it back via the same
// <audio> element (decoded by the browser, which avoids MIME mismatch on
// WebAudio decodeAudioData), and shows a small corner badge on drawings
// that have a sound attached.
//
// Disabled by setting `localStorage.kiddopaint_soundrec_off = "1"` or
// loading with `?nosoundrec`. Default-on per the standing policy.

(function () {
  if (typeof window === "undefined") return;

  // ---- Feature flag ----------------------------------------------------
  var SEARCH = (window.location && window.location.search) || "";
  if (/[?&]nosoundrec\b/.test(SEARCH)) return;
  try {
    if (localStorage.getItem("kiddopaint_soundrec_off") === "1") return;
  } catch (e) {}

  var MAX_MS = 30000; // bounded recording length
  var SCHEMA_VERSION = 2;
  var META_KEY = "kiddopaint_meta";
  var DRAWING_ID_KEY = "kiddopaint_drawing_id";

  // Stable drawing id (one slot — the in-progress drawing). A UUID-ish suffices.
  function getDrawingId() {
    try {
      var id = localStorage.getItem(DRAWING_ID_KEY);
      if (id) return id;
      id = "d-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
      localStorage.setItem(DRAWING_ID_KEY, id);
      return id;
    } catch (e) {
      return "d-fallback";
    }
  }

  function readMeta() {
    try {
      var raw = localStorage.getItem(META_KEY);
      if (!raw) return { version: SCHEMA_VERSION };
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return { version: SCHEMA_VERSION };
      // Backward-compat: pre-feature saves have no meta. Treat as v1, upgrade in place.
      if (!parsed.version) parsed.version = 1;
      return parsed;
    } catch (e) {
      return { version: SCHEMA_VERSION };
    }
  }
  function writeMeta(meta) {
    try {
      meta.version = SCHEMA_VERSION;
      localStorage.setItem(META_KEY, JSON.stringify(meta));
    } catch (e) {}
  }

  // ---- IndexedDB store (keyed by drawing id) --------------------------
  var DB_NAME = "kiddopaint-sound";
  var DB_VERSION = 1;
  var STORE = "sounds";

  function openDb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) return reject(new Error("no-indexeddb"));
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error("idb-open-failed")); };
    });
  }

  function putSound(id, blob, mime) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put({ id: id, blob: blob, mime: mime, savedAt: Date.now() });
        tx.oncomplete = function () { db.close(); resolve(); };
        tx.onerror = function () { db.close(); reject(tx.error); };
      });
    });
  }

  function getSound(id) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readonly");
        var req = tx.objectStore(STORE).get(id);
        req.onsuccess = function () { db.close(); resolve(req.result || null); };
        req.onerror = function () { db.close(); reject(req.error); };
      });
    });
  }

  function deleteSound(id) {
    return openDb().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = function () { db.close(); resolve(); };
        tx.onerror = function () { db.close(); resolve(); };
      });
    });
  }

  // ---- Codec negotiation ----------------------------------------------
  function pickMimeType() {
    if (typeof MediaRecorder === "undefined") return null;
    var candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4;codecs=mp4a.40.2", // Safari
      "audio/mp4",
      "audio/aac",
    ];
    for (var i = 0; i < candidates.length; i++) {
      try {
        if (MediaRecorder.isTypeSupported(candidates[i])) return candidates[i];
      } catch (e) {}
    }
    return ""; // empty string = let the browser pick
  }

  // ---- Recorder utility (mic stream + MediaRecorder) ------------------
  function Recorder() {
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
    this.mime = "";
    this.maxTimer = null;
    this.active = false;
  }

  Recorder.prototype.start = function () {
    var self = this;
    if (self.active) return Promise.reject(new Error("already-recording"));
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error("mic-unsupported"));
    }
    if (typeof MediaRecorder === "undefined") {
      return Promise.reject(new Error("mediarecorder-unsupported"));
    }
    return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      self.stream = stream;
      self.mime = pickMimeType();
      try {
        self.recorder = self.mime
          ? new MediaRecorder(stream, { mimeType: self.mime })
          : new MediaRecorder(stream);
      } catch (e) {
        // Mime picked but rejected by impl — retry default.
        self.recorder = new MediaRecorder(stream);
        self.mime = "";
      }
      if (!self.mime && self.recorder.mimeType) self.mime = self.recorder.mimeType;
      self.chunks = [];
      self.recorder.ondataavailable = function (ev) {
        if (ev.data && ev.data.size > 0) self.chunks.push(ev.data);
      };
      self.active = true;
      self.recorder.start();
      // Hard cap — auto-stop at MAX_MS.
      self.maxTimer = setTimeout(function () {
        if (self.active) self.stop();
      }, MAX_MS);
    });
  };

  Recorder.prototype.stop = function () {
    var self = this;
    if (!self.active) return Promise.resolve(null);
    return new Promise(function (resolve) {
      var rec = self.recorder;
      rec.onstop = function () {
        var mime = self.mime || "audio/webm";
        var blob = new Blob(self.chunks, { type: mime });
        self._releaseStream();
        self.active = false;
        if (self.maxTimer) { clearTimeout(self.maxTimer); self.maxTimer = null; }
        resolve({ blob: blob, mime: mime });
      };
      try {
        rec.stop();
      } catch (e) {
        self._releaseStream();
        self.active = false;
        resolve(null);
      }
    });
  };

  Recorder.prototype.cancel = function () {
    if (this.maxTimer) { clearTimeout(this.maxTimer); this.maxTimer = null; }
    if (this.recorder && this.active) {
      try { this.recorder.onstop = null; this.recorder.stop(); } catch (e) {}
    }
    this._releaseStream();
    this.active = false;
    this.chunks = [];
  };

  Recorder.prototype._releaseStream = function () {
    if (this.stream) {
      try {
        var tracks = this.stream.getTracks();
        for (var i = 0; i < tracks.length; i++) tracks[i].stop();
      } catch (e) {}
      this.stream = null;
    }
  };

  // ---- Player (decodes via <audio>, avoiding decodeAudioData MIME issues) ----
  function Player() {
    this.audio = null;
    this.url = null;
  }
  Player.prototype.play = function (blob) {
    var self = this;
    self.stop();
    self.url = URL.createObjectURL(blob);
    self.audio = new Audio();
    self.audio.src = self.url;
    self.audio.onended = function () { self.stop(); };
    return self.audio.play();
  };
  Player.prototype.stop = function () {
    if (this.audio) {
      try { this.audio.pause(); } catch (e) {}
      this.audio.src = "";
      this.audio = null;
    }
    if (this.url) {
      try { URL.revokeObjectURL(this.url); } catch (e) {}
      this.url = null;
    }
  };

  // ---- UI: toolbar buttons + corner badge -----------------------------
  var SVG_MIC =
    'data:image/svg+xml;utf8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" shape-rendering="crispEdges">' +
      '<rect width="48" height="48" fill="#ececec"/>' +
      '<g fill="#222" stroke="#222" stroke-width="2">' +
      // mic body
      '<rect x="20" y="8" width="8" height="18" rx="4" ry="4" fill="#d83a3a"/>' +
      // stand arc
      '<path d="M14 24 Q14 34 24 34 Q34 34 34 24" fill="none" stroke-width="3"/>' +
      '<line x1="24" y1="34" x2="24" y2="40" stroke-width="3"/>' +
      '<line x1="18" y1="40" x2="30" y2="40" stroke-width="3"/>' +
      '</g>' +
      // big "REC" tag
      '<text x="3" y="14" font-family="monospace" font-size="9" font-weight="bold" fill="#d83a3a">REC</text>' +
      '</svg>'
    );

  var SVG_SPEAKER =
    'data:image/svg+xml;utf8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" shape-rendering="crispEdges">' +
      '<rect width="48" height="48" fill="#ececec"/>' +
      '<g fill="#222" stroke="#222" stroke-width="2">' +
      // speaker box + cone
      '<polygon points="10,20 18,20 28,12 28,36 18,28 10,28" fill="#3a78d8"/>' +
      // sound waves
      '<path d="M32 16 Q38 24 32 32" fill="none" stroke-width="3"/>' +
      '<path d="M36 12 Q44 24 36 36" fill="none" stroke-width="3"/>' +
      '</g>' +
      '<text x="3" y="14" font-family="monospace" font-size="9" font-weight="bold" fill="#3a78d8">PLAY</text>' +
      '</svg>'
    );

  function injectButtons() {
    var mainbar = document.getElementById("mainbar");
    if (!mainbar) return null;
    if (document.getElementById("record-sound")) {
      return {
        record: document.getElementById("record-sound"),
        play: document.getElementById("play-sound"),
      };
    }

    var rec = document.createElement("button");
    rec.className = "tool";
    rec.id = "record-sound";
    rec.title = "Record Sound";
    var recImg = document.createElement("img");
    recImg.src = SVG_MIC;
    recImg.className = "pixelated";
    recImg.width = 48; recImg.height = 48;
    rec.appendChild(recImg);

    var play = document.createElement("button");
    play.className = "tool";
    play.id = "play-sound";
    play.title = "Play Sound";
    var playImg = document.createElement("img");
    playImg.src = SVG_SPEAKER;
    playImg.className = "pixelated";
    playImg.width = 48; playImg.height = 48;
    play.appendChild(playImg);

    // Append at the end of the main toolbar so they sit below the existing rail
    // (the rail is a flex-wrap column-pair; new tools naturally land at the bottom).
    mainbar.appendChild(rec);
    mainbar.appendChild(play);

    // Status-bar descriptions: piggy-back on the existing data-driven map.
    if (window.KiddoPaint && KiddoPaint.ToolDescriptions) {
      KiddoPaint.ToolDescriptions["Record Sound"] = "Record a sound for your picture.";
      KiddoPaint.ToolDescriptions["Play Sound"] = "Play the sound on your picture.";
    }
    return { record: rec, play: play };
  }

  function ensureBadge() {
    var paint = document.getElementById("paint");
    if (!paint) return null;
    var badge = document.getElementById("kp-sound-badge");
    if (badge) return badge;
    badge = document.createElement("div");
    badge.id = "kp-sound-badge";
    badge.title = "This picture has a sound";
    badge.style.cssText = [
      "position:absolute",
      "right:8px",
      "bottom:8px",
      "width:36px",
      "height:36px",
      "background:#ffec5c",
      "border:3px solid #222",
      "border-radius:50%",
      "display:none",
      "align-items:center",
      "justify-content:center",
      "z-index:10",
      "pointer-events:none",
      "font-family:monospace",
      "font-size:18px",
      "font-weight:bold",
      "color:#222",
      "box-shadow:0 2px 4px rgba(0,0,0,0.35)",
    ].join(";");
    badge.textContent = "♪";
    // #paint is the canvas container — make it the positioning context.
    var cs = window.getComputedStyle(paint);
    if (cs.position === "static") paint.style.position = "relative";
    paint.appendChild(badge);
    return badge;
  }

  function setBadgeVisible(visible) {
    var badge = ensureBadge();
    if (!badge) return;
    badge.style.display = visible ? "flex" : "none";
  }

  function flashButton(btn, color, ms) {
    if (!btn) return;
    var prev = btn.style.boxShadow;
    btn.style.boxShadow = "0 0 0 4px " + color + " inset";
    setTimeout(function () { btn.style.boxShadow = prev; }, ms || 250);
  }

  function setRecording(btn, on) {
    if (!btn) return;
    if (on) {
      btn.classList.add("kp-recording");
      btn.style.boxShadow = "0 0 0 4px #d83a3a inset";
    } else {
      btn.classList.remove("kp-recording");
      btn.style.boxShadow = "";
    }
  }

  function showStatus(msg) {
    var sb = document.getElementById("statusbar-text");
    if (!sb) { console.log("[soundrec]", msg); return; }
    sb.textContent = "";
    var span = document.createElement("span");
    span.className = "status-name";
    span.textContent = msg;
    sb.appendChild(span);
  }

  // ---- Wiring ----------------------------------------------------------
  var state = {
    recorder: new Recorder(),
    player: new Player(),
    busy: false, // guards double-tap / concurrent record+play
    hasSound: false,
    drawingId: getDrawingId(),
  };

  function refreshBadge() {
    var meta = readMeta();
    state.hasSound = !!(meta.sound && meta.sound.drawingId === state.drawingId);
    setBadgeVisible(state.hasSound);
  }

  function attachHandlers(buttons) {
    var rec = buttons.record;
    var play = buttons.play;

    rec.addEventListener("mousedown", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (state.busy) return;
      // Toggle behavior: first press starts, second press stops.
      if (state.recorder.active) {
        state.busy = true;
        state.recorder.stop().then(function (result) {
          setRecording(rec, false);
          state.busy = false;
          if (!result || !result.blob || result.blob.size === 0) {
            showStatus("No sound captured.");
            return;
          }
          var id = state.drawingId;
          putSound(id, result.blob, result.mime).then(function () {
            var meta = readMeta();
            meta.sound = {
              drawingId: id,
              mime: result.mime,
              durationMs: null,
              savedAt: Date.now(),
            };
            writeMeta(meta);
            refreshBadge();
            flashButton(rec, "#5cd16a", 400);
            showStatus("Sound recorded.");
          }).catch(function (err) {
            console.warn("[soundrec] save failed:", err);
            showStatus("Could not save sound.");
          });
        });
        return;
      }
      // Stop any current playback before starting a new recording.
      state.player.stop();
      state.busy = true;
      state.recorder.start().then(function () {
        state.busy = false;
        setRecording(rec, true);
        showStatus("Recording… (tap mic to stop, max " + Math.round(MAX_MS / 1000) + "s).");
      }).catch(function (err) {
        state.busy = false;
        setRecording(rec, false);
        var code = err && err.name ? err.name : (err && err.message) || "error";
        if (code === "NotAllowedError" || code === "SecurityError") {
          showStatus("Mic permission denied — can't record.");
        } else if (code === "mic-unsupported" || code === "mediarecorder-unsupported") {
          showStatus("Sound recording isn't supported in this browser.");
        } else {
          showStatus("Couldn't start the mic (" + code + ").");
        }
      });
    });

    play.addEventListener("mousedown", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (state.busy) return;
      if (state.recorder.active) {
        showStatus("Stop recording before playing.");
        return;
      }
      state.busy = true;
      getSound(state.drawingId).then(function (entry) {
        state.busy = false;
        if (!entry || !entry.blob) {
          showStatus("No sound on this picture yet.");
          return;
        }
        state.player.play(entry.blob).then(function () {
          flashButton(play, "#5cd16a", 400);
        }).catch(function (err) {
          console.warn("[soundrec] playback failed:", err);
          showStatus("Couldn't play the sound (" + (err && err.message) + ").");
        });
      }).catch(function (err) {
        state.busy = false;
        console.warn("[soundrec] read failed:", err);
        showStatus("Couldn't read the saved sound.");
      });
    });
  }

  // Hook clearAll so wiping the canvas also drops the attached sound.
  var wrapAttempts = 0;
  var wrapRetryTimer = null;
  function wrapClearAll() {
    // This runs from a retry timer that can outlive the page/test environment.
    // Bail if the global is gone (e.g. jsdom teardown between test runs) so a
    // late tick can't throw "window is not defined".
    if (typeof window === "undefined") return;
    // KiddoPaint.Display.clearAll is wired by init_kiddo_paint, which runs from main.js
    // either on DOMContentLoaded or synchronously at the end of import. If it isn't
    // there yet, retry on the next tick so we don't silently miss the hook.
    if (!window.KiddoPaint || !KiddoPaint.Display || !KiddoPaint.Display.clearAll) {
      if (wrapAttempts++ < 20) wrapRetryTimer = setTimeout(wrapClearAll, 50);
      return;
    }
    if (KiddoPaint.Display._soundRecWrapped) return;
    var orig = KiddoPaint.Display.clearAll;
    KiddoPaint.Display.clearAll = function () {
      orig.apply(this, arguments);
      // New blank drawing -> new id, and drop any prior sound.
      try { localStorage.removeItem(DRAWING_ID_KEY); } catch (e) {}
      var oldId = state.drawingId;
      state.drawingId = getDrawingId();
      var meta = readMeta();
      if (meta.sound) { delete meta.sound; writeMeta(meta); }
      deleteSound(oldId);
      state.recorder.cancel();
      state.player.stop();
      refreshBadge();
    };
    KiddoPaint.Display._soundRecWrapped = true;
  }

  function cleanupAll() {
    // Cancel a still-pending clearAll-hook retry so it can't fire after unload.
    if (wrapRetryTimer !== null) {
      clearTimeout(wrapRetryTimer);
      wrapRetryTimer = null;
    }
    state.recorder.cancel();
    state.player.stop();
  }

  function boot() {
    var buttons = injectButtons();
    if (!buttons) return;
    attachHandlers(buttons);
    wrapClearAll();
    refreshBadge();

    window.addEventListener("pagehide", cleanupAll);
    window.addEventListener("beforeunload", cleanupAll);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") cleanupAll();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // Expose for tests / debugging.
  window.KiddoPaint = window.KiddoPaint || {};
  window.KiddoPaint.SoundRecording = {
    _state: state,
    pickMimeType: pickMimeType,
    readMeta: readMeta,
    writeMeta: writeMeta,
    MAX_MS: MAX_MS,
    SCHEMA_VERSION: SCHEMA_VERSION,
  };
})();
