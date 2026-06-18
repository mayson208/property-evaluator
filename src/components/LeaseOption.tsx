import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, ReferenceLine } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function monthlyPmt(principal: number, annualRate: number, termYears: number) {
  const r = annualRate / 100 / 12
  const n = termYears * 12
  if (r === 0 || n === 0) return 0
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

export default function LeaseOption() {
  const { result, interestRate, monthlyRent: storeRent } = usePropertyStore()

  const homeVal   = result?.estimatedValue ?? 400000

  // Lease-option terms
  const [agreedPrice,       setAgreedPrice]       = useState(homeVal)
  const [optionPremium,     setOptionPremium]      = useState(Math.round(homeVal * 0.03))  // upfront non-refundable
  const [monthlyRent,       setMonthlyRent]        = useState(storeRent > 0 ? storeRent : Math.round(homeVal * 0.008))
  const [rentCredit,        setRentCredit]         = useState(25)   // % of rent credited toward purchase
  const [optionTermYrs,     setOptionTermYrs]      = useState(3)    // lease term before must exercise
  const [appreciationPct,   setAppreciationPct]    = useState(3.5)

  // Mortgage terms (when exercising option)
  const [rate,              setRate]               = useState(interestRate)
  const [termYrs,           setTermYrs]            = useState(30)
  const [downPctAtExercise, setDownPctAtExercise]  = useState(5)    // additional down at exercise

  // Market rent
  const [marketRent,        setMarketRent]         = useState(storeRent > 0 ? storeRent : Math.round(homeVal * 0.0075))

  const analysis = useMemo(() => {
    const marketValueAtExercise = agreedPrice * Math.pow(1 + appreciationPct / 100, optionTermYrs)
    const priceDiscount         = marketValueAtExercise - agreedPrice  // locked-in price benefit
    const priceDiscountPct      = agreedPrice > 0 ? (priceDiscount / marketValueAtExercise) * 100 : 0

    // Rent credits accumulated
    const totalRentPaid         = monthlyRent * optionTermYrs * 12
    const rentCreditAmount      = totalRentPaid * rentCredit / 100
    const rentOverMarket        = Math.max(0, monthlyRent - marketRent) * optionTermYrs * 12

    // At exercise: down payment sources
    const extraDownAtExercise   = agreedPrice * downPctAtExercise / 100
    const totalDown             = optionPremium + rentCreditAmount + extraDownAtExercise
    const totalDownPct          = agreedPrice > 0 ? (totalDown / agreedPrice) * 100 : 0
    const loanAmount            = Math.max(0, agreedPrice - totalDown)
    const monthlyPmtAtExercise  = monthlyPmt(loanAmount, rate, termYrs)

    // Total cost of lease-option path
    const totalLeaseOptionCost  = optionPremium + totalRentPaid + extraDownAtExercise
    const totalPurchaseCost     = totalDown  // money applied to purchase

    // Alternative: rent standard + save for down
    const altMonthlyRent        = marketRent
    const altMonthlySavings     = monthlyRent - marketRent + (monthlyRent * rentCredit / 100)  // savings from not paying extra
    const altSavingsAccumulated = altMonthlySavings * optionTermYrs * 12  // vs rent credit accumulation
    const altTotalRent          = altMonthlyRent * optionTermYrs * 12

    // Year-by-year chart
    const months = optionTermYrs * 12
    const chartData = Array.from({ length: optionTermYrs + 1 }, (_, yr) => {
      const rentCreditsAccum  = monthlyRent * rentCredit / 100 * yr * 12
      const premiumEquiv      = optionPremium
      const totalEquityBuilt  = optionPremium + rentCreditsAccum + extraDownAtExercise
      const marketValAtYr     = agreedPrice * Math.pow(1 + appreciationPct / 100, yr)
      const unrealizedBenefit = marketValAtYr - agreedPrice
      return { yr, rentCreditsAccum: Math.round(rentCreditsAccum), totalEquityBuilt: Math.round(totalEquityBuilt), unrealizedBenefit: Math.round(unrealizedBenefit) }
    })

    const exerciseValue         = priceDiscount + rentCreditAmount - optionPremium - rentOverMarket
    const walkAwayLoss          = optionPremium  // if you don't exercise, you lose the option premium

    return {
      marketValueAtExercise, priceDiscount, priceDiscountPct,
      totalRentPaid, rentCreditAmount, rentOverMarket,
      extraDownAtExercise, totalDown, totalDownPct, loanAmount, monthlyPmtAtExercise,
      totalLeaseOptionCost, totalPurchaseCost,
      altMonthlySavings, altTotalRent, exerciseValue, walkAwayLoss, chartData,
    }
  }, [agreedPrice, optionPremium, monthlyRent, rentCredit, optionTermYrs, appreciationPct, rate, termYrs, downPctAtExercise, marketRent])

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Lease Option (Rent-to-Own)</h3>
        <p className="text-xs text-slate-500">
          Analyze a lease-option or rent-to-own agreement — model the locked-in price benefit,
          rent credit accumulation, and total cost vs standard renting and saving.
        </p>
      </div>

      {/* Key outcome stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Agreed Purchase Price', value: fmt(agreedPrice),                        color: 'text-white' },
          { label: `Market Value at Yr ${optionTermYrs}`, value: fmt(analysis.marketValueAtExercise), color: 'text-blue-400' },
          { label: 'Locked-In Savings',     value: fmt(analysis.priceDiscount),             color: 'text-green-400' },
          { label: 'Rent Credits Built Up', value: fmt(analysis.rentCreditAmount),           color: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Exercise value analysis */}
      {analysis.exerciseValue >= 0 ? (
        <div className="bg-green-900/20 border border-green-700/40 rounded-xl p-4">
          <p className="text-sm font-bold text-green-400 mb-1">✓ Option is Worth Exercising</p>
          <p className="text-xs text-slate-400">
            Net benefit of exercising: <strong className="text-white">{fmt(analysis.exerciseValue)}</strong>
            {' '}(locked-in price gain + rent credits − option premium − above-market rent premium)
          </p>
        </div>
      ) : (
        <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-4">
          <p className="text-sm font-bold text-yellow-400 mb-1">⚠ Marginal — Re-evaluate Before Exercising</p>
          <p className="text-xs text-slate-400">
            Net benefit is negative ({fmt(analysis.exerciseValue)}) at current appreciation rate.
            If the market appreciates more than {((1 - (analysis.priceDiscount / agreedPrice)) * 100).toFixed(1)}% total, the option gains value.
          </p>
        </div>
      )}

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Lease-Option Terms</p>
          {[
            { label: 'Agreed Option Price',   value: agreedPrice,       min: 50000,  max: 5000000, step: 5000,  set: setAgreedPrice,       fmt: fmt },
            { label: 'Option Premium (upfront)', value: optionPremium,  min: 0,      max: agreedPrice * 0.1, step: 500, set: setOptionPremium, fmt: fmt },
            { label: 'Monthly Rent',          value: monthlyRent,       min: 300,    max: 8000,    step: 50,    set: setMonthlyRent,       fmt: (v: number) => `${fmt(v)}/mo` },
            { label: 'Market Rent (comp)',     value: marketRent,        min: 300,    max: 8000,    step: 50,    set: setMarketRent,        fmt: (v: number) => `${fmt(v)}/mo` },
            { label: 'Rent Credit %',         value: rentCredit,        min: 0,      max: 50,      step: 5,     set: setRentCredit,        fmt: (v: number) => `${v}% → ${fmt(monthlyRent * v / 100)}/mo` },
            { label: 'Option Term',           value: optionTermYrs,     min: 1,      max: 5,       step: 1,     set: setOptionTermYrs,     fmt: (v: number) => `${v} year${v > 1 ? 's' : ''}` },
            { label: 'Expected Appreciation', value: appreciationPct,   min: 0,      max: 10,      step: 0.5,   set: setAppreciationPct,   fmt: (v: number) => `${v}%/yr` },
          ].map(s => (
            <div key={s.label}>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-slate-400 uppercase tracking-widest">{s.label}</label>
                <span className="text-xs font-bold text-blue-400">{s.fmt(s.value)}</span>
              </div>
              <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                onChange={e => s.set(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
            <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Mortgage at Exercise</p>
            {[
              { label: 'Additional Down Payment %', value: downPctAtExercise, min: 0, max: 20, step: 1, set: setDownPctAtExercise, fmt: (v: number) => `${v}% = ${fmt(agreedPrice * v / 100)}` },
              { label: 'Expected Rate at Exercise', value: rate,              min: 3, max: 12, step: 0.125, set: setRate,              fmt: (v: number) => `${v.toFixed(3)}%` },
            ].map(s => (
              <div key={s.label}>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-slate-400 uppercase tracking-widest">{s.label}</label>
                  <span className="text-xs font-bold text-purple-400">{s.fmt(s.value)}</span>
                </div>
                <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                  onChange={e => s.set(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-purple-500" />
              </div>
            ))}
          </div>

          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">At Exercise Summary</p>
            <div className="space-y-1.5 text-xs">
              {[
                { label: 'Option premium credited',     value: fmt(optionPremium),                    color: 'text-green-400' },
                { label: 'Rent credits accumulated',    value: fmt(analysis.rentCreditAmount),         color: 'text-green-400' },
                { label: 'Additional down payment',     value: fmt(analysis.extraDownAtExercise),      color: 'text-blue-400' },
                { label: 'Total down payment',          value: `${fmt(analysis.totalDown)} (${analysis.totalDownPct.toFixed(1)}%)`, color: 'text-white font-black', border: true },
                { label: 'Loan amount',                 value: fmt(analysis.loanAmount),               color: 'text-slate-300' },
                { label: 'New mortgage payment',        value: `${fmt(analysis.monthlyPmtAtExercise)}/mo`, color: 'text-white', border: true },
              ].map(r => (
                <div key={r.label} className={`flex justify-between ${r.border ? 'border-t border-slate-700 pt-1.5 mt-1' : ''}`}>
                  <span className="text-slate-500">{r.label}</span>
                  <span className={r.color}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-red-900/20 border border-red-800/40 rounded-xl p-3">
            <p className="text-xs text-slate-400">
              <strong className="text-red-400">Walk-away loss:</strong> If you don't exercise the option, you forfeit the option premium of{' '}
              <strong className="text-white">{fmt(analysis.walkAwayLoss)}</strong>. Rent credits are also forfeited.
            </p>
          </div>
        </div>
      </div>

      {/* Equity / credit accumulation chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Rent Credits & Price Benefit Over Lease Term</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={analysis.chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="gradCredits"  x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="gradBenefit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="yr" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false}
              label={{ value: 'Year', position: 'insideBottom', offset: -3, fill: '#64748b', fontSize: 10 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} width={55} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number, name: string) => [fmt(v), name === 'rentCreditsAccum' ? 'Rent Credits' : 'Price Lock Benefit']} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
            <Area type="monotone" dataKey="unrealizedBenefit" stroke="#22c55e" fill="url(#gradBenefit)" strokeWidth={2} name="unrealizedBenefit" />
            <Area type="monotone" dataKey="rentCreditsAccum"  stroke="#8b5cf6" fill="url(#gradCredits)"  strokeWidth={2} name="rentCreditsAccum" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Lease-Option Pros &amp; Cons</p>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="space-y-1.5">
            <p className="text-green-400 font-bold uppercase tracking-widest mb-1">Pros</p>
            {[
              'Lock in today\'s price — benefit from appreciation without owning',
              'Build credit and savings while "testing" the home',
              'Rent credits reduce down payment needed at closing',
              'Option not obligation — can walk away (losing premium)',
              'Seller motivation: higher rent + locked-in buyer',
            ].map((t, i) => <p key={i} className="text-slate-400">✓ {t}</p>)}
          </div>
          <div className="space-y-1.5">
            <p className="text-red-400 font-bold uppercase tracking-widest mb-1">Cons</p>
            {[
              'Non-refundable option premium if you walk away',
              'Above-market rent offsets some of the benefit',
              'Seller can sell to someone else if you default on rent',
              'Financing at exercise is still your responsibility',
              'Price could drop — you\'re locked in above market',
            ].map((t, i) => <p key={i} className="text-slate-400">✗ {t}</p>)}
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Lease-option agreements vary widely — always have an attorney review the contract.
        Ensure rent credits are clearly defined and the option period matches your mortgage timeline.
      </p>
    </div>
  )
}
