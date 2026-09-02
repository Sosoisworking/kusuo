import { expect, test, type Page } from '@playwright/test'

/**
 * Reordering movements inside a split day, on the engine the app actually runs
 * on. The component test renders in jsdom, where there is no pointer capture,
 * no layout and therefore no drag — a handle that only answers a mouse would
 * pass there and fail on the phone.
 */

async function openSplitEditor(page: Page) {
  await page.goto('./')
  await page.getByRole('button', { name: 'Set it up' }).click()
  await page.getByRole('button', { name: 'This is my iPhone' }).click()
  await page.getByRole('textbox').first().fill('Soso')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.getByRole('button', { name: 'Push / Pull / Legs 3 days' }).click()
  await page.getByRole('link', { name: 'Splits' }).click()
  await page.getByRole('link', { name: 'Edit' }).first().click()
  await expect(page.getByRole('button', { name: /^Reorder / }).first()).toBeVisible()
}

/** The movement names, in the order the day currently lists them. */
function movementOrder(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('li'))
      .map((li) => li.querySelector('[aria-expanded]')?.querySelector('span')?.textContent?.trim())
      .filter((n): n is string => Boolean(n)),
  )
}

test('the arrow keys reorder a day, and the new order survives a reload', async ({ page }) => {
  await openSplitEditor(page)
  const before = await movementOrder(page)
  expect(before.length).toBeGreaterThan(2)

  await page.getByRole('button', { name: /^Reorder / }).first().focus()
  await page.keyboard.press('ArrowDown')

  await expect
    .poll(() => movementOrder(page))
    .toEqual([before[1], before[0], ...before.slice(2)])

  // The handle is a real control, not a decoration: it says where the row is,
  // it says which keys move it, and moving it is announced.
  await expect(page.locator('[aria-live="polite"]')).toHaveText(
    `${before[0]} moved to position 2 of ${before.length}`,
  )
  await expect(page.locator(':focus')).toHaveAttribute(
    'aria-label',
    `Reorder ${before[0]}. Position 2 of ${before.length}. Use the up and down arrow keys.`,
  )

  await page.reload()
  await expect
    .poll(() => movementOrder(page))
    .toEqual([before[1], before[0], ...before.slice(2)])
})

test('a pointer drag reorders the day', async ({ page }) => {
  await openSplitEditor(page)
  const before = await movementOrder(page)

  const handle = page.getByRole('button', { name: /^Reorder / }).first()
  const box = (await handle.boundingBox())!
  const third = (await page.locator('li').nth(2).boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  // Far enough to pass the midpoint of the row below, in steps a finger's worth
  // apart — dragMove advances at most one position per frame.
  const travel = third.y + third.height - y
  await page.mouse.move(x, y)
  await page.mouse.down()
  for (let i = 1; i <= 25; i++) {
    await page.mouse.move(x, y + (travel * i) / 25)
    await page.waitForTimeout(20)
  }
  await page.mouse.up()

  await expect.poll(() => movementOrder(page)).not.toEqual(before)
})

/**
 * DEFECT (fixed) — a drag that did not end on the handle never ended.
 *
 * `startDrag` took pointer capture on the handle, but the first swap
 * re-parents the row's <li>, which implicitly releases the capture — a
 * `lostpointercapture` fired and nothing re-acquired it. From then on
 * `pointerup` went to whatever was under the finger, and `endDrag` was wired
 * only to the handle's own onPointerUp/onPointerCancel. Lifting a finger over
 * the row's name, or over the 6px gap between rows, left `draggingKey` set for
 * good.
 *
 * What that cost, with a split open and one drag finished off-handle:
 *   - the row kept its accent border and read "· dragging";
 *   - swiping any row to remove was dead — `startSwipe` and `swipeMove` both
 *     return early while draggingKey is set;
 *   - and worst, the move handler still fired: brushing ANY handle with no
 *     finger held down silently reordered the split and wrote it to IndexedDB.
 *
 * Fixed: the drag's move and end listeners live on the window for the life of
 * one drag, so nothing can re-parent them away from the finger, and the handle
 * no longer takes a pointer capture it cannot keep.
 */
test('a drag that ends away from the handle still ends', async ({ page }) => {
  await openSplitEditor(page)
  const handle = page.getByRole('button', { name: /^Reorder / }).first()
  const box = (await handle.boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2

  await page.mouse.move(x, y)
  await page.mouse.down()
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(x, y + i * 5)
    await page.waitForTimeout(20)
  }
  // The finger drifts onto the movement's name before lifting, as fingers do.
  await page.mouse.move(x + 160, y + 100)
  await page.mouse.up()

  await expect(page.getByText('· dragging')).toHaveCount(0)

  // And with the drag genuinely over, moving across a handle must not reorder.
  const settled = await movementOrder(page)
  const other = page.getByRole('button', { name: /^Reorder / }).nth(3)
  const ob = (await other.boundingBox())!
  await page.mouse.move(ob.x + 5, ob.y + ob.height / 2)
  for (let i = 0; i < 10; i++) {
    await page.mouse.move(ob.x + 5, ob.y + ob.height / 2 - i * 10)
    await page.waitForTimeout(25)
  }
  expect(await movementOrder(page)).toEqual(settled)
})
