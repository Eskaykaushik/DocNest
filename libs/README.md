This folder is reserved for locally vendored copies of marked.js and
highlight.js, in case you'd rather not depend on a CDN at runtime.

By default, DocNest loads both libraries from cdnjs (see the <script> tags
in index.html and tutorial.html) so there is nothing to install or build.
To vendor them instead:

1. Download marked.min.js and highlight.min.js (plus a highlight.js theme
   CSS file) into this folder.
2. Update the <script src="..."> and <link rel="stylesheet" href="...">
   tags in index.html and tutorial.html to point here instead of cdnjs.

In addition, the Annotate page (annotate.html) loads PDF.js from cdnjs on
demand — only when you open or import a PDF — via js/annotate.js:

    https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js
    https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js

To vendor PDF.js instead, download both files into this folder and change the
two URLs in the `ensurePdfLib` / worker-src assignments in js/annotate.js.
The worker URL is set on `pdfjsLib.GlobalWorkerOptions.workerSrc`.
