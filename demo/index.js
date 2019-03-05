import avif from "../avif.js";

if ("serviceWorker" in navigator) {
  avif.register(navigator.serviceWorker.register("../avif-sw.js"));
}
