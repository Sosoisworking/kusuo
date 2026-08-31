import { useEffect } from 'react'
import { Route, Routes } from 'react-router'
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
import Progress from './pages/Progress'
import Records from './pages/Records'
import Reflection from './pages/Reflection'
import Session from './pages/Session'
import Settings from './pages/Settings'
import SplitEditor from './pages/SplitEditor'
import Splits from './pages/Splits'
import Today from './pages/Today'
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
        {/* Progress lost its tab to Calendar and Records. The route stays so
            existing links keep working; slices E and F absorb what it shows. */}
        <Route path="/progress" element={<Progress />} />
        <Route path="/habits/:id" element={<HabitDetail />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/reflection" element={<Reflection />} />
        <Route path="/goals" element={<Goals />} />
      </Route>
    </Routes>
  )
}

export default App
