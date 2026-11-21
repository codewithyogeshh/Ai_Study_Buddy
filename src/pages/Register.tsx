import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { Check } from 'lucide-react'

import { AuthShell } from '../components/layout/AuthShell'
import { Button } from '../components/ui/Button'
import { Alert } from '../components/ui/Card'
import { FieldError, Input, Label } from '../components/ui/Field'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { errorMessage } from '../lib/api'

export function Register() {
  const { user, signUp, loading } = useAuth()
  const navigate = useNavigate()
  const { success } = useToast()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  if (!loading && user) return <Navigate to="/app" replace />

  const passwordOk = form.password.length >= 8 && /[A-Za-z]/.test(form.password) && /\d/.test(form.password)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (form.name.trim().length < 2) next.name = 'Enter your name.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email address.'
    if (!passwordOk) next.password = 'Use at least 8 characters with a letter and a number.'
    if (form.confirm !== form.password) next.confirm = 'Passwords do not match.'
    setErrors(next)
    if (Object.keys(next).length) return

    setBusy(true)
    try {
      await signUp(form.name.trim(), form.email.trim(), form.password)
      success('Welcome to AI Study Buddy! Upload your first document to get started.')
      navigate('/app', { replace: true })
    } catch (err) {
      setErrors({ form: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start turning your study material into notes, quizzes and practice sessions."
      footer={
        <p>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {errors.form ? <Alert tone="error">{errors.form}</Alert> : null}

        <div>
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            autoComplete="name"
            placeholder="Aarav Sharma"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            invalid={Boolean(errors.name)}
            autoFocus
          />
          <FieldError>{errors.name}</FieldError>
        </div>

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@college.edu"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            invalid={Boolean(errors.email)}
          />
          <FieldError>{errors.email}</FieldError>
        </div>

        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            invalid={Boolean(errors.password)}
          />
          <FieldError>{errors.password}</FieldError>
          <ul className="mt-2 space-y-1 text-[11.5px] text-muted">
            <li className="flex items-center gap-1.5">
              <Check className={`size-3 ${form.password.length >= 8 ? 'text-ok' : 'text-line-strong'}`} /> 8+ characters
            </li>
            <li className="flex items-center gap-1.5">
              <Check className={`size-3 ${/[A-Za-z]/.test(form.password) && /\d/.test(form.password) ? 'text-ok' : 'text-line-strong'}`} />
              At least one letter and one number
            </li>
          </ul>
        </div>

        <div>
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat your password"
            value={form.confirm}
            onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            invalid={Boolean(errors.confirm)}
          />
          <FieldError>{errors.confirm}</FieldError>
        </div>

        <Button type="submit" className="w-full" loading={busy} size="lg">
          Create account
        </Button>
      </form>
    </AuthShell>
  )
}
