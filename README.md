# Arc Networth

Lightweight ARC Raiders session networth tracker.

The MVP is intentionally simple: enter currency, enter stash value, save snapshots, and watch the session curve like a small portfolio chart. No account, no hosted database, no inventory management.

## Features

- Currency + stash value inputs
- Session P&L and percent change
- Networth curve across snapshots
- Per-snapshot delta list
- Shared server-side JSON storage
- JSON import/export
- Built with Next.js and shadcn/ui

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Snapshots are stored in `data/snapshots.json`, so every device connected to the same running app sees the same session data.

## Checks

```bash
npm run lint
npm run typecheck
npm run build
```

## Roadmap

- Rename snapshots inline
- Optional notes per snapshot
- CSV export
- Shareable read-only session file
- Community-maintained item value presets
