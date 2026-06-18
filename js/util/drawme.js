// KiddoPaint.DrawMe — silly-scene prompt generator.
// composePrompt is a pure function: same rng + data => same string.
// rng may be a function returning [0,1) or an object with .next().

(function (root) {
  var REQUIRED_KEYS = ["adjectives", "subjects", "verbs", "objects", "settings"];

  function nextFloat(rng) {
    if (typeof rng === "function") return rng();
    if (rng && typeof rng.next === "function") return rng.next();
    throw new Error("drawme: rng must be a function or have .next()");
  }

  function pick(rng, arr, key) {
    if (!Array.isArray(arr) || arr.length === 0) {
      throw new Error("drawme: data." + key + " must be a non-empty array");
    }
    var r = nextFloat(rng);
    var idx = Math.floor(r * arr.length);
    if (idx < 0) idx = 0;
    if (idx >= arr.length) idx = arr.length - 1;
    return arr[idx];
  }

  function startsWithVowelSound(word) {
    return /^[aeiouAEIOU]/.test(String(word).trim());
  }

  function composePrompt(rng, data) {
    if (!data || typeof data !== "object") {
      throw new Error("drawme: data is required");
    }
    for (var i = 0; i < REQUIRED_KEYS.length; i++) {
      var k = REQUIRED_KEYS[i];
      if (!Array.isArray(data[k]) || data[k].length === 0) {
        throw new Error("drawme: data." + k + " must be a non-empty array");
      }
    }
    var adjective = pick(rng, data.adjectives, "adjectives");
    var subject = pick(rng, data.subjects, "subjects");
    var verb = pick(rng, data.verbs, "verbs");
    var object = pick(rng, data.objects, "objects");
    var setting = pick(rng, data.settings, "settings");

    var article = startsWithVowelSound(adjective) ? "an" : "a";
    return (
      "Draw " +
      article +
      " " +
      adjective +
      " " +
      subject +
      " " +
      verb +
      " " +
      object +
      " " +
      setting +
      "!"
    );
  }

  var api = { composePrompt: composePrompt };

  if (root && root.KiddoPaint) {
    root.KiddoPaint.DrawMe = Object.assign(root.KiddoPaint.DrawMe || {}, api);
  }

  if (typeof module !== "undefined" && typeof module.exports !== "undefined") {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
