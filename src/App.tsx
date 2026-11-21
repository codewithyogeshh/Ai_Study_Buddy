import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router'

import { AppLayout } from './components/layout/AppLayout'
import { RequireAuth } from './components/layout/Protected'
import { Chat } from './pages/Chat'
import { Dashboard } from './pages/Dashboard'
import { DocumentDetail } from './pages/DocumentDetail'
import { Documents } from './pages/Documents'
import { Flashcards } from './pages/Flashcards'
import { ForgotPassword } from './pages/ForgotPassword'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { Notes } from './pages/Notes'
import { NotFound } from './pages/NotFound'
import { Planner } from './pages/Planner'
import { Progress } from './pages/Progress'
import { QuizGenerator } from './pages/QuizGenerator'
import { QuizResults } from './pages/QuizResults'
import { QuizTake } from './pages/QuizTake'
import { Register } from './pages/Register'
import { ResetPassword } from './pages/ResetPassword'
import { Settings } from './pages/Settings'
import { Viva } from './pages/Viva'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    // Braces matter: an expression body would return whatever scrollTo returns
    // (some browsers/wrappers return a Promise), which React treats as a cleanup.
    window.scrollTo({ top: 0 })
  }, [pathname])
  return null
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<RequireAuth />}>
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="documents" element={<Documents />} />
            <Route path="documents/:id" element={<DocumentDetail />} />
            <Route path="chat" element={<Chat />} />
            <Route path="notes" element={<Notes />} />
            <Route path="quiz" element={<QuizGenerator />} />
            <Route path="quiz/:id" element={<QuizTake />} />
            <Route path="quiz/:id/results" element={<QuizResults />} />
            <Route path="viva" element={<Viva />} />
            <Route path="viva/:id" element={<Viva />} />
            <Route path="flashcards" element={<Flashcards />} />
            <Route path="flashcards/:id" element={<Flashcards />} />
            <Route path="planner" element={<Planner />} />
            <Route path="progress" element={<Progress />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}
