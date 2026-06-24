// Wacky Cam — modal UI: live device camera → take a crisp photo onto the canvas.
//
// The device camera (getUserMedia) feeds a visible <video> shown at its native
// resolution, so the preview and the captured photo are sharp. "Take photo"
// grabs the current frame and pastes it into the main picture; from there kids
// use the existing Mixer tool for wacky whole-picture effects.
//
// Lives alongside the legacy tool engine but does not register itself as a
// Toolbox tool. The toolbar button just opens a modal; pointer events on the
// main canvas still go to whichever Kid Pix tool was last selected.
//
// NOTE: the internal namespace stays KiddoPaint.WackyTV for continuity with
// the toolbar wiring and tests; only the user-facing tool is now a camera.

window.KiddoPaint = window.KiddoPaint || {};
KiddoPaint.WackyTV = KiddoPaint.WackyTV || {};

// --- Procedural CC0 sample (no-camera fallback) -------------------------
// Generated on demand from a canvas + captureStream(). Used only when the
// real camera can't start (desktop with no webcam, blocked permission), so
// the tool still does *something* you can snap.
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
    ctx.fillText("WACKY CAM ✺ CC0", 16, 220);
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

// --- Module state --------------------------------------------------------
var modalEl = null;
var videoEl = null; // visible live preview, shown at native resolution
var sampleStream = null; // kept alive across opens
var cameraStream = null; // live getUserMedia stream (stopped on close)
var facingMode = "user"; // "user" = selfie, "environment" = rear
var statusEl = null; // permission / no-camera hint line
var demoBtn = null; // fallback button, shown only if the camera fails

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

// Request the device camera and pipe it into the visible <video>. We stop any
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
    .getUserMedia({
      video: {
        facingMode: facingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    })
    .then(function (stream) {
      cameraStream = stream;
      videoEl.srcObject = stream;
      var p = videoEl.play();
      if (p && p.catch) p.catch(function () {});
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
    videoEl.srcObject = sampleStream;
    videoEl.play().catch(function () {});
    setStatus("Showing the demo picture (no camera).", false);
  }
}

// --- Modal construction --------------------------------------------------
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

  // Live preview = the camera <video> shown crisp at native resolution.
  videoEl = document.createElement("video");
  videoEl.muted = true; // required (with playsInline) for autoplay on iOS
  videoEl.autoplay = true;
  videoEl.playsInline = true;
  videoEl.style.cssText =
    "display:block;width:100%;max-width:512px;height:auto;background:#000;border:3px solid #000;border-radius:4px;margin:0 auto 12px;";
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

  // Hidden until the camera fails; lets you keep playing with the demo feed.
  demoBtn = document.createElement("button");
  demoBtn.textContent = "▶ Demo";
  styleBtn(demoBtn);
  demoBtn.style.display = "none";
  demoBtn.onclick = startSample;
  controls.appendChild(demoBtn);

  body.appendChild(controls);

  // Capture button
  var captureBtn = document.createElement("button");
  captureBtn.textContent = "📸 Take photo → picture";
  styleBtn(captureBtn);
  captureBtn.style.background = "linear-gradient(180deg,#ffd166,#ffa500)";
  captureBtn.style.fontSize = "1.1em";
  captureBtn.style.width = "100%";
  captureBtn.onclick = captureFrame;
  body.appendChild(captureBtn);

  // Hint: effects now live in the existing Mixer tool, post-capture.
  var hint = document.createElement("div");
  hint.style.cssText =
    "margin-top:10px;font-size:0.85em;color:#555;text-align:center;";
  hint.textContent = "Tip: after you snap, use the Mixer tool for wacky effects!";
  body.appendChild(hint);

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

// --- Capture -------------------------------------------------------------
// Grab the current camera frame at its native resolution and paste it into
// the main picture, then close so the kid lands back on the canvas.
function captureFrame() {
  if (!videoEl || videoEl.readyState < 2 || !videoEl.videoWidth) {
    setStatus("Camera isn't ready yet — give it a second.", true);
    return;
  }
  var w = videoEl.videoWidth;
  var h = videoEl.videoHeight;
  var off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  var octx = off.getContext("2d", { willReadFrequently: true });
  octx.drawImage(videoEl, 0, 0, w, h);

  var frame;
  try {
    frame = octx.getImageData(0, 0, w, h);
  } catch (e) {
    // Tainted canvas (cross-origin demo source, etc.) — can't read pixels.
    setStatus("Couldn't read the photo (security).", true);
    return;
  }

  KiddoPaint.WackyTV.pasteImageDataToMain(frame);
  if (KiddoPaint.Sounds && typeof KiddoPaint.Sounds.stamp === "function") {
    KiddoPaint.Sounds.stamp();
  }
  closeModal();
}

// --- Open / close --------------------------------------------------------
function openModal() {
  if (!modalEl) modalEl = buildModal();
  modalEl.style.display = "flex";
  // Ask for the camera as soon as the modal opens — this is a photo tool, so
  // the live feed should be there waiting. Permission prompt happens here.
  startCamera(facingMode);
}

function closeModal() {
  if (!modalEl) return;
  modalEl.style.display = "none";
  if (videoEl) videoEl.pause();
  // Release the camera so the hardware indicator light turns off.
  stopCamera();
}

KiddoPaint.WackyTV.open = openModal;
KiddoPaint.WackyTV.close = closeModal;
KiddoPaint.WackyTV.captureFrame = captureFrame;
