'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

export default function SignUpPage() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (!email.trim() || !password || !username.trim()) {
      setError('Please fill in all required fields.')
      return
    }

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    if (cleanUsername.length < 3) {
      setError('Username must be at least 3 characters and contain only letters, numbers, and underscores.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsLoading(true)

    try {
      const supabase = getSupabaseBrowserClient()
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            username: cleanUsername,
            display_name: displayName.trim() || cleanUsername,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (signUpError) {
        throw new Error(signUpError.message)
      }

      if (data.session) {
        window.location.href = '/'
      } else {
        setSuccessMessage(
          'Registration successful! Please check your email inbox to verify your account before logging in.'
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-10 bg-[#0f0f0f] select-none">
      <Card className="w-full max-w-md bg-[#181818] border-[#272727] shadow-2xl rounded-3xl">
        <CardHeader className="text-center space-y-2 pt-8">
          <div className="mx-auto flex items-center justify-center w-12 h-9 bg-[#ff0000] rounded-xl shadow-lg">
            <div className="w-0 h-0 border-y-[6px] border-y-transparent border-l-[10px] border-l-white ml-0.5" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-white pt-2">Create Your Channel</CardTitle>
          <CardDescription className="text-xs text-zinc-400">
            Join StreamFlow to upload, share, and manage videos
          </CardDescription>
        </CardHeader>

        <CardContent className="px-6 pb-8">
          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
                <p>{successMessage}</p>
              </div>
              <Link href="/login" className="block w-full">
                <button className="w-full py-2.5 bg-[#ff0000] hover:bg-[#cc0000] text-white text-sm font-semibold rounded-full transition-colors">
                  Proceed to Sign In
                </button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5" htmlFor="display-name">
                  Channel Name (Display Name)
                </label>
                <Input
                  id="display-name"
                  type="text"
                  placeholder="e.g. Alex Johnson"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-[#121212] border-[#383838] text-white placeholder-zinc-500 focus:border-[#3ea6ff] rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5" htmlFor="username">
                  Username <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-medium">@</span>
                  <Input
                    id="username"
                    type="text"
                    required
                    placeholder="alexjohnson"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-8 bg-[#121212] border-[#383838] text-white placeholder-zinc-500 focus:border-[#3ea6ff] rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5" htmlFor="email">
                  Email <span className="text-red-400">*</span>
                </label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="alex@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-[#121212] border-[#383838] text-white placeholder-zinc-500 focus:border-[#3ea6ff] rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5" htmlFor="password">
                  Password <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10 bg-[#121212] border-[#383838] text-white placeholder-zinc-500 focus:border-[#3ea6ff] rounded-xl text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5" htmlFor="confirm-password">
                  Confirm Password <span className="text-red-400">*</span>
                </label>
                <Input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-[#121212] border-[#383838] text-white placeholder-zinc-500 focus:border-[#3ea6ff] rounded-xl text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#ff0000] hover:bg-[#cc0000] disabled:bg-zinc-700 text-white font-semibold py-2.5 rounded-full mt-3 transition-colors flex items-center justify-center gap-2 text-sm shadow-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Creating Channel...</span>
                  </>
                ) : (
                  'Create Account'
                )}
              </button>

              <div className="text-center pt-3 border-t border-[#272727] mt-4">
                <span className="text-xs text-zinc-400">Already have an account? </span>
                <Link href="/login" className="text-xs font-semibold text-[#3ea6ff] hover:underline ml-1">
                  Sign in
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
