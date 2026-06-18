import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, Legend } from 'recharts'

interface StateProfile {
  name: string
  incomeTaxRate: number
  stateSalesTax: number
  medianHomePriceIndex: number
  colIndex: number
  propertyTaxRate: number
  hasCapGainsTax: boolean
}

const STATES: Record<string, StateProfile> = {
  CA: { name: 'California', incomeTaxRate: 13.3, stateSalesTax: 7.25, medianHomePriceIndex: 185, colIndex: 151, propertyTaxRate: 0.75, hasCapGainsTax: true },
  NY: { name: 'New York', incomeTaxRate: 10.9, stateSalesTax: 4.0, medianHomePriceIndex: 165, colIndex: 139, propertyTaxRate: 1.7, hasCapGainsTax: true },
  TX: { name: 'Texas', incomeTaxRate: 0, stateSalesTax: 6.25, medianHomePriceIndex: 95, colIndex: 92, propertyTaxRate: 1.8, hasCapGainsTax: false },
  FL: { name: 'Florida', incomeTaxRate: 0, stateSalesTax: 6.0, medianHomePriceIndex: 105, colIndex: 100, propertyTaxRate: 0.9, hasCapGainsTax: false },
  WA: { name: 'Washington', incomeTaxRate: 0, stateSalesTax: 6.5, medianHomePriceIndex: 130, colIndex: 118, propertyTaxRate: 1.0, hasCapGainsTax: true },
  NV: { name: 'Nevada', incomeTaxRate: 0, stateSalesTax: 6.85, medianHomePriceIndex: 100, colIndex: 100, propertyTaxRate: 0.6, hasCapGainsTax: false },
  AZ: { name: 'Arizona', incomeTaxRate: 2.5, stateSalesTax: 5.6, medianHomePriceIndex: 95, colIndex: 95, propertyTaxRate: 0.65, hasCapGainsTax: true },
  CO: { name: 'Colorado', incomeTaxRate: 4.4, stateSalesTax: 2.9, medianHomePriceIndex: 120, colIndex: 107, propertyTaxRate: 0.5, hasCapGainsTax: true },
  OR: { name: 'Oregon', incomeTaxRate: 9.9, stateSalesTax: 0, medianHomePriceIndex: 120, colIndex: 112, propertyTaxRate: 0.97, hasCapGainsTax: true },
  TN: { name: 'Tennessee', incomeTaxRate: 0, stateSalesTax: 7.0, medianHomePriceIndex: 80, colIndex: 87, propertyTaxRate: 0.6, hasCapGainsTax: false },
  GA: { name: 'Georgia', incomeTaxRate: 5.49, stateSalesTax: 4.0, medianHomePriceIndex: 85, colIndex: 91, propertyTaxRate: 0.92, hasCapGainsTax: true },
  NC: { name: 'North Carolina', incomeTaxRate: 4.5, stateSalesTax: 4.75, medianHomePriceIndex: 82, colIndex: 90, propertyTaxRate: 0.78, hasCapGainsTax: true },
  SC: { name: 'South Carolina', incomeTaxRate: 6.4, stateSalesTax: 6.0, medianHomePriceIndex: 75, colIndex: 88, propertyTaxRate: 0.57, hasCapGainsTax: true },
  VA: { name: 'Virginia', incomeTaxRate: 5.75, stateSalesTax: 5.3, medianHomePriceIndex: 100, colIndex: 103, propertyTaxRate: 0.8, hasCapGainsTax: true },
  IL: { name: 'Illinois', incomeTaxRate: 4.95, stateSalesTax: 6.25, medianHomePriceIndex: 75, colIndex: 95, propertyTaxRate: 2.08, hasCapGainsTax: true },
  OH: { name: 'Ohio', incomeTaxRate: 3.99, stateSalesTax: 5.75, medianHomePriceIndex: 65, colIndex: 88, propertyTaxRate: 1.53, hasCapGainsTax: true },
  MI: { name: 'Michigan', incomeTaxRate: 4.25, stateSalesTax: 6.0, medianHomePriceIndex: 65, colIndex: 87, propertyTaxRate: 1.54, hasCapGainsTax: true },
  PA: { name: 'Pennsylvania', incomeTaxRate: 3.07, stateSalesTax: 6.0, medianHomePriceIndex: 70, colIndex: 93, propertyTaxRate: 1.49, hasCapGainsTax: true },
  MN: { name: 'Minnesota', incomeTaxRate: 9.85, stateSalesTax: 6.875, medianHomePriceIndex: 85, colIndex: 99, propertyTaxRate: 1.11, hasCapGainsTax: true },
  ID: { name: 'Idaho', incomeTaxRate: 5.8, stateSalesTax: 6.0, medianHomePriceIndex: 90, colIndex: 92, propertyTaxRate: 0.69, hasCapGainsTax: true },
  MT: { name: 'Montana', incomeTaxRate: 6.75, stateSalesTax: 0, medianHomePriceIndex: 100, colIndex: 96, propertyTaxRate: 0.84, hasCapGainsTax: true },
  WY: { name: 'Wyoming', incomeTaxRate: 0, stateSalesTax: 4.0, medianHomePriceIndex: 75, colIndex: 91, propertyTaxRate: 0.61, hasCapGainsTax: false },
  SD: { name: 'South Dakota', incomeTaxRate: 0, stateSalesTax: 4.5, medianHomePriceIndex: 70, colIndex: 89, propertyTaxRate: 1.14, hasCapGainsTax: false },
}

