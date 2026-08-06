This folder is reserved for locally vendored copies of marked.js and
highlight.js, in case you'd rather not depend on a CDN at runtime.

By default, DocNest loads both libraries from cdnjs (see the <script> tags
in index.html and tutorial.html) so there is nothing to install or build.
To vendor them instead:

1. Download marked.min.js and highlight.min.js (plus a highlight.js theme
   CSS file) into this folder.
2. Update the <script src="..."> and <link rel="stylesheet" href="...">
   tags in index.html and tutorial.html to point here instead of cdnjs.
