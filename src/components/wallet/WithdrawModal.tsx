'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Coins,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  Banknote,
  Send,
  HelpCircle,
  ShieldCheck,
  IndianRupee,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { formatDate } from '@/lib/utils'

export interface WithdrawalHistoryItem {
  id: string
  user_id: string
  coins: number
  amount_inr: number
  upi_id: string
  upi_name?: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_notes?: string | null
  created_at: string
  updated_at?: string
}

interface WithdrawModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function WithdrawModal({ isOpen, onClose, onSuccess }: WithdrawModalProps) {
  const { profile, refreshProfile } = useAuth()

  const [activeTab, setActiveTab] = useState<'withdraw' | 'history'>('withdraw')
  const [loading, setLoading] = useState(true)
  const [coinBalance, setCoinBalance] = useState<number>(profile?.coin_balance ?? 0)
  const [totalEarnedCoins, setTotalEarnedCoins] = useState<number>(0)
  const [requests, setRequests] = useState<WithdrawalHistoryItem[]>([])

  // Payout configuration from admin
  const [rateCoins, setRateCoins] = useState<number>(100)
  const [rateInr, setRateInr] = useState<number>(20)
  const [minWithdrawalInr, setMinWithdrawalInr] = useState<number>(100)
  const [instructions, setInstructions] = useState<string>(
    'Enter your UPI ID and requested amount. Admin will verify and transfer funds to your UPI account manually.'
  )

