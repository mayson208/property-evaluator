import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function monthlyPmt(principal: number, annualRate: number, termYears: number) {
  const r = annualRate / 100 / 12
  const n = termYears * 12
  if (r === 0) return principal / n
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

export default function BrrrrCalc() {
  const { result, monthlyRent: storeRent, interestRate } = usePropertyStore()

  const arv = result?.estimatedValue ?? 350000

  // STEP 1: Buy
  const [purchasePrice, setPurchasePrice] = useState(Math.round(arv * 0.65))
  const [closingCostsBuy, setClosingCostsBuy] = useState(3000)
  const [hardMoneyRate, setHardMoneyRate] = useState(10.0)
  const [hardMoneyPoints, setHardMoneyPoints] = useState(2)
  const [hardMoneyPercent, setHardMoneyPercent] = useState(75)

  // STEP 2: Rehab
  const [rehabCost, setRehabCost] = useState(Math.round(arv * 0.12))
  const [holdMonths, setHoldMonths] = useState(5)
  const [monthlyHoldCost, setMonthlyHoldCost] = useState(800)

  // STEP 3: Rent
  const [monthlyRent, setMonthlyRent] = useState(storeRent > 0 ? storeRent : Math.round(arv * 0.007))
  const [vacancyPct, setVacancyPct] = useState(8)
  const [expensesPct, setExpensesPct] = useState(35)

  // STEP 4: Refinance
  const [refinanceRate, setRefinanceRate] = useState(interestRate)
  const [refinanceLtv, setRefinanceLtv] = useState(75)
  const [refinanceTerm, setRefinanceTerm] = useState(30)
  const [refinanceClosing, setRefinanceClosing] = useState(4000)

  const analysis = useMemo(() => {
    // Total into deal before refi
    const hardMoneyLoan    = purchasePrice * hardMoneyPercent / 100
    const hardMoneyOrigin  = hardMoneyLoan * hardMoneyPoints / 100
    const holdInterest     = hardMoneyLoan * (hardMoneyRate / 100 / 12) * holdMonths
    const holdingCosts     = monthlyHoldCost * holdMonths
    const totalCashIn      = (purchasePrice - hardMoneyLoan) + closingCostsBuy + rehabCost + hardMoneyOrigin + holdInterest + holdingCosts

    // After Repair Value and refi
    const refinanceLoan    = arv * refinanceLtv / 100
    const refinancePmt     = monthlyPmt(refinanceLoan, refinanceRate, refinanceTerm)
    const cashOutAtRefi    = refinanceLoan - refinanceClosing - hardMoneyLoan

    // Money left in deal
    const cashLeftInDeal   = totalCashIn - cashOutAtRefi

    // Cash recouped
    const cashRecouped     = Math.max(0, cashOutAtRefi - (totalCashIn - (purchasePrice - hardMoneyLoan) - closingCostsBuy))
    const percentRecouped  = totalCashIn > 0 ? (cashOutAtRefi / totalCashIn) * 100 : 0

    // Cash-on-cash after refi
    const effectiveRent    = monthlyRent * (1 - vacancyPct / 100)
    const expenses         = effectiveRent * expensesPct / 100
    const noi              = effectiveRent - expenses
    const cashFlow         = noi - refinancePmt
    const annualCashFlow   = cashFlow * 12
    const cocReturn        = cashLeftInDeal > 0 ? (annualCashFlow / cashLeftInDeal) * 100 : Infinity

    // Deal quality
    const isHomeRun        = percentRecouped >= 100
    const equity           = arv - refinanceLoan

    return {
      hardMoneyLoan, hardMoneyOrigin, holdInterest, holdingCosts, totalCashIn,
      refinanceLoan, refinancePmt, cashOutAtRefi, cashLeftInDeal,
      percentRecouped, cashRecouped,
      effectiveRent, expenses, noi, cashFlow, annualCashFlow, cocReturn,
      isHomeRun, equity,
    }
  }, [purchasePrice, closingCostsBuy, hardMoneyRate, hardMoneyPoints, hardMoneyPercent, rehabCost, holdMonths, monthlyHoldCost, monthlyRent, vacancyPct, expensesPct, refinanceRate, refinanceLtv, refinanceTerm, refinanceClosing, arv])

  const flowData = [
    { label: 'Purchase',      value: -(purchasePrice + closingCostsBuy), color: '#ef4444' },
    { label: 'Rehab',         value: -rehabCost, color: '#f59e0b' },
    { label: 'Hold Costs',    value: -(analysis.holdInterest + analysis.holdingCosts + analysis.hardMoneyOrigin), color: '#f97316' },
    { label: 'Refi Proceeds', value: analysis.cashOutAtRefi, color: '#22c55e' },
    { label: 'Net Left In',   value: -analysis.cashLeftInDeal, color: analysis.cashLeftInDeal <= 0 ? '#22c55e' : '#3b82f6' },
  ]

  if (!result) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-4xl mb-3">🔄</p>
        <p>Run a valuation first to analyze a BRRRR deal</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">BRRRR Strategy Calculator</h3>
        <p className="text-xs text-slate-500">
          <span className="font-bold text-white">B</span>uy ·{' '}
          <span className="font-bold text-white">R</span>ehab ·{' '}
          <span className="font-bold text-white">R</span>ent ·{' '}
          <span className="font-bold text-white">R</span>efinance ·{' '}
          <span className="font-bold text-white">R</span>epeat.
          Model the entire cycle and see how much capital you recoup.
        </p>
      </div>

      {/* ARV Banner */}
      <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 flex items-center justify-between">
        <span className="text-xs text-slate-400 uppercase tracking-widest">After Repair Value (from valuation)</span>
        <span className="text-xl font-black text-white">{fmt(arv)}</span>
      </div>

      {/* 5 step inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Buy */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs text-blue-400 uppercase tracking-widest font-bold">① Buy</p>
          {[
            { label: 'Purchase Price',     value: purchasePrice,      min: 20000, max: arv,    step: 1000,  set: setPurchasePrice,      fmt: fmt },
            { label: 'Closing Costs',      value: closingCostsBuy,    min: 0,     max: 20000,  step: 250,   set: setClosingCostsBuy,    fmt: fmt },
            { label: 'Hard Money %',       value: hardMoneyPercent,   min: 50,    max: 100,    step: 5,     set: setHardMoneyPercent,   fmt: (v: number) => `${v}% of purchase` },
            { label: 'Hard Money Rate',    value: hardMoneyRate,      min: 6,     max: 18,     step: 0.25,  set: setHardMoneyRate,      fmt: (v: number) => `${v.toFixed(2)}%` },
            { label: 'Hard Money Points',  value: hardMoneyPoints,    min: 0,     max: 5,      step: 0.5,   set: setHardMoneyPoints,    fmt: (v: number) => `${v} pts` },
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
          <div className="bg-slate-900/60 rounded-lg p-2 text-xs flex justify-between">
            <span className="text-slate-500">Your down payment</span>
            <span className="font-bold text-white">{fmt(purchasePrice * (1 - hardMoneyPercent / 100))}</span>
          </div>
        </div>

        {/* Rehab + Rent */}
        <div className="space-y-4">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
            <p className="text-xs text-yellow-400 uppercase tracking-widest font-bold">② Rehab</p>
            {[
              { label: 'Rehab Budget',     value: rehabCost,        min: 0,     max: arv * 0.5, step: 1000, set: setRehabCost,       fmt: fmt },
              { label: 'Hold Period',      value: holdMonths,       min: 1,     max: 18,        step: 1,    set: setHoldMonths,      fmt: (v: number) => `${v} months` },
              { label: 'Monthly Hold Cost', value: monthlyHoldCost, min: 0,     max: 3000,      step: 50,   set: setMonthlyHoldCost, fmt: fmt },
            ].map(s => (
              <div key={s.label}>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-slate-400 uppercase tracking-widest">{s.label}</label>
                  <span className="text-xs font-bold text-yellow-400">{s.fmt(s.value)}</span>
                </div>
                <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                  onChange={e => s.set(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-yellow-400" />
              </div>
            ))}
          </div>

          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
            <p className="text-xs text-green-400 uppercase tracking-widest font-bold">③ Rent</p>
            {[
              { label: 'Monthly Rent',   value: monthlyRent,  min: 300,  max: 8000, step: 50, set: setMonthlyRent,  fmt: (v: number) => `${fmt(v)}/mo` },
              { label: 'Vacancy',        value: vacancyPct,   min: 0,    max: 25,   step: 1,  set: setVacancyPct,   fmt: (v: number) => `${v}%` },
              { label: 'Expense Ratio',  value: expensesPct,  min: 20,   max: 60,   step: 5,  set: setExpensesPct,  fmt: (v: number) => `${v}% (incl. maintenance, mgmt, tax, ins)` },
            ].map(s => (
              <div key={s.label}>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-slate-400 uppercase tracking-widest">{s.label}</label>
                  <span className="text-xs font-bold text-green-400">{s.fmt(s.value)}</span>
                </div>
                <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                  onChange={e => s.set(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-green-500" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Refinance */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
        <p className="text-xs text-purple-400 uppercase tracking-widest font-bold">④ Refinance</p>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Refi Rate',       value: refinanceRate,    min: 3,   max: 12,     step: 0.125, set: setRefinanceRate,    fmt: (v: number) => `${v.toFixed(3)}%` },
            { label: 'Refi LTV',        value: refinanceLtv,     min: 65,  max: 80,     step: 1,     set: setRefinanceLtv,     fmt: (v: number) => `${v}% (${fmt(arv * v / 100)} loan)` },
            { label: 'Refi Term',       value: refinanceTerm,    min: 15,  max: 30,     step: 5,     set: setRefinanceTerm,    fmt: (v: number) => `${v}yr` },
            { label: 'Refi Closing',    value: refinanceClosing, min: 0,   max: 15000,  step: 250,   set: setRefinanceClosing, fmt: fmt },
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
      </div>

      {/* Results */}
      <div className={`rounded-xl p-5 border ${analysis.isHomeRun ? 'bg-green-900/20 border-green-700/40' : 'bg-slate-800/50 border-slate-700'}`}>
        <div className="flex items-center gap-2 mb-4">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">BRRRR Results</p>
          {analysis.isHomeRun && <span className="text-xs bg-green-700/50 text-green-300 px-2 py-0.5 rounded-full font-bold">🏆 Home Run Deal</span>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            { label: 'Total Cash In',    value: fmt(analysis.totalCashIn),       sub: 'before refi',     color: 'text-red-400' },
            { label: 'Cash Recouped',    value: fmt(analysis.cashOutAtRefi),      sub: 'from refi',       color: 'text-green-400' },
            { label: '% Recouped',       value: `${analysis.percentRecouped.toFixed(0)}%`, sub: analysis.isHomeRun ? 'ALL cash back!' : 'of total invested', color: analysis.percentRecouped >= 100 ? 'text-green-400' : analysis.percentRecouped >= 75 ? 'text-yellow-400' : 'text-blue-400' },
            { label: 'Left in Deal',     value: analysis.cashLeftInDeal <= 0 ? 'Nothing!' : fmt(analysis.cashLeftInDeal), sub: analysis.cashLeftInDeal <= 0 ? 'infinite CoC!' : 'remaining', color: analysis.cashLeftInDeal <= 0 ? 'text-green-400' : 'text-slate-300' },
          ].map(s => (
            <div key={s.label}>
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-600 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-slate-500 mb-1">Monthly Cash Flow</p>
            <p className={`text-lg font-black ${analysis.cashFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(analysis.cashFlow)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Cash-on-Cash Return</p>
            <p className={`text-lg font-black ${analysis.cashLeftInDeal <= 0 ? 'text-green-400' : analysis.cocReturn >= 12 ? 'text-green-400' : analysis.cocReturn >= 6 ? 'text-blue-400' : 'text-yellow-400'}`}>
              {analysis.cashLeftInDeal <= 0 ? '∞' : `${analysis.cocReturn.toFixed(1)}%`}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Equity Built</p>
            <p className="text-lg font-black text-green-400">{fmt(analysis.equity)}</p>
          </div>
        </div>
      </div>

      {/* Cost waterfall */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Deal Flow — Cash In / Cash Out</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={flowData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => v >= 0 ? `$${(v / 1000).toFixed(0)}K` : `-$${(Math.abs(v) / 1000).toFixed(0)}K`} width={55} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v: number) => [fmt(Math.abs(v)), v < 0 ? 'Cash Out' : 'Cash In']} />
            <ReferenceLine y={0} stroke="#64748b" strokeDasharray="3 3" />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {flowData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed P&L */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Full Deal Breakdown</p>
        <div className="space-y-1.5 text-xs">
          {[
            { label: 'Purchase price',         value: fmt(purchasePrice),               color: 'text-red-400' },
            { label: 'Closing costs (buy)',     value: fmt(closingCostsBuy),             color: 'text-red-400' },
            { label: 'Hard money down',         value: fmt(purchasePrice * (1 - hardMoneyPercent / 100)), color: 'text-red-400' },
            { label: 'Hard money origination',  value: fmt(analysis.hardMoneyOrigin),    color: 'text-red-400' },
            { label: 'Hard money interest',     value: fmt(analysis.holdInterest),       color: 'text-red-400' },
            { label: 'Rehab budget',            value: fmt(rehabCost),                   color: 'text-red-400' },
            { label: 'Hold costs',              value: fmt(analysis.holdingCosts),       color: 'text-red-400' },
            { label: 'Total cash invested',     value: fmt(analysis.totalCashIn),        color: 'text-white font-black', border: true },
            { label: 'Refi loan proceeds',      value: `+${fmt(analysis.refinanceLoan)}`, color: 'text-green-400' },
            { label: 'Refi closing costs',      value: `-${fmt(refinanceClosing)}`,      color: 'text-red-400' },
            { label: 'Hard money repaid',       value: `-${fmt(analysis.hardMoneyLoan)}`, color: 'text-red-400' },
            { label: 'Net cash from refi',      value: fmt(analysis.cashOutAtRefi),      color: 'text-green-400 font-bold', border: true },
            { label: 'Cash left in deal',       value: fmt(Math.max(0, analysis.cashLeftInDeal)), color: analysis.cashLeftInDeal <= 0 ? 'text-green-400 font-black' : 'text-blue-400 font-black', border: true },
          ].map(r => (
            <div key={r.label} className={`flex justify-between ${r.border ? 'border-t border-slate-700 pt-1.5 mt-1.5' : ''}`}>
              <span className={r.border ? 'text-slate-300 font-semibold' : 'text-slate-500'}>{r.label}</span>
              <span className={r.color}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        BRRRR requires finding below-market deals. Target all-in cost ≤ 75% of ARV.
        Home Run deal = pulling out 100% or more of invested capital via refinance (infinite cash-on-cash return).
        Hard money rates and terms vary significantly by lender and market.
      </p>
    </div>
  )
}
