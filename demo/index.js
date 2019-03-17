import avif from "../avif.js";

if ("serviceWorker" in navigator) {
  avif.register(navigator.serviceWorker.register("../avif-sw.js"));
}

document.addEventListener("DOMContentLoaded", () => {
  const loadButton = document.getElementById("load-button");
  const customItem = document.getElementById("custom-item");
  const fileInput = document.getElementById("file-input");

  function clearItems() {
    const items = document.querySelectorAll(".item:not(.user)");
    for (const item of items) {
      item.remove();
    }
  }

  function emptyCustomItem() {
    customItem.classList.toggle("hidden");
    while (customItem.firstChild) {
      customItem.firstChild.remove();
    }
  }

  // TODO(Kagami): Add this to library API.
  function sendDecodeRequest(file) {
    const reader = new FileReader();
    reader.onload = e => {
      const avifArr = e.target.result;
      navigator.serviceWorker.controller.postMessage({
        id: "demo",  // We have only single concurrent task so doesn't matter
        type: "avif-task",
        data: avifArr,
      }, [avifArr]);
    };
    reader.readAsArrayBuffer(file);
  }

  function showCustomImage(bmpArr) {
    const img = document.createElement("img");
    const blob = new Blob([bmpArr], {type: "image/bmp"});
    img.className = "user-img";
    img.src = URL.createObjectURL(blob);
    customItem.appendChild(img);
    customItem.classList.toggle("hidden");
    loadButton.disabled = false;
  }

  loadButton.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", () => {
    loadButton.disabled = true;
    clearItems();
    emptyCustomItem();
    sendDecodeRequest(fileInput.files[0]);
    fileInput.value = null;  // Allow to select same value second time
  });

  navigator.serviceWorker.addEventListener("message", e => {
    const msg = e.data;
    if (msg && msg.type === "avif-task") {
      showCustomImage(msg.data);
    }
  });
});
