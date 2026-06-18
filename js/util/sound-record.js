// Voice memo: capture a short audio clip via getUserMedia + MediaRecorder and
// replay it. The clip rides along with the drawing as a sibling localStorage
// key ("kiddopaint_sound") — additive, never touches the existing canvas state
// keys ("kiddopaint", "kiddopaint_undo", "kiddopaint_redo" — see
// js/util/display.js).
//
// Public surface:
//   record(maxMs?)   -> Promise<Blob>   start recording; auto-stops at maxMs
//                                       (capped at 15s). Resolves with the
//                                       recorded blob once stop() fires or the
//                                       cap is reached.
//   stop()           -> void            stop a recording in progress.
//   playLatest()     -> HTMLAudioElement|null
//   clear()          -> void
//   isRecording()    -> boolean
//
// All methods are defensive no-ops when the browser lacks the APIs.

const STORAGE_KEY = "kiddopaint_sound";
const MAX_CLIP_MS = 15000;

let _activeRecorder = null;

function hasMediaSupport() {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined"
  );
}

function _stopStream(stream) {
  if (!stream || typeof stream.getTracks !== "function") return;
  try {
    stream.getTracks().forEach(function (t) {
      try {
        t.stop();
      } catch (e) {}
    });
  } catch (e) {}
}

function _blobToBase64(blob) {
  return new Promise(function (resolve, reject) {
    if (typeof FileReader === "undefined") {
      reject(new Error("FileReader-unavailable"));
      return;
    }
    var reader = new FileReader();
    reader.onerror = function () {
      reject(new Error("read-failed"));
    };
    reader.onload = function () {
      resolve(reader.result);
    };
    reader.readAsDataURL(blob);
  });
}

function isRecording() {
  return !!_activeRecorder;
}

function record(maxMs) {
  if (!hasMediaSupport()) {
    return Promise.reject(new Error("media-unavailable"));
  }
  if (_activeRecorder) {
    return Promise.reject(new Error("already-recording"));
  }
  var requested =
    typeof maxMs === "number" && maxMs > 0 ? maxMs : MAX_CLIP_MS;
  var cap = Math.min(requested, MAX_CLIP_MS);

  return navigator.mediaDevices.getUserMedia({ audio: true }).then(
    function (stream) {
      return new Promise(function (resolve, reject) {
        var chunks = [];
        var rec;
        try {
          rec = new MediaRecorder(stream);
        } catch (e) {
          _stopStream(stream);
          reject(new Error("recorder-construct-failed"));
          return;
        }
        _activeRecorder = rec;

        var timer = null;
        function finalize() {
          _activeRecorder = null;
          _stopStream(stream);
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
        }

        rec.ondataavailable = function (e) {
          if (e && e.data && e.data.size) chunks.push(e.data);
        };
        rec.onerror = function () {
          finalize();
          reject(new Error("recorder-error"));
        };
        rec.onstop = function () {
          var type =
            (chunks[0] && chunks[0].type) ||
            (rec && rec.mimeType) ||
            "audio/webm";
          var blob = new Blob(chunks, { type: type });
          finalize();
          _blobToBase64(blob).then(
            function (dataUrl) {
              try {
                localStorage.setItem(STORAGE_KEY, dataUrl);
              } catch (e) {}
              resolve(blob);
            },
            function (err) {
              reject(err);
            },
          );
        };

        try {
          rec.start();
        } catch (e) {
          finalize();
          reject(new Error("recorder-start-failed"));
          return;
        }

        timer = setTimeout(function () {
          if (rec && rec.state !== "inactive") {
            try {
              rec.stop();
            } catch (e) {}
          }
        }, cap);

        rec.__kpStop = function () {
          if (timer) {
            clearTimeout(timer);
            timer = null;
          }
          if (rec.state !== "inactive") {
            try {
              rec.stop();
            } catch (e) {}
          }
        };
      });
    },
    function () {
      return Promise.reject(new Error("permission-denied"));
    },
  );
}

function stop() {
  if (_activeRecorder && typeof _activeRecorder.__kpStop === "function") {
    _activeRecorder.__kpStop();
  }
}

function _readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    return null;
  }
}

function hasStored() {
  return !!_readStored();
}

function playLatest() {
  var dataUrl = _readStored();
  if (!dataUrl) return null;
  if (typeof Audio === "undefined") return null;
  var audio = new Audio(dataUrl);
  var p = audio.play();
  if (p && typeof p.catch === "function") p.catch(function () {});
  return audio;
}

function clear() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {}
}

var SoundRecord = {
  record: record,
  stop: stop,
  playLatest: playLatest,
  clear: clear,
  isRecording: isRecording,
  hasStored: hasStored,
  STORAGE_KEY: STORAGE_KEY,
  MAX_CLIP_MS: MAX_CLIP_MS,
};

if (typeof window !== "undefined") {
  window.KiddoPaint = window.KiddoPaint || {};
  window.KiddoPaint.SoundRecord = SoundRecord;
}

export {
  record,
  stop,
  playLatest,
  clear,
  isRecording,
  hasStored,
  STORAGE_KEY,
  MAX_CLIP_MS,
};
export default SoundRecord;