interface Inputs {
  fromState: string
  toState: string
  annualIncome: number
  homeValueFrom: number
  homeValueTo: number
  movingDistance: 'local' | 'intrastate' | 'interstate' | 'longDistance'
  bedrooms: number
  professionalMovers: boolean
  temporaryHousing: number
  jobSearchMonths: number
  children: number
  yearsInNewState: number
}

const DEF: Inputs = {
  fromState: 'CA', toState: 'TX',
  annualIncome: 180000,
  homeValueFrom: 750000, homeValueTo: 400000,
  movingDistance: 'interstate',
  bedrooms: 3, professionalMovers: true,
  temporaryHousing: 2, jobSearchMonths: 0,
  children: 1, yearsInNewState: 10,
}

const MOVING_COSTS: Record<string, [number, number]> = {
  local: [500, 1500], intrastate: [1500, 4000],
  interstate: [4000, 10000], longDistance: [8000, 18000],
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const N = (v: string) => parseFloat(v) || 0

export default function RelocationCalc() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = (k: keyof Inputs, v: string | boolean | 'local' | 'intrastate' | 'interstate' | 'longDistance') =>
    setInp(p => ({ ...p, [k]: typeof DEF[k] === 'number' ? N(v as string) : v }))

  const calc = useMemo(() => {
    const { fromState, toState, annualIncome, homeValueFrom, homeValueTo,
            movingDistance, bedrooms, professionalMovers, temporaryHousing,
            jobSearchMonths, children, yearsInNewState } = inp

    const from = STATES[fromState]
    const to = STATES[toState]

    // Tax savings
    const incomeTaxSavings = annualIncome * (from.incomeTaxRate - to.incomeTaxRate) / 100
    const propertyTaxChange = homeValueTo * to.propertyTaxRate / 100 - homeValueFrom * from.propertyTaxRate / 100
    const annualNetTaxSavings = incomeTaxSavings - propertyTaxChange
    const tenYearTaxSavings = annualNetTaxSavings * yearsInNewState

    // One-time moving costs
    const [minMove, maxMove] = MOVING_COSTS[movingDistance]
    const baseMoverCost = professionalMovers ? (minMove + maxMove) / 2 + bedrooms * 800 : minMove * 0.3
    const tempHousingCost = temporaryHousing * 3500
    const jobGapCost = jobSearchMonths * (annualIncome / 12)
    const childEnrollmentCost = children * 500
    const vehicleRegistration = 400
    const stateId = 150
    const miscOneTime = 2000

    const totalOneTimeCosts = baseMoverCost + tempHousingCost + jobGapCost + childEnrollmentCost + vehicleRegistration + stateId + miscOneTime

    // Housing cost change
    const housingDiff = (homeValueTo * to.propertyTaxRate / 100 + homeValueTo * 0.006) -
                        (homeValueFrom * from.propertyTaxRate / 100 + homeValueFrom * 0.006)
    const housingDiffMonthly = housingDiff / 12

    // COL adjustment to income
    const colFactor = to.colIndex / from.colIndex
    const equivalentSalary = annualIncome * colFactor
    const colAdjustedSavings = annualIncome - equivalentSalary

    // Break-even
    const annualBenefit = annualNetTaxSavings + (-colAdjustedSavings)
    const breakEvenYears = annualBenefit > 0 ? totalOneTimeCosts / annualBenefit : Infinity
    const tenYearNet = tenYearTaxSavings + (-colAdjustedSavings * yearsInNewState) - totalOneTimeCosts

    // Year by year
    const yearData = Array.from({ length: Math.min(yearsInNewState, 15) + 1 }, (_, y) => ({
      year: y,
      cumSavings: y === 0 ? -totalOneTimeCosts : -totalOneTimeCosts + annualNetTaxSavings * y + (-colAdjustedSavings) * y,
      cumTaxSavings: annualNetTaxSavings * y,
    }))

    // Comparison radar
    const radarData = [
      { metric: 'Income Tax', from: 100 - from.incomeTaxRate * 5, to: 100 - to.incomeTaxRate * 5 },
      { metric: 'Property Tax', from: 100 - from.propertyTaxRate * 25, to: 100 - to.propertyTaxRate * 25 },
      { metric: 'Home Afford.', from: 100 - from.medianHomePriceIndex * 0.4, to: 100 - to.medianHomePriceIndex * 0.4 },
      { metric: 'Cost of Living', from: 100 - from.colIndex * 0.5, to: 100 - to.colIndex * 0.5 },
      { metric: 'Sales Tax', from: 100 - from.stateSalesTax * 7, to: 100 - to.stateSalesTax * 7 },
    ].map(r => ({
      metric: r.metric,
      [from.name]: Math.max(10, r.from),
      [to.name]: Math.max(10, r.to),
    }))

    // Cost breakdown
    const costBreakdown = [
      { name: 'Moving/Movers', value: baseMoverCost },
      { name: 'Temp Housing', value: tempHousingCost },
      { name: 'Job Gap', value: jobGapCost },
      { name: 'Children', value: childEnrollmentCost },
      { name: 'Registration/ID', value: vehicleRegistration + stateId },
      { name: 'Misc', value: miscOneTime },
    ].filter(d => d.value > 0)

    return {
      from, to, incomeTaxSavings, propertyTaxChange, annualNetTaxSavings, tenYearTaxSavings,
      baseMoverCost, tempHousingCost, jobGapCost, totalOneTimeCosts,
      housingDiffMonthly, colFactor, colAdjustedSavings, equivalentSalary,
      breakEvenYears, tenYearNet, yearData, radarData, costBreakdown,
    }
  }, [inp])

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-lg font-bold text-white">Relocation Cost &amp; Tax Savings Analyzer</h2>
        <p className="text-slate-400 text-xs mt-1">Compare income taxes, cost of living, housing costs, and relocation expenses between states</p>
      </div>

      {/* State Selector */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-red-900/20 rounded-xl p-4 border border-red-700/40 space-y-3">
          <p className="text-xs font-bold text-red-300 uppercase tracking-widest">From State</p>
          <select value={inp.fromState} onChange={e => setInp(p => ({ ...p, fromState: e.target.value }))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
            {Object.entries(STATES).sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-900/50 p-2 rounded-lg text-center">
              <p className="text-red-400 font-bold">{calc.from.incomeTaxRate}%</p>
              <p className="text-slate-500">Income Tax</p>
            </div>
            <div className="bg-slate-900/50 p-2 rounded-lg text-center">
              <p className="text-orange-400 font-bold">{calc.from.propertyTaxRate}%</p>
              <p className="text-slate-500">Property Tax</p>
            </div>
            <div className="bg-slate-900/50 p-2 rounded-lg text-center">
              <p className="text-yellow-400 font-bold">{calc.from.colIndex}</p>
              <p className="text-slate-500">COL Index</p>
            </div>
            <div className="bg-slate-900/50 p-2 rounded-lg text-center">
              <p className="text-slate-300 font-bold">{calc.from.stateSalesTax}%</p>
              <p className="text-slate-500">Sales Tax</p>
            </div>
          </div>
        </div>

        <div className="bg-green-900/20 rounded-xl p-4 border border-green-700/40 space-y-3">
          <p className="text-xs font-bold text-green-300 uppercase tracking-widest">To State</p>
          <select value={inp.toState} onChange={e => setInp(p => ({ ...p, toState: e.target.value }))}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
            {Object.entries(STATES).sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-900/50 p-2 rounded-lg text-center">
              <p className="text-green-400 font-bold">{calc.to.incomeTaxRate}%</p>
              <p className="text-slate-500">Income Tax</p>
            </div>
            <div className="bg-slate-900/50 p-2 rounded-lg text-center">
              <p className="text-blue-400 font-bold">{calc.to.propertyTaxRate}%</p>
              <p className="text-slate-500">Property Tax</p>
            </div>
            <div className="bg-slate-900/50 p-2 rounded-lg text-center">
              <p className="text-yellow-400 font-bold">{calc.to.colIndex}</p>
              <p className="text-slate-500">COL Index</p>
            </div>
            <div className="bg-slate-900/50 p-2 rounded-lg text-center">
              <p className="text-slate-300 font-bold">{calc.to.stateSalesTax}%</p>
              <p className="text-slate-500">Sales Tax</p>
            </div>
          </div>
        </div>
      </div>

      {/* Personal Inputs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Annual Income', key: 'annualIncome' as const, prefix: '$' },
          { label: 'Home Value (From)', key: 'homeValueFrom' as const, prefix: '$' },
          { label: 'Home Value (To)', key: 'homeValueTo' as const, prefix: '$' },
          { label: 'Years in New State', key: 'yearsInNewState' as const },
          { label: 'Bedrooms', key: 'bedrooms' as const },
          { label: 'Temp Housing (months)', key: 'temporaryHousing' as const },
          { label: 'Job Gap (months)', key: 'jobSearchMonths' as const },
          { label: 'Children Moving', key: 'children' as const },
        ].map(f => (
          <div key={f.key}>
            <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
            <div className="relative">
              {f.prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>}
              <input type="number" value={inp[f.key] as number} onChange={e => set(f.key, e.target.value)}
                className={`w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 ${f.prefix ? 'pl-5 pr-3' : 'px-3'}`} />
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Move Distance</label>
          <select value={inp.movingDistance} onChange={e => set('movingDistance', e.target.value as Inputs['movingDistance'])}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
            <option value="local">Local (&lt;50 mi)</option>
            <option value="intrastate">Intrastate (50-300 mi)</option>
            <option value="interstate">Interstate (300-1500 mi)</option>
            <option value="longDistance">Long Distance (&gt;1500 mi)</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer self-end pb-1.5">
          <input type="checkbox" checked={inp.professionalMovers} onChange={e => set('professionalMovers', e.target.checked)} className="accent-blue-500" />
          Professional Movers
        </label>
      </div>

      {/* Summary Banner */}
      <div className={`rounded-xl p-5 border ${calc.tenYearNet > 0 ? 'bg-green-900/20 border-green-700/40' : 'bg-red-900/20 border-red-700/40'}`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <p className={`text-2xl font-black ${calc.incomeTaxSavings > 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(calc.incomeTaxSavings)}</p>
            <p className="text-xs text-slate-400">Annual Income Tax Savings</p>
          </div>
          <div>
            <p className="text-2xl font-black text-red-400">{fmt(calc.totalOneTimeCosts)}</p>
            <p className="text-xs text-slate-400">One-Time Move Costs</p>
          </div>
          <div>
            <p className={`text-2xl font-black ${calc.tenYearNet > 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(calc.tenYearNet)}</p>
            <p className="text-xs text-slate-400">{inp.yearsInNewState}-Year Net Benefit</p>
          </div>
          <div>
            <p className="text-2xl font-black text-blue-400">
              {isFinite(calc.breakEvenYears) ? `${calc.breakEvenYears.toFixed(1)} yr` : 'N/A'}
            </p>
            <p className="text-xs text-slate-400">Break-Even Period</p>
          </div>
        </div>
        <div className="mt-3 text-center">
          <p className="text-xs text-slate-400">
            COL-adjusted equivalent salary in {calc.to.name}: <span className="text-white font-bold">{fmt(calc.equivalentSalary)}</span> vs {fmt(inp.annualIncome)} in {calc.from.name}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Cumulative Net Benefit Over Time</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={calc.yearData.slice(1)}>
              <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => `Yr ${v}`} />
              <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="cumSavings" name="Cumulative Net" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">State Comparison Radar</p>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={calc.radarData}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Radar name={calc.from.name} dataKey={calc.from.name} stroke="#ef4444" fill="#ef4444" fillOpacity={0.15} />
              <Radar name={calc.to.name} dataKey={calc.to.name} stroke="#22c55e" fill="#22c55e" fillOpacity={0.15} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Moving cost breakdown */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">One-Time Relocation Costs</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={calc.costBreakdown} layout="vertical">
            <XAxis type="number" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={90} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Domicile Tips */}
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Domicile Establishment Checklist</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
          {[
            '🪪 Obtain new state driver\'s license within 30-90 days of moving (varies by state)',
            '🗳️ Register to vote in the new state — key domicile evidence',
            '🏦 Update bank accounts, brokerage, and financial accounts to new address',
            '📄 Update your will, trusts, and estate documents in the new state',
            '🚗 Register vehicles in the new state (triggers use tax in some states)',
            '💼 Former state may audit if you spend >183 days/yr there — track carefully',
            '📮 Forward mail, update professional licenses, and update employer payroll',
            '🏥 Establish new doctors, dentists, and professionals in the new location',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
