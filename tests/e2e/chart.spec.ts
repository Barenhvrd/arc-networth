import { expect, type Page, type Route, test } from "@playwright/test"

type Snapshot = {
  id: string
  label: string
  currency: number
  stash: number
  total: number
  createdAt: string
}

const snapshots = [
  {
    id: "baseline",
    label: "Baseline",
    currency: 40,
    stash: 60,
    total: 100,
    createdAt: "2026-06-09T18:00:00.000Z",
  },
  {
    id: "after-raid",
    label: "After raid",
    currency: 120,
    stash: 180,
    total: 300,
    createdAt: "2026-06-09T19:00:00.000Z",
  },
]

async function routeSnapshots(page: Page, state: Snapshot[] = [...snapshots]) {
  await page.route("**/api/snapshots", async (route: Route) => {
    const request = route.request()

    if (request.method() === "POST") {
      const body = request.postDataJSON() as { snapshots?: Snapshot[] }
      state.splice(0, state.length, ...(body.snapshots || []))
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ snapshots: state }),
    })
  })

  return state
}

test("graph points select their snapshot networth", async ({ page }) => {
  await routeSnapshots(page)
  const messages: string[] = []
  page.on("console", (message) => messages.push(message.text()))

  await page.goto("/")

  await expect(page.getByTestId("chart-selected-networth")).toHaveCount(0)

  await page.getByTestId("chart-point-baseline").click()
  await expect(page.getByTestId("chart-selected-networth")).toHaveText("100")
  expect(
    messages.some((message) => message.includes("chart point selected"))
  ).toBe(true)

  await page.getByTestId("chart-point-after-raid").click()
  await expect(page.getByTestId("chart-selected-networth")).toHaveText("300")
})

test("graph tooltip can be dismissed", async ({ page }) => {
  await routeSnapshots(page)

  await page.goto("/")

  await page.getByTestId("chart-point-baseline").click()
  await expect(page.getByTestId("chart-selected-networth")).toHaveText("100")

  await page
    .getByTestId("chart-dismiss-area")
    .click({ position: { x: 360, y: 130 } })
  await expect(page.getByTestId("chart-selected-networth")).toHaveCount(0)

  await page.getByTestId("chart-point-after-raid").click()
  await expect(page.getByTestId("chart-selected-networth")).toHaveText("300")

  await page.getByRole("button", { name: "Close chart tooltip" }).click()
  await expect(page.getByTestId("chart-selected-networth")).toHaveCount(0)

  await page.getByTestId("chart-point-after-raid").click()
  await expect(page.getByTestId("chart-selected-networth")).toHaveText("300")

  await page.keyboard.press("Escape")
  await expect(page.getByTestId("chart-selected-networth")).toHaveCount(0)
})

test("graph tooltip dismisses from mobile touch outside the point", async ({
  isMobile,
  page,
}) => {
  test.skip(!isMobile, "mobile touch regression")

  await routeSnapshots(page)

  await page.goto("/")

  await page.getByTestId("chart-point-baseline").tap()
  await expect(page.getByTestId("chart-selected-networth")).toHaveText("100")

  const chartBox = await page.getByTestId("chart-shell").boundingBox()
  expect(chartBox).not.toBeNull()

  await page.touchscreen.tap(
    chartBox!.x + chartBox!.width - 24,
    chartBox!.y + 24
  )
  await expect(page.getByTestId("chart-selected-networth")).toHaveCount(0)
})

test("save snapshot works when crypto.randomUUID is unavailable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    try {
      Object.defineProperty(globalThis.crypto, "randomUUID", {
        value: undefined,
        configurable: true,
      })
    } catch {
      // Some browsers expose this as non-configurable; the app still handles
      // regular browsers, and this test covers the LAN/mobile fallback when possible.
    }
  })

  const state = await routeSnapshots(page, [snapshots[0]])

  await page.goto("/")
  await page.getByLabel("Label").fill("Regression raid")
  await page.getByRole("textbox", { name: "Currency" }).fill("1 111")
  await page.getByRole("textbox", { name: "Stash value" }).fill("2 222")
  await page.getByRole("button", { name: "Save snapshot" }).click()

  await expect(page.getByText("Regression raid")).toBeVisible()
  await expect(page.getByTestId("save-error")).toHaveCount(0)
  expect(state).toHaveLength(2)
  expect(state.at(-1)).toMatchObject({
    label: "Regression raid",
    currency: 1111,
    stash: 2222,
    total: 3333,
  })
})

test("past snapshots can be edited", async ({ page }) => {
  const state = await routeSnapshots(page)

  await page.goto("/")
  await page.getByRole("button", { name: "Edit Baseline" }).click()
  await page.getByRole("textbox", { name: "Edit label" }).fill("Fixed baseline")
  await page.getByRole("textbox", { name: "Edit currency" }).fill("1 500")
  await page.getByRole("textbox", { name: "Edit stash value" }).fill("2 500")
  await page.getByRole("button", { name: "Save edit" }).click()

  await expect(page.getByText("Fixed baseline")).toBeVisible()
  await expect(page.getByText("4,000")).toBeVisible()
  await expect(page.getByTestId("edit-error")).toHaveCount(0)
  expect(state[0]).toMatchObject({
    label: "Fixed baseline",
    currency: 1500,
    stash: 2500,
    total: 4000,
  })
})
