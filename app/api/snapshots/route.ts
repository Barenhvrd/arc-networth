import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { NextResponse } from "next/server"

type Snapshot = {
  id: string
  label: string
  currency: number
  stash: number
  total: number
  createdAt: string
}

const dataDirectory = path.join(process.cwd(), "data")
const dataFile = path.join(dataDirectory, "snapshots.json")

const initialSnapshots: Snapshot[] = [
  {
    id: "initial-2026-06-09",
    label: "Initial stash",
    currency: 1632250,
    stash: 3404961,
    total: 5037211,
    createdAt: "2026-06-09T16:26:53.000Z",
  },
]

function sanitizeSnapshot(snapshot: Snapshot): Snapshot | null {
  const currency = Number(snapshot.currency)
  const stash = Number(snapshot.stash)
  const total = Number(snapshot.total)

  if (!Number.isFinite(currency) || !Number.isFinite(stash) || !Number.isFinite(total)) {
    return null
  }

  return {
    id: String(snapshot.id || crypto.randomUUID()),
    label: String(snapshot.label || "Snapshot"),
    currency,
    stash,
    total,
    createdAt: String(snapshot.createdAt || new Date().toISOString()),
  }
}

async function readSnapshots() {
  try {
    const file = await readFile(dataFile, "utf8")
    const parsed = JSON.parse(file) as Snapshot[]
    return parsed.map(sanitizeSnapshot).filter((snapshot) => snapshot !== null)
  } catch {
    await writeSnapshots(initialSnapshots)
    return initialSnapshots
  }
}

async function writeSnapshots(snapshots: Snapshot[]) {
  await mkdir(dataDirectory, { recursive: true })
  await writeFile(dataFile, `${JSON.stringify(snapshots, null, 2)}\n`)
}

export async function GET() {
  const snapshots = await readSnapshots()
  return NextResponse.json({ snapshots })
}

export async function POST(request: Request) {
  const body = (await request.json()) as { snapshots?: Snapshot[] }
  const snapshots = Array.isArray(body.snapshots)
    ? body.snapshots
        .map(sanitizeSnapshot)
        .filter((snapshot) => snapshot !== null)
    : []

  await writeSnapshots(snapshots)

  return NextResponse.json({ snapshots })
}
