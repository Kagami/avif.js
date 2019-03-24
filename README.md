<p align="center">
  <img src="https://upload.wikimedia.org/wikipedia/commons/8/84/AV1_logo_2018.svg" height="200">
  <br><b>AVIF (AV1 Still Image File Format) polyfill for the browser</b>
  <br><i>Start using superior image compression today!</i> :shipit:
  <br>:confetti_ball: :tada: <b><a href="https://kagami.github.io/avif.js/">DEMO</a></b> :tada: :confetti_ball:
  <br><a href="https://www.npmjs.com/package/avif.js"><img src="https://img.shields.io/npm/v/avif.js.svg"></a>
</p>

## Features

* Small, optional dependency, <4kb minified & gzipped
* Intercepts AVIF fetch requests so works in any scenario
* Uses native decoder if possible and should be reasonably fast

## Supported browsers

**With native decoder:**

* Chrome Desktop 70+
* Firefox 63+ (with `media.av1.enabled` activated)
* Firefox for Android 64+ (with `media.av1.enabled` and `media.av1.use-dav1d` activated)
* Edge 18+ (with `AV1 Video Extension` installed)
* Bromite 71+

**With AV1 polyfill:**

* Chrome 57+
* Firefox 53+
* Edge 17+
* Safari 11+

## Usage

```
npm install avif.js
```

```js
// Put this to reg.js and serve avif-sw.js from web root
require("avif.js").register("/avif-sw.js");
```

```html
<html>
<body>
  <!-- Register worker -->
  <script src="reg.js"></script>

  <!-- Can embed AVIF with IMG tag now -->
  <img src="image.avif">

  <!-- Or via CSS property -->
  <div style="background: url(image2.avif)">
    some content
  </div>
</body>
</html>
```

That's it! Service worker will detect all fetch requests for AVIF files and
decode them on the fly. It works with any complex scenarios of image embedding
you might have, e.g. `background-image` in external CSS or `XMLHttpRequest`
from a script.

See [demo](demo) directory for the usage example.

To generate AVIF files you may use [go-avif CLI utility](https://github.com/Kagami/go-avif#cli).

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

## Limitations of Service Worker API

* Needs to be served from HTTPS
* Doesn't work in Firefox/Edge Private Window
* Requires page reload on first visit to display static assets

## TODO

* Benchmark
* Check for AVIF support
* Support for browsers without Service Workers

## License

avif.js is licensed under [CC0](COPYING).  
Demo images are taken from [av1-avif](https://github.com/AOMediaCodec/av1-avif/tree/master/testFiles) repo.
