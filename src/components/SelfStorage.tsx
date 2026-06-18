import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, LineChart, Line } from 'recharts'

interface UnitType {
  id: string
  label: string
  sqft: number
  count: number
  monthlyRate: number
  climateControlled: boolean
  occupancy: number
}

interface Inputs {
  landValue: number
  constructionCost: number
  softCosts: number
  annualExpensePct: number
  managementFeePct: number
  capRate: number
  loanLTV: number
  loanRate: number
  loanTermYrs: number
  appreciationRate: number
  holdYears: number
  unitTypes: UnitType[]
}

const DEF_UNITS: UnitType[] = [
  { id: '1', label: '5×5 Standard',         sqft: 25,  count: 20, monthlyRate: 65,  climateControlled: false, occupancy: 92 },
  { id: '2', label: '5×10 Standard',        sqft: 50,  count: 30, monthlyRate: 90,  climateControlled: false, occupancy: 90 },
  { id: '3', label: '10×10 Standard',       sqft: 100, count: 40, monthlyRate: 135, climateControlled: false, occupancy: 88 },
  { id: '4', label: '10×10 Climate',        sqft: 100, count: 25, monthlyRate: 175, climateControlled: true,  occupancy: 85 },
  { id: '5', label: '10×15 Standard',       sqft: 150, count: 20, monthlyRate: 170, climateControlled: false, occupancy: 85 },
  { id: '6', label: '10×20 Standard',       sqft: 200, count: 20, monthlyRate: 210, climateControlled: false, occupancy: 82 },
  { id: '7', label: '10×20 Climate',        sqft: 200, count: 15, monthlyRate: 265, climateControlled: true,  occupancy: 80 },
  { id: '8', label: '10×30 Drive-Up',       sqft: 300, count: 10, monthlyRate: 280, climateControlled: false, occupancy: 78 },
]

