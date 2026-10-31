import { Navigate, Route, Routes } from 'react-router-dom'
import { useApp } from './context/AppContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Opportunities from './pages/Opportunities'
import OpportunityForm from './pages/OpportunityForm'
import ResumeMatcher from './pages/ResumeMatcher'
import AtsChecker from './pages/AtsChecker'
import ScreeningQuestions from './pages/ScreeningQuestions'
import ResumeDatabase from './pages/ResumeDatabase'
import CandidateEvaluation from './pages/CandidateEvaluation'
import EvaluationForm from './pages/EvaluationForm'
import Offers from './pages/Offers'

function Protected({ children }) {
  const { user } = useApp()
  return user ? children : <Navigate to="/login" replace />
}
function Public({ children }) {
  const { user } = useApp()
  return user ? <Navigate to="/" replace /> : children
}

export default function App() {
  const { booting } = useApp()
  if (booting) return <div className="flex h-screen items-center justify-center text-sm text-muted">Loading TalentOS…</div>
  return (
    <Routes>
      <Route path="/login" element={<Public><Login /></Public>} />
      <Route path="/signup" element={<Public><Signup /></Public>} />
      <Route element={<Protected><Layout /></Protected>}>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/opportunities" element={<Opportunities />} />
        <Route path="/opportunities/new" element={<OpportunityForm />} />
        <Route path="/opportunities/:id/edit" element={<OpportunityForm />} />
        <Route path="/resume-matcher" element={<ResumeMatcher />} />
        <Route path="/ats-score" element={<AtsChecker />} />
        <Route path="/screening-questions" element={<ScreeningQuestions />} />
        <Route path="/resume-database" element={<ResumeDatabase />} />
        <Route path="/candidate-evaluation" element={<CandidateEvaluation />} />
        <Route path="/candidate-evaluation/:section" element={<CandidateEvaluation />} />
        <Route path="/candidate-evaluation/:section/:appId" element={<EvaluationForm />} />
        <Route path="/offers" element={<Offers />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
