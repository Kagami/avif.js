// TODO(Kagami): Check support for AVIF.
if ("serviceWorker" in navigator) {

  // Decode AVIF data using native browser's AV1 decoder.
  const decodeMov = arr => {
    const blob = new Blob([arr], {type: "video/mp4"});
    const blobURL = URL.createObjectURL(blob);
    return new Promise((resolve, reject) => {
      // TODO(Kagami): Check support for AV1.
      const vid = document.createElement("video");
      vid.muted = true;
      vid.onloadeddata = () => {
        if ((vid.mozDecodedFrames == null ||
             vid.mozDecodedFrames > 0)
            &&
            (vid.webkitDecodedFrameCount == null ||
             vid.webkitDecodedFrameCount > 0)) {
          resolve(vid);
        } else {
          reject(new Error("partial AV1 frame"));
        }
      };
      vid.onerror = () => {
        reject(new Error("cannot decode AV1 frame"));
      };
      vid.src = blobURL;
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
  };

  // Respond to job requests from worker because it can't decode using
  // <video> by itself.
  navigator.serviceWorker.addEventListener("message", e => {
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
  });

}
