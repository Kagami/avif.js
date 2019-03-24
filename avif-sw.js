import {avif2mov} from "./mov";
import {rgba2bmp} from "./bmp";

// Wait for client to become ready.
const waitForClient = {};

// Pending tasks.
const taskById = {};
let taskCounter = 0;

// Do preparation work and pass job request to DOM context.
function decodeAvif(id, req, client) {
  // TODO(Kagami): Apply request headers?
  return fetch(req.url, {credentials: "same-origin"})
    .then(res => res.arrayBuffer())
    .then(avifArr => {
      const movArr = avif2mov(avifArr);
      waitForClient[client.id].ready.then(() => {
        client.postMessage({id, type: "avif-mov", data: movArr}, [movArr]);
      });
    });
}

// Handle job messages.
self.addEventListener("message", e => {
  const msg = e.data;
  if (!msg) return;
  if (msg.type === "avif-update") {
    skipWaiting();
  } else if (msg.type === "avif-claim") {
    clients.claim();
  } else if (msg.type === "avif-ready") {
    const cid = e.source.id;
    if (waitForClient[cid]) {
      waitForClient[cid].resolve();
    } else {
      waitForClient[cid] = {ready: Promise.resolve(), resolve: null};
    }
  } else if (msg.type === "avif-rgba") {
    const bmpArr = rgba2bmp(msg.data, msg.width, msg.height);
    taskById[msg.id] && taskById[msg.id].resolve(bmpArr);
  } else if (msg.type === "avif-error") {
    taskById[msg.id] && taskById[msg.id].reject(new Error(msg.data));
  } else if (msg.type === "avif-task") {
    const client = e.source;
    const id = msg.id;
    const avifArr = msg.data;
    new Promise((resolve, reject) => {
      taskById[id] = {resolve, reject};
      const movArr = avif2mov(avifArr);
      client.postMessage({id, type: "avif-mov", data: movArr}, [movArr]);
    }).then(bmpArr => {
      delete taskById[id];
      client.postMessage({id, type: "avif-task", data: bmpArr}, [bmpArr]);
    }, err => {
      delete taskById[id];
      client.postMessage({id, type: "avif-error", data: err.message});
    });
  }
});

// Handle AVIF requests.
// TODO(Kagami): Error reporting?
self.addEventListener("fetch", e => {
  const cid = e.clientId;
  // TODO(Kagami): Better check for AVIF. HTTP headers?
  if (e.request.url.match(/\.avif$/i)) {
    if (!waitForClient[cid]) {
      let resolve = null;
      let ready = new Promise(res => { resolve = res; });
      waitForClient[cid] = {ready, resolve};
    }
    const id = taskCounter++;
    e.respondWith(new Promise((resolve, reject) => {
      taskById[id] = {resolve, reject};
      clients.get(cid)
        .then(client => decodeAvif(id, e.request, client))
        .catch(reject);
    }).then(bmpArr => {
      const blob = new Blob([bmpArr], {type: "image/bmp"});
      // TODO(Kagami): Apply response metadata?
      return new Response(blob);
    }).then(res => {
      delete taskById[id];
      return res;
    }, err => {
      delete taskById[id];
      throw err;
    }));
  }
});
