import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'

import { AuthShell } from '../components/layout/AuthShell'
import { Button } from '../components/ui/Button'
import { Alert } from '../components/ui/Card'
import { FieldError, Input, Label } from '../components/ui/Field'
import { useAuth } from '../contexts/AuthContext'
import { errorMessage } from '../lib/api'

export function Login() {
  const { user, signIn, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({})
  const [busy, setBusy] = useState(false)

  if (!loading && user) return <Navigate to="/app" replace />

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Enter a valid email address.'
    if (!password) next.password = 'Enter your password.'
    setErrors(next)
    if (Object.keys(next).length) return

    setBusy(true)
    try {
      await signIn(email.trim(), password)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from && from.startsWith('/app') ? from : '/app', { replace: true })
    } catch (err) {
      setErrors({ form: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue where you left off."
      footer={
        <p>
          New here?{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Create a free account
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {errors.form ? <Alert tone="error">{errors.form}</Alert> : null}

        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@college.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            invalid={Boolean(errors.email)}
            autoFocus
          />
          <FieldError>{errors.email}</FieldError>
        </div>

        <div>
          <Label htmlFor="password" hint={<Link to="/forgot-password" className="text-primary hover:underline">Forgot password?</Link>}>
            Password
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={Boolean(errors.password)}
          />
          <FieldError>{errors.password}</FieldError>
        </div>

        <Button type="submit" className="w-full" loading={busy} size="lg">
          Sign in
        </Button>
      </form>
    </AuthShell>
  )
}
