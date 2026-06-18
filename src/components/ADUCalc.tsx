import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line, PieChart, Pie, Cell } from 'recharts'

type ADUType = 'garageConversion' | 'basementADU' | 'attachedADU' | 'detachedADU' | 'jadu'
type FinancingType = 'cash' | 'cashOutRefi' | 'heloc' | 'constructionLoan' | 'renovationLoan'

interface Inputs {
  mainHomeValue: number
  mainHomeLoanBalance: number
  aduType: ADUType
  aduSqft: number
  constructionCostPerSqft: number
  softCosts: number
  aduRent: number
  vacancyPct: number
  mgmtFeePct: number
  maintenancePct: number
  utilityAnnual: number
  insuranceAdd: number
  propertyTaxAdd: number
  financingType: FinancingType
  refiRate: number
  refiTerm: number
  heloCRate: number
  valueAddMultiplier: number
  neighborhoodCapRate: number
  holdYears: number
  appreciationRate: number
}

const ADU_COST_DEFAULTS: Record<ADUType, { sqftMin: number; sqftMax: number; costLow: number; costHigh: number; label: string }> = {
  jadu: { sqftMin: 150, sqftMax: 500, costLow: 25000, costHigh: 80000, label: 'Junior ADU (JADU ≤500 sqft)' },
  garageConversion: { sqftMin: 300, sqftMax: 700, costLow: 50, costHigh: 130, label: 'Garage Conversion' },
  basementADU: { sqftMin: 400, sqftMax: 1200, costLow: 75, costHigh: 175, label: 'Basement ADU' },
  attachedADU: { sqftMin: 400, sqftMax: 1200, costLow: 150, costHigh: 275, label: 'Attached ADU' },
  detachedADU: { sqftMin: 400, sqftMax: 1200, costLow: 200, costHigh: 400, label: 'Detached ADU (backyard cottage)' },
}

const DEF: Inputs = {
  mainHomeValue: 850000,
  mainHomeLoanBalance: 320000,
  aduType: 'garageConversion',
  aduSqft: 500,
  constructionCostPerSqft: 90,
  softCosts: 25000,
  aduRent: 1800,
  vacancyPct: 5,
  mgmtFeePct: 0,
  maintenancePct: 8,
  utilityAnnual: 0,
  insuranceAdd: 600,
  propertyTaxAdd: 1200,
  financingType: 'cashOutRefi',
  refiRate: 7.25,
  refiTerm: 30,
  heloCRate: 9.0,
  valueAddMultiplier: 150,
  neighborhoodCapRate: 5.5,
  holdYears: 10,
  appreciationRate: 4,
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const N = (v: string) => parseFloat(v) || 0
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7']

function monthlyPmt(principal: number, annualRate: number, termYears: number) {
  if (annualRate === 0) return principal / (termYears * 12)
  const r = annualRate / 100 / 12
  const n = termYears * 12
  return principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1)
}

