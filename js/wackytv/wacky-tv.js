// Wacky Cam — modal UI: live camera → effect adapter → preview → take photo.
//
// The device camera (getUserMedia) feeds a hidden <video>; the render loop
// samples it, applies the selected Mixer-style effect, and the capture button
// freezes the current frame into the main picture so kids can draw on it.
//
// Lives alongside the legacy tool engine but does not register itself as a
// Toolbox tool. The toolbar button just opens a modal; pointer events on the
// main canvas still go to whichever Kid Pix tool was last selected.
//
// NOTE: the internal namespace stays KiddoPaint.WackyTV for continuity with
// the toolbar wiring and tests; only the user-facing tool is now a camera.

window.KiddoPaint = window.KiddoPaint || {};
KiddoPaint.WackyTV = KiddoPaint.WackyTV || {};

// Capped scratch size for the effect pipeline. Picture aspect-ish, low
// enough that an O(n) effect runs comfortably inside a 66ms tick on a
// laptop. See docs/wacky-tv-design.md.
var SCRATCH_W = 256;
var SCRATCH_H = 192;
// Effects re-render at 15fps; the underlying <video> keeps playing at its
// own framerate, we just sample it less often.
var TICK_MS = 66;

KiddoPaint.WackyTV.SCRATCH_W = SCRATCH_W;
KiddoPaint.WackyTV.SCRATCH_H = SCRATCH_H;

// --- Procedural CC0 sample (no-camera fallback) -------------------------
// Generated on demand from a canvas + captureStream(). Used only when the
// real camera can't start (desktop with no webcam, blocked permission), so
// the tool still does *something* and the effects remain visible.
function makeSampleStream() {
  var c = document.createElement("canvas");
  c.width = 320;
  c.height = 240;
  var ctx = c.getContext("2d");
  var t0 = performance.now();

  function frame() {
    var t = (performance.now() - t0) / 1000;
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, c.width, c.height);

    // Big sun
    ctx.fillStyle = "#ffd166";
    var sx = 80 + Math.sin(t * 1.3) * 60;
    var sy = 70 + Math.cos(t * 0.9) * 30;
    ctx.beginPath();
    ctx.arc(sx, sy, 36, 0, Math.PI * 2);
    ctx.fill();

    // Bouncing rainbow rectangles
    var palette = ["#ef476f", "#06d6a0", "#118ab2", "#f78c6b", "#c0a8ff"];
    for (var i = 0; i < 5; i++) {
      var phase = t * (1.0 + i * 0.4) + i;
      var x = 40 + ((Math.sin(phase) + 1) / 2) * (c.width - 80);
      var y = 140 + Math.cos(phase * 1.7) * 40;
      ctx.fillStyle = palette[i];
      ctx.fillRect(x - 14, y - 14, 28, 28);
    }
    // Marquee text
    ctx.fillStyle = "#fff";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText("WACKY TV ✺ CC0", 16, 220);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // captureStream is the standard MediaStream-from-canvas API; falls back
  // to mozCaptureStream on older Firefox builds.
  if (typeof c.captureStream === "function") {
    return c.captureStream(30);
  }
  if (typeof c.mozCaptureStream === "function") {
    return c.mozCaptureStream(30);
  }
  return null;
}

// --- Modal construction --------------------------------------------------
var modalEl = null;
var rafHandle = null;
var lastTick = 0;
var currentEffect = "none";
var scratchCanvas = null;
var scratchCtx = null;
var previewCanvas = null;
var previewCtx = null;
var videoEl = null;
var sampleStream = null; // kept alive across opens
var lastEffectedImageData = null;
var cameraStream = null; // live getUserMedia stream (stopped on close)
var facingMode = "user"; // "user" = selfie, "environment" = rear
var statusEl = null; // permission / no-camera hint line
var demoBtn = null; // fallback button, shown only if the camera fails
var freezeBtn = null; // live/freeze toggle, relabelled on state change

// --- Camera lifecycle ----------------------------------------------------
function setStatus(msg, isError) {
  if (!statusEl) return;
  statusEl.textContent = msg || "";
  statusEl.style.display = msg ? "block" : "none";
  statusEl.style.background = isError ? "#ffd6d6" : "#fff3cd";
}

// Stop all live tracks so the camera indicator light turns off. Safe to call
// when no stream is open.
function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(function (t) {
      t.stop();
    });
    cameraStream = null;
  }
  if (videoEl) videoEl.srcObject = null;
}

