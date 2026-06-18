import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function monthlyPmt(principal: number, annualRate: number, termYears: number) {
  const r = annualRate / 100 / 12
  const n = termYears * 12
  if (r === 0) return principal / n
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

function calcBalance(loan: number, rate: number, term: number, monthsPaid: number): number {
  const r   = rate / 100 / 12
  const n   = term * 12
  const pmt = monthlyPmt(loan, rate, term)
  let bal = loan
  for (let i = 0; i < Math.min(monthsPaid, n); i++) {
    const interest  = bal * r
    const principal = Math.min(bal, pmt - interest)
    bal -= principal
  }
  return Math.max(0, bal)
}

export default function RefinanceCalc() {
  const { result, interestRate, downPaymentPct } = usePropertyStore()

  const purchasePrice  = result?.estimatedValue ?? 400000
  const origLoan       = purchasePrice * (1 - downPaymentPct / 100)

  const [origRate,       setOrigRate]       = useState(interestRate)
  const [origTerm,       setOrigTerm]       = useState(30)
  const [monthsPaid,     setMonthsPaid]     = useState(36)
  const [newRate,        setNewRate]        = useState(Math.max(2, interestRate - 1.5))
  const [newTerm,        setNewTerm]        = useState(30)
  const [closingCosts,   setClosingCosts]   = useState(5000)
  const [extraMonthly,   setExtraMonthly]   = useState(0)

  const remainingBalance = useMemo(
    () => Math.round(calcBalance(origLoan, origRate, origTerm, monthsPaid)),
    [origLoan, origRate, origTerm, monthsPaid],
  )

  const origRemMonths = origTerm * 12 - monthsPaid
  const origMonthly   = monthlyPmt(origLoan, origRate, origTerm)
  const newMonthly    = monthlyPmt(remainingBalance, newRate, newTerm) + extraMonthly

  const monthlySaving = origMonthly - newMonthly
  const breakEvenMonths = monthlySaving > 0 ? Math.ceil(closingCosts / monthlySaving) : Infinity

  const { chartData, lifetimeSavings } = useMemo(() => {
    const origRem = origTerm * 12 - monthsPaid
    const newN    = newTerm * 12
    const pts     = []
    let origCumInt = 0, newCumInt = 0
    let origBal = remainingBalance, newBal = remainingBalance
    const origR = origRate / 100 / 12
    const newR  = newRate  / 100 / 12

    const maxMos = Math.max(origRem, newN)
    let running = -closingCosts

    for (let mo = 1; mo <= Math.min(maxMos, 360); mo++) {
      if (origBal > 0) {
        const interest  = origBal * origR
        const principal = Math.min(origBal, origMonthly - interest)
        origCumInt += interest
        origBal     = Math.max(0, origBal - principal)
      }
      if (newBal > 0) {
        const interest  = newBal * newR
        const principal = Math.min(newBal, newMonthly - interest)
        newCumInt  += interest
        newBal      = Math.max(0, newBal - principal)
      }
      running += (origMonthly - newMonthly)

      if (mo % 12 === 0) {
        pts.push({
          yr:       `Yr ${Math.round(monthsPaid / 12) + mo / 12}`,
          origCost: Math.round(origCumInt + closingCosts * 0),
          newCost:  Math.round(newCumInt  + closingCosts),
          cumSaving: Math.round(running),
        })
      }
    }

    const lifetimeSavings = origCumInt - newCumInt - closingCosts
    return { chartData: pts, lifetimeSavings }
  }, [remainingBalance, origRate, newRate, origTerm, newTerm, origMonthly, newMonthly, closingCosts, monthsPaid])

  if (!result) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-4xl mb-3">🔁</p>
        <p>Run a valuation first to analyze a refinance scenario</p>
      </div>
    )
  }

  const breakEvenYears = breakEvenMonths === Infinity ? null : (breakEvenMonths / 12).toFixed(1)

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Refinance Analyzer</h3>
        <p className="text-xs text-slate-500">
          Compare your current loan to a refinance. See break-even months and lifetime interest savings.
        </p>
      </div>

      {/* Current loan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Current Loan</p>
          {[
            { label: 'Original Rate',      value: origRate,     min: 2,  max: 14,  step: 0.125, set: setOrigRate,     fmt: (v: number) => `${v.toFixed(3)}%` },
            { label: 'Original Term',      value: origTerm,     min: 10, max: 30,  step: 5,     set: setOrigTerm,     fmt: (v: number) => `${v}yr` },
            { label: 'Months Already Paid', value: monthsPaid,  min: 1,  max: 360, step: 1,     set: setMonthsPaid,   fmt: (v: number) => `${v} mo (${(v / 12).toFixed(1)}yr)` },
          ].map(s => (
            <div key={s.label}>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-slate-400 uppercase tracking-widest">{s.label}</label>
                <span className="text-xs font-bold text-slate-300">{s.fmt(s.value)}</span>
              </div>
              <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                onChange={e => s.set(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-slate-400" />
            </div>
          ))}
          <div className="bg-slate-900/60 rounded-lg p-3 mt-2">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-500">Current balance</span>
              <span className="font-bold text-red-400">{fmt(remainingBalance)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Current monthly</span>
              <span className="font-bold text-slate-300">{fmt(origMonthly)}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs text-blue-400 uppercase tracking-widest font-bold">New Loan (Refi)</p>
          {[
            { label: 'New Rate',          value: newRate,       min: 2,  max: 12,   step: 0.125, set: setNewRate,       fmt: (v: number) => `${v.toFixed(3)}%` },
            { label: 'New Term',          value: newTerm,       min: 10, max: 30,   step: 5,     set: setNewTerm,       fmt: (v: number) => `${v}yr` },
            { label: 'Closing Costs',     value: closingCosts,  min: 0,  max: 20000, step: 250,  set: setClosingCosts,  fmt: (v: number) => fmt(v) },
            { label: 'Extra Monthly Pmt', value: extraMonthly,  min: 0,  max: 2000, step: 50,    set: setExtraMonthly,  fmt: (v: number) => `+${fmt(v)}` },
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
          <div className="bg-slate-900/60 rounded-lg p-3 mt-2">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-slate-500">New monthly payment</span>
              <span className="font-bold text-blue-400">{fmt(newMonthly)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Monthly {monthlySaving >= 0 ? 'saving' : 'increase'}</span>
              <span className={`font-bold ${monthlySaving >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {monthlySaving >= 0 ? '+' : ''}{fmt(monthlySaving)}/mo
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className={`rounded-xl p-5 border ${lifetimeSavings > 0 ? 'bg-green-900/20 border-green-700/40' : 'bg-red-900/20 border-red-700/40'}`}>
        <p className="text-xs uppercase tracking-widest font-bold text-slate-400 mb-4">Refinance Analysis</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            {
              label: 'Monthly Saving',
              value: fmt(Math.abs(monthlySaving)),
              sub:   monthlySaving >= 0 ? 'saved/mo' : 'extra/mo',
              color: monthlySaving >= 0 ? 'text-green-400' : 'text-red-400',
            },
            {
              label: 'Break-Even',
              value: breakEvenYears ? `${breakEvenYears} yrs` : 'Never',
              sub:   breakEvenYears ? `${breakEvenMonths} months` : 'refi costs more',
              color: breakEvenMonths <= 36 ? 'text-green-400' : breakEvenMonths <= 60 ? 'text-yellow-400' : 'text-red-400',
            },
            {
              label: 'Lifetime Interest Savings',
              value: lifetimeSavings >= 0 ? fmt(lifetimeSavings) : `-${fmt(Math.abs(lifetimeSavings))}`,
              sub:   'vs staying in current loan',
              color: lifetimeSavings >= 0 ? 'text-green-400' : 'text-red-400',
            },
            {
              label: 'Rate Reduction',
              value: `${Math.abs(origRate - newRate).toFixed(3)}%`,
              sub:   newRate < origRate ? 'lower rate' : 'higher rate',
              color: newRate < origRate ? 'text-blue-400' : 'text-red-400',
            },
          ].map(s => (
            <div key={s.label}>
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-600">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {breakEvenMonths < Infinity && (
        <div className={`rounded-lg p-3 border text-xs font-semibold ${
          breakEvenMonths <= 24 ? 'bg-green-900/20 border-green-700/30 text-green-400'
          : breakEvenMonths <= 60 ? 'bg-yellow-900/20 border-yellow-700/30 text-yellow-400'
          : 'bg-red-900/20 border-red-700/30 text-red-400'
        }`}>
          {breakEvenMonths <= 24 && `Strong refinance case — you recoup closing costs in under 2 years and save ${fmt(monthlySaving)}/mo thereafter.`}
          {breakEvenMonths > 24 && breakEvenMonths <= 60 && `Moderate refi case — break-even at ${breakEvenMonths} months. Worth it if you stay ${Math.ceil(breakEvenMonths / 12)}+ years.`}
          {breakEvenMonths > 60 && `Long break-even (${breakEvenMonths} months). Only makes sense if you plan to stay ${Math.ceil(breakEvenMonths / 12)}+ years.`}
        </div>
      )}

      {/* Cumulative savings chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Cumulative Savings After Refinancing</p>
        <p className="text-xs text-slate-600 mb-4">Includes upfront closing costs. Positive = refi has paid off.</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="yr" tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} interval={3} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => v >= 0 ? `$${(v / 1000).toFixed(0)}K` : `-$${(Math.abs(v) / 1000).toFixed(0)}K`} width={60} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v: number, name: string) => [fmt(v), name]} />
            <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" label={{ value: 'Break-even', fill: '#64748b', fontSize: 10 }} />
            <Line type="monotone" dataKey="cumSaving" name="Cumulative Net Saving" stroke="#22c55e" strokeWidth={2.5}
              dot={false} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Side-by-side totals */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Lifetime Cost Comparison</p>
        <div className="space-y-2">
          {[
            { label: 'Current Balance Refinanced', value: fmt(remainingBalance), color: 'text-slate-300' },
            { label: 'Current Loan — Remaining Payments', value: fmt(origMonthly * origRemMonths), color: 'text-red-400' },
            { label: 'New Loan — Total Payments', value: fmt(newMonthly * newTerm * 12), color: 'text-blue-400' },
            { label: 'Refinance Closing Costs', value: fmt(closingCosts), color: 'text-orange-400' },
            { label: 'Net Lifetime Saving (Refi)', value: lifetimeSavings >= 0 ? `+${fmt(lifetimeSavings)}` : `-${fmt(Math.abs(lifetimeSavings))}`, color: lifetimeSavings >= 0 ? 'text-green-400 font-black' : 'text-red-400 font-black' },
          ].map(r => (
            <div key={r.label} className="flex justify-between text-xs">
              <span className="text-slate-500">{r.label}</span>
              <span className={r.color}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Analysis uses simple interest amortization. Does not account for tax deductibility changes or opportunity cost of closing costs.
        Consult a mortgage professional before refinancing.
      </p>
    </div>
  )
}
