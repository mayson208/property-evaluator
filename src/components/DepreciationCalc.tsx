import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line, Legend, ReferenceLine } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

// Federal marginal brackets 2024 (approximation for depreciation tax benefit)
function marginalRate(income: number, status: 'single' | 'mfj'): number {
  const brackets = status === 'mfj'
    ? [23200, 94300, 201050, 383900, 487450, 731200]
    : [11600, 47150, 100525, 191950, 243725, 609350]
  const rates = [0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37]
  const idx = brackets.findIndex(b => income < b)
  return rates[idx === -1 ? rates.length - 1 : idx]
}

export default function DepreciationCalc() {
  const { result, input } = usePropertyStore()

  const homeVal  = result?.estimatedValue ?? 400000

  const [purchasePrice,   setPurchasePrice]   = useState(homeVal)
  const [landValue,       setLandValue]       = useState(Math.round(homeVal * 0.20))
  const [improvements,    setImprovements]    = useState(0)
  const [yearPurchased,   setYearPurchased]   = useState(new Date().getFullYear())
  const [monthPurchased,  setMonthPurchased]  = useState(new Date().getMonth() + 1)
  const [income,          setIncome]          = useState(120000)
  const [filingStatus,    setFilingStatus]    = useState<'single' | 'mfj'>('single')

  // Cost segregation bonus depreciation
  const [costSegPct5yr,   setCostSegPct5yr]   = useState(10)  // % of building value that qualifies as 5-yr
  const [costSegPct15yr,  setCostSegPct15yr]  = useState(5)   // % as 15-yr land improvements
  const [bonusDepPct,     setBonusDepPct]     = useState(60)  // current year bonus dep % (phasing down: 80→60→40...)

  const analysis = useMemo(() => {
    const depreciableBase  = purchasePrice - landValue + improvements
    const seg5yr           = depreciableBase * costSegPct5yr / 100
    const seg15yr          = depreciableBase * costSegPct15yr / 100
    const residential39yr  = depreciableBase - seg5yr - seg15yr  // actually 27.5 for residential

    // Annual straight-line 27.5yr depreciation (residential rental)
    const annualDepSL      = depreciableBase / 27.5

    // Cost seg bonus: accelerated in year 1
    const bonus5yr         = seg5yr * bonusDepPct / 100
    const bonus15yr        = seg15yr * bonusDepPct / 100
    const regular5yr       = (seg5yr - bonus5yr) / 5
    const regular15yr      = (seg15yr - bonus15yr) / 15
    const regular27yr      = residential39yr / 27.5
    const totalYr1WithSeg  = bonus5yr + bonus15yr + regular5yr + regular15yr + regular27yr

    // Tax savings
    const mRate            = marginalRate(income, filingStatus)
    const annualTaxSavingsSL    = annualDepSL * mRate
    const yr1TaxSavingsSeg      = totalYr1WithSeg * mRate
    const yr1ExtraSavings       = yr1TaxSavingsSeg - annualTaxSavingsSL

    // 27.5yr schedule with partial year in yr 1 (mid-month convention)
    const firstYrFrac      = (12 - monthPurchased + 0.5) / 12
    const currentYear      = new Date().getFullYear()
    const yearsHeld        = Math.max(0, currentYear - yearPurchased)

    const scheduleRows = Array.from({ length: 30 }, (_, i) => {
      const yr       = i + 1
      const slDep    = i === 0 ? depreciableBase / 27.5 * firstYrFrac : depreciableBase / 27.5
      const balance  = Math.max(0, depreciableBase - (slDep * yr))
      const cumDep   = Math.min(depreciableBase, slDep * yr)
      return { yr, slDep: Math.round(slDep), balance: Math.round(balance), cumDep: Math.round(cumDep), taxSaving: Math.round(slDep * mRate) }
    })

    // Recapture on sale (25% of total depreciation claimed)
    const totalDepClaimed  = scheduleRows.slice(0, yearsHeld).reduce((s, r) => s + r.slDep, 0)
    const recaptureOnSale  = Math.min(totalDepClaimed * 0.25, totalDepClaimed)

    return {
      depreciableBase, annualDepSL, seg5yr, seg15yr, residential39yr,
      totalYr1WithSeg, bonus5yr, bonus15yr, regular5yr, regular15yr, regular27yr,
      mRate, annualTaxSavingsSL, yr1TaxSavingsSeg, yr1ExtraSavings,
      scheduleRows, totalDepClaimed, recaptureOnSale, yearsHeld,
    }
  }, [purchasePrice, landValue, improvements, monthPurchased, yearPurchased, income, filingStatus, costSegPct5yr, costSegPct15yr, bonusDepPct])

  if (!result) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-4xl mb-3">📉</p>
        <p>Run a valuation first to calculate depreciation schedules</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Depreciation Calculator</h3>
        <p className="text-xs text-slate-500">
          IRS straight-line 27.5-year residential depreciation plus cost segregation analysis
          for accelerated deductions in year 1.
        </p>
      </div>

      {/* Key numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Depreciable Basis',    value: fmt(analysis.depreciableBase),      color: 'text-white' },
          { label: 'Annual SL Deprec',     value: fmt(analysis.annualDepSL),           color: 'text-blue-400' },
          { label: 'Annual Tax Savings',   value: fmt(analysis.annualTaxSavingsSL),    color: 'text-green-400' },
          { label: 'Year-1 w/ Cost Seg',   value: fmt(analysis.yr1TaxSavingsSeg),      color: 'text-yellow-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Property Basis</p>
          {[
            { label: 'Purchase Price',   value: purchasePrice,  min: 50000,  max: 5000000, step: 5000,  set: setPurchasePrice, fmt: fmt },
            { label: 'Land Value',       value: landValue,      min: 0,      max: purchasePrice * 0.6, step: 2500, set: setLandValue, fmt: (v: number) => `${fmt(v)} (${((v/purchasePrice)*100).toFixed(0)}%)` },
            { label: 'Improvements',     value: improvements,   min: 0,      max: 500000, step: 1000,   set: setImprovements, fmt: fmt },
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-widest block mb-1">Purchase Year</label>
              <select value={yearPurchased} onChange={e => setYearPurchased(Number(e.target.value))}
                className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded-lg px-2 py-1.5">
                {Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i).map(y =>
                  <option key={y} value={y}>{y}</option>
                )}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-widest block mb-1">Month Placed in Service</label>
              <select value={monthPurchased} onChange={e => setMonthPurchased(Number(e.target.value))}
                className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded-lg px-2 py-1.5">
                {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) =>
                  <option key={i} value={i + 1}>{m}</option>
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-widest block mb-1">Filing Status</label>
              <select value={filingStatus} onChange={e => setFilingStatus(e.target.value as 'single' | 'mfj')}
                className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded-lg px-2 py-1.5">
                <option value="single">Single</option>
                <option value="mfj">Married Filing Jointly</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-widest block mb-1">Taxable Income</label>
              <input type="number" value={income} onChange={e => setIncome(Number(e.target.value))}
                className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded-lg px-2 py-1.5"
                min={0} max={1000000} step={5000} />
            </div>
          </div>
          <p className="text-xs text-slate-600">Marginal rate: {(analysis.mRate * 100).toFixed(0)}%</p>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs text-yellow-400 uppercase tracking-widest font-bold">Cost Segregation (Advanced)</p>
          <p className="text-xs text-slate-500">Reclassify portions of the building as 5-yr or 15-yr property for accelerated bonus depreciation.</p>
          {[
            { label: '5-yr Property %',   value: costSegPct5yr,   min: 0, max: 25,  step: 1,  set: setCostSegPct5yr,  fmt: (v: number) => `${v}% → ${fmt(analysis.depreciableBase * v / 100)}` },
            { label: '15-yr Property %',  value: costSegPct15yr,  min: 0, max: 15,  step: 1,  set: setCostSegPct15yr, fmt: (v: number) => `${v}% → ${fmt(analysis.depreciableBase * v / 100)}` },
            { label: 'Bonus Dep Rate',    value: bonusDepPct,     min: 0, max: 100, step: 20, set: setBonusDepPct,    fmt: (v: number) => `${v}% (${new Date().getFullYear()}: ~60%)` },
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

          <div className="bg-slate-900/60 rounded-lg p-3 space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-slate-500">5-yr bonus deduction</span><span className="text-yellow-400 font-bold">{fmt(analysis.bonus5yr)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">15-yr bonus deduction</span><span className="text-yellow-400 font-bold">{fmt(analysis.bonus15yr)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">27.5-yr regular dep</span><span className="text-slate-300">{fmt(analysis.regular27yr)}</span></div>
            <div className="flex justify-between border-t border-slate-700 pt-1">
              <span className="text-slate-300 font-bold">Total Yr-1 Deduction</span>
              <span className="text-yellow-300 font-black">{fmt(analysis.totalYr1WithSeg)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Extra tax savings vs SL</span>
              <span className="text-green-400 font-bold">{fmt(analysis.yr1ExtraSavings)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 30yr cumulative depreciation chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">27.5-Year Depreciation Schedule</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={analysis.scheduleRows.slice(0, 28)} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="yr" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false}
              label={{ value: 'Year', position: 'insideBottom', offset: -3, fill: '#64748b', fontSize: 10 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} width={55} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number, name: string) => [fmt(v), name === 'balance' ? 'Remaining Basis' : name === 'cumDep' ? 'Cum. Depreciation' : 'Annual Deduction']} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
            {analysis.yearsHeld > 0 && <ReferenceLine x={analysis.yearsHeld} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Now', fill: '#f59e0b', fontSize: 9 }} />}
            <Line type="monotone" dataKey="balance"  stroke="#ef4444" dot={false} strokeWidth={2} name="balance" />
            <Line type="monotone" dataKey="cumDep"   stroke="#3b82f6" dot={false} strokeWidth={2} name="cumDep" />
            <Line type="monotone" dataKey="slDep"    stroke="#22c55e" dot={false} strokeWidth={1.5} strokeDasharray="4 4" name="slDep" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Recapture warning */}
      {analysis.yearsHeld > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-4">
          <p className="text-sm font-bold text-yellow-400 mb-1">Depreciation Recapture on Sale</p>
          <p className="text-xs text-slate-400">
            After {analysis.yearsHeld} years, you've claimed approx. <strong className="text-white">{fmt(analysis.totalDepClaimed)}</strong> in depreciation.
            On sale, the IRS taxes recaptured depreciation at 25% (Section 1250) —
            that's <strong className="text-yellow-300">{fmt(analysis.recaptureOnSale)}</strong> in potential recapture tax,
            regardless of how long you held the property. A 1031 exchange defers this.
          </p>
        </div>
      )}

      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Key Rules &amp; Tips</p>
        <div className="space-y-1.5 text-xs text-slate-400">
          {[
            '📋 Residential rental property depreciates over 27.5 years (commercial is 39 years) using straight-line method.',
            '🏗️ Land is NEVER depreciable — only the building and improvements. IRS requires a reasonable land/building split.',
            '📅 Depreciation starts when the property is "placed in service" (available for rent), not when tenants move in.',
            '⚡ Cost segregation studies (typically $3K–$15K by an engineer) identify 5-yr and 15-yr components for bonus dep.',
            '💰 Bonus depreciation: 100% through 2022, 80% in 2023, 60% in 2024, 40% in 2025, 20% in 2026, then 0%.',
            '⚠️ Passive activity rules: most W-2 earners can only use rental losses to offset passive income (not wages).',
            '🧠 Real estate professionals (750 hrs/yr) can deduct rental losses against ordinary income without passive limits.',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Cost segregation analysis requires a qualified engineering study. Consult a CPA or tax professional
        before claiming accelerated depreciation. Amounts are estimates only.
      </p>
    </div>
  )
}
