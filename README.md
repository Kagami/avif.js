<p align="center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/8/84/AV1_logo_2018.svg" height="300">
</p>

# avif.js [![npm](https://img.shields.io/npm/v/avif.js.svg)](https://www.npmjs.com/package/avif.js)

[AVIF](https://aomediacodec.github.io/av1-avif/) (AV1 Still Image File Format)
polyfill for the browser.

*Start using superior image compression today!*
:confetti_ball: :tada: **[DEMO](https://kagami.github.io/avif.js/)** :tada: :confetti_ball:

## Features

* Small size, no dependencies, <2kb minified & gzipped
* Intercepts AVIF fetch requests so works in any scenario
* Uses native browser decoder and should be reasonably fast

## Supported browsers

* Chrome 70+
* Firefox 65+ (with `media.av1.enabled` activated)
* Edge 18+ (with `AV1 Video Extension` installed)

After AV1 polyfill is implemented, Safari and elder browsers should
work too.

## Usage

```
npm install avif.js
```

```html
<head>
  <!-- Include library code -->
  <script src="avif.js"></script>
  <!-- Register worker -->
  <script>
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("avif-sw.js");
    }
  </script>
</head>

<body>
  <!-- Normal image tag works as expected -->
  <img src="image.avif">

  <!-- So do CSS properties -->
  <div style="background: url(image2.avif)">
    some content inside
  </div>
</body>
```

That's it! Service worker will detect all fetch requests for AVIF files and
decode them on the fly. It works with any complex scenarios of image embedding
you might have, e.g. `background-image` in external CSS or `XMLHttpRequest`
from a script.

If you already have Service Worker, simply add `importScripts("avif-sw.js")` to
its code instead of registering a new one.

See [demo](demo) directory for the usage example.

## Technical details for nerds

AVIF file is basically an AV1 keyframe packed inside ISOBMFF container, almost
identical to the HEIF structure, except AV1 video format instead of HEVC is
used. Latest versions of Chrome and Firefox support AV1 video decoding, but
still can't display AVIF images, it usually takes some time before new format
will be added. See e.g. [Firefox issue](https://bugzilla.mozilla.org/show_bug.cgi?id=1443863).

Though abovementioned technical aspects of AVIF make it quite easy to implement
as a tiny polyfill. All we need to do is repack AVIF as a single-frame AV1
video and decode it using native decoder. This is exactly what avif.js does.
First it fetches the AVIF file into binary buffer, then parses the ISOBMFF
structure, then searches and extracts the actual frame data (OBUs) and finally
embeds it into MP4 video file. Now we can decode that video with standard
`<video>` element and dump raw pixel data to temporary `<canvas>`.

Instead of forcing users to call some function every time they need to display
AVIF file, fetch event interceptor powered by
[Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
is used. It allows us to replace image data that browser doesn't know how to
decode with some known one. avif.js uses BMP to avoid spending time on second
compression of already decoded pixel data. It's very fast operation, we just
need to write BMP header and copy color values in order. Finally we can deliver
that created on the fly .bmp back to the browser and our image will appear on
the page.

The actual process is a bit more complex, e.g. we can't create `<video>`
element in a worker, so pass decoding request to the main thread and get result
back. Also container fields of the video should correspond to properties of the
still image, some offsets need to be fixed and so on. But you got the general
idea.

## TODO

* Benchmark
* Check for AVIF support
* Support for browsers without Service Workers
* Use full-blown decoder for browsers without AV1 support

## License

avif.js is licensed under [CC0](COPYING).  
Demo images are taken from [av1-avif](https://github.com/AOMediaCodec/av1-avif/tree/master/testFiles) repo.
