import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line, ReferenceLine } from 'recharts'

type AppealType = 'diy' | 'consultant' | 'attorney'

interface Comp {
  id: string
  address: string
  salePrice: number
  sqft: number
  saleYear: number
}

interface Inputs {
  assessedValue: number
  taxRate: number
  targetAssessment: number
  appealType: AppealType
  consultantPct: number
  filingFee: number
  timeInvestedHours: number
  hourlyValue: number
  comps: Comp[]
}

const DEF: Inputs = {
  assessedValue: 485000,
  taxRate: 1.25,
  targetAssessment: 390000,
  appealType: 'diy',
  consultantPct: 35,
  filingFee: 150,
  timeInvestedHours: 8,
  hourlyValue: 75,
  comps: [
    { id: '1', address: '101 Maple St', salePrice: 375000, sqft: 2100, saleYear: 2024 },
    { id: '2', address: '204 Elm Ave', salePrice: 405000, sqft: 2350, saleYear: 2024 },
    { id: '3', address: '318 Oak Dr', salePrice: 362000, sqft: 2050, saleYear: 2025 },
  ],
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const N = (v: string) => parseFloat(v) || 0
let nextCompId = 4

export default function PropertyTaxAppeal() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = (k: keyof Inputs, v: string | AppealType) =>
    setInp(p => ({ ...p, [k]: typeof DEF[k] === 'number' ? N(v as string) : v }))

  const updateComp = (id: string, k: keyof Comp, v: string) =>
    setInp(p => ({ ...p, comps: p.comps.map(c => c.id === id ? { ...c, [k]: typeof c[k] === 'number' ? N(v) : v } : c) }))

  const calc = useMemo(() => {
    const { assessedValue, taxRate, targetAssessment, appealType, consultantPct, filingFee, timeInvestedHours, hourlyValue, comps } = inp

    const currentTax = assessedValue * taxRate / 100
    const targetTax = targetAssessment * taxRate / 100
    const annualSavings = currentTax - targetTax
    const reductionPct = assessedValue > 0 ? (assessedValue - targetAssessment) / assessedValue * 100 : 0

    const compImpliedValue = comps.length > 0 ? comps.reduce((s, c) => s + c.salePrice, 0) / comps.length : 0
    const avgCompPSF = comps.length > 0 ? comps.reduce((s, c) => s + c.salePrice / c.sqft, 0) / comps.length : 0
    const equityRatio = compImpliedValue > 0 ? assessedValue / compImpliedValue * 100 : 100
    const overAssessedBy = Math.max(0, assessedValue - compImpliedValue)

    const diyTimeCost = timeInvestedHours * hourlyValue
    const totalDiyCost = filingFee + diyTimeCost
    const contingencyFee = annualSavings * consultantPct / 100
    const consultantCost = filingFee + contingencyFee
    const attorneyCost = filingFee + Math.min(annualSavings * 0.5, 3000)

    const appealCost = appealType === 'diy' ? totalDiyCost : appealType === 'consultant' ? consultantCost : attorneyCost
    const netFirstYearSavings = annualSavings - appealCost
    const breakEvenMonths = appealCost > 0 && annualSavings > 0 ? appealCost / (annualSavings / 12) : 0

    const successRateByType: Record<AppealType, number> = { diy: 45, consultant: 65, attorney: 75 }
    const successRate = successRateByType[appealType]
    const expectedValueSavings = annualSavings * successRate / 100

    const yearlyData = Array.from({ length: 10 }, (_, i) => {
      const y = i + 1
      const cumSavings = Array.from({ length: y }, (__, j) => {
        const bt = assessedValue * Math.pow(1.02, j) * taxRate / 100
        const dt = targetAssessment * Math.pow(1.02, j) * taxRate / 100
        return bt - dt
      }).reduce((a, b) => a + b, 0) - (y === 1 ? appealCost : 0)
      const yearlySavings = assessedValue * Math.pow(1.02, y - 1) * taxRate / 100 - targetAssessment * Math.pow(1.02, y - 1) * taxRate / 100
      return { year: `Yr ${y}`, savings: Math.round(yearlySavings), cumulative: Math.round(cumSavings) }
    })

    const roi10yr = appealCost > 0 && yearlyData[9].cumulative > 0 ? yearlyData[9].cumulative / appealCost * 100 : 0

    const scenarios = [
      { label: 'No Reduction', annualSavings: 0, netSavings: -appealCost },
      { label: 'Partial (50%)', annualSavings: annualSavings * 0.5, netSavings: annualSavings * 0.5 - appealCost },
      { label: 'Full Reduction', annualSavings, netSavings: netFirstYearSavings },
    ]

    return {
      currentTax, targetTax, annualSavings, reductionPct,
      compImpliedValue, avgCompPSF, equityRatio, overAssessedBy,
      diyTimeCost, totalDiyCost, consultantCost, contingencyFee, attorneyCost, appealCost,
      netFirstYearSavings, breakEvenMonths,
      yearlyData, successRate, expectedValueSavings, roi10yr, scenarios,
    }
  }, [inp])

  const field = (label: string, key: keyof Inputs, suffix = '', prefix = '') => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{prefix}</span>}
        <input type="number" value={inp[key] as number} onChange={e => set(key, e.target.value)}
          className={`w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 ${prefix ? 'pl-5 pr-3' : suffix ? 'pl-3 pr-8' : 'px-3'}`} />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{suffix}</span>}
      </div>
    </div>
  )

  const overAssessed = calc.equityRatio > 105

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-lg font-bold text-white">Property Tax Appeal Analyzer</h2>
        <p className="text-slate-400 text-xs mt-1">Assessment reduction ROI, comp-based market value, break-even analysis, 10-year cumulative savings by appeal strategy</p>
      </div>

      <div className={`rounded-xl p-4 border ${overAssessed ? 'bg-red-900/20 border-red-700/40' : 'bg-green-900/20 border-green-700/40'}`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{overAssessed ? '⚠️' : '✅'}</span>
          <div>
            <p className={`font-bold ${overAssessed ? 'text-red-300' : 'text-green-300'}`}>
              {overAssessed
                ? `Over-Assessed by ~${fmt(calc.overAssessedBy)} (${(calc.equityRatio - 100).toFixed(1)}% above comp market value)`
                : `Assessment appears fair — equity ratio ${calc.equityRatio.toFixed(1)}%`}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Comp-implied value: {fmt(calc.compImpliedValue)} · Assessed: {fmt(inp.assessedValue)} · Equity ratio {calc.equityRatio.toFixed(1)}% {overAssessed ? '(>105% = strong appeal basis)' : '(≤105% = uphill battle)'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Assessment Details</p>
          {field('Current Assessed Value', 'assessedValue', '', '$')}
          {field('Property Tax Rate', 'taxRate', '%')}
          {field('Target Assessment (your ask)', 'targetAssessment', '', '$')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Current Annual Tax</span><span className="text-red-400 font-bold">{fmt(calc.currentTax)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Target Annual Tax</span><span className="text-green-400 font-bold">{fmt(calc.targetTax)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Annual Savings (if won)</span><span className="text-blue-400 font-bold">{fmt(calc.annualSavings)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Reduction %</span><span className="text-white">{calc.reductionPct.toFixed(1)}%</span></div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Appeal Strategy</p>
          <div className="space-y-1.5">
            {([['diy', 'DIY (Self-Represent)', '~45% success, low cost'], ['consultant', 'Tax Consultant (contingency)', '~65% success, no upfront'], ['attorney', 'Property Tax Attorney', '~75% success, strongest case']] as const).map(([v, label, sub]) => (
              <label key={v} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition ${inp.appealType === v ? 'border-blue-500 bg-blue-900/20' : 'border-slate-700 hover:border-slate-600'}`}>
                <input type="radio" name="appeal" value={v} checked={inp.appealType === v} onChange={() => set('appealType', v)} className="text-blue-500" />
                <div>
                  <p className="text-xs font-semibold text-slate-200">{label}</p>
                  <p className="text-xs text-slate-500">{sub}</p>
                </div>
              </label>
            ))}
          </div>
          {field('Filing Fee', 'filingFee', '', '$')}
          {inp.appealType === 'diy' && (
            <div className="grid grid-cols-2 gap-2">
              {field('Time (hrs)', 'timeInvestedHours', 'hrs')}
              {field('Hourly Value', 'hourlyValue', '', '$')}
            </div>
          )}
          {inp.appealType === 'consultant' && field('Contingency % of Annual Savings', 'consultantPct', '%')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Total Appeal Cost</span><span className="text-orange-400 font-bold">{fmt(calc.appealCost)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Success Rate (typical)</span><span className="text-blue-400">{calc.successRate}%</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Expected Value / yr</span><span className="text-green-400">{fmt(calc.expectedValueSavings)}</span></div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Appeal ROI</p>
          {[
            { label: 'Net Yr 1 Savings (if won)', value: fmt(calc.netFirstYearSavings), color: calc.netFirstYearSavings > 0 ? 'text-green-400' : 'text-red-400' },
            { label: 'Break-Even', value: calc.breakEvenMonths > 0 ? `${calc.breakEvenMonths.toFixed(1)} months` : 'N/A', color: 'text-blue-400' },
            { label: '10-Year Cumulative', value: fmt(calc.yearlyData[9]?.cumulative ?? 0), color: 'text-purple-400' },
            { label: '10-Year ROI on Cost', value: `${calc.roi10yr.toFixed(0)}%`, color: 'text-white' },
          ].map(m => (
            <div key={m.label} className="flex justify-between items-center p-2 bg-slate-900/50 rounded-lg">
              <span className="text-xs text-slate-400">{m.label}</span>
              <span className={`text-sm font-bold ${m.color}`}>{m.value}</span>
            </div>
          ))}
          <div className="p-3 rounded-lg border border-slate-700 bg-slate-900/50 text-xs space-y-0.5">
            <p className="font-bold text-slate-300 mb-1">Case Strength Checklist</p>
            {[
              { pass: overAssessed, text: `Equity ratio ${calc.equityRatio.toFixed(1)}% — ${overAssessed ? '>105% ✓' : '≤105% ✗'}` },
              { pass: calc.overAssessedBy > 20000, text: `Gap ${fmt(calc.overAssessedBy)} — ${calc.overAssessedBy > 20000 ? '>$20k ✓' : 'small ✗'}` },
              { pass: inp.comps.length >= 3, text: `${inp.comps.length} comp${inp.comps.length !== 1 ? 's' : ''} — ${inp.comps.length >= 3 ? '3+ ideal ✓' : 'need more ✗'}` },
              { pass: calc.annualSavings > calc.appealCost, text: `Savings > cost — ${calc.annualSavings > calc.appealCost ? '✓' : '✗'}` },
            ].map((c, i) => <p key={i} className={c.pass ? 'text-green-400' : 'text-slate-500'}>{c.text}</p>)}
          </div>
        </div>
      </div>

      {/* Comps */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Comparable Sales (Evidence for Appeal)</p>
          <button onClick={() => setInp(p => ({ ...p, comps: [...p.comps, { id: String(nextCompId++), address: 'New Comp', salePrice: 350000, sqft: 2000, saleYear: 2025 }] }))}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg">+ Add</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-slate-500 border-b border-slate-700">
              <th className="text-left py-2 px-2">Address</th>
              <th className="text-right py-2 px-2">Sale Price</th>
              <th className="text-right py-2 px-2">Sqft</th>
              <th className="text-right py-2 px-2">$/sqft</th>
              <th className="text-right py-2 px-2">Year</th>
              <th className="py-2 px-2"></th>
            </tr></thead>
            <tbody className="divide-y divide-slate-700/50">
              {inp.comps.map(c => (
                <tr key={c.id} className="text-slate-300">
                  <td className="py-1.5 px-2">
                    <input value={c.address} onChange={e => updateComp(c.id, 'address', e.target.value)}
                      className="bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none w-full" />
                  </td>
                  <td className="py-1.5 px-2">
                    <input type="number" value={c.salePrice} onChange={e => updateComp(c.id, 'salePrice', e.target.value)}
                      className="bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none w-full text-right" />
                  </td>
                  <td className="py-1.5 px-2">
                    <input type="number" value={c.sqft} onChange={e => updateComp(c.id, 'sqft', e.target.value)}
                      className="bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none w-full text-right" />
                  </td>
                  <td className="text-right py-1.5 px-2 text-blue-400">${c.sqft > 0 ? (c.salePrice / c.sqft).toFixed(0) : 0}</td>
                  <td className="py-1.5 px-2">
                    <input type="number" value={c.saleYear} onChange={e => updateComp(c.id, 'saleYear', e.target.value)}
                      className="bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none w-full text-right" />
                  </td>
                  <td className="py-1.5 px-2">
                    <button onClick={() => setInp(p => ({ ...p, comps: p.comps.filter(x => x.id !== c.id) }))} className="text-slate-600 hover:text-red-400">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-600 font-bold">
                <td className="py-2 px-2 text-slate-300">Avg / Implied Market Value</td>
                <td className="text-right py-2 px-2 text-white">{fmt(calc.compImpliedValue)}</td>
                <td></td>
                <td className="text-right py-2 px-2 text-blue-400">${calc.avgCompPSF.toFixed(0)}/sqft</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Outcome Scenarios (Year 1)</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={calc.scenarios}>
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tickFormatter={v => `$${Math.abs(v)}`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="annualSavings" name="Annual Tax Savings" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="netSavings" name="Net Yr-1 (after costs)" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">10-Year Cumulative Savings</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={calc.yearlyData}>
              <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
              <Line type="monotone" dataKey="cumulative" stroke="#22c55e" strokeWidth={2} dot={false} name="Cumulative Net" />
              <Line type="monotone" dataKey="savings" stroke="#3b82f6" strokeWidth={2} dot={false} name="Annual Savings" strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Tax Appeal — Quick Guide</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
          {[
            '📅 Deadlines: typically 30-90 days after assessment notice — missing it means waiting a full year',
            '📊 Equity argument: if neighbors are assessed at a lower rate per value, use uniformity / equal treatment angle',
            '🏠 Market value argument: the strongest case — comps below your assessed value from the past 12-18 months',
            '📷 Condition evidence: photos of deferred maintenance or defects the assessor may have missed',
            '🤝 Informal hearing: many counties offer this first — often faster and cheaper than formal ARB/BOE',
            '⚖️ Formal hearing (ARB/BOE): requires filing, evidence packets, sometimes sworn testimony',
            '💰 Contingency firms: pay nothing if they lose; they take 25-40% of first-year savings if they win',
            '🔁 Annual reviews: successful appeals typically reset for 1-3 years — calendar re-file after reassessment',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
