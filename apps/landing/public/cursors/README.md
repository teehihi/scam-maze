# Kiroween — Kiro Ghost Cursor Pack

16 transparent PNG cursor assets, 96×96 px, based on a friendly white ghost
mascot silhouette with dark oval eyes, violet shadow/outline and warm orange
magic accents. Halloween styling is playful, not gory.

Files: default, pointer, text, wait, progress, help, crosshair, move,
not-allowed, click, grab, ew-resize, ns-resize, nwse-resize, nesw-resize,
zoom-in.

Example CSS (adjust hotspot coordinates after testing):
```css
html, body { cursor: url('/cursors/default.png') 12 12, auto; }
a, button, [role="button"] { cursor: url('/cursors/pointer.png') 24 24, pointer; }
input, textarea, [contenteditable="true"] { cursor: url('/cursors/text.png') 48 48, text; }
[draggable="true"] { cursor: url('/cursors/grab.png') 48 48, grab; }
.is-dragging { cursor: url('/cursors/click.png') 48 48, grabbing; }
```
