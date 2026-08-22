import { Route, Routes } from 'react-router'
import Onboarding from './pages/Onboarding'
import Today from './pages/Today'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Today />} />
      <Route path="/onboarding" element={<Onboarding />} />
    </Routes>
  )
}

export default App
