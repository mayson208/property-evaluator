import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

// Approximate property tax rates by state (effective rates as %)
const STATE_TAX_RATES: Record<string, number> = {
  AL: 0.41, AK: 1.19, AZ: 0.62, AR: 0.61, CA: 0.75, CO: 0.51, CT: 2.14,
  DE: 0.57, FL: 0.89, GA: 0.92, HI: 0.32, ID: 0.69, IL: 2.27, IN: 0.85,
  IA: 1.57, KS: 1.41, KY: 0.86, LA: 0.55, ME: 1.36, MD: 1.09, MA: 1.23,
  MI: 1.54, MN: 1.12, MS: 0.65, MO: 0.97, MT: 0.84, NE: 1.73, NV: 0.55,
  NH: 2.18, NJ: 2.49, NM: 0.80, NY: 1.72, NC: 0.82, ND: 0.98, OH: 1.59,
  OK: 0.90, OR: 0.97, PA: 1.58, RI: 1.63, SC: 0.57, SD: 1.31, TN: 0.71,
  TX: 1.80, UT: 0.58, VT: 1.90, VA: 0.82, WA: 0.98, WV: 0.59, WI: 1.85, WY: 0.61,
}

const APPEAL_STEPS = [
  { step: 1, title: 'Review Assessment Notice', desc: 'Check the assessed value vs. market value, note the appeal deadline (typically 30–90 days from notice).', effort: 'Low', cost: '$0' },
  { step: 2, title: 'Gather Comparable Sales', desc: 'Find 3–5 recent sales of similar homes in your area that closed lower than your assessed value. Use MLS, Zillow, or county records.', effort: 'Medium', cost: '$0–$100' },
  { step: 3, title: 'Request Property Record Card', desc: 'Get the assessor\'s property card to check for errors: wrong sq ft, bedroom count, lot size, or condition grade.', effort: 'Low', cost: '$0' },
  { step: 4, title: 'File Informal Appeal', desc: 'Meet with the assessor informally first — many errors are fixed without a formal hearing. Bring your comps and any photos.', effort: 'Low', cost: '$0' },
  { step: 5, title: 'Formal Hearing (if needed)', desc: 'File a formal appeal with the county board of equalization or review board. Present your evidence and comparable sales.', effort: 'High', cost: '$0–$300' },
  { step: 6, title: 'Hire a Tax Consultant', desc: 'For high-value properties or complex cases, a property tax consultant takes 25–40% of the first-year savings as their fee.', effort: 'Low (delegated)', cost: '25–40% of savings' },
]

