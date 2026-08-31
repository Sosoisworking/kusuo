import { useEffect } from 'react'
import { Route, Routes } from 'react-router'
import Layout from './components/Layout'
import { seedExercises } from './db/exercises'
import { getOrCreateDeviceId, getSettings } from './db/settings'
import { applyTheme } from './lib/theme'
import CalendarView from './pages/CalendarView'
import Goals from './pages/Goals'
import HabitDetail from './pages/HabitDetail'
import HabitForm from './pages/HabitForm'
import Onboarding from './pages/Onboarding'
import Progress from './pages/Progress'
import Records from './pages/Records'
import Reflection from './pages/Reflection'
import Settings from './pages/Settings'
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
      <Route element={<Layout />}>
        <Route path="/" element={<Today />} />
        <Route path="/train" element={<Train />} />
        <Route path="/splits" element={<Splits />} />
        <Route path="/calendar" element={<CalendarView />} />
        <Route path="/records" element={<Records />} />
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
