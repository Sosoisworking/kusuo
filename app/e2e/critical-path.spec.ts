import { expect, test } from '@playwright/test'

/**
 * Onboard, tick a habit, reload, and confirm it is still ticked.
 *
 * SPEC.md's definition of done names exactly this path. It is the one thing the
 * component tests cannot prove: they use a fake IndexedDB inside one process,
 * so they can show the code writes, never that the data survives the browser
 * throwing the page away and starting again.
 */
test('a habit ticked survives a reload', async ({ page }) => {
  await page.goto('./')

  await page.getByRole('button', { name: 'Set it up' }).click()
  await page.getByRole('button', { name: 'This is my iPhone' }).click()
  await page.getByRole('textbox').first().fill('Soso')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Get started' }).click()
  await page.getByRole('button', { name: /not lifting yet/ }).click()

  // Exact, because the row's sibling edit button is "Edit Reading".
  const reading = page.getByRole('button', { name: 'Reading', exact: true })
  await expect(reading).toHaveAttribute('aria-pressed', 'false')
  await reading.click()
  await expect(page.getByRole('button', { name: /^Reading/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  await page.reload()

  await expect(page.getByRole('button', { name: /^Reading/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('a logged set survives a reload', async ({ page }) => {
  await page.goto('./')

  await page.getByRole('button', { name: 'Set it up' }).click()
  await page.getByRole('button', { name: 'This is my iPhone' }).click()
  await page.getByRole('button', { name: /Skip/ }).click()
  await page.getByRole('button', { name: 'Get started' }).click()
  // Exact: three templates start with these words.
  await page.getByRole('button', { name: 'Push / Pull / Legs 3 days' }).click()

  await page.getByRole('link', { name: 'Train' }).click()
  await page.getByRole('button', { name: /Start session/ }).click()

  await page.getByLabel(/Weight for set 1/).fill('80')
  await page.getByLabel(/Reps for set 1/).fill('6')
  await page.getByRole('button', { name: 'Log set 1' }).click()
  await expect(page.getByRole('button', { name: 'Set 1 logged — remove it' })).toBeVisible()

  await page.reload()

  await expect(page.getByRole('button', { name: 'Set 1 logged — remove it' })).toBeVisible()
  await expect(page.getByLabel(/Weight for set 1/)).toHaveValue('80')
})
