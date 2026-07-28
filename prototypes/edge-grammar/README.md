# Edge Grammar prototype

Static design mockup exploring an **edge-led visual grammar** for the Code Observatory
workflow canvas: meaning carried by stroke pattern, colour, and arrowhead on the
*connections* between steps, rather than by which direction a node is placed.

This is a design exploration only — not production code, not wired into the app, not built
with React Flow / dagre / any auto-layout. Every node and edge in every composition was
positioned by hand, like a cartographer, to see the grammar at its clearest before deciding
whether to build a layout engine around it.

See `docs/canvas-layout-discussion.md` for the design conversation that led here.

## How to open it

No build step, no server, no dependencies. Just open the file directly in a browser:

```
prototypes/edge-grammar/index.html
```

Double-click it in Explorer, or run (PowerShell):

```powershell
start prototypes\edge-grammar\index.html
```

It links `tokens.css` (a copy of `src/web/styles/tokens.css`) from the same folder, so it must
stay next to `index.html` if you move things around. Use the "Switch to light / dark" button
in the top right to check both themes.

## What's inside

Five hand-authored compositions, stacked vertically, each testing the grammar on a different
real workflow shape:

1. Guarded pipeline with multiple outcomes (400 / 429 / 502 / 201)
2. Retry to exhaustion (amber retry loop vs. red exhaustion exit)
3. Fork / join parallelism (charge card, reserve stock, fraud check → confirm)
4. Sync → async handoff (blocking request vs. background worker, split into zones)
5. Failure with cleanup (compensation step before the terminal failure outcome)

Screenshots used to verify legibility during iteration live in `shots/` (git-ignored, not
committed).
