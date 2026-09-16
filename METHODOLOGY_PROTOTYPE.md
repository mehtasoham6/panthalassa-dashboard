# Methodology introduction — local review prototype

Starting commit: 8f3175a. Local branch: prototype/methodology-story.
No remote push, pull request, or deployment has been performed.

## Review

- `npm ci` then `npm run dev` runs the complete application, with the new story on `/` and the original dashboard on `/old`.
- `node scripts/build-story-preview.mjs [output.html]` creates a self-contained HTML fragment for in-conversation review. It includes the existing hero and the same story components, and makes no network requests. Its dashboard links open the existing public landing page because `/old` is not currently a reliable direct deep link on that deployment.
- The review entry is `src/app/prototype.tsx`; it is not imported into the deployed app.

## Scope

The existing hero and its placeholder copy are retained. The three lower placeholder sections are replaced by the methodology. About/findings copy, the dashboard tour, and the appendix remain future work. Dashboard calculations and controls are unchanged.

The implementation uses explicit ordered copy/visual states in `storyData.ts`. Desktop uses a sticky graphic; narrow layouts and reduced motion use paired inline illustrations. The failure panel reveals together after the last output step leaves the viewport, and costs are a static four-category grid.

The circle uses the exact existing Ocean-2 wireframe geometry, projected into a perspective canvas view. Its inline geometry module is generated from `src/app/assets/node_wire.bin`; regenerate if the original model changes. The map uses public-domain Natural Earth geometry from world-atlas 2.0.2 (https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json), projected with d3-geo. The selected coastal departure point and route are illustrative.

The power chart is schematic, with independently compressed stage widths. Fixed illustrative lulls are not WAVERYS observations. Chip/failure losses are not plotted as made-up numeric proportions. Sea-park battery support uses the methodology's per-lull energy-deficit approximation; tug support starts from 100 kWh and follows chronological deficits.

## Verification and limits

- TypeScript check and Vite production build pass.
- Numerical checks verified the two illustrative lull deficits (60 and 360 kWh), recovery capped at 100 kWh per lull, both tug-leg battery energy budgets, and the 200 kW computing cap.
- Static SVG renders of the globe and power chart were inspected for label placement.
- End-to-end browser scroll, mobile, and reduced-motion checks remain outstanding: the session's remote browser cannot connect to a local development server. The inline preview is provided for actual visual review rather than claimed as browser-verified.
- Production build emits a large-bundle warning; no optimization of the existing dashboard bundle is included in this UI prototype.
