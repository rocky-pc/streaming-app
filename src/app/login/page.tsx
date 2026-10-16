'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'
  const errorParam = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(
    errorParam === 'auth_callback_failed'
      ? 'Authentication link expired or invalid. Please try logging in.'
      : null
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim() || !password) {
      setError('Please provide both email and password.')
      return
    }

    setIsLoading(true)

    try {
      const supabase = getSupabaseBrowserClient()
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError) {
        throw new Error(signInError.message)
      }

      if (data.session) {
        window.location.href = redirect
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid login credentials. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md bg-[#181818] border-[#272727] shadow-2xl rounded-3xl">
      <CardHeader className="text-center space-y-2 pt-8">
        <div className="mx-auto flex items-center justify-center w-12 h-9 bg-[#ff0000] rounded-xl shadow-lg">
          <div className="w-0 h-0 border-y-[6px] border-y-transparent border-l-[10px] border-l-white ml-0.5" />
        </div>
        <CardTitle className="text-2xl font-bold tracking-tight text-white pt-2">Sign in to StreamFlow</CardTitle>
        <CardDescription className="text-xs text-zinc-400">
          to continue to your channel, watchlists, and studio
        </CardDescription>
      </CardHeader>

      <CardContent className="px-6 pb-8">
        {error && (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5" htmlFor="email">
              Email
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-zinc-300" htmlFor="password">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-[#3ea6ff] hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
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

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#ff0000] hover:bg-[#cc0000] disabled:bg-zinc-700 text-white font-semibold py-2.5 rounded-full mt-3 transition-colors flex items-center justify-center gap-2 text-sm shadow-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Signing in...</span>
              </>
            ) : (
              'Sign In'
            )}
          </button>

          <div className="text-center pt-3 border-t border-[#272727] mt-5">
            <span className="text-xs text-zinc-400">Don&apos;t have an account? </span>
            <Link
              href="/signup"
              className="text-xs font-semibold text-[#3ea6ff] hover:underline ml-1"
            >
              Create account
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center px-4 py-10 bg-[#0f0f0f] select-none">
      <Suspense fallback={<div className="text-zinc-500 text-sm">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
