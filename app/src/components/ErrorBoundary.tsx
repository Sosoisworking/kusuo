import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * The floor under the whole app.
 *
 * A single throw in any screen used to unmount the entire tree and leave a
 * white page that survived reloads and tab taps — which happened for real, from
 * one illegal `Intl` option in a date format. On a device holding the only copy
 * of the record, a blank screen reads as "my history is gone".
 *
 * So the fallback's job is not to apologise. It is to say the record is still
 * on the device, and to keep the one route that gets it off the device reachable
 * even while the app cannot render: Your data, and the export inside it. It uses
 * plain links rather than the router, because the router is one of the things
 * that might have thrown.
 */
interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

const DATA_PATH = `${import.meta.env.BASE_URL}settings/data`

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No telemetry leaves this device, so the console is the only place a
    // stack can go. It is worth keeping: it is what makes the next fix possible.
    console.error('Kusuo could not render:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <main className="flex min-h-dvh flex-col justify-center gap-5 px-6 py-16">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-medium text-[var(--color-text-primary)]">
            Kusuo could not draw this screen
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Your habits, sessions and reflections are untouched on this device. Nothing has been
            deleted, and nothing has been sent anywhere.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => window.location.reload()}
            className="flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 py-3 text-sm text-[var(--color-bg)]"
          >
            Reload Kusuo
          </button>
          <a
            href={DATA_PATH}
            className="flex min-h-11 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-5 py-3 text-sm text-[var(--color-text-primary)]"
          >
            Go to Your data and export a copy
          </a>
        </div>

        {/* Named, not hidden: it is the one thing that makes the fault fixable. */}
        <p className="text-xs text-[var(--color-text-secondary)]">{error.message}</p>
      </main>
    )
  }
}
