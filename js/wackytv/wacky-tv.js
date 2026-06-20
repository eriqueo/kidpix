// Wacky TV — modal UI: video element → effect adapter → preview → capture.
//
// Lives alongside the legacy tool engine but does not register itself as a
// Toolbox tool. The toolbar button just opens a modal; pointer events on the
// main canvas still go to whichever Kid Pix tool was last selected.

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

// --- Procedural CC0 sample ----------------------------------------------
// Generated on demand from a canvas + captureStream(). Two bouncing colour
// squares so there's enough motion / colour variety to see effects working.
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
  h2.textContent = "📺 Wacky TV";
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

  // Controls row
  var controls = document.createElement("div");
  controls.style.cssText =
    "display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px;";

  var fileBtn = document.createElement("button");
  fileBtn.textContent = "Load a video…";
  styleBtn(fileBtn);
  var fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "video/*";
  fileInput.style.display = "none";
  fileInput.onchange = function (e) {
    var f = e.target.files && e.target.files[0];
    if (f) {
      var url = URL.createObjectURL(f);
      videoEl.srcObject = null;
      videoEl.src = url;
      videoEl.play().catch(function () {});
    }
  };
  fileBtn.onclick = function () {
    fileInput.click();
  };
  controls.appendChild(fileBtn);
  controls.appendChild(fileInput);

  var sampleBtn = document.createElement("button");
  sampleBtn.textContent = "▶ Sample";
  styleBtn(sampleBtn);
  sampleBtn.onclick = function () {
    if (!sampleStream) sampleStream = makeSampleStream();
    if (sampleStream) {
      videoEl.removeAttribute("src");
      videoEl.srcObject = sampleStream;
      videoEl.play().catch(function () {});
    }
  };
  controls.appendChild(sampleBtn);

  var playBtn = document.createElement("button");
  playBtn.textContent = "⏯";
  styleBtn(playBtn);
  playBtn.onclick = function () {
    if (videoEl.paused) videoEl.play().catch(function () {});
    else videoEl.pause();
  };
  controls.appendChild(playBtn);

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
  captureBtn.textContent = "📸 Capture frame → picture";
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
}

function closeModal() {
  if (!modalEl) return;
  modalEl.style.display = "none";
  if (rafHandle) cancelAnimationFrame(rafHandle);
  rafHandle = null;
  if (videoEl) videoEl.pause();
}

KiddoPaint.WackyTV.open = openModal;
KiddoPaint.WackyTV.close = closeModal;
KiddoPaint.WackyTV.captureFrame = captureFrame;
