import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { AuthShell } from '../components/layout/AuthShell'
import { Button } from '../components/ui/Button'
import { Alert } from '../components/ui/Card'
import { FieldError, Input, Label } from '../components/ui/Field'
import { api, errorMessage } from '../lib/api'

export function ResetPassword() {
  const [params] = useSearchParams()
  const [token, setToken] = useState(params.get('token') ?? '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const next: Record<string, string> = {}
    if (!token.trim()) next.token = 'Paste the reset token or open the full reset link.'
    if (!(password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password)))
      next.password = 'Use at least 8 characters with a letter and a number.'
    if (confirm !== password) next.confirm = 'Passwords do not match.'
    setErrors(next)
    if (Object.keys(next).length) return

    setBusy(true)
    try {
      await api.post('/auth/reset-password', { token: token.trim(), newPassword: password })
      setDone(true)
    } catch (err) {
      setErrors({ form: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="This link can only be used once."
      footer={
        <p>
          <Link to="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      }
    >
      {done ? (
        <div className="space-y-4">
          <Alert tone="success" title="Password updated">
            Your password has been changed. You can now sign in with it.
          </Alert>
          <Link
            to="/login"
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-on-primary hover:bg-primary-hover"
          >
            Go to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {errors.form ? <Alert tone="error">{errors.form}</Alert> : null}
          <div>
            <Label htmlFor="token">Reset token</Label>
            <Input
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your reset token"
              invalid={Boolean(errors.token)}
            />
            <FieldError>{errors.token}</FieldError>
          </div>
          <div>
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              invalid={Boolean(errors.password)}
            />
            <FieldError>{errors.password}</FieldError>
          </div>
          <div>
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              invalid={Boolean(errors.confirm)}
            />
            <FieldError>{errors.confirm}</FieldError>
          </div>
          <Button type="submit" className="w-full" loading={busy} size="lg">
            Update password
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