  // Input states
  const [coinsInput, setCoinsInput] = useState<string>('500')
  const [inrInput, setInrInput] = useState<string>('100')
  const [upiIdInput, setUpiIdInput] = useState<string>('')
  const [upiNameInput, setUpiNameInput] = useState<string>('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Calculate equivalent values
  const coinsNum = Math.max(0, parseInt(coinsInput, 10) || 0)
  const inrNum = Math.max(0, parseFloat(inrInput) || 0)

  // Fetch withdrawal data and settings
  const fetchWithdrawalData = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/wallet/withdraw')
      if (res.ok) {
        const data = await res.json()
        if (typeof data.coinBalance === 'number') {
          setCoinBalance(data.coinBalance)
        }
        if (typeof data.totalEarnedCoins === 'number') {
          setTotalEarnedCoins(data.totalEarnedCoins)
        }
        if (data.settings) {
          setRateCoins(data.settings.streamer_payout_rate_coins || 100)
          setRateInr(data.settings.streamer_payout_rate_inr || 20)
          setMinWithdrawalInr(data.settings.min_withdrawal_inr || 100)
          if (data.settings.instructions) {
            setInstructions(data.settings.instructions)
          }

          // Initial preset matching min withdrawal
          const minInr = data.settings.min_withdrawal_inr || 100
          const rCoins = data.settings.streamer_payout_rate_coins || 100
          const rInr = data.settings.streamer_payout_rate_inr || 20
          const neededCoins = Math.ceil((minInr * rCoins) / rInr)
          setInrInput(String(minInr))
          setCoinsInput(String(neededCoins))
        }
        if (Array.isArray(data.requests)) {
          setRequests(data.requests)
        }
      }
    } catch (err) {
      console.error('Failed to load withdrawal data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchWithdrawalData()
      setErrorMessage(null)
      setSuccessMessage(null)
    }
  }, [isOpen])

  // Bidirectional conversions
  const handleCoinsChange = (val: string) => {
    setCoinsInput(val)
    const num = Math.max(0, parseInt(val, 10) || 0)
    if (num <= 0) {
      setInrInput('0')
      return
    }
    const calcInr = Math.floor(((num * rateInr) / rateCoins) * 100) / 100
    setInrInput(String(calcInr))
  }

  const handleInrChange = (val: string) => {
    setInrInput(val)
    const num = Math.max(0, parseFloat(val) || 0)
    if (num <= 0) {
      setCoinsInput('0')
      return
    }
    const calcCoins = Math.ceil((num * rateCoins) / rateInr)
    setCoinsInput(String(calcCoins))
  }

  const handleQuickPreset = (presetInr: number) => {
    setInrInput(String(presetInr))
    const calcCoins = Math.ceil((presetInr * rateCoins) / rateInr)
    setCoinsInput(String(calcCoins))
  }

  const handleWithdrawAll = () => {
    if (coinBalance <= 0) return
    setCoinsInput(String(coinBalance))
    const calcInr = Math.floor(((coinBalance * rateInr) / rateCoins) * 100) / 100
    setInrInput(String(calcInr))
  }

  // Submit withdrawal request
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    const cleanUpi = upiIdInput.trim()
    if (!cleanUpi || !cleanUpi.includes('@')) {
      setErrorMessage('Please enter a valid UPI ID (e.g. yourname@okhdfcbank or 9876543210@paytm)')
      return
    }

    if (inrNum < minWithdrawalInr) {
      const minCoins = Math.ceil((minWithdrawalInr * rateCoins) / rateInr)
      setErrorMessage(
        `Minimum withdrawal amount is ₹${minWithdrawalInr} (${minCoins} coins). Please enter a higher amount.`
      )
      return
    }

    if (coinBalance < coinsNum) {
      setErrorMessage(
        `Insufficient balance. You need ${coinsNum} coins for ₹${inrNum}, but currently have ${coinBalance} coins.`
      )
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coins: coinsNum,
          amount_inr: inrNum,
          upi_id: cleanUpi,
          upi_name: upiNameInput.trim() || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit withdrawal request')
      }

      setSuccessMessage(
        data.message ||
          `Withdrawal request for ₹${inrNum} submitted successfully! Admin will send amount to ${cleanUpi} manually.`
      )

      if (typeof data.newBalance === 'number') {
        setCoinBalance(data.newBalance)
      } else {
        setCoinBalance((prev) => Math.max(0, prev - coinsNum))
      }

      if (data.request) {
        setRequests((prev) => [data.request, ...prev])
      }

      await refreshProfile()
      if (onSuccess) onSuccess()

      // Switch to history tab after 2 seconds to view pending request
      setTimeout(() => {
        setActiveTab('history')
      }, 2200)
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'An error occurred while submitting withdrawal')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  const minCoinsNeeded = Math.ceil((minWithdrawalInr * rateCoins) / rateInr)
  const userCanWithdraw = coinBalance >= minCoinsNeeded

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="relative w-full max-w-lg bg-[#181818] border border-[#272727] rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#272727] bg-[#1f1f1f]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Banknote className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
                <span>Withdraw Streamer Earnings</span>
              </h3>
              <p className="text-xs text-zinc-400">Convert coins to INR & receive via UPI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-[#272727] px-6 bg-[#141414]">
          <button
            onClick={() => setActiveTab('withdraw')}
            className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-2 ${
              activeTab === 'withdraw'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Banknote className="w-4 h-4" />
            <span>Withdraw to UPI</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-2 ${
              activeTab === 'history'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Withdrawal History ({requests.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Balance & Conversion Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-teal-950/30 border border-emerald-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Available Wallet Balance
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-white">🪙 {coinBalance.toLocaleString()}</span>
                  <span className="text-xs font-bold text-emerald-400">
                    ≈ ₹{((coinBalance * rateInr) / rateCoins).toFixed(2)} INR
                  </span>
                </div>
              </div>
              <div className="text-right space-y-0.5">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Lifetime Revenue
                </span>
                <div className="text-sm font-bold text-zinc-200 flex items-center justify-end gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                  <span>🪙 {totalEarnedCoins.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Admin Payout Rate Badge */}
            <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] text-zinc-400">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Conversion Rate: {rateCoins} Coins = ₹{rateInr} INR</span>
              </div>
              <div className="text-zinc-400">
                Min Payout: <strong className="text-white">₹{minWithdrawalInr}</strong> ({minCoinsNeeded} coins)
              </div>
            </div>
          </div>

          {/* TAB 1: WITHDRAW FORM */}
          {activeTab === 'withdraw' && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Select Quick Amount
                  </label>
                  {userCanWithdraw && (
                    <button
                      type="button"
                      onClick={handleWithdrawAll}
                      className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      Withdraw Max Available
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {[100, 250, 500, 1000].map((preset) => {
                    const presetCoins = Math.ceil((preset * rateCoins) / rateInr)
                    const isSelected = inrNum === preset
                    const disabled = preset < minWithdrawalInr
                    return (
                      <button
                        key={preset}
                        type="button"
                        disabled={disabled}
                        onClick={() => handleQuickPreset(preset)}
                        className={`p-2.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center ${
                          disabled
                            ? 'opacity-40 border-zinc-800 bg-zinc-900 cursor-not-allowed'
                            : isSelected
                            ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400 shadow-md shadow-emerald-500/10'
                            : 'border-[#2c2c2c] bg-[#1f1f1f] text-zinc-300 hover:border-zinc-600'
                        }`}
                      >
                        <span className="text-sm font-extrabold text-white">₹{preset}</span>
                        <span className="text-[10px] text-zinc-400">🪙 {presetCoins}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Bidirectional Inputs: INR & Coins */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <IndianRupee className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Amount (INR ₹)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-500">
                      ₹
                    </span>
                    <input
                      type="number"
                      min={minWithdrawalInr}
                      step="1"
                      value={inrInput}
                      onChange={(e) => handleInrChange(e.target.value)}
                      placeholder={String(minWithdrawalInr)}
                      className="w-full pl-8 pr-3 py-2.5 bg-[#121212] border border-[#2e2e2e] focus:border-emerald-500 rounded-xl text-white font-mono text-sm focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-amber-400" />
                    <span>Coins to Deduct</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-500">
                      🪙
                    </span>
                    <input
                      type="number"
                      min={minCoinsNeeded}
                      step="1"
                      value={coinsInput}
                      onChange={(e) => handleCoinsChange(e.target.value)}
                      placeholder={String(minCoinsNeeded)}
                      className="w-full pl-8 pr-3 py-2.5 bg-[#121212] border border-[#2e2e2e] focus:border-emerald-500 rounded-xl text-white font-mono text-sm focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* UPI ID Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span>UPI ID / VPA</span>
                    <span className="text-red-400">*</span>
                  </span>
                  <span className="text-[10px] text-zinc-500">e.g. name@okhdfcbank or 9876543210@paytm</span>
                </label>
                <input
                  type="text"
                  required
                  value={upiIdInput}
                  onChange={(e) => setUpiIdInput(e.target.value)}
                  placeholder="yourname@okaxis, 9876543210@paytm..."
                  className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#2e2e2e] focus:border-emerald-500 rounded-xl text-white text-sm focus:outline-none tracking-wide"
                />
              </div>

              {/* UPI Account Holder Name (Optional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
                  <span>Payee Name / UPI Account Name (Optional)</span>
                  <span className="text-[10px] text-zinc-500">helps admin verify receiver</span>
                </label>
                <input
                  type="text"
                  value={upiNameInput}
                  onChange={(e) => setUpiNameInput(e.target.value)}
                  placeholder="Account holder's full name"
                  className="w-full px-3.5 py-2.5 bg-[#121212] border border-[#2e2e2e] focus:border-emerald-500 rounded-xl text-white text-sm focus:outline-none"
                />
              </div>

              {/* Instructions Callout */}
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
                <div className="flex items-center gap-1.5 text-zinc-300 font-semibold">
                  <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>How Withdrawal Works:</span>
                </div>
                <p className="leading-relaxed">
                  1. When you submit, <strong>{coinsNum} coins</strong> are deducted from your wallet.
                  <br />
                  2. Admin reviews the request and transfers <strong>₹{inrNum}</strong> directly to your UPI ID manually.
                  <br />
                  3. If declined for invalid UPI details, your deducted coins are <strong>automatically 100% refunded</strong> back to your wallet.
                </p>
              </div>

              {/* Error / Success Messages */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !userCanWithdraw || coinsNum <= 0 || inrNum < minWithdrawalInr}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-extrabold text-sm shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-[0.99]"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Submitting Request...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit Withdrawal Request for ₹{inrNum}</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 2: REQUEST HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Past Withdrawal Requests
                </span>
                <button
                  onClick={fetchWithdrawalData}
                  className="p-1 text-zinc-400 hover:text-white rounded transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {requests.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 text-xs space-y-2 border border-dashed border-zinc-800 rounded-2xl">
                  <Clock className="w-8 h-8 mx-auto text-zinc-600" />
                  <p>You haven't submitted any withdrawal requests yet.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {requests.map((req) => (
                    <div
                      key={req.id}
                      className="p-3.5 rounded-2xl bg-[#131313] border border-[#252525] space-y-2 hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-white">₹{req.amount_inr}</span>
                          <span className="text-xs text-zinc-400 font-mono">({req.coins} coins)</span>
                        </div>
                        {req.status === 'pending' && (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 animate-spin" />
                            Pending Admin Payout
                          </span>
                        )}
                        {req.status === 'approved' && (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Paid via UPI
                          </span>
                        )}
                        {req.status === 'rejected' && (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            Declined & Refunded
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-zinc-400 space-y-1">
                        <div className="flex items-center justify-between font-mono text-[11px]">
                          <span>UPI ID: <strong className="text-zinc-200">{req.upi_id}</strong></span>
                          <span>{formatDate(req.created_at)}</span>
                        </div>

                        {req.admin_notes && (
                          <div className={`p-2 rounded-lg text-[11px] ${
                            req.status === 'approved'
                              ? 'bg-emerald-950/20 text-emerald-300 border border-emerald-900/30'
                              : req.status === 'rejected'
                              ? 'bg-red-950/20 text-red-300 border border-red-900/30'
                              : 'bg-zinc-900 text-zinc-400'
                          }`}>
                            <strong>Admin Note:</strong> {req.admin_notes}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