export default function PropertyTaxAppeal() {
  const { result, input } = usePropertyStore()

  const stateKey = (input.state ?? 'TX') as keyof typeof STATE_TAX_RATES
  const marketValue = result?.estimatedValue ?? 400000
  const defaultRate = STATE_TAX_RATES[stateKey] ?? 1.2

  const [assessedValue,    setAssessedValue]    = useState(marketValue)
  const [targetAssessment, setTargetAssessment] = useState(Math.round(marketValue * 0.90))
  const [taxRatePct,       setTaxRatePct]       = useState(defaultRate)
  const [homesteadExempt,  setHomesteadExempt]  = useState(25000)
  const [seniorExempt,     setSeniorExempt]     = useState(0)
  const [veteranExempt,    setVeteranExempt]    = useState(0)
  const [consultantPct,    setConsultantPct]    = useState(30)
  const [checkedSteps,     setCheckedSteps]     = useState<number[]>([])

  const analysis = useMemo(() => {
    const totalExempt     = homesteadExempt + seniorExempt + veteranExempt
    const taxableBase     = Math.max(0, assessedValue - totalExempt)
    const targetBase      = Math.max(0, targetAssessment - totalExempt)

    const currentTaxAnnual = taxableBase * taxRatePct / 100
    const targetTaxAnnual  = targetBase  * taxRatePct / 100
    const annualSavings    = currentTaxAnnual - targetTaxAnnual
    const monthlySavings   = annualSavings / 12

    const pctReduction     = assessedValue > 0 ? ((assessedValue - targetAssessment) / assessedValue) * 100 : 0
    const marketGap        = assessedValue - marketValue  // positive = over-assessed
    const overAssessedPct  = marketValue > 0 ? (marketGap / marketValue) * 100 : 0

    const yr5Savings       = annualSavings * 5
    const consultantFee    = annualSavings * consultantPct / 100

    // Comps needed to prove case
    const compsNeeded = Math.ceil(3 + (pctReduction > 10 ? 2 : 0))

    // Success probability (rough heuristic)
    const successOdds =
      overAssessedPct > 15 ? 80 :
      overAssessedPct > 10 ? 65 :
      overAssessedPct >  5 ? 45 :
      overAssessedPct >  0 ? 25 : 5

    // Bar chart data: assessed vs market vs target
    const barData = [
      { name: 'Market Value',     value: Math.round(marketValue), color: '#3b82f6' },
      { name: 'Assessed (now)',   value: Math.round(assessedValue), color: '#ef4444' },
      { name: 'Target Appeal',    value: Math.round(targetAssessment), color: '#22c55e' },
    ]

    return { taxableBase, targetBase, currentTaxAnnual, targetTaxAnnual, annualSavings, monthlySavings,
             pctReduction, marketGap, overAssessedPct, yr5Savings, consultantFee, compsNeeded, successOdds, barData }
  }, [assessedValue, targetAssessment, taxRatePct, homesteadExempt, seniorExempt, veteranExempt, consultantPct, marketValue])

  const toggleStep = (n: number) => {
    setCheckedSteps(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n])
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Property Tax Appeal</h3>
        <p className="text-xs text-slate-500">
          Estimate your potential tax savings from appealing your assessed value,
          model exemptions, and follow the step-by-step appeal process.
        </p>
      </div>

      {/* Over-assessment alert */}
      {analysis.overAssessedPct > 5 && (
        <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-4">
          <p className="text-sm font-bold text-yellow-400 mb-1">
            ⚠️ Potentially Over-Assessed by {analysis.overAssessedPct.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-400">
            Your assessed value ({fmt(assessedValue)}) is{' '}
            <strong className="text-white">{fmt(analysis.marketGap)}</strong> above the estimated market value ({fmt(marketValue)}).
            Estimated appeal success probability: <strong className="text-yellow-300">{analysis.successOdds}%</strong>.
          </p>
        </div>
      )}
      {analysis.overAssessedPct <= 0 && (
        <div className="bg-green-900/20 border border-green-700/40 rounded-xl p-3 text-center text-xs text-green-400">
          Your assessed value appears to be at or below market — appeal may be difficult to win.
        </div>
      )}

      {/* Key savings stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Current Annual Tax', value: fmt(analysis.currentTaxAnnual), color: 'text-red-400' },
          { label: 'After Appeal',        value: fmt(analysis.targetTaxAnnual),  color: 'text-green-400' },
          { label: 'Annual Savings',      value: fmt(analysis.annualSavings),    color: 'text-white' },
          { label: '5-Year Savings',      value: fmt(analysis.yr5Savings),       color: 'text-blue-400' },
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
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Assessment Details</p>
          {[
            { label: 'Current Assessed Value',  value: assessedValue,    min: 50000, max: 5000000, step: 5000,  set: setAssessedValue,    fmt: fmt },
            { label: 'Target Appeal Value',     value: targetAssessment, min: 50000, max: assessedValue, step: 5000, set: setTargetAssessment, fmt: (v: number) => `${fmt(v)} (−${((1 - v/assessedValue)*100).toFixed(1)}%)` },
            { label: 'Tax Rate (effective %)',  value: taxRatePct,       min: 0.1,   max: 4.0,    step: 0.05,  set: setTaxRatePct,       fmt: (v: number) => `${v.toFixed(2)}%` },
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

          <div className="bg-slate-900/60 rounded-lg p-3 space-y-1 text-xs">
            <p className="text-slate-500 uppercase tracking-widest text-xs font-bold mb-2">Exemptions</p>
            {[
              { label: 'Homestead Exemption', value: homesteadExempt, set: setHomesteadExempt, max: 100000 },
              { label: 'Senior Exemption',    value: seniorExempt,    set: setSeniorExempt,    max: 100000 },
              { label: 'Veteran Exemption',   value: veteranExempt,   set: setVeteranExempt,   max: 100000 },
            ].map(e => (
              <div key={e.label} className="flex items-center gap-2">
                <span className="text-slate-400 w-32 flex-shrink-0">{e.label}</span>
                <input type="number" value={e.value} onChange={ev => e.set(Number(ev.target.value))}
                  min={0} max={e.max} step={1000}
                  className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200" />
              </div>
            ))}
            <div className="flex justify-between pt-1 border-t border-slate-700">
              <span className="text-slate-400">Taxable base after exemptions</span>
              <span className="text-white font-bold">{fmt(analysis.taxableBase)}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-4">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Assessed vs Market vs Target</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={analysis.barData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9 }} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} width={55} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(v: number) => [fmt(v)]} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {analysis.barData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          <div className="space-y-2">
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-slate-400 uppercase tracking-widest">Consultant Fee Split</label>
                <span className="text-xs font-bold text-purple-400">{consultantPct}% of savings</span>
              </div>
              <input type="range" min={20} max={50} step={5} value={consultantPct}
                onChange={e => setConsultantPct(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-purple-500" />
            </div>
            <div className="bg-slate-900/60 rounded-lg p-3 space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Your net savings/yr (DIY)</span><span className="text-green-400 font-bold">{fmt(analysis.annualSavings)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Consultant fee (Yr 1)</span><span className="text-yellow-400">{fmt(analysis.consultantFee)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Your net savings/yr (w/ consultant)</span><span className="text-green-400 font-bold">{fmt(analysis.annualSavings - analysis.consultantFee)}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Step-by-step appeal process */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">
          Appeal Checklist ({checkedSteps.length}/{APPEAL_STEPS.length} complete)
        </p>
        <div className="w-full h-1.5 bg-slate-700 rounded-full mb-4 overflow-hidden">
          <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${(checkedSteps.length / APPEAL_STEPS.length) * 100}%` }} />
        </div>
        <div className="space-y-3">
          {APPEAL_STEPS.map(s => (
            <div key={s.step} className={`flex gap-3 p-3 rounded-xl border cursor-pointer transition ${checkedSteps.includes(s.step) ? 'bg-green-900/20 border-green-800/50' : 'bg-slate-900/40 border-slate-700 hover:bg-slate-700/30'}`}
              onClick={() => toggleStep(s.step)}>
              <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-black mt-0.5 ${checkedSteps.includes(s.step) ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                {checkedSteps.includes(s.step) ? '✓' : s.step}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-xs font-bold text-slate-200">{s.title}</p>
                  <span className="text-xs text-slate-500">{s.cost}</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Property tax appeal deadlines vary by county — typically 30–90 days from your assessment notice.
        State effective tax rates are approximate; check your county assessor for exact rates and exemptions.
      </p>
    </div>
  )
}
