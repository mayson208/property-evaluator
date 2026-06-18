import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function monthlyPmt(principal: number, annualRate: number, termYears: number) {
  const r = annualRate / 100 / 12
  const n = termYears * 12
  if (r === 0 || n === 0) return 0
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

function calcCashFlow(rent: number, vacancy: number, expenses: number, price: number, downPct: number, rate: number, termYrs: number, propTax: number, insurance: number): number {
  const loan       = price * (1 - downPct / 100)
  const debt       = monthlyPmt(loan, rate, termYrs)
  const effectRent = rent * (1 - vacancy / 100)
  const expTotal   = effectRent * expenses / 100 + propTax / 12 + insurance / 12
  return effectRent - expTotal - debt
}

type SensMode = 'rent_vs_rate' | 'rent_vs_price' | 'rent_vs_vacancy' | 'price_vs_rate'

export default function CashFlowSensitivity() {
  const { result, input, interestRate, monthlyRent: storeRent } = usePropertyStore()

  const homeVal = result?.estimatedValue ?? 400000
  const defRent = storeRent > 0 ? storeRent : Math.round(homeVal * 0.007)

  const [basePrice,    setBasePrice]    = useState(homeVal)
  const [baseRent,     setBaseRent]     = useState(defRent)
  const [baseRate,     setBaseRate]     = useState(interestRate)
  const [baseVacancy,  setBaseVacancy]  = useState(8)
  const [baseExpenses, setBaseExpenses] = useState(35)
  const [baseDownPct,  setBaseDownPct]  = useState(input.downPaymentPct ?? 25)
  const [baseTax,      setBaseTax]      = useState(Math.round(homeVal * 0.012))
  const [baseIns,      setBaseIns]      = useState(1500)
  const [termYrs,      setTermYrs]      = useState(30)
  const [mode,         setMode]         = useState<SensMode>('rent_vs_rate')

  const { rowLabels, colLabels, matrix, rowKey, colKey } = useMemo(() => {
    const n = 7  // 7×7 grid

    let rows: number[], cols: number[], rKey: string, cKey: string

    if (mode === 'rent_vs_rate') {
      rows = Array.from({ length: n }, (_, i) => Math.round(baseRent  * (0.80 + i * 0.067)))
      cols = Array.from({ length: n }, (_, i) => +(baseRate  * (0.70 + i * 0.10)).toFixed(3))
      rKey = 'Rent'; cKey = 'Rate'
    } else if (mode === 'rent_vs_price') {
      rows = Array.from({ length: n }, (_, i) => Math.round(baseRent  * (0.80 + i * 0.067)))
      cols = Array.from({ length: n }, (_, i) => Math.round(basePrice * (0.80 + i * 0.067)))
      rKey = 'Rent'; cKey = 'Price'
    } else if (mode === 'rent_vs_vacancy') {
      rows = Array.from({ length: n }, (_, i) => Math.round(baseRent * (0.80 + i * 0.067)))
      cols = Array.from({ length: n }, (_, i) => +(0 + i * (20 / (n - 1))).toFixed(0))
      rKey = 'Rent'; cKey = 'Vacancy %'
    } else {
      rows = Array.from({ length: n }, (_, i) => Math.round(basePrice * (0.80 + i * 0.067)))
      cols = Array.from({ length: n }, (_, i) => +(baseRate  * (0.70 + i * 0.10)).toFixed(3))
      rKey = 'Price'; cKey = 'Rate'
    }

    const matrix = rows.map(r => cols.map(c => {
      if (mode === 'rent_vs_rate')    return calcCashFlow(r, baseVacancy, baseExpenses, basePrice, baseDownPct, c, termYrs, baseTax, baseIns)
      if (mode === 'rent_vs_price')   return calcCashFlow(r, baseVacancy, baseExpenses, c, baseDownPct, baseRate, termYrs, baseTax, baseIns)
      if (mode === 'rent_vs_vacancy') return calcCashFlow(r, c, baseExpenses, basePrice, baseDownPct, baseRate, termYrs, baseTax, baseIns)
      return calcCashFlow(baseRent, baseVacancy, baseExpenses, r, baseDownPct, c, termYrs, baseTax, baseIns)
    }))

    const rowLabels = rows.map(v =>
      rKey === 'Rent' || rKey === 'Price' ? fmt(v) : `${v}%`
    )
    const colLabels = cols.map(v =>
      cKey === 'Rate' ? `${v.toFixed(2)}%` :
      cKey === 'Vacancy %' ? `${v}%` :
      cKey === 'Price' ? `$${(v / 1000).toFixed(0)}K` : fmt(v)
    )

    return { rowLabels, colLabels, matrix, rowKey: rKey, colKey: cKey }
  }, [mode, basePrice, baseRent, baseRate, baseVacancy, baseExpenses, baseDownPct, baseTax, baseIns, termYrs])

  const allValues   = matrix.flat()
  const minVal      = Math.min(...allValues)
  const maxVal      = Math.max(...allValues)
  const baseFlow    = calcCashFlow(baseRent, baseVacancy, baseExpenses, basePrice, baseDownPct, baseRate, termYrs, baseTax, baseIns)

  function cellColor(v: number): string {
    if (v >= 500)  return 'bg-green-700/80 text-green-100'
    if (v >= 200)  return 'bg-green-900/60 text-green-300'
    if (v >= 0)    return 'bg-green-900/30 text-green-400'
    if (v >= -200) return 'bg-red-900/30 text-red-400'
    if (v >= -500) return 'bg-red-900/50 text-red-300'
    return 'bg-red-800/80 text-red-200'
  }

  const MODES: { id: SensMode; label: string }[] = [
    { id: 'rent_vs_rate',    label: 'Rent vs Rate' },
    { id: 'rent_vs_price',   label: 'Rent vs Price' },
    { id: 'rent_vs_vacancy', label: 'Rent vs Vacancy' },
    { id: 'price_vs_rate',   label: 'Price vs Rate' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Cash Flow Sensitivity Matrix</h3>
        <p className="text-xs text-slate-500">
          Two-variable sensitivity table showing monthly cash flow across all combinations.
          Green = positive cash flow, red = negative. Cells show monthly net.
        </p>
      </div>

      {/* Base cash flow */}
      <div className={`rounded-xl p-4 border text-center ${baseFlow >= 0 ? 'bg-green-900/20 border-green-700/40' : 'bg-red-900/20 border-red-700/40'}`}>
        <p className="text-xs text-slate-400 mb-1">Base Case Monthly Cash Flow</p>
        <p className={`text-3xl font-black ${baseFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(baseFlow)}</p>
        <p className="text-xs text-slate-500 mt-1">
          {fmt(basePrice)} @ {baseDownPct}% down · {baseRate}% rate · {fmt(baseRent)} rent · {baseVacancy}% vacancy · {baseExpenses}% expense ratio
        </p>
      </div>

      {/* Mode selector */}
      <div className="flex gap-2 flex-wrap">
        {MODES.map(m => (
          <button key={m.id} onClick={() => setMode(m.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${mode === m.id ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'}`}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Base Assumptions</p>
          {[
            { label: 'Purchase Price',   value: basePrice,    min: 50000, max: 3000000, step: 5000,  set: setBasePrice,    fmt: fmt },
            { label: 'Monthly Rent',     value: baseRent,     min: 300,   max: 10000,  step: 50,    set: setBaseRent,     fmt: fmt },
            { label: 'Interest Rate',    value: baseRate,     min: 3,     max: 12,     step: 0.125, set: setBaseRate,     fmt: (v: number) => `${v.toFixed(3)}%` },
            { label: 'Down Payment %',   value: baseDownPct,  min: 3,     max: 60,     step: 1,     set: setBaseDownPct,  fmt: (v: number) => `${v}%` },
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
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Expense Assumptions</p>
          {[
            { label: 'Vacancy Rate',      value: baseVacancy,  min: 0,   max: 25,    step: 1,    set: setBaseVacancy,  fmt: (v: number) => `${v}%` },
            { label: 'Expense Ratio',     value: baseExpenses, min: 15,  max: 60,    step: 5,    set: setBaseExpenses, fmt: (v: number) => `${v}% of gross rent` },
            { label: 'Annual Prop Tax',   value: baseTax,      min: 0,   max: 30000, step: 250,  set: setBaseTax,      fmt: fmt },
            { label: 'Annual Insurance',  value: baseIns,      min: 0,   max: 5000,  step: 100,  set: setBaseIns,      fmt: fmt },
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

      {/* Sensitivity matrix */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">
            Monthly Cash Flow: {rowKey} (rows) × {colKey} (cols)
          </p>
          <div className="flex gap-2 text-xs">
            <span className="bg-green-700/80 text-green-100 px-2 py-0.5 rounded">≥ +$500</span>
            <span className="bg-green-900/60 text-green-300 px-2 py-0.5 rounded">+$200</span>
            <span className="bg-green-900/30 text-green-400 px-2 py-0.5 rounded">$0</span>
            <span className="bg-red-900/50 text-red-300 px-2 py-0.5 rounded">−$200</span>
            <span className="bg-red-800/80 text-red-200 px-2 py-0.5 rounded">&lt;−$500</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-slate-600 text-right pr-2 pb-1 font-normal">{rowKey} ↓ / {colKey} →</th>
                {colLabels.map((l, i) => (
                  <th key={i} className="text-slate-400 font-semibold text-center px-2 pb-1 whitespace-nowrap min-w-[64px]">{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, ri) => (
                <tr key={ri}>
                  <td className="text-slate-400 font-semibold text-right pr-2 py-0.5 whitespace-nowrap">{rowLabels[ri]}</td>
                  {row.map((val, ci) => (
                    <td key={ci} className={`text-center px-2 py-1 rounded font-bold ${cellColor(val)}`}>
                      {val >= 0 ? fmt(val) : `-${fmt(Math.abs(val))}`}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-600 mt-3">
          All other variables held at base case values. Expense ratio includes maintenance, management, reserves (not property tax/insurance).
        </p>
      </div>

      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">How to Use This Table</p>
        <div className="space-y-1.5 text-xs text-slate-400">
          {[
            '📊 Look for the "break-even line" (cells near $0) — your deal is robust if it\'s far into the green zone.',
            '🎯 The base case appears in the middle of the table. Surrounding cells show downside and upside scenarios.',
            '⚠️ If your base case is on the red/green border, the deal has little margin of safety.',
            '💰 Shoot for cash flow ≥ $200/month per unit — covers unexpected vacancies and capex.',
            '🔄 Switch between analysis modes (Rent vs Rate, etc.) to understand which variable poses the most risk.',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
