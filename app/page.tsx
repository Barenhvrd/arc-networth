"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"

type Snapshot = {
  id: string
  label: string
  currency: number
  stash: number
  total: number
  createdAt: string
}

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

function formatCredits(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDelta(value: number) {
  const prefix = value > 0 ? "+" : ""
  return `${prefix}${formatCredits(value)}`
}

function formatPercent(value: number) {
  const prefix = value > 0 ? "+" : ""
  return `${prefix}${value.toFixed(1)}%`
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function parseCredits(value: string) {
  const parsed = Number(value.replaceAll(",", ""))
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

function getTone(value: number) {
  if (value > 0) {
    return "gain"
  }

  if (value < 0) {
    return "loss"
  }

  return "neutral"
}

function NetworthChart({ snapshots }: { snapshots: Snapshot[] }) {
  const totals = snapshots.map((snapshot) => snapshot.total)
  const min = Math.min(...totals)
  const max = Math.max(...totals)
  const span = Math.max(1, max - min)
  const width = 720
  const height = 260
  const padding = 30
  const usableWidth = width - padding * 2
  const usableHeight = height - padding * 2

  const points = snapshots.map((snapshot, index) => {
    const x =
      snapshots.length === 1
        ? width / 2
        : padding + (index / (snapshots.length - 1)) * usableWidth
    const y =
      snapshots.length === 1
        ? height / 2
        : padding + (1 - (snapshot.total - min) / span) * usableHeight
    return { ...snapshot, x, y }
  })

  const line = points.map((point) => `${point.x},${point.y}`).join(" ")
  const area = `${padding},${height - padding} ${line} ${width - padding},${height - padding}`
  const latest = points.at(-1)

  return (
    <div className="relative h-[320px] overflow-hidden rounded-md border bg-card shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
      <div className="absolute left-5 top-5 z-10">
        <div className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
          Networth
        </div>
        <div className="mt-1 font-mono text-2xl font-semibold">
          {latest ? formatCredits(latest.total) : "-"}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Networth history chart"
        className="h-full w-full pt-10"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="networth-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((row) => {
          const y = padding + (row / 3) * usableHeight
          return (
            <line
              key={row}
              x1={padding}
              x2={width - padding}
              y1={y}
              y2={y}
              className="stroke-border/80"
              strokeWidth="1"
            />
          )
        })}
        <polygon points={area} fill="url(#networth-area)" />
        <polyline
          points={line}
          fill="none"
          stroke="var(--chart-1)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4"
        />
        {points.map((point) => (
          <circle
            key={point.id}
            cx={point.x}
            cy={point.y}
            r="5"
            className="fill-background"
            stroke="var(--chart-1)"
            strokeWidth="3"
          />
        ))}
      </svg>
    </div>
  )
}

function StatCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string
  value: string
  tone?: "neutral" | "gain" | "loss"
}) {
  return (
    <div className="rounded-md border bg-card/90 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.05)] backdrop-blur">
      <div className="text-[11px] font-medium uppercase tracking-normal text-muted-foreground">
        {label}
      </div>
      <div
        className={
          tone === "gain"
            ? "mt-2 font-mono text-2xl font-semibold text-emerald-600 dark:text-emerald-400"
            : tone === "loss"
              ? "mt-2 font-mono text-2xl font-semibold text-red-600 dark:text-red-400"
              : "mt-2 font-mono text-2xl font-semibold"
        }
      >
        {value}
      </div>
    </div>
  )
}

