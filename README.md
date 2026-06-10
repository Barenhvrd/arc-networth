# Arc Networth

Local-first ARC Raiders networth tracker for quickly logging raid-to-raid value
changes from currency and stash estimates.

Arc Networth is intentionally small: it does one workflow well, stores data in a
plain JSON file, and works across devices on the same Wi-Fi without accounts or
hosted infrastructure.

## Highlights

- Manual currency and stash inputs with tolerant number parsing
- Shared server-side JSON storage for desktop and mobile clients
- Session P&L, percent change, largest move, and latest update summary
- Interactive networth chart with selectable points and dismissible tooltips
- Range filters: all time, year, quarter, month, 7D, 1D, and custom dates
- Snapshot editing, import/export, reset confirmation, and OCR-assisted entry
- Basic Auth gate for the app and API via `APP_PASSWORD`
- Playwright regression coverage for desktop and mobile flows

## Stack

- Next.js App Router
- React
- Tailwind CSS
- shadcn/ui-style primitives
- Tesseract.js for optional local OCR
- Playwright for end-to-end tests

## Getting Started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Set a real password in `.env.local`:

```bash
APP_PASSWORD=your-local-password
```

## LAN Mode

To use the app from a phone or another computer on the same trusted network:

```bash
HOST=0.0.0.0 PORT=3000 npm run serve:lan
```

Then open the machine's local network URL, for example:

```text
http://192.168.1.55:3000
```

Snapshots are stored in `data/snapshots.json`. That file is intentionally
ignored by git so personal ledger data stays local. Use
`data/snapshots.example.json` as the committed example format.

For macOS auto-start, see [docs/macos-autostart.md](docs/macos-autostart.md).

## Checks

```bash
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

## Security Notes

This is a personal LAN tool, not a hosted multi-user service. Basic Auth is a
small local gate, not a replacement for proper production authentication. Keep
it on trusted networks, use a non-trivial `APP_PASSWORD`, and avoid committing
real `data/snapshots.json` contents.

## Roadmap

- Notes and tags per snapshot
- CSV export
- Read-only share/export bundle
- Category breakdown for stash, gear, and currency
- Audit history for snapshot edits
