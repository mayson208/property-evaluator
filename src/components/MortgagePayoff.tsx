import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function monthlyPmt(principal: number, annualRate: number, termYears: number) {
  const r = annualRate / 100 / 12
  const n = termYears * 12
  if (r === 0 || n === 0) return 0
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

interface PayoffStrategy {
  label: string
  extra: number
  color: string
}

export default function MortgagePayoff() {
  const { result, input, interestRate } = usePropertyStore()

  const homeVal = result?.estimatedValue ?? 400000
  const defaultLoan = homeVal * (1 - (input.downPaymentPct ?? 20) / 100)

  const [loanBalance,   setLoanBalance]   = useState(Math.round(defaultLoan))
  const [rate,          setRate]          = useState(interestRate)
  const [termYrs,       setTermYrs]       = useState(30)
  const [monthsPaid,    setMonthsPaid]    = useState(0)
  const [extraMonthly,  setExtraMonthly]  = useState(200)
  const [extraAnnual,   setExtraAnnual]   = useState(1000)
  const [investReturn,  setInvestReturn]  = useState(7.0)

  const strategies: PayoffStrategy[] = useMemo(() => [
    { label: 'No Extra',            extra: 0,              color: '#64748b' },
    { label: `+${fmt(extraMonthly)}/mo`, extra: extraMonthly, color: '#3b82f6' },
    { label: `+${fmt(extraAnnual)}/yr`,  extra: extraAnnual / 12, color: '#8b5cf6' },
    { label: 'Bi-weekly',           extra: monthlyPmt(loanBalance, rate, termYrs - monthsPaid / 12) / 24, color: '#22c55e' },
  ], [extraMonthly, extraAnnual, loanBalance, rate, termYrs, monthsPaid])

  const baseMonthly = useMemo(() => monthlyPmt(loanBalance, rate, termYrs), [loanBalance, rate, termYrs])

  const { chartData, summaries } = useMemo(() => {
    const r = rate / 100 / 12
    const remainMonths = termYrs * 12 - monthsPaid

    // Simulate each strategy
    const simulations = strategies.map(s => {
      let bal = loanBalance
      let totalInt = 0
      const monthly = baseMonthly + s.extra
      const months: number[] = [Math.round(bal)]
      let payoffMonth = remainMonths

      for (let m = 1; m <= remainMonths; m++) {
        const interest = bal * r
        const principal = Math.min(monthly - interest, bal)
        totalInt += interest
        bal = Math.max(0, bal - principal)
        months.push(Math.round(bal))
        if (bal <= 0 && payoffMonth === remainMonths) {
          payoffMonth = m
        }
      }

      return { label: s.label, color: s.color, months, totalInt, payoffMonth }
    })

    // Build year-by-year chart data
    const maxYears = Math.ceil(remainMonths / 12)
    const data = Array.from({ length: maxYears + 1 }, (_, yr) => {
      const row: Record<string, number | string> = { year: yr }
      simulations.forEach(sim => {
        const mIdx = Math.min(yr * 12, sim.months.length - 1)
        row[sim.label] = sim.months[mIdx]
      })
      return row
    })

    const sums = simulations.map((sim, i) => {
      const yearsEarly = ((simulations[0].payoffMonth - sim.payoffMonth) / 12).toFixed(1)
      const interestSaved = simulations[0].totalInt - sim.totalInt
      return { label: sim.label, color: sim.color, payoffYrs: (sim.payoffMonth / 12).toFixed(1), yearsEarly, interestSaved }
    })

    // Alt: what if extra payment invested instead
    const investAlts = strategies.slice(1).map(s => {
      const extraYrs = Number(sums.find(x => x.label === s.label)?.payoffYrs ?? termYrs)
      const invested = s.extra * 12 * ((Math.pow(1 + investReturn / 100, extraYrs) - 1) / (investReturn / 100))
      const interestSaved = sums.find(x => x.label === s.label)?.interestSaved ?? 0
      return { label: s.label, invested: Math.round(invested), interestSaved: Math.round(interestSaved), better: invested > interestSaved ? 'invest' : 'payoff' }
    })

    return { chartData: data, summaries: sums, investAlts }
  }, [strategies, loanBalance, rate, termYrs, monthsPaid, baseMonthly, investReturn])

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Mortgage Payoff Planner</h3>
        <p className="text-xs text-slate-500">
          Compare extra payment strategies — monthly additions, annual lump sums, bi-weekly payments —
          and see exactly how many years and dollars you save.
        </p>
      </div>

      {/* Base stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center">
          <p className="text-xs text-slate-500 mb-1">Current Balance</p>
          <p className="text-xl font-black text-white">{fmt(loanBalance)}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center">
          <p className="text-xs text-slate-500 mb-1">Base Monthly</p>
          <p className="text-xl font-black text-white">{fmt(baseMonthly)}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center">
          <p className="text-xs text-slate-500 mb-1">Remaining Term</p>
          <p className="text-xl font-black text-white">{termYrs * 12 - monthsPaid} mo</p>
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Loan Details</p>
          {[
            { label: 'Current Balance',      value: loanBalance,  min: 50000,  max: 2000000, step: 5000,  set: setLoanBalance,  fmt: fmt },
            { label: 'Interest Rate',        value: rate,         min: 2,      max: 12,      step: 0.125, set: setRate,         fmt: (v: number) => `${v.toFixed(3)}%` },
            { label: 'Original Term',        value: termYrs,      min: 10,     max: 30,      step: 5,     set: setTermYrs,      fmt: (v: number) => `${v} yr` },
            { label: 'Months Already Paid',  value: monthsPaid,   min: 0,      max: termYrs * 12 - 1, step: 6, set: setMonthsPaid, fmt: (v: number) => `${v} mo` },
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

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Extra Payment Options</p>
          {[
            { label: 'Extra Monthly Payment',  value: extraMonthly,  min: 0,    max: 5000, step: 50,  set: setExtraMonthly,  fmt: fmt,                     color: '#3b82f6' },
            { label: 'Extra Annual Lump Sum',  value: extraAnnual,   min: 0,    max: 50000, step: 500, set: setExtraAnnual,  fmt: fmt,                     color: '#8b5cf6' },
            { label: 'Alt Investment Return',  value: investReturn,  min: 2,    max: 15,   step: 0.5, set: setInvestReturn,  fmt: (v: number) => `${v}%`,  color: '#22c55e' },
          ].map(s => (
            <div key={s.label}>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-slate-400 uppercase tracking-widest">{s.label}</label>
                <span className="text-xs font-bold" style={{ color: s.color }}>{s.fmt(s.value)}</span>
              </div>
              <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                onChange={e => s.set(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: s.color }} />
            </div>
          ))}

          <div className="bg-slate-900/60 rounded-lg p-3 space-y-1 text-xs mt-2">
            <p className="text-slate-500 font-bold uppercase tracking-widest mb-2">Bi-weekly Explained</p>
            <p className="text-slate-400">Pay half your monthly payment every 2 weeks = 26 half-payments = 13 full payments/yr. One extra payment automatically.</p>
          </div>
        </div>
      </div>

      {/* Summary table */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Strategy Comparison</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 text-left border-b border-slate-700">
                <th className="pb-2 pr-4">Strategy</th>
                <th className="pb-2 pr-4">Payoff In</th>
                <th className="pb-2 pr-4">Years Saved</th>
                <th className="pb-2">Interest Saved</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s, i) => (
                <tr key={s.label} className="border-t border-slate-700/50">
                  <td className="py-2 pr-4 font-semibold" style={{ color: s.color }}>{s.label}</td>
                  <td className="py-2 pr-4 text-slate-300">{s.payoffYrs} yrs</td>
                  <td className="py-2 pr-4 text-green-400">{i === 0 ? '—' : `${s.yearsEarly} yrs`}</td>
                  <td className="py-2 text-green-400">{i === 0 ? '—' : fmt(s.interestSaved)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Balance over time chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Loan Balance Over Time</p>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <defs>
              {strategies.map(s => (
                <linearGradient key={s.label} id={`grad-${s.label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={s.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={s.color} stopOpacity={0.0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false}
              label={{ value: 'Year', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 10 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} width={55} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number) => [fmt(v)]} labelFormatter={v => `Year ${v}`} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
            <ReferenceLine y={0} stroke="#64748b" strokeDasharray="3 3" />
            {strategies.map(s => (
              <Area key={s.label} type="monotone" dataKey={s.label}
                stroke={s.color} fill={`url(#grad-${s.label})`}
                strokeWidth={2} dot={false} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Pay Off Mortgage vs. Invest — The Debate</p>
        <div className="space-y-2 text-xs text-slate-400">
          <p>🏦 <strong className="text-slate-200">Pay down mortgage</strong> when: your rate &gt; expected investment return, you want guaranteed risk-free return, near retirement</p>
          <p>📈 <strong className="text-slate-200">Invest instead</strong> when: mortgage rate ≪ stock market expectations (~7–10%), you have long time horizon, employer 401k match</p>
          <p>⚖️ <strong className="text-slate-200">Hybrid approach</strong>: max 401k to get match → invest in Roth IRA → extra toward mortgage → taxable brokerage</p>
          <p>🔑 At {rate}% rate vs {investReturn}% investment return, the math currently {investReturn > rate ? 'favors investing' : 'favors paying down the mortgage'}.</p>
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Verify extra payment terms with your servicer — some loans have prepayment penalties.
        Always specify extra payments go to principal, not future payments.
      </p>
    </div>
  )
}
