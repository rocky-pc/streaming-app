'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

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
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) {
        throw new Error(updateError.message)
      }

      setIsSuccess(true)
      setTimeout(() => {
        router.push('/login')
      }, 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password. Please try again.')
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
          <CardTitle className="text-2xl font-bold tracking-tight text-white pt-2">Create New Password</CardTitle>
          <CardDescription className="text-xs text-zinc-400">
            Enter your new secure password below
          </CardDescription>
        </CardHeader>

        <CardContent className="px-6 pb-8">
          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {isSuccess ? (
            <div className="space-y-4 text-center py-2">
              <div className="flex items-center justify-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-400" />
              </div>
              <p className="text-emerald-300 font-semibold text-sm">Password updated successfully!</p>
              <p className="text-xs text-zinc-400">Redirecting you to the login page...</p>
              <Link href="/login" className="inline-block mt-3 w-full">
                <button
                  type="button"
                  className="w-full bg-[#ff0000] hover:bg-[#cc0000] text-white font-semibold py-2.5 rounded-full text-sm transition-colors"
                >
                  Sign In Now
                </button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5" htmlFor="password">
                  New Password
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
                  Confirm New Password
                </label>
                <Input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Repeat new password"
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
                    <span>Updating Password...</span>
                  </>
                ) : (
                  'Update Password'
                )}
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
