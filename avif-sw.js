import dav1d from "dav1d.js";
import {rgba2bmp} from "./bmp";
import {avif2obu, avif2mov} from "./mov";

// Wait for client to become ready.
const waitForClient = {};

// Pending tasks.
const taskById = {};
let taskCounter = 0;

// AV1 decoder context.
let dCtx = null;

function initPolyfill(opts) {
  if (!opts.usePolyfill) return Promise.resolve();
  return dav1d.create({wasmURL: opts.wasmURL}).then(d => {
    dCtx = d;
  });
}

function setClientReady(cid) {
  if (waitForClient[cid]) {
    waitForClient[cid].resolve();
  } else {
    waitForClient[cid] = {ready: Promise.resolve(), resolve: null};
  }
}

function setClientWaiting(cid) {
  if (!waitForClient[cid]) {
    let resolve = null;
    let ready = new Promise(res => { resolve = res; });
    waitForClient[cid] = {ready, resolve};
  }
}

function resolveTask(taskId, cb) {
  const task = taskById[taskId];
  if (task) {
    task.resolve(cb(task.toBlob));
  }
}

function rejectTask(taskId, err) {
  const task = taskById[taskId];
  if (task) {
    task.reject(err);
  }
}

function arr2blob(bmpArr) {
  return new Blob([bmpArr], {type: "image/bmp"});
}

function nativeDecodeAvif(client, id, avifArr) {
  const movArr = avif2mov(avifArr);
  client.postMessage({id, type: "avif-mov", data: movArr}, [movArr]);
}

// Synchronous but that should be ok.
function polyfillDecodeAvif(client, id, avifArr) {
  const obuArr = avif2obu(avifArr).data;
  resolveTask(id, toBlob => {
    if (toBlob) {
      // console.time("dav1d "+id);
      const bmpArr = dCtx.unsafeDecodeFrameAsBMP(obuArr);
      // console.timeEnd("dav1d "+id);
      const blob = arr2blob(bmpArr);
      dCtx.unsafeCleanup();
      return blob;
    } else {
      // Will be transfered so ok to copy.
      return dCtx.decodeFrameAsBMP(obuArr);
    }
  });
}

function decodeAvif(client, id, avifArr) {
  return waitForClient[client.id].ready.then(() => {
    return dCtx ? polyfillDecodeAvif(client, id, avifArr)
                : nativeDecodeAvif(client, id, avifArr);
  });
}

// Handle job messages.
self.addEventListener("message", e => {
  const msg = e.data;
  if (!msg) return;

  switch (msg.type) {
  // Client asks for our update
  case "avif-update":
    skipWaiting();
    break;

  // Client asks to activate us right away
  case "avif-claim":
    clients.claim();
    break;

  // Client is ready
  case "avif-ready":
    initPolyfill(msg.data).then(() => setClientReady(e.source.id));
    break;

  // Client sent task result
  case "avif-rgba":
    const bmpArr = rgba2bmp(msg.data, msg.width, msg.height);
    resolveTask(msg.id, toBlob => toBlob ? arr2blob(bmpArr) : bmpArr);
    break;

  // Client sent task error
  case "avif-error":
    rejectTask(msg.id, new Error(msg.data));
    break;

  // Client sent task request
  case "avif-task":
    const client = e.source;
    const id = msg.id;
    new Promise((resolve, reject) => {
      taskById[id] = {resolve, reject, toBlob: false};
      decodeAvif(client, id, msg.data);
    }).then(bmpArr => {
      delete taskById[id];
      client.postMessage({id, type: "avif-task", data: bmpArr}, [bmpArr]);
    }, err => {
      delete taskById[id];
      client.postMessage({id, type: "avif-error", data: err.message});
    });
    break;
  }
});

// Handle AVIF requests.
// TODO(Kagami): Error reporting?
self.addEventListener("fetch", e => {
  // TODO(Kagami): Better check for AVIF. HTTP headers?
  if (e.request.url.match(/\.avif$/i)) {
    const id = taskCounter++;
    setClientWaiting(e.clientId);
    e.respondWith(new Promise((resolve, reject) => {
      taskById[id] = {resolve, reject, toBlob: true};
      clients.get(e.clientId).then(client =>
        // TODO(Kagami): Apply request headers?
        fetch(e.request.url, {credentials: "same-origin"})
          .then(res => res.arrayBuffer())
          .then(avifArr => decodeAvif(client, id, avifArr))
      ).catch(reject);
    }).then(blob => {
      delete taskById[id];
      // TODO(Kagami): Apply response metadata?
      return new Response(blob);
    }, err => {
      delete taskById[id];
      throw err;
    }));
  }
});
