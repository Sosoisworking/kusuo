import { useEffect } from 'react'
import { Route, Routes } from 'react-router'
import Layout from './components/Layout'
import { seedExercises } from './db/exercises'
import { getOrCreateDeviceId, getSettings } from './db/settings'
import { applyTheme } from './lib/theme'
import Goals from './pages/Goals'
import HabitDetail from './pages/HabitDetail'
import HabitForm from './pages/HabitForm'
import Onboarding from './pages/Onboarding'
import Progress from './pages/Progress'
import Reflection from './pages/Reflection'
import Settings from './pages/Settings'
import Today from './pages/Today'

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
