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

const storageKey = "arc-networth:snapshots"

function formatCredits(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDelta(value: number) {
  const prefix = value > 0 ? "+" : ""
  return `${prefix}${formatCredits(value)}`
}

function parseCredits(value: string) {
  const parsed = Number(value.replaceAll(",", ""))
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

function useSnapshots() {
  const [snapshots, setSnapshots] = React.useState<Snapshot[]>(() => {
    if (typeof window === "undefined") {
      return []
    }

    const stored = window.localStorage.getItem(storageKey)
    if (!stored) {
      return []
    }

    try {
      const parsed = JSON.parse(stored) as Snapshot[]
      return parsed
    } catch {
      return []
    }
  })

  React.useEffect(() => {
    if (snapshots.length) {
      window.localStorage.setItem(storageKey, JSON.stringify(snapshots))
    }
  }, [snapshots])

  return [snapshots, setSnapshots] as const
}

function NetworthChart({ snapshots }: { snapshots: Snapshot[] }) {
  const totals = snapshots.map((snapshot) => snapshot.total)
  const min = Math.min(...totals)
  const max = Math.max(...totals)
  const span = Math.max(1, max - min)
  const width = 720
  const height = 260
  const padding = 22
  const usableWidth = width - padding * 2
  const usableHeight = height - padding * 2

  const points = snapshots.map((snapshot, index) => {
    const x =
      snapshots.length === 1
        ? width / 2
        : padding + (index / (snapshots.length - 1)) * usableWidth
    const y = padding + (1 - (snapshot.total - min) / span) * usableHeight
    return { ...snapshot, x, y }
  })

  const line = points.map((point) => `${point.x},${point.y}`).join(" ")
  const area = `${padding},${height - padding} ${line} ${width - padding},${height - padding}`
  const latest = points.at(-1)

  return (
    <div className="relative h-[280px] overflow-hidden rounded-lg border bg-card">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Networth history chart"
        className="h-full w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="networth-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.34" />
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
              className="stroke-border"
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
      {latest ? (
        <div className="absolute right-4 top-4 rounded-md border bg-background/90 px-3 py-2 text-right backdrop-blur">
          <div className="text-xs text-muted-foreground">Latest</div>
          <div className="font-mono text-lg font-semibold">
            {formatCredits(latest.total)}
          </div>
        </div>
      ) : null}
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
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-normal text-muted-foreground">
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
  const [snapshots, setSnapshots] = useSnapshots()
  const latest = snapshots.at(-1)
  const first = snapshots[0]
  const sessionDelta = latest && first ? latest.total - first.total : 0
  const sessionPercent = first ? (sessionDelta / first.total) * 100 : 0
  const [currency, setCurrency] = React.useState("")
  const [stash, setStash] = React.useState("")
  const [label, setLabel] = React.useState("Start")

  const currencyValue = parseCredits(currency)
  const stashValue = parseCredits(stash)
  const total = currencyValue + stashValue

  function addSnapshot() {
    const nextSnapshot: Snapshot = {
      id: crypto.randomUUID(),
      label: label.trim() || `Snapshot ${snapshots.length + 1}`,
      currency: currencyValue,
      stash: stashValue,
      total,
      createdAt: new Date().toISOString(),
    }

    setSnapshots((current) => [...current, nextSnapshot])
    setLabel(`Raid ${snapshots.length + 1}`)
  }

  function clearSnapshots() {
    setSnapshots([])
    window.localStorage.removeItem(storageKey)
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
        setSnapshots(
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
    <main className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              ARC Raiders session tracker
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal">
              Networth Curve
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={exportSnapshots}>
              Export
            </Button>
            <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border bg-background px-4 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground">
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
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Current networth" value={formatCredits(total)} />
          <StatCard label="Currency" value={formatCredits(currencyValue)} />
          <StatCard label="Stash value" value={formatCredits(stashValue)} />
          <StatCard
            label="Session P&L"
            value={`${formatDelta(sessionDelta)} (${sessionPercent.toFixed(1)}%)`}
            tone={sessionDelta >= 0 ? "gain" : "loss"}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <form
            className="rounded-lg border bg-card p-4"
            onSubmit={(event) => {
              event.preventDefault()
              addSnapshot()
            }}
          >
            <div className="mb-4">
              <h2 className="text-base font-semibold">Snapshot</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Capture start, end, or after each raid.
              </p>
            </div>
            <div className="grid gap-4">
              <label className="grid gap-2 text-sm font-medium">
                Label
                <input
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  className="h-10 rounded-md border bg-background px-3 font-mono text-sm outline-none ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Currency
                <input
                  inputMode="numeric"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  className="h-10 rounded-md border bg-background px-3 font-mono text-sm outline-none ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Stash value
                <input
                  inputMode="numeric"
                  value={stash}
                  onChange={(event) => setStash(event.target.value)}
                  className="h-10 rounded-md border bg-background px-3 font-mono text-sm outline-none ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <Button type="submit" className="w-full">
                Save snapshot
              </Button>
            </div>
          </form>

          <div className="grid gap-4">
            {snapshots.length ? (
              <NetworthChart snapshots={snapshots} />
            ) : (
              <div className="flex h-[280px] items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground">
                Add a snapshot to start the curve.
              </div>
            )}
            <div className="overflow-hidden rounded-lg border">
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium uppercase tracking-normal text-muted-foreground">
                <span>Snapshot</span>
                <span>Total</span>
                <span>P&L</span>
              </div>
              <div className="max-h-[260px] overflow-auto">
                {snapshots.map((snapshot, index) => {
                  const previous = snapshots[index - 1]
                  const delta = previous ? snapshot.total - previous.total : 0

                  return (
                    <div
                      key={snapshot.id}
                      className="grid grid-cols-[1fr_auto_auto] gap-3 border-b px-3 py-3 text-sm last:border-0"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {snapshot.label}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {new Date(snapshot.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                      <div className="font-mono">{formatCredits(snapshot.total)}</div>
                      <div
                        className={
                          delta >= 0
                            ? "font-mono text-emerald-600 dark:text-emerald-400"
                            : "font-mono text-red-600 dark:text-red-400"
                        }
                      >
                        {index === 0 ? "-" : formatDelta(delta)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