const DEF: Inputs = {
  landValue: 400000,
  constructionCost: 1200000,
  softCosts: 120000,
  annualExpensePct: 38,
  managementFeePct: 6,
  capRate: 6.5,
  loanLTV: 65,
  loanRate: 6.75,
  loanTermYrs: 25,
  appreciationRate: 4,
  holdYears: 10,
  unitTypes: DEF_UNITS,
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const N = (v: string) => parseFloat(v) || 0
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4', '#f97316', '#84cc16']
let nextUnitId = 9

export default function SelfStorage() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = (k: keyof Inputs, v: string) => setInp(p => ({ ...p, [k]: N(v) }))
  const setUnit = (id: string, k: keyof UnitType, v: string | boolean) =>
    setInp(p => ({ ...p, unitTypes: p.unitTypes.map(u => u.id === id ? { ...u, [k]: typeof v === 'boolean' ? v : (typeof DEF_UNITS[0][k] === 'number' ? N(v as string) : v) } : u) }))

  const calc = useMemo(() => {
    const { unitTypes, landValue, constructionCost, softCosts, annualExpensePct, managementFeePct, capRate, loanLTV, loanRate, loanTermYrs, appreciationRate, holdYears } = inp

    const totalInvestment = landValue + constructionCost + softCosts
    const totalUnits = unitTypes.reduce((s, u) => s + u.count, 0)
    const totalSqft = unitTypes.reduce((s, u) => s + u.sqft * u.count, 0)
    const ccUnits = unitTypes.filter(u => u.climateControlled).reduce((s, u) => s + u.count, 0)
    const ccPct = totalUnits > 0 ? ccUnits / totalUnits * 100 : 0

    const unitMetrics = unitTypes.map(u => {
      const effectiveUnits = u.count * u.occupancy / 100
      const monthlyRevenue = effectiveUnits * u.monthlyRate
      const annualRevenue = monthlyRevenue * 12
      const revPSF = u.sqft > 0 ? annualRevenue / (u.sqft * u.count) : 0
      return { ...u, effectiveUnits, monthlyRevenue, annualRevenue, revPSF }
    })

    const grossAnnualRevenue = unitMetrics.reduce((s, u) => s + u.annualRevenue, 0)
    const potentialGrossRevenue = unitTypes.reduce((s, u) => s + u.count * u.monthlyRate * 12, 0)
    const blendedOccupancy = potentialGrossRevenue > 0 ? grossAnnualRevenue / potentialGrossRevenue * 100 : 0
    const managementFee = grossAnnualRevenue * managementFeePct / 100
    const operatingExpenses = grossAnnualRevenue * annualExpensePct / 100
    const noi = grossAnnualRevenue - operatingExpenses - managementFee
    const expenseRatio = grossAnnualRevenue > 0 ? (operatingExpenses + managementFee) / grossAnnualRevenue * 100 : 0

    // Valuation
    const impliedValue = capRate > 0 ? noi / (capRate / 100) : 0
    const revPSF = totalSqft > 0 ? grossAnnualRevenue / totalSqft : 0
    const noiPSF = totalSqft > 0 ? noi / totalSqft : 0

    // Loan
    const loanAmount = totalInvestment * loanLTV / 100
    const monthlyRate = loanRate / 100 / 12
    const numPayments = loanTermYrs * 12
    const monthlyPayment = loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments) / (Math.pow(1 + monthlyRate, numPayments) - 1)
    const annualDebtService = monthlyPayment * 12
    const annualCashFlow = noi - annualDebtService
    const dscr = annualDebtService > 0 ? noi / annualDebtService : 0
    const equity = totalInvestment * (1 - loanLTV / 100)
    const coc = equity > 0 ? annualCashFlow / equity * 100 : 0

    // Occupancy / revenue ramp for 5 years
    const rampYears = Array.from({ length: 5 }, (_, i) => {
      const y = i + 1
      const rampFactor = Math.min(1, 0.6 + y * 0.1)
      const rev = potentialGrossRevenue * rampFactor
      const expenses = rev * (annualExpensePct + managementFeePct) / 100
      const noiY = rev - expenses
      return { year: `Yr ${y}`, revenue: Math.round(rev), noi: Math.round(noiY), occupancy: parseFloat((blendedOccupancy * rampFactor).toFixed(1)) }
    })

    // Hold projection
    const yearlyHold = Array.from({ length: holdYears }, (_, i) => {
      const y = i + 1
      const projValue = impliedValue * Math.pow(1 + appreciationRate / 100, y)
      const projEquity = projValue - loanAmount * Math.pow(1 - monthlyRate, y * 12)
      return { year: `Yr ${y}`, value: Math.round(projValue), equity: Math.round(projEquity) }
    })

    // Unit mix for pie
    const unitMixPie = unitMetrics.map(u => ({ name: u.label, value: Math.round(u.annualRevenue) }))
    const revenueByType = unitMetrics.map(u => ({ name: u.label.replace(' Standard', '').replace(' Climate', ' CC'), revenue: Math.round(u.annualRevenue), revPSF: parseFloat(u.revPSF.toFixed(2)) }))

    return {
      totalInvestment, totalUnits, totalSqft, ccUnits, ccPct,
      unitMetrics, grossAnnualRevenue, potentialGrossRevenue, blendedOccupancy,
      managementFee, operatingExpenses, noi, expenseRatio,
      impliedValue, revPSF, noiPSF,
      loanAmount, annualDebtService, annualCashFlow, dscr, equity, coc,
      rampYears, yearlyHold, unitMixPie, revenueByType,
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

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-lg font-bold text-white">Self-Storage Analyzer</h2>
        <p className="text-slate-400 text-xs mt-1">Unit mix optimizer — 5×5 to 10×30, climate-controlled premium, occupancy ramp, NOI, DSCR, cap rate valuation</p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Gross Annual Revenue', value: fmt(calc.grossAnnualRevenue), color: 'text-white' },
          { label: 'Annual NOI', value: fmt(calc.noi), color: 'text-blue-400' },
          { label: 'Implied Value (cap rate)', value: fmt(calc.impliedValue), color: 'text-green-400' },
          { label: 'Cash-on-Cash Return', value: `${calc.coc.toFixed(2)}%`, color: calc.coc >= 8 ? 'text-green-400' : 'text-yellow-400' },
        ].map(m => (
          <div key={m.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
            <p className={`text-2xl font-black ${m.color}`}>{m.value}</p>
            <p className="text-xs text-slate-400 mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Units', value: String(calc.totalUnits), color: 'text-white' },
          { label: 'Total Rentable Sqft', value: calc.totalSqft.toLocaleString(), color: 'text-purple-400' },
          { label: 'Blended Occupancy', value: `${calc.blendedOccupancy.toFixed(1)}%`, color: calc.blendedOccupancy >= 85 ? 'text-green-400' : 'text-yellow-400' },
          { label: 'DSCR', value: calc.dscr.toFixed(2), color: calc.dscr >= 1.25 ? 'text-green-400' : 'text-red-400' },
        ].map(m => (
          <div key={m.label} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center">
            <p className={`text-xl font-black ${m.color}`}>{m.value}</p>
            <p className="text-xs text-slate-400 mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Development Costs */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Development / Purchase</p>
          {field('Land Value', 'landValue', '', '$')}
          {field('Construction Cost', 'constructionCost', '', '$')}
          {field('Soft Costs', 'softCosts', '', '$')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Total Investment</span><span className="text-white font-bold">{fmt(calc.totalInvestment)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Cost / sqft</span><span className="text-slate-300">${calc.totalSqft > 0 ? (calc.totalInvestment / calc.totalSqft).toFixed(2) : 0}/sqft</span></div>
          </div>
          {field('Cap Rate (for valuation)', 'capRate', '%')}
          {field('Appreciation Rate', 'appreciationRate', '%')}
          {field('Hold Period', 'holdYears', 'yr')}
        </div>

        {/* Operations */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Operations</p>
          {field('Operating Expense Ratio', 'annualExpensePct', '%')}
          {field('Management Fee', 'managementFeePct', '%')}
          <div className="p-3 bg-slate-900/50 rounded-lg text-xs space-y-1.5">
            <div className="flex justify-between"><span className="text-slate-400">Gross Revenue</span><span className="text-slate-300">{fmt(calc.grossAnnualRevenue)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Operating Expenses</span><span className="text-red-400">({fmt(calc.operatingExpenses)})</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Management Fee</span><span className="text-red-400">({fmt(calc.managementFee)})</span></div>
            <div className="flex justify-between border-t border-slate-700 pt-1"><span className="text-slate-300 font-bold">NOI</span><span className="text-blue-400 font-bold">{fmt(calc.noi)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Expense Ratio</span><span className="text-white">{calc.expenseRatio.toFixed(1)}%</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Rev/sqft</span><span className="text-slate-300">${calc.revPSF.toFixed(2)}/yr</span></div>
            <div className="flex justify-between"><span className="text-slate-400">NOI/sqft</span><span className="text-slate-300">${calc.noiPSF.toFixed(2)}/yr</span></div>
          </div>
          <div className="p-2 bg-blue-900/20 border border-blue-700/30 rounded-lg text-xs space-y-1">
            <p className="text-blue-300 font-semibold">CC Premium</p>
            <p className="text-slate-400">{calc.ccUnits} of {calc.totalUnits} units ({calc.ccPct.toFixed(0)}%) are climate-controlled</p>
            <p className="text-slate-400">CC typically commands 25-40% premium over standard</p>
          </div>
        </div>

        {/* Financing */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Financing & Returns</p>
          {field('Loan LTV', 'loanLTV', '%')}
          {field('Loan Rate', 'loanRate', '%')}
          {field('Loan Term', 'loanTermYrs', 'yr')}
          <div className="p-3 bg-slate-900/50 rounded-lg text-xs space-y-1.5">
            <div className="flex justify-between"><span className="text-slate-400">Loan Amount</span><span className="text-orange-400">{fmt(calc.loanAmount)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Annual Debt Service</span><span className="text-red-400">({fmt(calc.annualDebtService)})</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Annual Cash Flow</span><span className={calc.annualCashFlow > 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>{fmt(calc.annualCashFlow)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Monthly Cash Flow</span><span className={calc.annualCashFlow > 0 ? 'text-green-400' : 'text-red-400'}>{fmt(calc.annualCashFlow / 12)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">DSCR</span><span className={calc.dscr >= 1.25 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>{calc.dscr.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Cash-on-Cash</span><span className="text-blue-400 font-bold">{calc.coc.toFixed(2)}%</span></div>
          </div>
        </div>
      </div>

      {/* Unit Mix Table */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Unit Mix ({calc.totalUnits} total units)</p>
          <button onClick={() => setInp(p => ({ ...p, unitTypes: [...p.unitTypes, { id: String(nextUnitId++), label: 'New Unit', sqft: 100, count: 10, monthlyRate: 120, climateControlled: false, occupancy: 85 }] }))}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg">+ Add Type</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-slate-500 border-b border-slate-700 bg-slate-900/30">
              <th className="text-left py-2 px-3">Unit Type</th>
              <th className="text-right py-2 px-3">Sqft</th>
              <th className="text-right py-2 px-3">Count</th>
              <th className="text-right py-2 px-3">Rate/mo</th>
              <th className="text-right py-2 px-3">Occupancy</th>
              <th className="text-right py-2 px-3">Annual Rev</th>
              <th className="text-right py-2 px-3">Rev/sqft</th>
              <th className="text-center py-2 px-3">CC</th>
              <th className="py-2 px-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-slate-700/50">
              {calc.unitMetrics.map((u, idx) => (
                <tr key={u.id} className="hover:bg-slate-700/20 transition">
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: COLORS[idx % COLORS.length] }} />
                      <input value={u.label} onChange={e => setUnit(u.id, 'label', e.target.value)}
                        className="bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none text-slate-200 w-32" />
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <input type="number" value={u.sqft} onChange={e => setUnit(u.id, 'sqft', e.target.value)}
                      className="bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none text-right text-slate-300 w-16" />
                  </td>
                  <td className="py-2 px-3">
                    <input type="number" value={u.count} onChange={e => setUnit(u.id, 'count', e.target.value)}
                      className="bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none text-right text-slate-300 w-14" />
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-slate-500">$</span>
                      <input type="number" value={u.monthlyRate} onChange={e => setUnit(u.id, 'monthlyRate', e.target.value)}
                        className="bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none text-right text-slate-300 w-16" />
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center justify-end gap-1">
                      <input type="number" value={u.occupancy} onChange={e => setUnit(u.id, 'occupancy', e.target.value)}
                        className="bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none text-right text-slate-300 w-12" />
                      <span className="text-slate-500">%</span>
                    </div>
                  </td>
                  <td className="text-right py-2 px-3 text-blue-400 font-semibold">{fmt(u.annualRevenue)}</td>
                  <td className="text-right py-2 px-3 text-slate-400">${u.revPSF.toFixed(2)}</td>
                  <td className="text-center py-2 px-3">
                    <button onClick={() => setUnit(u.id, 'climateControlled', !u.climateControlled)}
                      className={`w-8 h-4 rounded-full transition-colors ${u.climateControlled ? 'bg-blue-500' : 'bg-slate-700'}`}>
                      <div className={`w-3 h-3 bg-white rounded-full mx-0.5 transition-transform ${u.climateControlled ? 'translate-x-3.5' : 'translate-x-0'}`} />
                    </button>
                  </td>
                  <td className="py-2 px-3">
                    <button onClick={() => setInp(p => ({ ...p, unitTypes: p.unitTypes.filter(x => x.id !== u.id) }))}
                      className="text-slate-600 hover:text-red-400">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-600 font-bold bg-slate-900/40 text-xs">
                <td className="py-2 px-3 text-slate-300">TOTAL</td>
                <td className="text-right py-2 px-3 text-slate-300">{calc.totalSqft.toLocaleString()} sqft</td>
                <td className="text-right py-2 px-3 text-slate-300">{calc.totalUnits}</td>
                <td className="py-2 px-3"></td>
                <td className="text-right py-2 px-3 text-yellow-400">{calc.blendedOccupancy.toFixed(1)}%</td>
                <td className="text-right py-2 px-3 text-blue-400 font-bold">{fmt(calc.grossAnnualRevenue)}</td>
                <td className="text-right py-2 px-3 text-slate-400">${calc.revPSF.toFixed(2)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Revenue by Unit Type</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={calc.unitMixPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={false}>
                {calc.unitMixPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Revenue/sqft by Unit Type</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={calc.revenueByType} layout="vertical">
              <XAxis type="number" tickFormatter={v => `$${v}`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 9 }} width={80} />
              <Tooltip formatter={(v: number) => `$${v.toFixed(2)}/sqft/yr`} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="revPSF" name="Rev/sqft/yr" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Occupancy Ramp */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-1">Lease-Up Ramp (Year 1-5 from Opening)</p>
        <p className="text-xs text-slate-500 mb-3">Assumes 60% occupancy at open, +10% per year to stabilized. Adjust occupancy per unit type to model your market.</p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={calc.rampYears}>
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis yAxisId="left" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}%`} tick={{ fill: '#64748b', fontSize: 10 }} domain={[0, 100]} />
            <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} name="Revenue" />
            <Line yAxisId="left" type="monotone" dataKey="noi" stroke="#22c55e" strokeWidth={2} dot={false} name="NOI" />
            <Line yAxisId="right" type="monotone" dataKey="occupancy" stroke="#f59e0b" strokeWidth={2} dot={false} name="Occupancy %" strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Self-Storage Industry Benchmarks</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
          {[
            '📊 Stabilized occupancy: 85-93% physical, ~90% economic (economic = revenue / potential at 100% occ)',
            '💰 Expense ratio: 35-45% for self-operated; 40-50% with 3rd-party management; REITs run ~37%',
            '🌡 Climate-controlled premium: 25-40% over standard — 10x10 CC vs 10x10 standard is common test case',
            '🚗 Drive-up vs indoor: drive-up commands 5-10% premium for vehicle/oversized access; indoor is more CC-friendly',
            '📍 Trade area: 3-5 mile radius for primary demand; market cap rates 5.5-7.5% depending on MSA and vintage',
            '🏗 Construction cost: ground-up typically $40-80/sqft (single-story) to $60-120/sqft (multi-story climate-controlled)',
            '🔄 REITs (PS, EXR, CUBE, LSI): trade at 16-22x FFO — institutional benchmark for cap rate compression',
            '📈 Revenue management: dynamic pricing (like hotels) can lift revenue 10-15% at same occupancy vs flat-rate pricing',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