export default function ADUCalc() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = (k: keyof Inputs, v: string | ADUType | FinancingType) =>
    setInp(p => ({ ...p, [k]: typeof DEF[k] === 'number' ? N(v as string) : v }))

  const calc = useMemo(() => {
    const {
      mainHomeValue, mainHomeLoanBalance, aduType, aduSqft, constructionCostPerSqft,
      softCosts, aduRent, vacancyPct, mgmtFeePct, maintenancePct,
      utilityAnnual, insuranceAdd, propertyTaxAdd,
      financingType, refiRate, refiTerm, heloCRate,
      valueAddMultiplier, neighborhoodCapRate, holdYears, appreciationRate,
    } = inp

    const profile = ADU_COST_DEFAULTS[aduType]
    const constructionCost = aduType === 'jadu'
      ? Math.max(profile.costLow, Math.min(profile.costHigh, constructionCostPerSqft * aduSqft))
      : constructionCostPerSqft * aduSqft
    const totalCost = constructionCost + softCosts
    const currentEquity = mainHomeValue - mainHomeLoanBalance

    // Property value increase
    const valueByRent = aduRent * 12 / (neighborhoodCapRate / 100)  // income approach
    const valueByComp = aduSqft * valueAddMultiplier                  // $/sqft approach
    const estimatedValueAdd = (valueByRent + valueByComp) / 2
    const newHomeValue = mainHomeValue + estimatedValueAdd
    const roi = totalCost > 0 ? estimatedValueAdd / totalCost * 100 : 0

    // Revenue
    const grossAnnualRent = aduRent * 12
    const vacancy = grossAnnualRent * vacancyPct / 100
    const effectiveRent = grossAnnualRent - vacancy
    const mgmtFee = effectiveRent * mgmtFeePct / 100
    const maintenance = effectiveRent * maintenancePct / 100
    const totalExpenses = mgmtFee + maintenance + utilityAnnual + insuranceAdd + propertyTaxAdd
    const noi = effectiveRent - totalExpenses

    // Financing
    let annualDebtService = 0
    let monthlyPayment = 0
    let financingNote = ''

    if (financingType === 'cashOutRefi') {
      // Refi entire home + ADU cost
      const newLoanAmount = (mainHomeValue + estimatedValueAdd) * 0.80
      const additionalBorrowed = newLoanAmount - mainHomeLoanBalance
      const newMonthly = monthlyPmt(newLoanAmount, refiRate, refiTerm)
      const oldMonthly = monthlyPmt(mainHomeLoanBalance, 3.5, 30) // approx old payment
      monthlyPayment = newMonthly - oldMonthly
      annualDebtService = monthlyPayment * 12
      financingNote = `Cash-out refi: ${fmt(newLoanAmount)} new loan, ${fmt(additionalBorrowed)} extracted`
    } else if (financingType === 'heloc') {
      monthlyPayment = totalCost * (heloCRate / 100 / 12)
      annualDebtService = monthlyPayment * 12
      financingNote = `HELOC interest-only at ${heloCRate}%`
    } else if (financingType === 'constructionLoan' || financingType === 'renovationLoan') {
      monthlyPayment = monthlyPmt(totalCost, refiRate, refiTerm)
      annualDebtService = monthlyPayment * 12
      financingNote = `${financingType === 'constructionLoan' ? 'Construction' : 'Renovation (203k)'} loan at ${refiRate}%`
    } else {
      financingNote = 'Cash purchase — no debt service'
    }

    const annualCashFlow = noi - annualDebtService
    const cashOnCash = totalCost > 0 ? annualCashFlow / totalCost * 100 : 0
    const paybackYears = annualCashFlow > 0 ? totalCost / annualCashFlow : Infinity

    // 10-year projection
    const yearlyData = Array.from({ length: holdYears }, (_, i) => {
      const y = i + 1
      const propValue = newHomeValue * Math.pow(1 + appreciationRate / 100, y)
      const yearRent = effectiveRent * Math.pow(1 + 3 / 100, y)
      const yearNOI = yearRent - totalExpenses
      const yearCF = yearNOI - annualDebtService
      const cumCF = annualCashFlow * y
      return {
        year: `Yr ${y}`,
        cashFlow: Math.round(yearCF),
        cumCashFlow: Math.round(cumCF),
        propValue: Math.round(propValue),
      }
    })

    // Scenario comparison
    const scenarios = [
      { label: 'Do Nothing', value: mainHomeValue, rent: 0, equity: currentEquity },
      { label: 'Build ADU (cash)', value: newHomeValue, rent: noi, equity: newHomeValue - mainHomeLoanBalance - totalCost },
      { label: 'Build ADU (financed)', value: newHomeValue, rent: annualCashFlow, equity: newHomeValue - mainHomeLoanBalance },
    ]

    // Cost breakdown
    const costBreakdown = [
      { name: 'Construction', value: constructionCost },
      { name: 'Soft Costs', value: softCosts },
    ]

    return {
      profile, constructionCost, totalCost, currentEquity,
      valueByRent, valueByComp, estimatedValueAdd, newHomeValue, roi,
      grossAnnualRent, effectiveRent, totalExpenses, noi,
      annualDebtService, monthlyPayment, annualCashFlow, cashOnCash,
      paybackYears, financingNote, yearlyData, scenarios, costBreakdown,
    }
  }, [inp])

  const field = (label: string, key: keyof Inputs, suffix = '', prefix = '', step = 'any') => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{prefix}</span>}
        <input type="number" step={step} value={inp[key] as number} onChange={e => set(key, e.target.value)}
          className={`w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 ${prefix ? 'pl-5 pr-3' : suffix ? 'pl-3 pr-8' : 'px-3'}`} />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{suffix}</span>}
      </div>
    </div>
  )

  const profile = ADU_COST_DEFAULTS[inp.aduType]

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-lg font-bold text-white">ADU (Accessory Dwelling Unit) Calculator</h2>
        <p className="text-slate-400 text-xs mt-1">Analyze garage conversions, basement apartments, backyard cottages — construction cost, rental income, value-add, and financing</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* ADU Details */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">ADU Type & Cost</p>
          <div>
            <label className="block text-xs text-slate-400 mb-1">ADU Type</label>
            <select value={inp.aduType} onChange={e => set('aduType', e.target.value as ADUType)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
              {Object.entries(ADU_COST_DEFAULTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="p-2 bg-blue-900/20 border border-blue-700/30 rounded-lg text-xs">
            <p className="text-blue-300 font-semibold mb-1">{profile.label}</p>
            {inp.aduType === 'jadu'
              ? <p className="text-slate-400">Typical total cost: {fmt(profile.costLow)}–{fmt(profile.costHigh)}</p>
              : <p className="text-slate-400">Typical cost: ${profile.costLow}–${profile.costHigh}/sqft</p>}
            <p className="text-slate-400">Size: {profile.sqftMin}–{profile.sqftMax} sqft</p>
          </div>
          {field('ADU Size (sqft)', 'aduSqft', 'sqft', '', '10')}
          {inp.aduType !== 'jadu' && field('Construction Cost / sqft', 'constructionCostPerSqft', '/sqft', '$')}
          {inp.aduType === 'jadu' && field('Total Construction Cost', 'constructionCostPerSqft', '', '$', '500')}
          {field('Soft Costs (permits, design, eng)', 'softCosts', '', '$', '500')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Construction Cost</span><span className="text-white">{fmt(calc.constructionCost)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Total All-In Cost</span><span className="text-blue-400 font-bold">{fmt(calc.totalCost)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Cost / sqft (all-in)</span><span className="text-slate-300">${(calc.totalCost / inp.aduSqft).toFixed(0)}/sqft</span></div>
          </div>
        </div>

        {/* Income & Expenses */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Rental Income & Expenses</p>
          {field('Monthly Rent', 'aduRent', '', '$')}
          {field('Vacancy Rate', 'vacancyPct', '%')}
          {field('Property Mgmt', 'mgmtFeePct', '% of rent')}
          {field('Maintenance Reserve', 'maintenancePct', '% of rent')}
          {field('Utilities (annual)', 'utilityAnnual', '', '$')}
          {field('Insurance Add-On (annual)', 'insuranceAdd', '', '$')}
          {field('Property Tax Increase (annual)', 'propertyTaxAdd', '', '$')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Effective Rent/yr</span><span className="text-slate-300">{fmt(calc.effectiveRent)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Total Expenses/yr</span><span className="text-red-400">{fmt(calc.totalExpenses)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">NOI</span><span className="text-blue-400 font-bold">{fmt(calc.noi)}/yr</span></div>
          </div>
        </div>

        {/* Financing & Value */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Financing & Value-Add</p>
          {field('Main Home Value', 'mainHomeValue', '', '$', '5000')}
          {field('Current Loan Balance', 'mainHomeLoanBalance', '', '$')}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Financing Method</label>
            <select value={inp.financingType} onChange={e => set('financingType', e.target.value as FinancingType)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
              <option value="cash">Cash</option>
              <option value="cashOutRefi">Cash-Out Refinance</option>
              <option value="heloc">HELOC</option>
              <option value="constructionLoan">Construction Loan</option>
              <option value="renovationLoan">FHA 203k Renovation Loan</option>
            </select>
          </div>
          {inp.financingType !== 'cash' && field(inp.financingType === 'heloc' ? 'HELOC Rate' : 'Loan Rate', inp.financingType === 'heloc' ? 'heloCRate' : 'refiRate', '%')}
          {inp.financingType !== 'cash' && inp.financingType !== 'heloc' && field('Loan Term', 'refiTerm', 'yr', '', '1')}
          {field('Value Add / sqft (comp method)', 'valueAddMultiplier', '/sqft', '$')}
          {field('Neighborhood Cap Rate', 'neighborhoodCapRate', '%')}
          <div className="p-3 bg-green-900/15 border border-green-700/30 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Value Add (income)</span><span className="text-green-400">{fmt(calc.valueByRent)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Value Add (comps)</span><span className="text-green-400">{fmt(calc.valueByComp)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Avg Estimated Value Add</span><span className="text-green-400 font-bold">{fmt(calc.estimatedValueAdd)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">New Home Value</span><span className="text-white font-bold">{fmt(calc.newHomeValue)}</span></div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Value-Add ROI', value: `${calc.roi.toFixed(0)}%`, sub: `${fmt(calc.estimatedValueAdd)} gain on ${fmt(calc.totalCost)} cost`, color: calc.roi > 100 ? 'text-green-400' : calc.roi > 50 ? 'text-yellow-400' : 'text-red-400' },
          { label: 'Annual Cash Flow', value: fmt(calc.annualCashFlow), sub: `${fmt(calc.annualCashFlow / 12)}/mo after debt`, color: calc.annualCashFlow > 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'Cash-on-Cash Return', value: `${calc.cashOnCash.toFixed(1)}%`, sub: `On ${fmt(calc.totalCost)} invested`, color: calc.cashOnCash > 10 ? 'text-green-400' : calc.cashOnCash > 5 ? 'text-yellow-400' : 'text-red-400' },
          { label: 'Payback Period', value: calc.paybackYears === Infinity ? 'N/A' : `${calc.paybackYears.toFixed(1)} yrs`, sub: 'Cash cost ÷ annual cash flow', color: calc.paybackYears < 10 ? 'text-green-400' : calc.paybackYears < 20 ? 'text-yellow-400' : 'text-red-400' },
        ].map(m => (
          <div key={m.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
            <p className={`text-2xl font-black ${m.color}`}>{m.value}</p>
            <p className="text-xs text-slate-400 mt-1">{m.label}</p>
            <p className="text-xs text-slate-500">{m.sub}</p>
          </div>
        ))}
      </div>

      {inp.financingType !== 'cash' && (
        <div className="p-3 bg-blue-900/15 border border-blue-700/30 rounded-lg text-xs text-blue-300">
          💡 <span className="font-semibold">Financing:</span> {calc.financingNote} — adds {fmt(calc.monthlyPayment)}/mo ({fmt(calc.annualDebtService)}/yr) in debt service
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Cash Flow & Home Value Over Time</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={calc.yearlyData}>
              <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis yAxisId="left" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="left" type="monotone" dataKey="cumCashFlow" stroke="#22c55e" strokeWidth={2} dot={false} name="Cumulative Cash Flow" />
              <Line yAxisId="right" type="monotone" dataKey="propValue" stroke="#3b82f6" strokeWidth={2} dot={false} name="Home Value" strokeDasharray="5 3" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">ADU vs No-ADU Comparison</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={calc.scenarios}>
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 9 }} />
              <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="value" name="Property Value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="equity" name="Equity" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">ADU Key Facts & Strategy</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
          {[
            '🏗️ AB 68/AB 881 (CA) and similar laws in many states now allow ADUs by-right — check local ordinances before designing',
            '💰 Best ROI ADUs: garage conversions ($50–130/sqft) and basement conversions — lowest cost, existing structure',
            '🔨 Detached new construction costs $200–400/sqft but adds most value; JADU (≤500 sqft within home) is cheapest overall',
            '🏦 Cash-out refi works best if your rate is still competitive — compare to HELOC if you want to keep your existing rate',
            '📊 ADU value-add varies widely: income approach (NOI ÷ cap rate) often yields higher value in low-cap-rate markets',
            '⚠️ Soft costs (15–25% of construction) are often underestimated — include permits, design, engineering, and utility hookups',
            '🏠 Owner-occupancy requirements: some programs require owner to occupy main home or ADU — check before renting both',
            '📋 FHA 203k and Fannie Mae HomeStyle renovation loans allow you to roll ADU construction into purchase or refi',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
