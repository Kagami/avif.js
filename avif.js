// Decode AVIF data using native browser's AV1 decoder.
const isEdge = navigator.userAgent.indexOf("Edge") >= 0;
function decodeMov(arr) {
  const blob = new Blob([arr], {type: "video/mp4"});
  const blobURL = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    // TODO(Kagami): Check support for AV1.
    const vid = document.createElement("video");
    vid.addEventListener(isEdge ? "ended" : "loadeddata", () => {
      if ((vid.mozDecodedFrames == null ||
           vid.mozDecodedFrames > 0)
          &&
          (vid.webkitDecodedFrameCount == null ||
           vid.webkitDecodedFrameCount > 0)) {
        resolve(vid);
      } else {
        reject(new Error("partial AV1 frame"));
      }
    });
    vid.addEventListener("error", () => {
      reject(new Error("cannot decode AV1 frame"));
    });
    vid.muted = true;
    vid.src = blobURL;
    if (isEdge) {
      vid.play();
    }
  }).then(vid => {
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    c.width = vid.videoWidth;
    c.height = vid.videoHeight;
    ctx.drawImage(vid, 0, 0, c.width, c.height);
    const imgData = ctx.getImageData(0, 0, c.width, c.height);
    return {
      width: c.width,
      height: c.height,
      data: imgData.data.buffer,
    }
  }).then(res => {
    URL.revokeObjectURL(blobURL);
    return res;
  }, err => {
    URL.revokeObjectURL(blobURL);
    throw err;
  });
}

// Respond to job requests from worker.
export function onMessage(e) {
  const msg = e.data;
  if (msg && msg.type === "avif-mov") {
    decodeMov(msg.data).then(decoded => {
      navigator.serviceWorker.controller.postMessage({
        id: msg.id,
        type: "avif-rgba",
        ...decoded
      }, [decoded.data]);
    }, err => {
      navigator.serviceWorker.controller.postMessage({
        id: msg.id,
        type: "avif-error",
        data: err.toString(),
      });
    });
  }
}

// See https://redfin.engineering/how-to-fix-the-refresh-button-when-using-service-workers-a8e27af6df68
// for the Service Worker update best practices.
export function register(regPromise, opts) {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service Worker API is not supported");
  }

  if (typeof opts === "function") {
    opts = {confirmUpdate: opts};
  }
  opts = Object.assign({
    confirmUpdate: () => true,
    onUpdate: () => window.location.reload(),
  }, opts);

  if (typeof regPromise === "string") {
    const regOpts = opts.scope ? {scope: opts.scope} : undefined;
    regPromise = navigator.serviceWorker.register(regPromise, regOpts);
  }
  regPromise.then(reg => {
    let refreshing = false;
    function refresh() {
      if (refreshing) return;
      refreshing = true;
      opts.onUpdate(reg);
    }
    function promptUserToRefresh() {
      Promise.resolve(opts.confirmUpdate(reg)).then(shouldUpdate => {
        if (shouldUpdate) {
          if (navigator.serviceWorker.controller) {
            reg.waiting.postMessage({type: "avif-update"});
          } else {
            refresh();
          }
        }
      });
    }
    function awaitStateChange() {
      const waitFor = navigator.serviceWorker.controller ? "installed" : "activated";
      reg.installing.addEventListener("statechange", function() {
        if (this.state === waitFor) promptUserToRefresh();
      });
    }

    navigator.serviceWorker.addEventListener("controllerchange", refresh);
    navigator.serviceWorker.addEventListener("message", onMessage);
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({type: "avif-ready"});
    }

    if (reg.waiting) return promptUserToRefresh();
    reg.addEventListener("updatefound", awaitStateChange);
  });
}

export default {onMessage, register};
