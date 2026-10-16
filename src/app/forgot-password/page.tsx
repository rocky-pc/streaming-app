'use client'

import { useState } from 'react'
import Link from 'next/link'
import { getSupabaseBrowserClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { CheckCircle2, AlertCircle, Loader2, ArrowLeft } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }

    setIsLoading(true)

    try {
      const supabase = getSupabaseBrowserClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (resetError) {
        throw new Error(resetError.message)
      }

      setIsSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send password reset email.')
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
          <CardTitle className="text-2xl font-bold tracking-tight text-white pt-2">Reset Password</CardTitle>
          <CardDescription className="text-xs text-zinc-400">
            Enter your email to receive a password reset recovery link
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
            <div className="space-y-5">
              <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-300">
                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-400" />
                <p>
                  A password reset email has been sent to <strong>{email}</strong>. Check your inbox and click the link to choose a new password.
                </p>
              </div>
              <Link href="/login" className="block w-full">
                <button
                  type="button"
                  className="w-full bg-[#272727] hover:bg-[#3f3f3f] text-white font-semibold py-2.5 rounded-full text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Return to Sign In
                </button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5" htmlFor="email">
                  Email Address
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

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#ff0000] hover:bg-[#cc0000] disabled:bg-zinc-700 text-white font-semibold py-2.5 rounded-full mt-3 transition-colors flex items-center justify-center gap-2 text-sm shadow-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Sending Reset Link...</span>
                  </>
                ) : (
                  'Send Reset Link'
                )}
              </button>

              <div className="text-center pt-3 border-t border-[#272727] mt-5">
                <Link
                  href="/login"
                  className="inline-flex items-center text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
