import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import { seedExercises } from './db/exercises'
import { getOrCreateDeviceId, getSettings } from './db/settings'
import { applyTheme } from './lib/theme'
import CalendarView from './pages/CalendarView'
import Directory from './pages/Directory'
import ExerciseDetail from './pages/ExerciseDetail'
import Goals from './pages/Goals'
import HabitDetail from './pages/HabitDetail'
import HabitForm from './pages/HabitForm'
import Onboarding from './pages/Onboarding'
import Records from './pages/Records'
import Reflection from './pages/Reflection'
import Session from './pages/Session'
import Settings from './pages/Settings'
import Share from './pages/Share'
import SplitEditor from './pages/SplitEditor'
import Splits from './pages/Splits'
import Today from './pages/Today'
import YourData from './pages/YourData'
import Train from './pages/Train'

function App() {
  useEffect(() => {
    getSettings(getOrCreateDeviceId()).then((s) => {
      if (!s) return
      applyTheme(s.theme)
      // Fills in any movements this install is missing, including ones added in
      // a later app version. Writers only: a reader device gets its directory
      // from the imported backup, and nothing on the Mac writes to the database.
      if (s.deviceRole === 'writer') void seedExercises()
    })
  }, [])

  return (
    // Outside the router, so a throw while resolving a route is caught too.
    <ErrorBoundary>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/habits/new" element={<HabitForm />} />
        <Route path="/habits/:id/edit" element={<HabitForm />} />
        {/* A session is a focused mode, so it sits outside the tab shell: the way
            out is finishing it or leaving it, not wandering into Records mid-set.
            The editor and the directory are full screens for the same reason —
            the tab bar would only offer a way to leave a half-finished edit by
            the wrong door. */}
        <Route path="/train/session/:dayId" element={<Session />} />
        <Route path="/splits/:splitId/edit" element={<SplitEditor />} />
        <Route path="/exercises" element={<Directory />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Today />} />
          <Route path="/train" element={<Train />} />
          <Route path="/splits" element={<Splits />} />
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/records" element={<Records />} />
          {/* Exercise detail keeps the tab bar, the way habit detail does: it is
              a thing you read, and a reader device can reach it too. */}
          <Route path="/exercises/:id" element={<ExerciseDetail />} />
          {/* Habit detail is where a habit's own history lives — its streak,
              its total, and the month grid. Today's habit rows open it by name,
              which is the only way in and the reason the screen is here. */}
          <Route path="/habits/:id" element={<HabitDetail />} />
          {/* Progress lost its tab to Calendar and Records, and then lost its
              screen: slices E and F absorbed the counts and the bests, and habit
              detail already said everything left. Kept as its own route rather
              than left to the catch-all below, because a URL retired on purpose
              and a URL typed wrong are not the same fact — if the catch-all ever
              starts saying something, this one must still just go home. */}
          <Route path="/progress" element={<Navigate to="/" replace />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/data" element={<YourData />} />
          <Route path="/settings/share" element={<Share />} />
          <Route path="/reflection" element={<Reflection />} />
          <Route path="/goals" element={<Goals />} />
        </Route>
        {/*
          Anything else goes home. public/404.html now folds an unknown path into
          the query string and index.html unfolds it, so a URL that used to hit
          GitHub's 404 reaches the router instead — and reached nothing, which
          rendered blank.

          Home rather than a "not found" screen, and the reason is the installed
          app: on the home screen there is no address bar, so the user cannot
          have typed this and has no field to correct. The realistic sources are
          a stale bookmark and a shared link, and for both of those Today is the
          answer, not an explanation of a mechanism they cannot see. Every real
          route is declared above and outranks a splat, so nothing reachable is
          swallowed — including /progress and the /onboarding gate, which Today
          redirects to on its own when the device has not been through it.
        */}
          <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  )
}

export default App
