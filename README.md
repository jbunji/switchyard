# Switchyard

A modern web-based control system for model railroad layouts.

Design your track topology, throw turnouts, track block occupancy, and eventually run real trains over DCC — all from a browser.

## Status

**Phase 0 — foundation.** Graph data model, SVG renderer with the ballast/tie/rail aesthetic, turnout toggling, block occupancy. Purely client-side.

## Roadmap

- **Phase 0:** Graph model + renderer + demo layout
- **Phase 1:** Drag-and-drop layout editor (the core feature)
- **Phase 2:** Route building, collision avoidance, block reservation
- **Phase 3:** AI agent — voice commands, chat interface, RAG over layout state (Vercel AI SDK + OpenRouter)
- **Phase 4:** Hardware bridge — JMRI over WebSocket for real DCC control (Digitrax / NCE / ESU)

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4
- Zustand (state)
- Zod (schema validation)
- Vercel AI SDK v6 (dormant until Phase 3)
- SVG rendering

## Dev

```bash
pnpm install
pnpm dev
```

Visit `http://localhost:3000`.

## Interactions

- Scroll wheel — zoom toward cursor
- Click and drag empty space — pan
- Click a green/red turnout dot — throw the switch
- Click a block in the HUD — toggle occupancy
