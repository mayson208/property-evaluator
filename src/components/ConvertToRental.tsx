import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line, Legend, ReferenceLine } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
function fmtPct(n: number) { return `${n.toFixed(2)}%` }

export default function ConvertToRental() {
  const { result, input, interestRate, monthlyRent: storeRent } = usePropertyStore()

  const homeVal = result?.estimatedValue ?? 400000

  // Current home
  const [homeValue,       setHomeValue]       = useState(homeVal)
  const [mortgageBalance, setMortgageBalance] = useState(Math.round(homeVal * 0.5))
  const [existingRate,    setExistingRate]    = useState(interestRate - 0.5)
  const [monthsPaid,      setMonthsPaid]      = useState(60)
  const [landValue,       setLandValue]       = useState(Math.round(homeVal * 0.20))

  // Rental income
  const [monthlyRent,     setMonthlyRent]     = useState(storeRent > 0 ? storeRent : Math.round(homeVal * 0.007))
  const [vacancyPct,      setVacancyPct]      = useState(8)
  const [expenseRatio,    setExpenseRatio]    = useState(35)  // % of gross (excl. mortgage)
  const [propTaxRate,     setPropTaxRate]     = useState(1.2)
  const [insurance,       setInsurance]       = useState(1500)

  // New primary home
  const [newRent,         setNewRent]         = useState(Math.round(homeVal * 0.005))

  // Market
  const [appreciation,    setAppreciation]    = useState(3.5)
  const [rentGrowth,      setRentGrowth]      = useState(3.0)
  const [marginalRate,    setMarginalRate]    = useState(24)

  const analysis = useMemo(() => {
    // Existing mortgage payment
    const r    = existingRate / 100 / 12
    const n    = 30 * 12
    const pmt  = mortgageBalance > 0 ? mortgageBalance * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : 0

    // Rental income
    const grossRentAnnual = monthlyRent * 12
    const vacancyLoss     = grossRentAnnual * vacancyPct / 100
    const effectiveGross  = grossRentAnnual - vacancyLoss
    const operatingExp    = effectiveGross * expenseRatio / 100
    const propTaxAnnual   = homeValue * propTaxRate / 100
    const noi             = effectiveGross - operatingExp - propTaxAnnual - insurance
    const annualDebt      = pmt * 12
    const annualCashFlow  = noi - annualDebt

    // Metrics
    const capRate      = homeValue > 0 ? (noi / homeValue) * 100 : 0
    const cashOnCash   = mortgageBalance > 0 ? (annualCashFlow / (homeValue - mortgageBalance)) * 100 : 0
    const rentToValue  = homeValue > 0 ? (monthlyRent / homeValue) * 100 : 0

    // Depreciation benefit
    const depreciableBase = homeValue - landValue
    const annualDepreciation = depreciableBase / 27.5
    const taxSavingsFromDep  = annualDepreciation * (marginalRate / 100)

    // Convert: taxable rental income
    const rentalIncomeTaxable  = Math.max(0, noi - annualDepreciation)  // after depreciation deduction
    const additionalTaxBurden  = Math.max(0, rentalIncomeTaxable) * (marginalRate / 100)

    // True net: cashflow + depreciation benefit - tax on income
    const trueNet = annualCashFlow + taxSavingsFromDep - additionalTaxBurden

    // vs Selling: net proceeds
    const saleNetProceeds  = homeValue * (1 - 0.065)  // ~6.5% selling costs
    const gainFromSale     = Math.max(0, homeValue - (input.purchasePrice > 0 ? input.purchasePrice : homeValue * 0.7))
    const sec121Excluded   = Math.min(gainFromSale, 500000)  // MFJ exclusion (must live there 2 of last 5 yr)
    const taxableGain      = Math.max(0, gainFromSale - sec121Excluded)
    const capGainsTax      = taxableGain * 0.20

    // 10-yr comparison: rent vs sell and invest
    const investReturnPct  = 7.0
    const investProceeds   = saleNetProceeds - capGainsTax
    const yr10Sell         = investProceeds * Math.pow(1 + investReturnPct / 100, 10)
    const yr10Hold         = homeValue * Math.pow(1 + appreciation / 100, 10)
    const yr10CumCashFlow  = Array.from({ length: 10 }, (_, i) => annualCashFlow * Math.pow(1 + rentGrowth / 100, i)).reduce((s, v) => s + v, 0)
    const yr10HoldTotal    = yr10Hold + yr10CumCashFlow - mortgageBalance

    const yearData = Array.from({ length: 11 }, (_, yr) => ({
      yr,
      holdValue: Math.round(homeValue * Math.pow(1 + appreciation / 100, yr)),
      investValue: Math.round(investProceeds * Math.pow(1 + investReturnPct / 100, yr)),
    }))

    // Capital gains recapture warning
    const depreciationToDate = (annualDepreciation * monthsPaid / 12)

    return {
      pmt, grossRentAnnual, vacancyLoss, effectiveGross, operatingExp, propTaxAnnual, noi,
      annualDebt, annualCashFlow, capRate, cashOnCash, rentToValue,
      annualDepreciation, taxSavingsFromDep, rentalIncomeTaxable, additionalTaxBurden, trueNet,
      saleNetProceeds, gainFromSale, sec121Excluded, taxableGain, capGainsTax,
      yr10Sell, yr10Hold, yr10CumCashFlow, yr10HoldTotal, yearData, investProceeds, depreciationToDate,
    }
  }, [homeValue, mortgageBalance, existingRate, monthsPaid, landValue, monthlyRent, vacancyPct, expenseRatio, propTaxRate, insurance, newRent, appreciation, rentGrowth, marginalRate, input.purchasePrice])

  const convert = analysis.trueNet > 0 && analysis.capRate >= 4

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Convert Primary Home to Rental</h3>
        <p className="text-xs text-slate-500">
          Should you rent out your current home instead of selling when you move?
          Compare cash flow, depreciation benefits, and 10-year total return vs selling and investing.
        </p>
      </div>

      {/* Verdict */}
      <div className={`rounded-xl p-4 border ${convert ? 'bg-green-900/20 border-green-700/40' : 'bg-yellow-900/20 border-yellow-700/40'}`}>
        <p className={`text-sm font-bold mb-1 ${convert ? 'text-green-400' : 'text-yellow-400'}`}>
          {convert ? '✓ Converting to Rental Looks Favorable' : '⚠ Selling May Be the Better Move'}
        </p>
        <p className="text-xs text-slate-400">
          {convert
            ? `Cap rate ${fmtPct(analysis.capRate)} and positive true net cash flow (${fmt(analysis.trueNet)}/yr after taxes) suggest rental is attractive.`
            : `Low cap rate (${fmtPct(analysis.capRate)}) or negative cash flow suggests this home is better suited for sale than rental.`
          }
          {analysis.taxableGain === 0 && ' You can sell now tax-free under Section 121 — that window closes if you convert and lose the exclusion.'}
        </p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Annual Cash Flow',   value: fmt(analysis.annualCashFlow), color: analysis.annualCashFlow >= 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'True Net (after tax)',value: fmt(analysis.trueNet),       color: analysis.trueNet >= 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'Cap Rate',           value: fmtPct(analysis.capRate),     color: analysis.capRate >= 6 ? 'text-green-400' : analysis.capRate >= 4 ? 'text-yellow-400' : 'text-red-400' },
          { label: '1% Rule',            value: fmtPct(analysis.rentToValue), color: analysis.rentToValue >= 1 ? 'text-green-400' : 'text-yellow-400' },
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
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Current Home Details</p>
          {[
            { label: 'Current Market Value',   value: homeValue,       min: 50000, max: 5000000, step: 5000,  set: setHomeValue,       fmt: fmt },
            { label: 'Mortgage Balance',       value: mortgageBalance, min: 0,     max: homeValue, step: 5000, set: setMortgageBalance, fmt: fmt },
            { label: 'Existing Rate',          value: existingRate,    min: 2,     max: 12,      step: 0.125, set: setExistingRate,    fmt: (v: number) => `${v.toFixed(3)}%` },
            { label: 'Months Already Paid',    value: monthsPaid,      min: 0,     max: 360,     step: 12,    set: setMonthsPaid,      fmt: (v: number) => `${v} mo` },
            { label: 'Land Value %',           value: landValue,       min: 0,     max: homeValue * 0.5, step: 5000, set: setLandValue, fmt: (v: number) => `${fmt(v)} (${((v/homeValue)*100).toFixed(0)}%)` },
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
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Rental Assumptions</p>
          {[
            { label: 'Monthly Rent',       value: monthlyRent,   min: 300, max: 10000, step: 50,   set: setMonthlyRent,   fmt: (v: number) => `${fmt(v)}/mo` },
            { label: 'Vacancy Rate',       value: vacancyPct,    min: 0,   max: 20,    step: 1,    set: setVacancyPct,    fmt: (v: number) => `${v}%` },
            { label: 'Expense Ratio',      value: expenseRatio,  min: 15,  max: 60,    step: 5,    set: setExpenseRatio,  fmt: (v: number) => `${v}% of effective gross` },
            { label: 'Property Tax Rate',  value: propTaxRate,   min: 0.2, max: 4,     step: 0.1,  set: setPropTaxRate,   fmt: (v: number) => `${v.toFixed(1)}%` },
            { label: 'Annual Insurance',   value: insurance,     min: 500, max: 5000,  step: 100,  set: setInsurance,     fmt: fmt },
            { label: 'Marginal Tax Rate',  value: marginalRate,  min: 10,  max: 37,    step: 1,    set: setMarginalRate,  fmt: (v: number) => `${v}%` },
            { label: 'Appreciation',       value: appreciation,  min: 0,   max: 8,     step: 0.5,  set: setAppreciation,  fmt: (v: number) => `${v}%/yr` },
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

      {/* P&L breakdown */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Annual P&L (as Rental)</p>
        <div className="space-y-1.5 text-xs">
          {[
            { label: 'Gross rent income',           value: fmt(analysis.grossRentAnnual),    color: 'text-green-400' },
            { label: `Vacancy loss (${vacancyPct}%)`, value: `-${fmt(analysis.vacancyLoss)}`, color: 'text-red-400' },
            { label: `Operating expenses (${expenseRatio}%)`, value: `-${fmt(analysis.operatingExp)}`, color: 'text-red-400' },
            { label: 'Property taxes',              value: `-${fmt(analysis.propTaxAnnual)}`, color: 'text-red-400' },
            { label: 'Insurance',                   value: `-${fmt(insurance)}`,              color: 'text-red-400' },
            { label: 'NOI',                         value: fmt(analysis.noi),                color: 'text-blue-400 font-bold', border: true },
            { label: 'Mortgage (P&I)',              value: `-${fmt(analysis.annualDebt)}`,   color: 'text-red-400' },
            { label: 'Cash Flow',                   value: fmt(analysis.annualCashFlow),     color: analysis.annualCashFlow >= 0 ? 'text-green-400 font-black' : 'text-red-400 font-black', border: true },
            { label: 'Depreciation deduction',      value: `+${fmt(analysis.annualDepreciation)}`, color: 'text-yellow-400' },
            { label: 'Tax savings from deprec.',    value: `+${fmt(analysis.taxSavingsFromDep)}`, color: 'text-green-400' },
            { label: 'Tax on rental income',        value: `-${fmt(analysis.additionalTaxBurden)}`, color: 'text-red-400' },
            { label: 'True Net (taxes included)',   value: fmt(analysis.trueNet),            color: analysis.trueNet >= 0 ? 'text-green-400 font-black' : 'text-red-400 font-black', border: true },
          ].map(r => (
            <div key={r.label} className={`flex justify-between ${r.border ? 'border-t border-slate-700 pt-1.5 mt-1' : ''}`}>
              <span className={r.border ? 'text-slate-300 font-semibold' : 'text-slate-500'}>{r.label}</span>
              <span className={r.color}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 10yr comparison */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Hold & Rent vs Sell & Invest (10yr)</p>
        <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
          <div className="bg-green-900/20 border border-green-800/40 rounded-lg p-2 text-center">
            <p className="text-slate-500">Keep & Rent (yr 10 value)</p>
            <p className="text-green-400 font-black text-lg">{fmt(analysis.yr10HoldTotal)}</p>
            <p className="text-slate-600 text-xs">appreciation + net cash flows</p>
          </div>
          <div className="bg-blue-900/20 border border-blue-800/40 rounded-lg p-2 text-center">
            <p className="text-slate-500">Sell & Invest @ 7%</p>
            <p className="text-blue-400 font-black text-lg">{fmt(analysis.yr10Sell)}</p>
            <p className="text-slate-600 text-xs">from {fmt(analysis.investProceeds)} net proceeds</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={analysis.yearData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="yr" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} width={55} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number) => [fmt(v)]} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
            <Line type="monotone" dataKey="holdValue"   stroke="#22c55e" dot={false} strokeWidth={2} name="Rental Home Value" />
            <Line type="monotone" dataKey="investValue" stroke="#3b82f6" dot={false} strokeWidth={2} strokeDasharray="4 3" name="Invest Proceeds" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Section 121 warning */}
      <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-4">
        <p className="text-sm font-bold text-yellow-400 mb-1">⚠️ Section 121 Exclusion — Act Before Converting</p>
        <p className="text-xs text-slate-400">
          Once you convert to rental, the clock starts ticking on your Section 121 exclusion (up to $500K gain tax-free for MFJ).
          You must have lived there 2 of the last 5 years. If you rent for 3+ years, you may lose the exclusion.
          Estimated gain: <strong className="text-white">{fmt(analysis.gainFromSale)}</strong>.
          {analysis.taxableGain > 0 && <span className="text-yellow-300"> Taxable portion if exclusion lost: {fmt(analysis.taxableGain)}.</span>}
        </p>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Tax analysis is simplified. Passive activity loss rules, QBI deduction, and real estate professional status
        significantly affect actual tax outcomes. Consult a CPA before converting.
      </p>
    </div>
  )
}
