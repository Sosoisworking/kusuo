import type { Theme } from '../db/schema'

/** Sets/clears the data-theme attribute driving the explicit overrides in tokens.css. 'system' clears it so prefers-color-scheme decides. */
export function applyTheme(theme: Theme): void {
  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', theme)
  }
}
