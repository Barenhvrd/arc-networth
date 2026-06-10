"use client"

import * as React from "react"
import type { LoggerMessage } from "tesseract.js"

import { Button } from "@/components/ui/button"

type Snapshot = {
  id: string
  label: string
  currency: number
  stash: number
  total: number
  createdAt: string
}

type ChartRange = "all" | "year" | "quarter" | "month" | "7d" | "1d" | "custom"
type OcrTarget = "currency" | "stash"
type OcrReview = {
  target: OcrTarget
  value: string
  candidates: number[]
}

const chartRanges: { label: string; value: ChartRange }[] = [
  { label: "All", value: "all" },
  { label: "Year", value: "year" },
  { label: "Quarter", value: "quarter" },
  { label: "Month", value: "month" },
  { label: "7D", value: "7d" },
  { label: "1D", value: "1d" },
  { label: "Custom", value: "custom" },
]

const quickLabels = [
  "Current",
  "Before raid",
  "After raid",
  "Loot run",
  "Good raid",
  "Bad raid",
  "Big loot",
  "Sold stash",
  "Bought gear",
  "Death tax",
  "Session start",
  "Session end",
  "Vault check",
  "Market sale",
  "Gear spend",
  "Daily close",
]

const initialSnapshots: Snapshot[] = [
  {
    id: "sample-baseline",
    label: "Baseline",
    currency: 250000,
    stash: 750000,
    total: 1000000,
    createdAt: "2026-01-01T18:00:00.000Z",
  },
  {
    id: "sample-after-raid",
    label: "After raid",
    currency: 310000,
    stash: 840000,
    total: 1150000,
    createdAt: "2026-01-01T19:00:00.000Z",
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

function formatSnapshotDate(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function parseCredits(value: string) {
  const parsed = Number(value.replace(/\D/g, ""))
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

function createSnapshotId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  return `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function parseCreditToken(value: string) {
  const digits = value.replace(/\D/g, "")
  const parsed = Number(digits)
  return Number.isFinite(parsed) && parsed >= 10000 ? parsed : null
}

function findCreditValues(text: string) {
  const values = new Set<number>()
  const matches = text.match(/\d[\d\s,.'’]{2,}\d/g) || []

  for (const match of matches) {
    const parsed = parseCreditToken(match)
    if (parsed !== null) {
      values.add(parsed)
    }
  }

  return [...values]
}

function getOcrTargetLabel(target: OcrTarget) {
  return target === "currency" ? "Currency" : "Stash value"
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    const url = URL.createObjectURL(file)

    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }

    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Image failed to load"))
    }

    image.src = url
  })
}

async function prepareOcrImage(file: File) {
  const image = await loadImage(file)
  const scale = 3
  const canvas = document.createElement("canvas")
  canvas.width = image.naturalWidth * scale
  canvas.height = image.naturalHeight * scale

  const context = canvas.getContext("2d")
  if (!context) {
    return file
  }

  context.imageSmoothingEnabled = false
  context.drawImage(image, 0, 0, canvas.width, canvas.height)

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  for (let index = 0; index < data.length; index += 4) {
    const gray =
      data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114
    const boosted = gray > 120 ? 255 : 0
    data[index] = boosted
    data[index + 1] = boosted
    data[index + 2] = boosted
  }

  context.putImageData(imageData, 0, 0)

  return new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob || file), "image/png")
  })
}

function formatDateInput(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ""
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getRangeStart(
  anchor: Date,
  range: Exclude<ChartRange, "all" | "custom">
) {
  const start = new Date(anchor)

  if (range === "year") {
    start.setFullYear(start.getFullYear() - 1)
  }

  if (range === "quarter") {
    start.setMonth(start.getMonth() - 3)
  }

  if (range === "month") {
    start.setMonth(start.getMonth() - 1)
  }

  if (range === "7d") {
    start.setDate(start.getDate() - 7)
  }

  if (range === "1d") {
    start.setDate(start.getDate() - 1)
  }

  return start
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
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const hasCurve = snapshots.length > 1
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
  const selected = points.find((point) => point.id === selectedId) ?? null
  const displayedNetworth = selected ?? latest ?? points[0]
  const selectedIndex = selected
    ? snapshots.findIndex((snapshot) => snapshot.id === selected.id)
    : -1
  const selectedDelta =
    selected && selectedIndex > 0
      ? selected.total - snapshots[selectedIndex - 1].total
      : 0
  const selectedTone = getTone(selectedDelta)
  const selectPoint = React.useCallback((point: (typeof points)[number]) => {
    setSelectedId(point.id)
    console.info("[arc-networth] chart point selected", {
      id: point.id,
      label: point.label,
      networth: point.total,
      createdAt: point.createdAt,
    })
  }, [])
  const clearSelection = React.useCallback(() => {
    setSelectedId(null)
  }, [])

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        clearSelection()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [clearSelection])

  function handleChartBackgroundInteraction(
    event:
      | React.MouseEvent<HTMLDivElement>
      | React.PointerEvent<HTMLDivElement>
      | React.TouchEvent<HTMLDivElement>
  ) {
    const target = event.target

    if (!(target instanceof Element)) {
      return
    }

    if (
      target.closest("[data-chart-point]") ||
      target.closest("[data-chart-tooltip]")
    ) {
      return
    }

    clearSelection()
  }

  return (
    <div
      className="relative h-[320px] overflow-hidden rounded-md border bg-card shadow-[0_24px_80px_rgba(15,23,42,0.08)]"
      data-testid="chart-shell"
      onMouseDownCapture={handleChartBackgroundInteraction}
      onPointerDownCapture={handleChartBackgroundInteraction}
      onTouchStartCapture={handleChartBackgroundInteraction}
    >
      <div className="absolute top-5 left-5 z-10">
        <div className="text-xs font-medium tracking-normal text-muted-foreground uppercase">
          Networth
        </div>
        <div className="mt-1 font-mono text-2xl font-semibold">
          {displayedNetworth ? formatCredits(displayedNetworth.total) : "-"}
        </div>
      </div>
      {selected ? (
        <div
          className="pointer-events-auto absolute z-20 min-w-44 rounded-md border bg-background/92 p-3 text-sm shadow-[0_14px_48px_rgba(15,23,42,0.14)] backdrop-blur"
          data-chart-tooltip
          style={{
            left: `clamp(5.75rem, ${(selected.x / width) * 100}%, calc(100% - 5.75rem))`,
            top: `${(selected.y / height) * 100}%`,
            transform:
              selected.y < height / 2
                ? "translate(-50%, 1.5rem)"
                : "translate(-50%, -115%)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="truncate text-xs font-medium text-muted-foreground">
              {selected.label}
            </div>
            <button
              type="button"
              className="-mt-1 -mr-1 grid size-7 place-items-center rounded-md text-base leading-none text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Close chart tooltip"
              onClick={clearSelection}
            >
              ×
            </button>
          </div>
          <div className="mt-1 font-mono text-lg font-semibold">
            <span data-testid="chart-selected-networth">
              {formatCredits(selected.total)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3 font-mono text-xs">
            <span className="text-muted-foreground">
              {formatSnapshotDate(selected.createdAt)}
            </span>
            {selectedIndex > 0 ? (
              <span
                className={
                  selectedTone === "gain"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : selectedTone === "loss"
                      ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground"
                }
              >
                {formatDelta(selectedDelta)}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
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
        {hasCurve ? <polygon points={area} fill="url(#networth-area)" /> : null}
        {hasCurve ? (
          <polyline
            points={line}
            fill="none"
            stroke="var(--chart-1)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
        ) : (
          <line
            x1={padding}
            x2={width - padding}
            y1={height / 2}
            y2={height / 2}
            stroke="var(--chart-1)"
            strokeDasharray="10 12"
            strokeLinecap="round"
            strokeOpacity="0.5"
            strokeWidth="3"
          />
        )}
        <rect
          x="0"
          y="0"
          width={width}
          height={height}
          className="fill-transparent"
          pointerEvents="all"
          data-testid="chart-dismiss-area"
          onPointerDown={clearSelection}
        />
        {points.map((point) => {
          const isSelected = selected?.id === point.id

          return (
            <g
              key={point.id}
              role="button"
              tabIndex={0}
              aria-label={`${point.label}: ${formatCredits(point.total)} networth on ${formatSnapshotDate(point.createdAt)}`}
              className="cursor-pointer outline-none"
              data-chart-point
              data-testid={`chart-point-${point.id}`}
              onPointerDown={(event) => {
                event.stopPropagation()
              }}
              onClick={(event) => {
                event.stopPropagation()
                selectPoint(point)
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  selectPoint(point)
                }
              }}
            >
              <circle cx={point.x} cy={point.y} r="22" fill="transparent" />
              <circle
                cx={point.x}
                cy={point.y}
                r={isSelected ? "8" : "5"}
                className="fill-background transition-[r]"
                stroke="var(--chart-1)"
                strokeWidth={isSelected ? "4" : "3"}
              />
              {isSelected ? (
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="14"
                  fill="none"
                  stroke="var(--chart-1)"
                  strokeOpacity="0.18"
                  strokeWidth="8"
                />
              ) : null}
            </g>
          )
        })}
      </svg>
      {!hasCurve ? (
        <div className="absolute right-5 bottom-5 left-5 rounded-md border bg-background/88 p-3 text-sm text-muted-foreground backdrop-blur">
          <div className="font-medium text-foreground">Baseline saved</div>
          <div className="mt-1">
            Save one more snapshot after a raid to draw the performance curve.
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
    <div className="rounded-md border bg-card/90 p-4 shadow-[0_12px_40px_rgba(15,23,42,0.05)] backdrop-blur">
      <div className="text-[11px] font-medium tracking-normal text-muted-foreground uppercase">
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
  const [snapshots, setSnapshots] = React.useState<Snapshot[]>(initialSnapshots)
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [syncStatus, setSyncStatus] = React.useState("Shared data loaded")
  const [saveError, setSaveError] = React.useState("")
  const latest = snapshots.at(-1)
  const first = snapshots[0]
  const sessionDelta = latest && first ? latest.total - first.total : 0
  const sessionPercent = first ? (sessionDelta / first.total) * 100 : 0
  const [currency, setCurrency] = React.useState("250000")
  const [stash, setStash] = React.useState("750000")
  const [label, setLabel] = React.useState("Current")
  const [chartRange, setChartRange] = React.useState<ChartRange>("all")
  const [customFrom, setCustomFrom] = React.useState("")
  const [customTo, setCustomTo] = React.useState("")
  const [isResetOpen, setIsResetOpen] = React.useState(false)
  const [editingSnapshot, setEditingSnapshot] = React.useState<Snapshot | null>(
    null
  )
  const [editLabel, setEditLabel] = React.useState("")
  const [editCurrency, setEditCurrency] = React.useState("")
  const [editStash, setEditStash] = React.useState("")
  const [editError, setEditError] = React.useState("")
  const [ocrStatus, setOcrStatus] = React.useState("Ready")
  const [readingTarget, setReadingTarget] = React.useState<OcrTarget | null>(
    null
  )
  const [ocrReview, setOcrReview] = React.useState<OcrReview | null>(null)

  const currencyValue = parseCredits(currency)
  const stashValue = parseCredits(stash)
  const total = currencyValue + stashValue
  const chartSnapshots = React.useMemo(() => {
    if (chartRange === "all" || !snapshots.length) {
      return snapshots
    }

    if (chartRange === "custom") {
      if (!customFrom && !customTo) {
        return snapshots
      }

      const from = customFrom
        ? new Date(`${customFrom}T00:00:00`).getTime()
        : Number.NEGATIVE_INFINITY
      const to = customTo
        ? new Date(`${customTo}T23:59:59.999`).getTime()
        : Number.POSITIVE_INFINITY

      return snapshots.filter((snapshot) => {
        const createdAt = new Date(snapshot.createdAt).getTime()
        return createdAt >= from && createdAt <= to
      })
    }

    const anchor = latest ? new Date(latest.createdAt) : new Date()
    const from = getRangeStart(anchor, chartRange).getTime()
    const to = anchor.getTime()

    return snapshots.filter((snapshot) => {
      const createdAt = new Date(snapshot.createdAt).getTime()
      return createdAt >= from && createdAt <= to
    })
  }, [chartRange, customFrom, customTo, latest, snapshots])
  const snapshotDeltas = snapshots.map((snapshot, index) => ({
    snapshot,
    delta: index === 0 ? 0 : snapshot.total - snapshots[index - 1].total,
    hasPrevious: index > 0,
  }))
  const displayedSnapshotDeltas = [...snapshotDeltas].reverse()
  const largestMove = snapshotDeltas
    .slice(1)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))[0]
  const lastUpdated = latest ? formatTime(latest.createdAt) : "-"

  const saveSnapshots = React.useCallback(async (nextSnapshots: Snapshot[]) => {
    setSyncStatus("Saving")
    setSaveError("")
    setIsSaving(true)

    try {
      const response = await fetch("/api/snapshots", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ snapshots: nextSnapshots }),
      })

      if (!response.ok) {
        console.error("[arc-networth] snapshot save failed", {
          status: response.status,
          statusText: response.statusText,
        })
        setSyncStatus("Save failed")
        setSaveError(`Save failed: ${response.status}`)
        return false
      }

      const data = (await response.json()) as { snapshots?: Snapshot[] }
      setSnapshots(data.snapshots || nextSnapshots)
      setSyncStatus(`Saved ${formatTime(new Date().toISOString())}`)
      return true
    } catch (error) {
      console.error("[arc-networth] snapshot save failed", error)
      setSyncStatus("Save failed")
      setSaveError(
        error instanceof Error ? error.message : "Unknown save failure"
      )
      return false
    } finally {
      setIsSaving(false)
    }
  }, [])

  React.useEffect(() => {
    let isActive = true

    async function loadSnapshots() {
      setIsLoading(true)
      try {
        const response = await fetch("/api/snapshots", {
          cache: "no-store",
          credentials: "include",
        })
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
    try {
      if (isSaving) {
        return
      }

      if (!total) {
        setSyncStatus("Enter values first")
        setSaveError("Enter currency and stash values first")
        return
      }

      const nextSnapshot: Snapshot = {
        id: createSnapshotId(),
        label: label.trim() || `Snapshot ${snapshots.length + 1}`,
        currency: currencyValue,
        stash: stashValue,
        total,
        createdAt: new Date().toISOString(),
      }

      console.info("[arc-networth] saving snapshot", {
        id: nextSnapshot.id,
        label: nextSnapshot.label,
        currency: nextSnapshot.currency,
        stash: nextSnapshot.stash,
        total: nextSnapshot.total,
      })

      const saved = await saveSnapshots([...snapshots, nextSnapshot])

      if (saved) {
        setLabel(`Raid ${snapshots.length + 1}`)
      }
    } catch (error) {
      console.error("[arc-networth] snapshot save crashed", error)
      setSyncStatus("Save failed")
      setSaveError(
        error instanceof Error ? error.message : "Unknown save failure"
      )
      setIsSaving(false)
    }
  }

  function openSnapshotEditor(snapshot: Snapshot) {
    setEditingSnapshot(snapshot)
    setEditLabel(snapshot.label)
    setEditCurrency(String(snapshot.currency))
    setEditStash(String(snapshot.stash))
    setEditError("")
  }

  async function saveSnapshotEdit() {
    if (!editingSnapshot || isSaving) {
      return
    }

    const nextCurrency = parseCredits(editCurrency)
    const nextStash = parseCredits(editStash)
    const nextTotal = nextCurrency + nextStash

    if (!nextTotal) {
      setEditError("Enter currency and stash values first")
      return
    }

    const nextSnapshots = snapshots.map((snapshot) =>
      snapshot.id === editingSnapshot.id
        ? {
            ...snapshot,
            label: editLabel.trim() || snapshot.label,
            currency: nextCurrency,
            stash: nextStash,
            total: nextTotal,
          }
        : snapshot
    )

    console.info("[arc-networth] editing snapshot", {
      id: editingSnapshot.id,
      label: editLabel.trim() || editingSnapshot.label,
      currency: nextCurrency,
      stash: nextStash,
      total: nextTotal,
    })

    const saved = await saveSnapshots(nextSnapshots)

    if (saved) {
      setEditingSnapshot(null)
      setEditError("")
    } else {
      setEditError("Edit failed")
    }
  }

  async function importNumberImage(
    target: OcrTarget,
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0]
    event.target.value = ""

    if (!file) {
      return
    }

    const label = target === "currency" ? "currency" : "stash"
    setReadingTarget(target)
    setOcrStatus(`Reading ${label}`)

    try {
      const { recognize } = await import("tesseract.js")
      const image = await prepareOcrImage(file)
      const result = await recognize(image, "eng", {
        logger(message: LoggerMessage) {
          if (message.status === "recognizing text") {
            setOcrStatus(`Reading ${Math.round(message.progress * 100)}%`)
          }
        },
      })
      const candidates = findCreditValues(result.data.text).sort(
        (left, right) => right - left
      )
      const value = candidates[0] ?? null

      if (value !== null) {
        setOcrReview({
          target,
          value: String(value),
          candidates,
        })
        setOcrStatus(`${label} found: ${formatCredits(value)}`)
        return
      }

      setOcrStatus(`No ${label} value found`)
    } catch {
      setOcrStatus(`${label} read failed`)
    } finally {
      setReadingTarget(null)
    }
  }

  function confirmOcrValue() {
    if (!ocrReview) {
      return
    }

    const value = parseCredits(ocrReview.value)
    const targetLabel = getOcrTargetLabel(ocrReview.target).toLowerCase()

    if (!value) {
      setOcrStatus(`Confirm failed: ${targetLabel} is empty`)
      return
    }

    if (ocrReview.target === "currency") {
      setCurrency(String(value))
    } else {
      setStash(String(value))
    }

    setLabel("Screenshot import")
    setOcrStatus(`${targetLabel} confirmed: ${formatCredits(value)}`)
    setOcrReview(null)
  }

  async function clearSnapshots() {
    await saveSnapshots([])
    setIsResetOpen(false)
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
              id: snapshot.id || createSnapshotId(),
            }))
        )
      } catch {
        event.target.value = ""
      }
    }
    reader.readAsText(file)
  }

  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_top_left,color-mix(in_oklch,var(--chart-1),transparent_78%),transparent_30rem),linear-gradient(180deg,var(--background),var(--muted))] pb-24 text-foreground sm:pb-0">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <header className="rounded-md border bg-card/82 p-4 shadow-[0_24px_90px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-5">
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
                      : isLoading || isSaving
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
              <Button
                variant="outline"
                onClick={() => setIsResetOpen(true)}
                disabled={!snapshots.length}
              >
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
            id="snapshot-form"
            className="rounded-md border bg-card/88 p-4 shadow-[0_24px_90px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-5"
            onSubmit={(event) => {
              event.preventDefault()
              void addSnapshot()
            }}
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">New snapshot</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Type values manually, or use OCR as an assist.
                </p>
              </div>
              <div className="rounded-md border bg-background px-2.5 py-1 font-mono text-xs text-muted-foreground">
                {isLoading ? "syncing" : `${snapshots.length} saved`}
              </div>
            </div>
            <div className="grid gap-4 rounded-md border bg-background/72 p-3 shadow-inner">
              <div>
                <div className="text-sm font-medium">Manual entry</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Enter the numbers directly. OCR is optional.
                </div>
              </div>
              <label className="grid gap-2 text-sm font-medium">
                Label
                <input
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  className="h-12 rounded-md border bg-background px-3 font-mono text-base ring-offset-background transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <div className="grid gap-2">
                <div className="text-[11px] font-medium tracking-normal text-muted-foreground uppercase">
                  Presets
                </div>
                <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                  {quickLabels.map((quickLabel) => (
                    <Button
                      key={quickLabel}
                      type="button"
                      size="xs"
                      className="shrink-0"
                      variant={label === quickLabel ? "default" : "outline"}
                      onClick={() => setLabel(quickLabel)}
                    >
                      {quickLabel}
                    </Button>
                  ))}
                </div>
              </div>
              <label className="grid gap-2 text-sm font-medium">
                Currency
                <input
                  inputMode="numeric"
                  placeholder="1,671,425"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  className="h-14 rounded-md border bg-background px-3 font-mono text-lg ring-offset-background transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Stash value
                <input
                  inputMode="numeric"
                  placeholder="3,412,317"
                  value={stash}
                  onChange={(event) => setStash(event.target.value)}
                  className="h-14 rounded-md border bg-background px-3 font-mono text-lg ring-offset-background transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              {latest ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setCurrency(String(latest.currency))
                    setStash(String(latest.stash))
                    setLabel("Current")
                  }}
                >
                  Use latest values
                </Button>
              ) : null}
              <div className="rounded-md border bg-background p-3">
                <div className="text-xs font-medium tracking-normal text-muted-foreground uppercase">
                  Snapshot total
                </div>
                <div className="mt-1 font-mono text-2xl font-semibold">
                  {formatCredits(total)}
                </div>
              </div>
              {saveError ? (
                <div
                  className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
                  role="alert"
                  data-testid="save-error"
                >
                  {saveError}
                </div>
              ) : null}
              <Button
                type="button"
                className="h-11 w-full"
                disabled={isSaving || !total}
                onClick={() => void addSnapshot()}
              >
                {isSaving ? "Saving" : "Save snapshot"}
              </Button>
            </div>
            <div className="mt-4 overflow-hidden rounded-md border bg-background/72 shadow-inner">
              <div className="border-b bg-muted/30 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">OCR assist</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Scan one tight crop per number, then confirm before apply.
                    </div>
                  </div>
                  <div className="rounded-md border bg-background px-2 py-1 font-mono text-[11px] text-muted-foreground">
                    {ocrStatus}
                  </div>
                </div>
              </div>
              <div className="grid gap-2 p-3">
                <label className="flex h-11 cursor-pointer items-center justify-between rounded-md border bg-card px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground">
                  <span>
                    {readingTarget === "currency" ? "Reading" : "Scan currency"}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatCredits(currencyValue)}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(event) => importNumberImage("currency", event)}
                    className="sr-only"
                    disabled={readingTarget !== null}
                  />
                </label>
                <label className="flex h-11 cursor-pointer items-center justify-between rounded-md border bg-card px-3 text-sm font-medium shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground">
                  <span>
                    {readingTarget === "stash" ? "Reading" : "Scan stash"}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatCredits(stashValue)}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(event) => importNumberImage("stash", event)}
                    className="sr-only"
                    disabled={readingTarget !== null}
                  />
                </label>
              </div>
              {ocrReview ? (
                <div className="border-t bg-card p-3">
                  <div className="text-xs font-medium tracking-normal text-muted-foreground uppercase">
                    Confirm {getOcrTargetLabel(ocrReview.target)}
                  </div>
                  <input
                    inputMode="numeric"
                    value={ocrReview.value}
                    onChange={(event) =>
                      setOcrReview({
                        ...ocrReview,
                        value: event.target.value,
                      })
                    }
                    className="mt-2 h-11 w-full rounded-md border bg-background px-3 font-mono text-lg font-semibold ring-offset-background transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  {ocrReview.candidates.length > 1 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {ocrReview.candidates.slice(0, 4).map((candidate) => (
                        <Button
                          key={candidate}
                          type="button"
                          size="xs"
                          variant={
                            ocrReview.value === String(candidate)
                              ? "default"
                              : "outline"
                          }
                          onClick={() =>
                            setOcrReview({
                              ...ocrReview,
                              value: String(candidate),
                            })
                          }
                        >
                          {formatCredits(candidate)}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setOcrReview(null)
                        setOcrStatus("Ready")
                      }}
                    >
                      Reject
                    </Button>
                    <Button type="button" onClick={confirmOcrValue}>
                      Apply
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </form>

          <div className="grid gap-4">
            <div className="flex flex-col gap-3 rounded-md border bg-card/90 p-3 shadow-[0_18px_70px_rgba(15,23,42,0.06)] sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-1.5">
                {chartRanges.map((range) => (
                  <Button
                    key={range.value}
                    type="button"
                    size="sm"
                    variant={chartRange === range.value ? "default" : "ghost"}
                    aria-pressed={chartRange === range.value}
                    onClick={() => {
                      setChartRange(range.value)
                      if (range.value === "custom" && latest) {
                        setCustomFrom(
                          (current) =>
                            current ||
                            formatDateInput(
                              first?.createdAt || latest.createdAt
                            )
                        )
                        setCustomTo(
                          (current) =>
                            current || formatDateInput(latest.createdAt)
                        )
                      }
                    }}
                  >
                    {range.label}
                  </Button>
                ))}
              </div>
              {chartRange === "custom" ? (
                <div className="flex flex-wrap gap-2">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(event) => setCustomFrom(event.target.value)}
                    className="h-8 rounded-md border bg-background px-2 font-mono text-xs ring-offset-background transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <input
                    type="date"
                    value={customTo}
                    onChange={(event) => setCustomTo(event.target.value)}
                    className="h-8 rounded-md border bg-background px-2 font-mono text-xs ring-offset-background transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              ) : null}
            </div>
            {isLoading ? (
              <div className="flex h-[320px] items-center justify-center rounded-md border bg-card text-sm text-muted-foreground">
                Syncing shared ledger...
              </div>
            ) : chartSnapshots.length ? (
              <NetworthChart snapshots={chartSnapshots} />
            ) : (
              <div className="flex h-[320px] items-center justify-center rounded-md border bg-card text-sm text-muted-foreground">
                No snapshots in this range.
              </div>
            )}
            <div className="overflow-hidden rounded-md border bg-card/90 shadow-[0_18px_70px_rgba(15,23,42,0.06)]">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 border-b bg-muted/40 px-4 py-3 text-[11px] font-medium tracking-normal text-muted-foreground uppercase">
                <span>Snapshot</span>
                <span>Total</span>
                <span>P&L</span>
                <span className="sr-only">Actions</span>
              </div>
              <div className="max-h-[280px] overflow-auto">
                {isLoading ? (
                  <div className="px-4 py-6 text-sm text-muted-foreground">
                    Loading shared snapshots...
                  </div>
                ) : null}
                {displayedSnapshotDeltas.map(
                  ({ snapshot, delta, hasPrevious }) => (
                    <div
                      key={snapshot.id}
                      className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 border-b px-4 py-3 text-sm last:border-0"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {snapshot.label}
                        </div>
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
                        {hasPrevious ? formatDelta(delta) : "-"}
                      </div>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        aria-label={`Edit ${snapshot.label}`}
                        onClick={() => openSnapshotEditor(snapshot)}
                      >
                        Edit
                      </Button>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
      <div className="fixed right-0 bottom-0 left-0 z-40 border-t bg-background/94 p-3 shadow-[0_-16px_50px_rgba(15,23,42,0.12)] backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium tracking-normal text-muted-foreground uppercase">
              Snapshot total
            </div>
            <div className="flex items-baseline gap-2">
              <div className="truncate font-mono text-lg font-semibold">
                {formatCredits(total)}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">
                {syncStatus}
              </div>
            </div>
          </div>
          <Button
            type="button"
            className="h-11 min-w-32"
            disabled={isSaving || !total}
            onClick={() => void addSnapshot()}
          >
            {isSaving ? "Saving" : "Save"}
          </Button>
        </div>
      </div>
      {isResetOpen ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-title"
        >
          <div className="w-full max-w-sm rounded-md border bg-card p-5 shadow-[0_24px_90px_rgba(15,23,42,0.18)]">
            <h2 id="reset-title" className="text-lg font-semibold">
              Reset snapshots?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This clears the shared ledger for every device.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsResetOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={clearSnapshots}>
                Reset
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {editingSnapshot ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-title"
        >
          <div className="w-full max-w-sm rounded-md border bg-card p-5 shadow-[0_24px_90px_rgba(15,23,42,0.18)]">
            <h2 id="edit-title" className="text-lg font-semibold">
              Edit snapshot
            </h2>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {formatSnapshotDate(editingSnapshot.createdAt)}
            </p>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-2 text-sm font-medium">
                Edit label
                <input
                  value={editLabel}
                  onChange={(event) => setEditLabel(event.target.value)}
                  className="h-11 rounded-md border bg-background px-3 font-mono text-base ring-offset-background transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Edit currency
                <input
                  inputMode="numeric"
                  value={editCurrency}
                  onChange={(event) => setEditCurrency(event.target.value)}
                  className="h-11 rounded-md border bg-background px-3 font-mono text-base ring-offset-background transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Edit stash value
                <input
                  inputMode="numeric"
                  value={editStash}
                  onChange={(event) => setEditStash(event.target.value)}
                  className="h-11 rounded-md border bg-background px-3 font-mono text-base ring-offset-background transition-shadow outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <div className="rounded-md border bg-background p-3">
                <div className="text-xs font-medium tracking-normal text-muted-foreground uppercase">
                  Edited total
                </div>
                <div className="mt-1 font-mono text-xl font-semibold">
                  {formatCredits(
                    parseCredits(editCurrency) + parseCredits(editStash)
                  )}
                </div>
              </div>
              {editError ? (
                <div
                  className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
                  role="alert"
                  data-testid="edit-error"
                >
                  {editError}
                </div>
              ) : null}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setEditingSnapshot(null)
                  setEditError("")
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void saveSnapshotEdit()}
                disabled={isSaving}
              >
                {isSaving ? "Saving" : "Save edit"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
