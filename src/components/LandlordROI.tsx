import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, LineChart, Line } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
function fmtPct(n: number) { return `${n.toFixed(2)}%` }

function monthlyPmt(principal: number, annualRate: number, termYears: number) {
  const r = annualRate / 100 / 12
  const n = termYears * 12
  if (r === 0 || n === 0) return 0
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

const COLORS = ['#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#f97316']

export default function LandlordROI() {
  const { result, input, interestRate, monthlyRent: storeRent } = usePropertyStore()

  const homeVal    = result?.estimatedValue ?? 400000
  const downPct    = input.downPaymentPct ?? 25

  // Purchase
  const [purchasePrice,    setPurchasePrice]    = useState(homeVal)
  const [downPaymentPct,   setDownPaymentPct]   = useState(downPct)
  const [closingCostsPct,  setClosingCostsPct]  = useState(2.5)
  const [rehabCost,        setRehabCost]        = useState(0)
  const [rate,             setRate]             = useState(interestRate)
  const [termYrs,          setTermYrs]          = useState(30)

  // Income
  const [monthlyRent,      setMonthlyRent]      = useState(storeRent > 0 ? storeRent : Math.round(homeVal * 0.007))
  const [otherIncome,      setOtherIncome]      = useState(0)  // laundry, parking, etc.
  const [vacancyPct,       setVacancyPct]       = useState(8)

  // Expenses
  const [propTaxPct,       setPropTaxPct]       = useState(1.2)  // % of value
  const [insuranceMo,      setInsuranceMo]      = useState(120)
  const [pmFeePct,         setPmFeePct]         = useState(0)    // % of gross rent
  const [maintenancePct,   setMaintenancePct]   = useState(8)    // % of gross rent
  const [utilsMo,          setUtilsMo]          = useState(0)
  const [hoaMo,            setHoaMo]            = useState(0)

  // Appreciation
  const [appreciationPct,  setAppreciationPct]  = useState(3.5)
  const [rentGrowthPct,    setRentGrowthPct]    = useState(3.0)

  const analysis = useMemo(() => {
    const downDollar      = purchasePrice * downPaymentPct / 100
    const closingCosts    = purchasePrice * closingCostsPct / 100
    const totalInvested   = downDollar + closingCosts + rehabCost

    const loanAmount      = purchasePrice - downDollar
    const monthlyDebt     = monthlyPmt(loanAmount, rate, termYrs)

    // Annual income
    const grossRentAnnual = (monthlyRent + otherIncome) * 12
    const vacancyLoss     = grossRentAnnual * vacancyPct / 100
    const effectiveGross  = grossRentAnnual - vacancyLoss

    // Annual expenses
    const propTaxAnnual   = purchasePrice * propTaxPct / 100
    const insuranceAnnual = insuranceMo * 12
    const pmFeeAnnual     = grossRentAnnual * pmFeePct / 100
    const maintenanceAnnual = grossRentAnnual * maintenancePct / 100
    const utilsAnnual     = utilsMo * 12
    const hoaAnnual       = hoaMo * 12
    const totalExpenses   = propTaxAnnual + insuranceAnnual + pmFeeAnnual + maintenanceAnnual + utilsAnnual + hoaAnnual

    const noi             = effectiveGross - totalExpenses
    const annualDebtService = monthlyDebt * 12
    const annualCashFlow  = noi - annualDebtService

    // Metrics
    const capRate         = purchasePrice > 0 ? (noi / purchasePrice) * 100 : 0
    const cashOnCash      = totalInvested > 0 ? (annualCashFlow / totalInvested) * 100 : 0
    const grm             = grossRentAnnual > 0 ? purchasePrice / grossRentAnnual : 0
    const dscr            = annualDebtService > 0 ? noi / annualDebtService : 0
    const rentToValue     = purchasePrice > 0 ? (monthlyRent / purchasePrice) * 100 : 0

    // 10-yr projection
    const yearData = Array.from({ length: 11 }, (_, yr) => {
      const valueAtYr    = purchasePrice * Math.pow(1 + appreciationPct / 100, yr)
      const rentAtYr     = monthlyRent * Math.pow(1 + rentGrowthPct / 100, yr) * 12 * (1 - vacancyPct / 100)
      const expenseAtYr  = totalExpenses * Math.pow(1.03, yr)
      const noiAtYr      = rentAtYr - expenseAtYr
      const cfAtYr       = noiAtYr - annualDebtService
      const equityAtYr   = valueAtYr - loanAmount  // simplified (ignores paydown)
      return { yr, value: Math.round(valueAtYr), rent: Math.round(rentAtYr), noi: Math.round(noiAtYr), cashflow: Math.round(cfAtYr), equity: Math.round(equityAtYr) }
    })

    // Total 10yr return (cash flow + appreciation)
    const totalCashFlow10 = yearData.slice(1).reduce((s, r) => s + r.cashflow, 0)
    const appreciation10  = yearData[10].value - purchasePrice
    const equityGain10    = yearData[10].equity - downDollar
    const totalReturn10   = totalCashFlow10 + appreciation10
    const totalROI10      = totalInvested > 0 ? (totalReturn10 / totalInvested) * 100 : 0
    const annualizedROI   = Math.pow(1 + totalROI10 / 100, 1 / 10) - 1

    const expensePieData = [
      { name: 'Mortgage',     value: Math.round(annualDebtService) },
      { name: 'Prop Tax',     value: Math.round(propTaxAnnual) },
      { name: 'Insurance',    value: Math.round(insuranceAnnual) },
      { name: 'Maintenance',  value: Math.round(maintenanceAnnual) },
      { name: 'PM Fee',       value: Math.round(pmFeeAnnual) },
      { name: 'HOA',          value: Math.round(hoaAnnual) },
      { name: 'Utilities',    value: Math.round(utilsAnnual) },
    ].filter(e => e.value > 0)

    return {
      downDollar, closingCosts, totalInvested, loanAmount, monthlyDebt,
      grossRentAnnual, vacancyLoss, effectiveGross,
      propTaxAnnual, insuranceAnnual, pmFeeAnnual, maintenanceAnnual, utilsAnnual, hoaAnnual, totalExpenses,
      noi, annualDebtService, annualCashFlow,
      capRate, cashOnCash, grm, dscr, rentToValue,
      yearData, totalCashFlow10, appreciation10, equityGain10, totalReturn10, totalROI10, annualizedROI,
      expensePieData,
    }
  }, [purchasePrice, downPaymentPct, closingCostsPct, rehabCost, rate, termYrs, monthlyRent, otherIncome, vacancyPct, propTaxPct, insuranceMo, pmFeePct, maintenancePct, utilsMo, hoaMo, appreciationPct, rentGrowthPct])

  if (!result) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-4xl mb-3">🏠</p>
        <p>Run a valuation first to build your landlord ROI dashboard</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Landlord ROI Dashboard</h3>
        <p className="text-xs text-slate-500">
          Comprehensive rental property analysis: cap rate, cash-on-cash, DSCR, GRM, 10-year projection,
          and total return including appreciation.
        </p>
      </div>

      {/* Key metrics scorecard */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        {[
          { label: 'Cap Rate',     value: fmtPct(analysis.capRate),     good: analysis.capRate >= 6,   ok: analysis.capRate >= 4 },
          { label: 'Cash-on-Cash', value: fmtPct(analysis.cashOnCash),  good: analysis.cashOnCash >= 8, ok: analysis.cashOnCash >= 4 },
          { label: 'DSCR',         value: analysis.dscr.toFixed(2),     good: analysis.dscr >= 1.25,   ok: analysis.dscr >= 1.0 },
          { label: 'GRM',          value: analysis.grm.toFixed(1),      good: analysis.grm <= 12,      ok: analysis.grm <= 15 },
          { label: '1% Rule',      value: `${analysis.rentToValue.toFixed(2)}%`, good: analysis.rentToValue >= 1.0, ok: analysis.rentToValue >= 0.75 },
        ].map(m => (
          <div key={m.label} className={`rounded-xl p-3 border text-center ${m.good ? 'bg-green-900/20 border-green-800/50' : m.ok ? 'bg-yellow-900/20 border-yellow-800/50' : 'bg-red-900/20 border-red-800/50'}`}>
            <p className="text-xs text-slate-500 mb-1">{m.label}</p>
            <p className={`text-xl font-black ${m.good ? 'text-green-400' : m.ok ? 'text-yellow-400' : 'text-red-400'}`}>{m.value}</p>
            <p className={`text-xs mt-0.5 ${m.good ? 'text-green-600' : m.ok ? 'text-yellow-600' : 'text-red-600'}`}>{m.good ? '✓ Target' : m.ok ? '~ Okay' : '✗ Low'}</p>
          </div>
        ))}
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Purchase & Financing</p>
          {[
            { label: 'Purchase Price',    value: purchasePrice,   min: 50000,  max: 5000000, step: 5000,  set: setPurchasePrice,   fmt: fmt },
            { label: 'Down Payment %',    value: downPaymentPct,  min: 3,      max: 60,      step: 1,     set: setDownPaymentPct,  fmt: (v: number) => `${v}% = ${fmt(purchasePrice * v / 100)}` },
            { label: 'Closing Costs %',   value: closingCostsPct, min: 1,      max: 5,       step: 0.25,  set: setClosingCostsPct, fmt: (v: number) => `${v}% = ${fmt(purchasePrice * v / 100)}` },
            { label: 'Rehab Budget',      value: rehabCost,       min: 0,      max: 200000,  step: 2500,  set: setRehabCost,       fmt: fmt },
            { label: 'Interest Rate',     value: rate,            min: 3,      max: 12,      step: 0.125, set: setRate,            fmt: (v: number) => `${v.toFixed(3)}%` },
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

        <div className="space-y-3">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
            <p className="text-xs text-green-400 uppercase tracking-widest font-bold">Income</p>
            {[
              { label: 'Monthly Rent',    value: monthlyRent,  min: 300,  max: 10000, step: 50,  set: setMonthlyRent,  fmt: (v: number) => `${fmt(v)}/mo` },
              { label: 'Other Income',    value: otherIncome,  min: 0,    max: 1000,  step: 25,  set: setOtherIncome,  fmt: (v: number) => `${fmt(v)}/mo` },
              { label: 'Vacancy Rate',    value: vacancyPct,   min: 0,    max: 20,    step: 1,   set: setVacancyPct,   fmt: (v: number) => `${v}%` },
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

          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
            <p className="text-xs text-red-400 uppercase tracking-widest font-bold">Expenses</p>
            {[
              { label: 'Property Tax %',  value: propTaxPct,      min: 0.2, max: 4,    step: 0.05, set: setPropTaxPct,     fmt: (v: number) => `${v.toFixed(2)}% = ${fmt(purchasePrice * v / 100)}/yr` },
              { label: 'Insurance /mo',   value: insuranceMo,     min: 0,   max: 500,  step: 10,   set: setInsuranceMo,    fmt: fmt },
              { label: 'PM Fee %',        value: pmFeePct,        min: 0,   max: 15,   step: 1,    set: setPmFeePct,       fmt: (v: number) => `${v}% of rent` },
              { label: 'Maintenance %',   value: maintenancePct,  min: 0,   max: 20,   step: 1,    set: setMaintenancePct, fmt: (v: number) => `${v}% of rent` },
              { label: 'Utilities /mo',   value: utilsMo,         min: 0,   max: 500,  step: 25,   set: setUtilsMo,        fmt: fmt },
              { label: 'HOA /mo',         value: hoaMo,           min: 0,   max: 1000, step: 25,   set: setHoaMo,          fmt: fmt },
            ].map(s => (
              <div key={s.label}>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-slate-400 uppercase tracking-widest">{s.label}</label>
                  <span className="text-xs font-bold text-red-400">{s.fmt(s.value)}</span>
                </div>
                <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                  onChange={e => s.set(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-red-500" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Annual P&L */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Gross Rent (annual)',     value: fmt(analysis.grossRentAnnual),   color: 'text-green-400' },
          { label: 'Vacancy Loss',            value: `-${fmt(analysis.vacancyLoss)}`, color: 'text-yellow-400' },
          { label: 'Total Expenses (ex debt)',value: `-${fmt(analysis.totalExpenses)}`,color: 'text-red-400' },
          { label: 'NOI',                     value: fmt(analysis.noi),               color: 'text-blue-400' },
          { label: 'Debt Service',            value: `-${fmt(analysis.annualDebtService)}`, color: 'text-red-400' },
          { label: 'Annual Cash Flow',        value: fmt(analysis.annualCashFlow),    color: analysis.annualCashFlow >= 0 ? 'text-green-400 text-2xl font-black' : 'text-red-400 text-2xl font-black' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 flex justify-between items-center">
            <span className="text-xs text-slate-400">{s.label}</span>
            <span className={`font-bold ${s.color}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Expense pie + 10yr projection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-2 text-center">Expense Breakdown</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={analysis.expensePieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                {analysis.expensePieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(v: number) => [fmt(v)]} />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 9, color: '#94a3b8' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">10-Year Cash Flow Projection</p>
          <div className="flex items-center gap-3 mb-2">
            {[
              { label: 'Appreciation', value: appreciationPct, set: setAppreciationPct },
              { label: 'Rent Growth',  value: rentGrowthPct,   set: setRentGrowthPct },
            ].map(s => (
              <div key={s.label} className="flex-1">
                <label className="text-xs text-slate-500 uppercase tracking-widest">{s.label}</label>
                <div className="flex items-center gap-1">
                  <input type="range" min={0} max={8} step={0.5} value={s.value}
                    onChange={e => s.set(Number(e.target.value))}
                    className="flex-1 h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
                  <span className="text-xs text-blue-400 font-bold w-8">{s.value}%</span>
                </div>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={analysis.yearData.slice(1)} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="yr" tick={{ fill: '#94a3b8', fontSize: 9 }} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} axisLine={false}
                tickFormatter={v => `$${(v/1000).toFixed(0)}K`} width={45} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(v: number) => [fmt(v)]} />
              <Line type="monotone" dataKey="cashflow" stroke="#22c55e" dot={false} strokeWidth={2} name="cashflow" />
              <Line type="monotone" dataKey="noi" stroke="#3b82f6" dot={false} strokeWidth={1.5} strokeDasharray="4 3" name="noi" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 10yr total return */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">10-Year Total Return Summary</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            { label: 'Cash Flow (10yr)',      value: fmt(analysis.totalCashFlow10), color: 'text-green-400' },
            { label: 'Appreciation (10yr)',   value: fmt(analysis.appreciation10),  color: 'text-blue-400' },
            { label: 'Total Return',          value: fmt(analysis.totalReturn10),   color: 'text-white' },
            { label: 'Annualized ROI',        value: fmtPct(analysis.annualizedROI * 100), color: analysis.annualizedROI > 0.10 ? 'text-green-400' : 'text-yellow-400' },
          ].map(s => (
            <div key={s.label}>
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Projections assume constant appreciation and rent growth. Actual returns vary.
        Cap rate target: 5–8% for single-family, 6–10%+ for multi-family. DSCR target: ≥ 1.25 for most lenders.
      </p>
    </div>
  )
}
