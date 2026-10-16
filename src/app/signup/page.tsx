'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Play, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

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
        // Immediate login (email confirmation disabled or auto-confirmed)
        router.push('/')
        router.refresh()
      } else {
        // Email verification required
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
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 bg-gray-950">
      <Card className="w-full max-w-md bg-gray-900/90 border-gray-800 shadow-2xl backdrop-blur-sm">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 shadow-lg shadow-indigo-600/30">
            <Play className="h-6 w-6 text-white ml-0.5 fill-current" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-white">Create an Account</CardTitle>
          <CardDescription className="text-gray-400">
            Join StreamFlow to upload, share, and manage videos
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3.5 text-sm text-red-400">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMessage ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-400" />
                <p>{successMessage}</p>
              </div>
              <Link href="/login" className="block w-full">
                <Button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white">
                  Proceed to Login
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5" htmlFor="display-name">
                  Display Name
                </label>
                <Input
                  id="display-name"
                  type="text"
                  placeholder="e.g. Alex Johnson"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-gray-800/80 border-gray-700 text-white placeholder-gray-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5" htmlFor="username">
                  Username <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">@</span>
                  <Input
                    id="username"
                    type="text"
                    required
                    placeholder="alexjohnson"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-8 bg-gray-800/80 border-gray-700 text-white placeholder-gray-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5" htmlFor="email">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="alex@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-gray-800/80 border-gray-700 text-white placeholder-gray-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5" htmlFor="password">
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
                    className="pr-10 bg-gray-800/80 border-gray-700 text-white placeholder-gray-500 focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5" htmlFor="confirm-password">
                  Confirm Password <span className="text-red-400">*</span>
                </label>
                <Input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-gray-800/80 border-gray-700 text-white placeholder-gray-500 focus:border-indigo-500"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2.5 mt-2 transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Creating Account...</span>
                  </>
                ) : (
                  'Sign Up'
                )}
              </Button>

              <div className="text-center pt-2">
                <span className="text-sm text-gray-400">Already have an account? </span>
                <Link href="/login" className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
                  Sign In
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
