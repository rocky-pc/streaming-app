'use client'

import { useState, useEffect } from 'react'
import {
  X,
  Coins,
  Copy,
  Check,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  QrCode,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

interface TopUpPackage {
  coins: number
  inr: number
  popular?: boolean
}

interface TopUpRequestItem {
  id: string
  coins: number
  amount_inr: number
  utr_number: string
  upi_id: string
  status: 'pending' | 'approved' | 'rejected'
  admin_notes: string | null
  created_at: string
}

interface TopUpModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function TopUpModal({ isOpen, onClose, onSuccess }: TopUpModalProps) {
  const { user, profile, refreshProfile } = useAuth()

  const [loading, setLoading] = useState(true)
  const [upiId, setUpiId] = useState('streamflow@upi')
  const [upiName, setUpiName] = useState('StreamFlow Official')
  const [coinPriceInr, setCoinPriceInr] = useState(1)
  const [packages, setPackages] = useState<TopUpPackage[]>([
    { coins: 50, inr: 50, popular: false },
    { coins: 100, inr: 100, popular: true },
    { coins: 250, inr: 250, popular: false },
    { coins: 500, inr: 500, popular: false },
    { coins: 1000, inr: 950, popular: false },
  ])
  const [recentRequests, setRecentRequests] = useState<TopUpRequestItem[]>([])

  // Selection & Input state
  const [selectedCoins, setSelectedCoins] = useState<number>(100)
  const [customCoins, setCustomCoins] = useState<string>('100')
  const [utrNumber, setUtrNumber] = useState('')
  const [isCopied, setIsCopied] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<'pay' | 'history'>('pay')

  // Calculate current INR amount
  const calculatedInr = Math.max(
    1,
    Math.round(
      (packages.find((p) => p.coins === selectedCoins)?.inr ??
        (Number(customCoins) || 0) * coinPriceInr) * 100
    ) / 100
  )

  // Fetch top-up settings and history
  const fetchTopupData = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/wallet/topup')
      if (res.ok) {
        const data = await res.json()
        if (data.upiId) setUpiId(data.upiId)
        if (data.upiName) setUpiName(data.upiName)
        if (typeof data.coinPriceInr === 'number') setCoinPriceInr(data.coinPriceInr)
        if (Array.isArray(data.packages) && data.packages.length > 0) {
          setPackages(data.packages)
        }
        if (Array.isArray(data.requests)) {
          setRecentRequests(data.requests)
        }
      }
    } catch (err) {
      console.error('Failed to load topup config:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchTopupData()
      setErrorMessage(null)
      setSuccessMessage(null)
      setUtrNumber('')
    }
  }, [isOpen])

  // Copy UPI ID to clipboard
  const handleCopyUpi = () => {
    navigator.clipboard.writeText(upiId)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  // Handle preset package selection
  const handleSelectPackage = (pkg: TopUpPackage) => {
    setSelectedCoins(pkg.coins)
    setCustomCoins(String(pkg.coins))
  }

  // Handle custom coins change
  const handleCustomCoinsChange = (val: string) => {
    setCustomCoins(val)
    const num = parseInt(val, 10)
    if (!isNaN(num) && num > 0) {
      setSelectedCoins(num)
    }
  }

  // Handle UTR submission
  const handleSubmitTopup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      setErrorMessage('Please sign in to submit a top-up request.')
      return
    }

    const trimmedUtr = utrNumber.trim()
    if (!trimmedUtr || trimmedUtr.length < 6) {
      setErrorMessage('Please enter a valid 12-digit transaction UTR / Reference number.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const res = await fetch('/api/wallet/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coins: selectedCoins,
          amountInr: calculatedInr,
          utrNumber: trimmedUtr,
          upiId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to submit top-up request.')
      } else {
        setSuccessMessage('Top-up request submitted! Your coins will be credited once verified by Admin.')
        setUtrNumber('')
        fetchTopupData()
        if (refreshProfile) refreshProfile()
        if (onSuccess) onSuccess()
      }
    } catch {
      setErrorMessage('Network error submitting request. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  // Generate UPI deep link
  const upiDeepLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
    upiName
  )}&am=${calculatedInr}&cu=INR&tn=${encodeURIComponent(`StreamFlow Coins ${selectedCoins}`)}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="relative w-full max-w-lg bg-[#141414] border border-[#2b2b2b] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-zinc-100"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#262626] bg-[#181818]/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-amber-500/20 text-black font-extrabold text-base">
              🪙
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Top-Up Wallet Coins</h2>
              <p className="text-[11px] text-zinc-400">
                1 Coin = ₹{coinPriceInr} INR • Instant UPI Transfer
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Switcher */}
            <div className="flex items-center bg-[#202020] p-0.5 rounded-xl border border-[#2e2e2e] text-xs">
              <button
                type="button"
                onClick={() => setActiveView('pay')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  activeView === 'pay'
                    ? 'bg-amber-500 text-black font-bold shadow-xs'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Top-Up
              </button>
              <button
                type="button"
                onClick={() => setActiveView('history')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  activeView === 'history'
                    ? 'bg-amber-500 text-black font-bold shadow-xs'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                History ({recentRequests.length})
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Current Wallet Balance Banner */}
        <div className="px-5 py-2.5 bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent border-b border-[#262626] flex items-center justify-between text-xs">
          <span className="text-zinc-400">Your Current Coin Balance:</span>
          <div className="inline-flex items-center gap-1.5 font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2.5 py-0.5 rounded-full">
            <span>🪙</span>
            <span>{profile?.coin_balance ?? 0} Coins</span>
          </div>
        </div>

        {/* Body Container */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-zinc-400 gap-3">
              <RefreshCw className="h-7 w-7 animate-spin text-amber-400" />
              <p className="text-xs">Loading payment channels & exchange rates...</p>
            </div>
          ) : activeView === 'history' ? (
            /* HISTORY VIEW */
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Your Past Top-Up Submissions
              </h3>

              {recentRequests.length === 0 ? (
                <div className="text-center py-10 bg-[#191919] border border-[#2a2a2a] rounded-2xl text-zinc-500 space-y-1">
                  <Clock className="h-8 w-8 mx-auto text-zinc-600 mb-2" />
                  <p className="text-sm font-semibold text-zinc-300">No top-up requests yet</p>
                  <p className="text-xs">Your completed and pending top-up requests will appear here</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recentRequests.map((req) => (
                    <div
                      key={req.id}
                      className="p-3.5 bg-[#191919] border border-[#292929] rounded-2xl space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-amber-400 flex items-center gap-1">
                            🪙 {req.coins} Coins
                          </span>
                          <span className="text-zinc-500">•</span>
                          <span className="font-semibold text-white">₹{req.amount_inr}</span>
                        </div>

                        {req.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold">
                            <Clock className="h-3 w-3 animate-pulse" />
                            <span>Pending Review</span>
                          </span>
                        )}
                        {req.status === 'approved' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Approved (+{req.coins} Coins)</span>
                          </span>
                        )}
                        {req.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 text-[10px] font-bold">
                            <XCircle className="h-3 w-3" />
                            <span>Declined</span>
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-zinc-400 flex items-center justify-between border-t border-[#272727] pt-2">
                        <span className="font-mono">UTR: {req.utr_number}</span>
                        <span>{new Date(req.created_at).toLocaleDateString()}</span>
                      </div>

                      {req.admin_notes && (
                        <p className="text-[11px] text-zinc-400 bg-[#222222] p-2 rounded-xl border border-[#333333]">
                          <strong className="text-zinc-300">Note:</strong> {req.admin_notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* PAYMENT & SUBMISSION VIEW */
            <>
              {/* Notifications */}
              {errorMessage && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold">{successMessage}</p>
                    <p className="text-[11px] text-emerald-400/80">
                      You can check status in the History tab.
                    </p>
                  </div>
                </div>
              )}

              {/* STEP 1: Select Coin Package */}
              <div className="space-y-2.5">
                <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                  <span>1. Choose Coin Package</span>
                  <span className="text-[11px] text-amber-400 lowercase font-normal">
                    1 coin = ₹{coinPriceInr}
                  </span>
                </label>

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {packages.map((pkg) => {
                    const isSelected = selectedCoins === pkg.coins
                    return (
                      <button
                        key={pkg.coins}
                        type="button"
                        onClick={() => handleSelectPackage(pkg)}
                        className={`relative p-2.5 rounded-2xl border text-center transition-all ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-400 text-white shadow-md shadow-amber-500/20 ring-1 ring-amber-400'
                            : 'bg-[#1a1a1a] border-[#2d2d2d] text-zinc-300 hover:border-[#404040] hover:bg-[#202020]'
                        }`}
                      >
                        {pkg.popular && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.2 rounded-full bg-gradient-to-r from-red-500 to-amber-500 text-white font-extrabold text-[9px] uppercase tracking-wider shadow-xs">
                            Popular
                          </span>
                        )}
                        <div className="font-extrabold text-sm text-amber-400">
                          🪙 {pkg.coins}
                        </div>
                        <div className="text-[11px] text-zinc-400 font-semibold mt-0.5">
                          ₹{pkg.inr}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Custom Coins Input */}
                <div className="flex items-center gap-2 pt-1">
                  <div className="text-xs text-zinc-400 shrink-0">Or Enter Coins:</div>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm select-none">
                      🪙
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={100000}
                      value={customCoins}
                      onChange={(e) => handleCustomCoinsChange(e.target.value)}
                      placeholder="e.g. 150"
                      className="w-full bg-[#181818] border border-[#2e2e2e] focus:border-amber-400 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div className="px-3 py-1.5 bg-[#1f1f1f] border border-[#333333] rounded-xl text-xs font-bold text-emerald-400 shrink-0">
                    = ₹{calculatedInr} INR
                  </div>
                </div>
              </div>

              {/* STEP 2: Pay via UPI */}
              <div className="space-y-2.5 bg-[#191919] border border-[#2b2b2b] rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <QrCode className="h-3.5 w-3.5 text-amber-400" />
                    <span>2. Transfer to Admin UPI ID</span>
                  </span>
                  <span className="text-xs font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Amount: ₹{calculatedInr}
                  </span>
                </div>

                {/* Copyable UPI Box */}
                <div className="flex items-center justify-between gap-2 bg-[#121212] border border-[#333333] rounded-xl px-3.5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] text-zinc-500 block">UPI VPA Address:</span>
                    <span className="font-mono text-xs sm:text-sm font-bold text-amber-300 truncate block">
                      {upiId}
                    </span>
                    <span className="text-[10px] text-zinc-400 block mt-0.5">
                      Payee: <strong>{upiName}</strong>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyUpi}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                      isCopied
                        ? 'bg-emerald-500 text-black'
                        : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{isCopied ? 'Copied!' : 'Copy UPI'}</span>
                  </button>
                </div>

                {/* Mobile Direct Pay Action */}
                <a
                  href={upiDeepLink}
                  className="w-full py-2.5 px-3 bg-gradient-to-r from-blue-600/30 via-indigo-600/30 to-purple-600/30 hover:from-blue-600/40 hover:to-purple-600/40 border border-blue-500/30 rounded-xl text-xs font-semibold text-blue-200 flex items-center justify-center gap-2 transition-all"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-blue-400" />
                  <span>Open in UPI App (GPay / PhonePe / Paytm / BHIM)</span>
                </a>
              </div>

              {/* STEP 3: Enter UTR Number & Submit */}
              <form onSubmit={handleSubmitTopup} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center justify-between">
                    <span>3. Enter 12-Digit UTR Number</span>
                    <span className="text-[10px] text-zinc-400 lowercase font-normal">
                      from transaction receipt
                    </span>
                  </label>

                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={utrNumber}
                      onChange={(e) => setUtrNumber(e.target.value)}
                      placeholder="Enter 12-digit UTR (e.g. 428910284712)"
                      className="w-full bg-[#181818] border border-[#2e2e2e] focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-mono text-white placeholder-zinc-500 focus:outline-none transition-colors uppercase tracking-wider"
                    />
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    After completing payment in your UPI app, copy the 12-digit UTR/UPI Ref ID from the receipt and paste it here.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !utrNumber.trim()}
                  className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-extrabold rounded-2xl text-xs sm:text-sm transition-all shadow-lg shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin text-black" />
                      <span>Submitting Request...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" />
                      <span>Submit Request for 🪙 {selectedCoins} Coins (₹{calculatedInr})</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
