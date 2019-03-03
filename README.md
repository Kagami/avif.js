# avif.js [![npm](https://img.shields.io/npm/v/avif.js.svg)](https://www.npmjs.com/package/avif.js)

## Features

## Supported browsers

* Chrome 70+
* Firefox 65+ (with `media.av1.enabled` enabled)
* Edge 18+ (with `AV1 Video Extension` installed)

After AV1 decoder polyfill is implemented, Safari and elder browsers should
work too.

## Usage

```
npm install avif.js --save
```

```html
<head>
  <script src="avif.js"></script>
  <script>
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("avif-sw.js");
    }
  </script>
</head>

<body>
  <img src="image.avif">
  <div style="background: url(image2.avif); height: 100%"></div>
</body>
```

That's it! Service worker will detect all fetch requests for AVIF files and
decode them on the fly. It works with any complex scenarios of image embedding
you might have, e.g. `background-color` in external CSS or `XMLHttpRequest` in
a script.

If you already have Service Worker, simply add `importScripts("avif-sw.js")` to
its code instead of registering a new one.

See [demo](demo) directory for an example usage.

## Technical details for nerds

## TODO

* Check for AVIF support
* Support for browsers without Service Workers
* Use full-blown decoder for browsers without AV1 support

## License

[CC0](COPYING).
