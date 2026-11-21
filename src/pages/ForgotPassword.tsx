import { useState } from 'react'
import { Link } from 'react-router'

import { AuthShell } from '../components/layout/AuthShell'
import { Button } from '../components/ui/Button'
import { Alert } from '../components/ui/Card'
import { FieldError, Input, Label } from '../components/ui/Field'
import { api, errorMessage } from '../lib/api'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<{ message: string; resetToken?: string } | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.')
      return
    }
    setError('')
    setBusy(true)
    try {
      const data = await api.post<{ message: string; resetToken?: string }>('/auth/forgot-password', { email: email.trim() })
      setSent(data)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll create a secure, single-use reset link for your account."
      footer={
        <p>
          Remembered it?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      }
    >
      {sent ? (
        <div className="space-y-4">
          <Alert tone="success" title="Request received">
            {sent.message}
          </Alert>
          {sent.resetToken ? (
            <Alert tone="warn" title="Development reset token">
              Email delivery is not enabled on this deployment. Use this one-time link to set a new password:
              <Link
                to={`/reset-password?token=${sent.resetToken}`}
                className="mt-2 block break-all font-medium text-primary hover:underline"
              >
                Continue to reset password
              </Link>
            </Alert>
          ) : null}
          <Button variant="secondary" className="w-full" onClick={() => setSent(null)}>
            Use a different email
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@college.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
            <FieldError>{error && !error.includes('valid') ? '' : undefined}</FieldError>
          </div>
          <Button type="submit" className="w-full" loading={busy} size="lg">
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