// Request the device camera and pipe it into the hidden <video>. We stop any
// existing stream first so a fresh request honours the requested facingMode
// (soft constraint — falls back gracefully if the device lacks that camera).
function startCamera(facing) {
  facingMode = facing || facingMode;

  // getUserMedia only exists in a secure context (https or localhost). On a
  // plain http:// LAN address (e.g. testing on an iPad) it's undefined.
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus("Camera needs https (or localhost). This page can't open it.", true);
    if (demoBtn) demoBtn.style.display = "";
    return;
  }

  setStatus("Starting camera…", false);
  stopCamera();
  navigator.mediaDevices
    .getUserMedia({ video: { facingMode: facingMode }, audio: false })
    .then(function (stream) {
      cameraStream = stream;
      videoEl.removeAttribute("src");
      videoEl.srcObject = stream;
      var p = videoEl.play();
      if (p && p.catch) p.catch(function () {});
      if (freezeBtn) freezeBtn.textContent = "⏸ Freeze";
      if (demoBtn) demoBtn.style.display = "none";
      setStatus("", false);
    })
    .catch(function (err) {
      var name = err && err.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        setStatus("Camera blocked. Allow it in your browser, then tap Start.", true);
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setStatus("No camera found on this device.", true);
      } else {
        setStatus("Couldn't start the camera: " + ((err && err.message) || name), true);
      }
      if (demoBtn) demoBtn.style.display = "";
    });
}

// No-camera fallback: drive the preview from the procedural sample stream.
function startSample() {
  stopCamera();
  if (!sampleStream) sampleStream = makeSampleStream();
  if (sampleStream) {
    videoEl.removeAttribute("src");
    videoEl.srcObject = sampleStream;
    videoEl.play().catch(function () {});
    if (freezeBtn) freezeBtn.textContent = "⏸ Freeze";
    setStatus("Showing the demo picture (no camera).", false);
  }
}

function buildModal() {
  var overlay = document.createElement("div");
  overlay.id = "wacky-tv-modal";
  overlay.className = "modal-overlay";
  overlay.style.display = "none";

  var content = document.createElement("div");
  content.className = "modal-content";
  content.style.maxWidth = "560px";

  var header = document.createElement("div");
  header.className = "modal-header";
  var h2 = document.createElement("h2");
  h2.textContent = "📷 Wacky Cam";
  var closeBtn = document.createElement("button");
  closeBtn.className = "close-btn";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.innerHTML = "&times;";
  closeBtn.onclick = closeModal;
  header.appendChild(h2);
  header.appendChild(closeBtn);

  var body = document.createElement("div");
  body.className = "modal-body";
  body.style.fontFamily = "sans-serif";

  // Preview canvas
  previewCanvas = document.createElement("canvas");
  previewCanvas.width = SCRATCH_W;
  previewCanvas.height = SCRATCH_H;
  previewCanvas.className = "pixelated";
  previewCanvas.style.cssText =
    "display:block;width:100%;max-width:512px;height:auto;background:#000;border:3px solid #000;margin:0 auto 12px;image-rendering:pixelated;";
  previewCtx = previewCanvas.getContext("2d");
  previewCtx.imageSmoothingEnabled = false;
  body.appendChild(previewCanvas);

  // Hidden scratch canvas for getImageData
  scratchCanvas = document.createElement("canvas");
  scratchCanvas.width = SCRATCH_W;
  scratchCanvas.height = SCRATCH_H;
  scratchCtx = scratchCanvas.getContext("2d", { willReadFrequently: true });
  scratchCtx.imageSmoothingEnabled = false;

  // Hidden video element
  videoEl = document.createElement("video");
  videoEl.muted = true; // muted by default per spec
  videoEl.autoplay = true;
  videoEl.playsInline = true;
  videoEl.loop = true;
  videoEl.style.display = "none";
  body.appendChild(videoEl);

  // Status / hint line — camera permission, no-camera, https reminders.
  statusEl = document.createElement("div");
  statusEl.style.cssText =
    "display:none;margin:0 0 10px;padding:6px 10px;border:2px solid #000;border-radius:4px;background:#fff3cd;font-weight:bold;text-align:center;";
  body.appendChild(statusEl);

  // Controls row
  var controls = document.createElement("div");
  controls.style.cssText =
    "display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px;";

  // Start / retry the camera.
  var startBtn = document.createElement("button");
  startBtn.textContent = "📷 Start camera";
  styleBtn(startBtn);
  startBtn.onclick = function () {
    startCamera(facingMode);
  };
  controls.appendChild(startBtn);

  // Flip between selfie ("user") and rear ("environment") cameras.
  var flipBtn = document.createElement("button");
  flipBtn.textContent = "🔄 Flip";
  styleBtn(flipBtn);
  flipBtn.onclick = function () {
    startCamera(facingMode === "user" ? "environment" : "user");
  };
  controls.appendChild(flipBtn);

  // Freeze the live feed to line up a shot, then take the photo.
  freezeBtn = document.createElement("button");
  freezeBtn.textContent = "⏸ Freeze";
  styleBtn(freezeBtn);
  freezeBtn.onclick = function () {
    if (!videoEl) return;
    if (videoEl.paused) {
      videoEl.play().catch(function () {});
      freezeBtn.textContent = "⏸ Freeze";
    } else {
      videoEl.pause();
      freezeBtn.textContent = "▶ Live";
    }
  };
  controls.appendChild(freezeBtn);

  // Hidden until the camera fails; lets you keep playing with the demo feed.
  demoBtn = document.createElement("button");
  demoBtn.textContent = "▶ Demo";
  styleBtn(demoBtn);
  demoBtn.style.display = "none";
  demoBtn.onclick = startSample;
  controls.appendChild(demoBtn);

  body.appendChild(controls);

  // Effect selector
  var effectRow = document.createElement("div");
  effectRow.style.cssText = "margin-bottom:12px;";
  var label = document.createElement("label");
  label.textContent = "Effect: ";
  label.style.cssText = "font-weight:bold;margin-right:6px;";
  var select = document.createElement("select");
  select.style.cssText =
    "padding:4px 8px;border:2px solid #000;border-radius:4px;background:#fff;";
  KiddoPaint.WackyTV.EFFECTS.forEach(function (e) {
    var opt = document.createElement("option");
    opt.value = e;
    opt.textContent = e;
    select.appendChild(opt);
  });
  select.onchange = function () {
    currentEffect = select.value;
  };
  effectRow.appendChild(label);
  effectRow.appendChild(select);
  body.appendChild(effectRow);

  // Capture button
  var captureBtn = document.createElement("button");
  captureBtn.textContent = "📸 Take photo → picture";
  styleBtn(captureBtn);
  captureBtn.style.background = "linear-gradient(180deg,#ffd166,#ffa500)";
  captureBtn.style.fontSize = "1.1em";
  captureBtn.onclick = captureFrame;
  body.appendChild(captureBtn);

  content.appendChild(header);
  content.appendChild(body);
  overlay.appendChild(content);
  document.body.appendChild(overlay);
  return overlay;
}

