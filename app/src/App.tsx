import { Route, Routes } from 'react-router'
import HabitForm from './pages/HabitForm'
import Onboarding from './pages/Onboarding'
import Today from './pages/Today'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Today />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/habits/new" element={<HabitForm />} />
      <Route path="/habits/:id/edit" element={<HabitForm />} />
    </Routes>
  )
}

export default App
