# kidpix — modular vanilla-JS remake of the 1989 Kid Pix drawing app

- Build: `npm run build` (vite; dual outputs: dist/ root-based, dist-gh/
  for GitHub Pages at /kidpix/). Dev: `yarn dev` → :5173.
- Gate: `npm run typecheck && npm test`. `yarn build` ends with the offline-PWA
  checker; `yarn test:pwa` exercises the built artifacts offline
  ([docs/pwa.md](docs/pwa.md)).
- Counts and baselines: run the gate — no test counts live in prose.
- Env traps: no ESLint/Prettier by design. Live app auto-deploys from
  `main` to https://eriqueo.github.io/kidpix/ — upstream is
  justinpearson/kidpix with its own separate deploy.
- Done means: merged to `main` and the Pages deploy renders the change.
- Author/auditor: changes >50 LOC get a fresh-eyes read of the full diff
  before merge.

Architecture and history live in [ARCHITECTURE.md](ARCHITECTURE.md); the only active
feature queue is [prompts-TODO/current.txt](prompts-TODO/current.txt). Don't duplicate them here.
