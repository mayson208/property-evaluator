import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend,
} from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
function fmtK(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
  return fmt(n)
}

function calcMonthlyPayment(principal: number, annualRate: number, termYears: number) {
  const r = annualRate / 100 / 12
  const n = termYears * 12
  if (r === 0) return principal / n
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

interface YearRow {
  year: number
  homeValue: number
  loanBalance: number
  equity: number
  equityPct: number
  totalInterestPaid: number
  totalPrincipalPaid: number
  netWealthGain: number
  investedAlt: number
}

export default function EquityGrowth() {
  const { result, downPaymentPct, interestRate } = usePropertyStore()

  const [appreciationRate, setAppreciationRate] = useState(3.5)
  const [termYears,        setTermYears]        = useState(30)
  const [extraMonthly,     setExtraMonthly]     = useState(0)
  const [investReturn,     setInvestReturn]     = useState(7.0)

  const purchasePrice = result?.estimatedValue ?? 400000
  const downAmt       = purchasePrice * (downPaymentPct / 100)
  const loanAmt       = purchasePrice - downAmt

  const { rows, milestones } = useMemo(() => {
    const r          = interestRate / 100 / 12
    const n          = termYears * 12
    const basePmt    = calcMonthlyPayment(loanAmt, interestRate, termYears)
    const totalPmt   = basePmt + extraMonthly

    const rows: YearRow[] = []
    let balance          = loanAmt
    let totalInterest    = 0
    let totalPrincipal   = 0
    let homeValue        = purchasePrice
    let investedAlt      = downAmt

    const milestones: { year: number; label: string }[] = []
    let hit20 = false, hit50 = false

    for (let yr = 1; yr <= Math.max(termYears, 30); yr++) {
      for (let mo = 0; mo < 12; mo++) {
        if (balance <= 0) break
        const interest  = balance * r
        const principal = Math.min(balance, totalPmt - interest)
        totalInterest  += interest
        totalPrincipal += principal
        balance         = Math.max(0, balance - principal)
        investedAlt    *= (1 + investReturn / 100 / 12)
      }
      homeValue *= (1 + appreciationRate / 100)
      const equity    = homeValue - balance
      const equityPct = (equity / homeValue) * 100

      rows.push({
        year: yr,
        homeValue:          Math.round(homeValue),
        loanBalance:        Math.round(balance),
        equity:             Math.round(equity),
        equityPct:          Math.round(equityPct * 10) / 10,
        totalInterestPaid:  Math.round(totalInterest),
        totalPrincipalPaid: Math.round(totalPrincipal),
        netWealthGain:      Math.round(equity - downAmt),
        investedAlt:        Math.round(investedAlt),
      })

      if (!hit20 && equityPct >= 20) { milestones.push({ year: yr, label: '20% equity' }); hit20 = true }
      if (!hit50 && equityPct >= 50) { milestones.push({ year: yr, label: '50% equity' }); hit50 = true }
      if (balance <= 0 && !milestones.find(m => m.label === 'Paid off')) {
        milestones.push({ year: yr, label: 'Paid off' })
      }
    }

    return { rows, milestones }
  }, [purchasePrice, downAmt, loanAmt, interestRate, termYears, extraMonthly, appreciationRate, investReturn])

  const chartData = rows.filter(r => r.year % 5 === 0 || r.year <= 3 || r.year === termYears)

  const yr5   = rows[4]
  const yr10  = rows[9]
  const yr20  = rows[19]
  const final = rows[termYears - 1] ?? rows[rows.length - 1]

  if (!result) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-4xl mb-3">📈</p>
        <p>Run a valuation first to see your equity growth timeline</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Equity Growth &amp; Wealth Building</h3>
        <p className="text-xs text-slate-500">
          Year-by-year equity buildup from mortgage paydown and home appreciation
        </p>
      </div>

      {/* Controls */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Assumptions</p>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Annual Appreciation', value: appreciationRate, min: 0, max: 10, step: 0.25, set: setAppreciationRate, fmt: (v: number) => `${v.toFixed(2)}%/yr` },
            { label: 'Extra Monthly Payment', value: extraMonthly, min: 0, max: 3000, step: 50, set: setExtraMonthly, fmt: (v: number) => `+${fmt(v)}/mo` },
            { label: 'Alt Investment Return', value: investReturn, min: 0, max: 15, step: 0.25, set: setInvestReturn, fmt: (v: number) => `${v.toFixed(2)}%/yr` },
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
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Loan Term</p>
            <div className="flex gap-2 flex-wrap">
              {[10, 15, 20, 30].map(t => (
                <button key={t}
                  onClick={() => setTermYears(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${termYears === t ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                  {t}yr
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Milestone badges */}
      {milestones.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {milestones.map(m => (
            <span key={m.label} className="flex items-center gap-1.5 bg-blue-900/30 border border-blue-700/40 text-blue-300 text-xs font-semibold px-3 py-1.5 rounded-full">
              <span className="text-blue-400">Year {m.year}</span>
              <span className="text-slate-500">·</span>
              {m.label}
            </span>
          ))}
        </div>
      )}

      {/* Snapshot cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Year 5 Equity',  value: yr5  ? fmt(yr5.equity)   : '—', sub: yr5  ? `${yr5.equityPct}%`   : '' },
          { label: 'Year 10 Equity', value: yr10 ? fmt(yr10.equity)  : '—', sub: yr10 ? `${yr10.equityPct}%`  : '' },
          { label: 'Year 20 Equity', value: yr20 ? fmt(yr20.equity)  : '—', sub: yr20 ? `${yr20.equityPct}%`  : '' },
          { label: `Year ${termYears} Equity`, value: final ? fmt(final.equity) : '—', sub: final ? `${final.equityPct}% · ${fmt(final.homeValue)}` : '' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className="text-xl font-black text-green-400">{s.value}</p>
            <p className="text-xs text-slate-600 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Area chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Home Value vs Loan Balance vs Equity</p>
        <p className="text-xs text-slate-600 mb-4">
          Purchase: {fmt(purchasePrice)} · {downPaymentPct}% down · {interestRate}% rate · {appreciationRate}%/yr appreciation
        </p>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="gradValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="gradEquity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="gradLoan" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false}
              tickFormatter={v => `Yr ${v}`} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => fmtK(v)} width={70} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v: number, name: string) => [fmt(v), name]} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            <Area type="monotone" dataKey="homeValue"   name="Home Value"    stroke="#3b82f6" strokeWidth={2} fill="url(#gradValue)" />
            <Area type="monotone" dataKey="equity"      name="Equity"        stroke="#22c55e" strokeWidth={2} fill="url(#gradEquity)" />
            <Area type="monotone" dataKey="loanBalance" name="Loan Balance"  stroke="#ef4444" strokeWidth={1.5} fill="url(#gradLoan)" strokeDasharray="4 2" />
            {milestones.map(m => (
              <ReferenceLine key={m.label} x={m.year} stroke="#64748b" strokeDasharray="3 3"
                label={{ value: m.label, fill: '#94a3b8', fontSize: 9, position: 'top' }} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Buy vs invest comparison */}
      {final && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Buy vs Invest Down Payment ({termYears}yr outlook)</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900/60 rounded-lg p-4 text-center border border-green-900/40">
              <p className="text-xs text-slate-500 mb-2">🏠 Buy the Home</p>
              <p className="text-2xl font-black text-green-400">{fmt(final.equity)}</p>
              <p className="text-xs text-slate-500 mt-1">equity at year {termYears}</p>
              <p className="text-xs text-slate-600 mt-0.5">net gain: {final.netWealthGain >= 0 ? '+' : ''}{fmt(final.netWealthGain)}</p>
            </div>
            <div className="bg-slate-900/60 rounded-lg p-4 text-center border border-purple-900/40">
              <p className="text-xs text-slate-500 mb-2">📊 Invest Down Payment at {investReturn}%</p>
              <p className="text-2xl font-black text-purple-400">{fmt(final.investedAlt)}</p>
              <p className="text-xs text-slate-500 mt-1">portfolio value at year {termYears}</p>
              <p className="text-xs text-slate-600 mt-0.5">gain: +{fmt(final.investedAlt - downAmt)}</p>
            </div>
          </div>
          <p className={`text-xs font-semibold mt-3 text-center ${final.equity >= final.investedAlt ? 'text-green-400' : 'text-purple-400'}`}>
            {final.equity >= final.investedAlt
              ? `🏠 Buying wins by ${fmt(final.equity - final.investedAlt)} over ${termYears} years at ${appreciationRate}% appreciation`
              : `📊 Investing wins by ${fmt(final.investedAlt - final.equity)} over ${termYears} years at ${investReturn}% return`}
          </p>
          <p className="text-xs text-slate-600 text-center mt-1">Note: comparison doesn't include rent savings, tax benefits, or housing costs.</p>
        </div>
      )}

      {/* Year-by-year table */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Year-by-Year Summary</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700">
                <th className="text-left pb-2">Year</th>
                <th className="text-right pb-2">Home Value</th>
                <th className="text-right pb-2">Loan Balance</th>
                <th className="text-right pb-2">Equity</th>
                <th className="text-right pb-2">Equity %</th>
                <th className="text-right pb-2">Total Interest</th>
                <th className="text-right pb-2">Net Wealth Gain</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows
                .filter(r => r.year === 1 || r.year % 5 === 0 || r.year === termYears)
                .map(r => {
                  const milestone = milestones.find(m => m.year === r.year)
                  return (
                    <tr key={r.year} className={milestone ? 'bg-blue-900/10' : ''}>
                      <td className="py-2 font-semibold text-slate-300">
                        {r.year}
                        {milestone && <span className="ml-2 text-blue-400 font-bold">← {milestone.label}</span>}
                      </td>
                      <td className="text-right py-2 text-slate-300">{fmt(r.homeValue)}</td>
                      <td className="text-right py-2 text-red-400">{r.loanBalance > 0 ? fmt(r.loanBalance) : '—'}</td>
                      <td className="text-right py-2 text-green-400 font-bold">{fmt(r.equity)}</td>
                      <td className="text-right py-2">
                        <span className={`font-bold ${r.equityPct >= 50 ? 'text-green-400' : r.equityPct >= 20 ? 'text-blue-400' : 'text-slate-400'}`}>
                          {r.equityPct}%
                        </span>
                      </td>
                      <td className="text-right py-2 text-red-400">{fmt(r.totalInterestPaid)}</td>
                      <td className="text-right py-2">
                        <span className={r.netWealthGain >= 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                          {r.netWealthGain >= 0 ? '+' : ''}{fmt(r.netWealthGain)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>

      {extraMonthly > 0 && (() => {
        const paidOffYear = milestones.find(m => m.label === 'Paid off')?.year ?? termYears
        const yearsSaved  = termYears - paidOffYear
        return (
          <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-4">
            <p className="text-xs text-blue-300 font-semibold mb-1">
              With {fmt(extraMonthly)}/mo extra: loan paid off at year {paidOffYear}
              {yearsSaved > 0 ? ` — ${yearsSaved} year${yearsSaved !== 1 ? 's' : ''} early` : ''}.
            </p>
            <p className="text-xs text-slate-500">
              Extra principal payments accelerate equity buildup and can eliminate PMI sooner.
            </p>
          </div>
        )
      })()}

      <p className="text-xs text-slate-600 text-center">
        Equity = home value − remaining loan balance. Net wealth gain = equity − original down payment.
        Appreciation compounded annually. Interest calculated on declining balance.
      </p>
    </div>
  )
}