function styleBtn(btn) {
  btn.style.cssText =
    "padding:6px 14px;border:3px solid #000;border-radius:4px;background:#fff;font-weight:bold;cursor:pointer;font-family:inherit;";
}

// --- Render loop ---------------------------------------------------------
function tick(now) {
  if (!modalEl || modalEl.style.display === "none") return;
  rafHandle = requestAnimationFrame(tick);
  if (now - lastTick < TICK_MS) return;
  lastTick = now;

  // Only draw if the video has frames. readyState >= 2 = HAVE_CURRENT_DATA.
  if (!videoEl || videoEl.readyState < 2 || videoEl.videoWidth === 0) return;

  try {
    scratchCtx.drawImage(videoEl, 0, 0, SCRATCH_W, SCRATCH_H);
    var raw = scratchCtx.getImageData(0, 0, SCRATCH_W, SCRATCH_H);
    var effected = KiddoPaint.WackyTV.applyEffect(raw, currentEffect);
    previewCtx.putImageData(effected, 0, 0);
    lastEffectedImageData = effected;
  } catch (e) {
    // CORS / decode glitch — skip this frame rather than killing the loop.
    console.warn("WackyTV tick skipped:", e && e.message);
  }
}

function captureFrame() {
  if (!lastEffectedImageData) return;
  KiddoPaint.WackyTV.pasteImageDataToMain(lastEffectedImageData);
  if (KiddoPaint.Sounds && typeof KiddoPaint.Sounds.stamp === "function") {
    KiddoPaint.Sounds.stamp();
  }
}

// --- Open / close --------------------------------------------------------
function openModal() {
  if (!modalEl) modalEl = buildModal();
  modalEl.style.display = "flex";
  lastTick = 0;
  rafHandle = requestAnimationFrame(tick);
  // Ask for the camera as soon as the modal opens — this is a photo tool, so
  // the live feed should be there waiting. Permission prompt happens here.
  startCamera(facingMode);
}

function closeModal() {
  if (!modalEl) return;
  modalEl.style.display = "none";
  if (rafHandle) cancelAnimationFrame(rafHandle);
  rafHandle = null;
  if (videoEl) videoEl.pause();
  // Release the camera so the hardware indicator light turns off.
  stopCamera();
}

KiddoPaint.WackyTV.open = openModal;
KiddoPaint.WackyTV.close = closeModal;
KiddoPaint.WackyTV.captureFrame = captureFrame;
