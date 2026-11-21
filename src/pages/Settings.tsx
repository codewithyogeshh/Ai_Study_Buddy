import { useState } from 'react'
import { Check, KeyRound, LogOut, Moon, Palette, ShieldCheck, Sparkles, Sun, UserRound } from 'lucide-react'

import { Button } from '../components/ui/Button'
import { Alert, Badge, Card, CardHeader, PageHeader } from '../components/ui/Card'
import { FieldError, Input, Label, Select } from '../components/ui/Field'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useAiStatus } from '../hooks/useAiStatus'
import { useTheme } from '../hooks/useTheme'
import { api, errorMessage } from '../lib/api'
import { formatDate } from '../lib/format'
import type { Language, User } from '../types'

export function Settings() {
  const { user, setUser, signOut } = useAuth()
  const { success, error: toastError } = useToast()
  const { theme, setTheme } = useTheme()
  const ai = useAiStatus()

  const [name, setName] = useState(user?.name ?? '')
  const [language, setLanguage] = useState<Language>(user?.language ?? 'english')
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({})
  const [savingPassword, setSavingPassword] = useState(false)

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (name.trim().length < 2) {
      toastError('Enter your name.')
      return
    }
    setSavingProfile(true)
    try {
      const data = await api.put<{ user: User }>('/auth/profile', { name: name.trim(), language })
      setUser(data.user)
      success('Profile updated.')
    } catch (err) {
      toastError(errorMessage(err))
    } finally {
      setSavingProfile(false)
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    const errors: Record<string, string> = {}
    if (!currentPassword) errors.current = 'Enter your current password.'
    if (!(newPassword.length >= 8 && /[A-Za-z]/.test(newPassword) && /\d/.test(newPassword)))
      errors.next = 'Use at least 8 characters with a letter and a number.'
    if (confirmPassword !== newPassword) errors.confirm = 'Passwords do not match.'
    setPasswordErrors(errors)
    if (Object.keys(errors).length) return

    setSavingPassword(true)
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      success('Password changed.')
    } catch (err) {
      setPasswordErrors({ form: errorMessage(err) })
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Profile & settings" description="Manage your account, appearance and study language." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Your profile" description="This name appears on your dashboard." icon={<UserRound className="size-4" />} />
          <form onSubmit={saveProfile} className="space-y-3.5 px-5 pb-5 pt-4">
            <div>
              <Label htmlFor="profile-name">Full name</Label>
              <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
            </div>
            <div>
              <Label htmlFor="profile-email" hint="cannot be changed">
                Email
              </Label>
              <Input id="profile-email" value={user?.email ?? ''} disabled />
            </div>
            <div>
              <Label htmlFor="profile-language">Preferred study language</Label>
              <Select id="profile-language" value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
                <option value="english">English</option>
                <option value="marathi">Marathi</option>
                <option value="hindi">Hindi</option>
              </Select>
              <p className="mt-1 text-[11px] text-muted">Used as the default for notes, quizzes and explanations.</p>
            </div>
            <Button type="submit" loading={savingProfile} icon={<Check className="size-4" />}>
              Save profile
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Change password" description="Use a strong password you do not reuse elsewhere." icon={<KeyRound className="size-4" />} />
          <form onSubmit={changePassword} className="space-y-3.5 px-5 pb-5 pt-4">
            {passwordErrors.form ? <Alert tone="error">{passwordErrors.form}</Alert> : null}
            <div>
              <Label htmlFor="current-password">Current password</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                invalid={Boolean(passwordErrors.current)}
              />
              <FieldError>{passwordErrors.current}</FieldError>
            </div>
            <div>
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                invalid={Boolean(passwordErrors.next)}
              />
              <FieldError>{passwordErrors.next}</FieldError>
            </div>
            <div>
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                invalid={Boolean(passwordErrors.confirm)}
              />
              <FieldError>{passwordErrors.confirm}</FieldError>
            </div>
            <Button type="submit" loading={savingPassword}>
              Update password
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader title="Appearance" description="Choose how the app looks on this device." icon={<Palette className="size-4" />} />
          <div className="px-5 pb-5 pt-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTheme('light')}
                className={`flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition ${
                  theme === 'light' ? 'border-primary bg-primary-soft' : 'border-line bg-surface hover:border-line-strong'
                }`}
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-surface-2 text-ink">
                  <Sun className="size-4" />
                </span>
                <span className="text-[12.5px] font-medium text-ink">Light</span>
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition ${
                  theme === 'dark' ? 'border-primary bg-primary-soft' : 'border-line bg-surface hover:border-line-strong'
                }`}
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-surface-2 text-ink">
                  <Moon className="size-4" />
                </span>
                <span className="text-[12.5px] font-medium text-ink">Dark</span>
              </button>
            </div>
            <p className="mt-2.5 text-[11px] text-muted">Saved in this browser and applied immediately.</p>
          </div>
        </Card>

        <Card>
          <CardHeader title="AI service" description="The model powering analysis, notes, quizzes and viva." icon={<Sparkles className="size-4" />} />
          <div className="space-y-3 px-5 pb-5 pt-4">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2/50 px-3 py-2.5">
              <div>
                <p className="text-[12.5px] font-medium text-ink">Gemini API</p>
                <p className="mt-0.5 text-[11px] text-muted">{ai?.model || 'Checking model…'}</p>
              </div>
              <Badge tone={ai?.configured ? 'success' : 'warn'}>{ai?.configured ? 'Connected' : 'Not configured'}</Badge>
            </div>
            <p className="text-[11.5px] leading-relaxed text-muted">
              The API key lives only in the backend environment as <code className="rounded bg-surface-2 px-1">GEMINI_API_KEY</code>,
              never in the browser. {ai?.configured ? 'All AI features are available.' : ai?.message}
            </p>
            <div className="flex items-start gap-2 rounded-lg border border-line bg-surface px-3 py-2.5">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ok" />
              <p className="text-[11.5px] leading-relaxed text-muted">
                Your documents are used only to answer your own questions. Other students cannot access them.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Account" description={`Member since ${formatDate(user?.createdAt)}`} icon={<UserRound className="size-4" />} />
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-5 pt-4">
          <div>
            <p className="text-[13px] font-medium text-ink">{user?.name}</p>
            <p className="mt-0.5 text-[12px] text-muted">{user?.email}</p>
          </div>
          <Button
            variant="danger"
            onClick={() => {
              signOut()
              success('Signed out.')
            }}
            icon={<LogOut className="size-4" />}
          >
            Sign out
          </Button>
        </div>
      </Card>
    </div>
  )
}