export default function Page() {
  const [snapshots, setSnapshots] = React.useState<Snapshot[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [syncStatus, setSyncStatus] = React.useState("Loading shared data")
  const latest = snapshots.at(-1)
  const first = snapshots[0]
  const sessionDelta = latest && first ? latest.total - first.total : 0
  const sessionPercent = first ? (sessionDelta / first.total) * 100 : 0
  const [currency, setCurrency] = React.useState("1632250")
  const [stash, setStash] = React.useState("3404961")
  const [label, setLabel] = React.useState("Current")

  const currencyValue = parseCredits(currency)
  const stashValue = parseCredits(stash)
  const total = currencyValue + stashValue
  const snapshotDeltas = snapshots.map((snapshot, index) => ({
    snapshot,
    delta: index === 0 ? 0 : snapshot.total - snapshots[index - 1].total,
  }))
  const largestMove = snapshotDeltas
    .slice(1)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))[0]
  const lastUpdated = latest ? formatTime(latest.createdAt) : "-"

  const saveSnapshots = React.useCallback(async (nextSnapshots: Snapshot[]) => {
    setSnapshots(nextSnapshots)
    setSyncStatus("Saving")

    const response = await fetch("/api/snapshots", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ snapshots: nextSnapshots }),
    })

    if (!response.ok) {
      setSyncStatus("Save failed")
      return
    }

    setSyncStatus("Shared data saved")
  }, [])

  React.useEffect(() => {
    let isActive = true

    async function loadSnapshots() {
      try {
        const response = await fetch("/api/snapshots", { cache: "no-store" })
        const data = (await response.json()) as { snapshots?: Snapshot[] }
        const nextSnapshots = data.snapshots?.length
          ? data.snapshots
          : initialSnapshots
        const nextLatest = nextSnapshots.at(-1)

        if (!isActive) {
          return
        }

        setSnapshots(nextSnapshots)
        if (nextLatest) {
          setCurrency(String(nextLatest.currency))
          setStash(String(nextLatest.stash))
        }
        setSyncStatus("Shared data loaded")
      } catch {
        if (isActive) {
          setSnapshots(initialSnapshots)
          setSyncStatus("Using fallback data")
        }
      } finally {
        if (isActive) {
          setIsLoading(false)
        }
      }
    }

    loadSnapshots()

    return () => {
      isActive = false
    }
  }, [])

  async function addSnapshot() {
    const nextSnapshot: Snapshot = {
      id: crypto.randomUUID(),
      label: label.trim() || `Snapshot ${snapshots.length + 1}`,
      currency: currencyValue,
      stash: stashValue,
      total,
      createdAt: new Date().toISOString(),
    }

    await saveSnapshots([...snapshots, nextSnapshot])
    setLabel(`Raid ${snapshots.length + 1}`)
  }

  async function clearSnapshots() {
    await saveSnapshots([])
  }

  function exportSnapshots() {
    const data = encodeURIComponent(JSON.stringify(snapshots, null, 2))
    const link = document.createElement("a")
    link.href = `data:application/json;charset=utf-8,${data}`
    link.download = "arc-networth-snapshots.json"
    link.click()
  }

  function importSnapshots(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Snapshot[]
        saveSnapshots(
          parsed
            .filter((snapshot) => Number.isFinite(snapshot.total))
            .map((snapshot) => ({
              ...snapshot,
              id: snapshot.id || crypto.randomUUID(),
            })),
        )
      } catch {
        event.target.value = ""
      }
    }
    reader.readAsText(file)
  }

  return (
    <main className="min-h-svh bg-[linear-gradient(180deg,var(--background),var(--muted))] text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <header className="rounded-md border bg-card/85 p-4 shadow-[0_18px_70px_rgba(15,23,42,0.07)] backdrop-blur sm:p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <span className="size-2 rounded-full bg-emerald-500" />
                ARC Raiders ledger
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
                <h1 className="font-mono text-4xl font-semibold tracking-normal sm:text-6xl">
                  {formatCredits(total)}
                </h1>
                <div
                  className={
                    getTone(sessionDelta) === "gain"
                      ? "pb-1 font-mono text-lg font-semibold text-emerald-600 dark:text-emerald-400"
                      : getTone(sessionDelta) === "loss"
                        ? "pb-1 font-mono text-lg font-semibold text-red-600 dark:text-red-400"
                        : "pb-1 font-mono text-lg font-semibold text-muted-foreground"
                  }
                >
                  {formatDelta(sessionDelta)} ({formatPercent(sessionPercent)})
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex h-10 items-center gap-2 rounded-md border bg-background/80 px-3 text-xs text-muted-foreground">
                <span
                  className={
                    syncStatus === "Save failed"
                      ? "size-1.5 rounded-full bg-red-500"
                      : isLoading
                        ? "size-1.5 rounded-full bg-amber-500"
                        : "size-1.5 rounded-full bg-emerald-500"
                  }
                />
                {isLoading ? "Loading" : syncStatus}
              </div>
              <Button variant="secondary" onClick={exportSnapshots}>
                Export
              </Button>
              <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border bg-background/80 px-4 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground">
                Import
                <input
                  type="file"
                  accept="application/json"
                  onChange={importSnapshots}
                  className="sr-only"
                />
              </label>
              <Button variant="outline" onClick={clearSnapshots}>
                Reset
              </Button>
            </div>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Currency" value={formatCredits(currencyValue)} />
          <StatCard label="Stash value" value={formatCredits(stashValue)} />
          <StatCard label="Last update" value={lastUpdated} />
          <StatCard
            label="Largest move"
            value={largestMove ? formatDelta(largestMove.delta) : "-"}
            tone={largestMove ? getTone(largestMove.delta) : "neutral"}
          />
        </section>

        <section className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <form
            className="rounded-md border bg-card/90 p-4 shadow-[0_18px_70px_rgba(15,23,42,0.06)] backdrop-blur sm:p-5"
            onSubmit={(event) => {
              event.preventDefault()
              addSnapshot()
            }}
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Snapshot</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Shared across every open device.
                </p>
              </div>
              <div className="rounded-md border bg-background px-2.5 py-1 font-mono text-xs text-muted-foreground">
                {isLoading ? "syncing" : `${snapshots.length} saved`}
              </div>
            </div>
            <div className="grid gap-4">
              <label className="grid gap-2 text-sm font-medium">
                Label
                <input
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  className="h-12 rounded-md border bg-background px-3 font-mono text-base outline-none ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Currency
                <input
                  inputMode="numeric"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  className="h-12 rounded-md border bg-background px-3 font-mono text-base outline-none ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Stash value
                <input
                  inputMode="numeric"
                  value={stash}
                  onChange={(event) => setStash(event.target.value)}
                  className="h-12 rounded-md border bg-background px-3 font-mono text-base outline-none ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <div className="rounded-md border bg-background p-3">
                <div className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
                  Snapshot total
                </div>
                <div className="mt-1 font-mono text-2xl font-semibold">
                  {formatCredits(total)}
                </div>
              </div>
              <Button type="submit" className="h-11 w-full">
                Save snapshot
              </Button>
            </div>
          </form>

          <div className="grid gap-4">
            {isLoading ? (
              <div className="flex h-[320px] items-center justify-center rounded-md border bg-card text-sm text-muted-foreground">
                Loading shared data...
              </div>
            ) : snapshots.length ? (
              <NetworthChart snapshots={snapshots} />
            ) : (
              <div className="flex h-[320px] items-center justify-center rounded-md border bg-card text-sm text-muted-foreground">
                Add a snapshot to start the curve.
              </div>
            )}
            <div className="overflow-hidden rounded-md border bg-card/90 shadow-[0_18px_70px_rgba(15,23,42,0.06)]">
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b bg-muted/40 px-4 py-3 text-[11px] font-medium uppercase tracking-normal text-muted-foreground">
                <span>Snapshot</span>
                <span>Total</span>
                <span>P&L</span>
              </div>
              <div className="max-h-[280px] overflow-auto">
                {isLoading ? (
                  <div className="px-4 py-6 text-sm text-muted-foreground">
                    Loading shared snapshots...
                  </div>
                ) : null}
                {snapshotDeltas.map(({ snapshot, delta }, index) => (
                  <div
                    key={snapshot.id}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b px-4 py-3 text-sm last:border-0"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium">{snapshot.label}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {formatTime(snapshot.createdAt)}
                      </div>
                    </div>
                    <div className="font-mono font-medium">
                      {formatCredits(snapshot.total)}
                    </div>
                    <div
                      className={
                        getTone(delta) === "gain"
                          ? "font-mono font-medium text-emerald-600 dark:text-emerald-400"
                          : getTone(delta) === "loss"
                            ? "font-mono font-medium text-red-600 dark:text-red-400"
                            : "font-mono font-medium text-muted-foreground"
                      }
                    >
                      {index === 0 ? "-" : formatDelta(delta)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
