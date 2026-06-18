import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line, ReferenceLine } from 'recharts'

interface Inputs {
  purchasePrice: number
  purchaseClosingCosts: number
  rehabCost: number
  rehabMonths: number
  carryingCostsPct: number
  arv: number
  refiLTV: number
  refiRate: number
  refiTerm: number
  refiClosingCosts: number
  monthlyRent: number
  vacancyPct: number
  propertyMgmtPct: number
  maintenancePct: number
  propertyTaxAnnual: number
  insuranceAnnual: number
  appreciationRate: number
  holdYears: number
}

const DEF: Inputs = {
  purchasePrice: 120000,
  purchaseClosingCosts: 3500,
  rehabCost: 45000,
  rehabMonths: 4,
  carryingCostsPct: 8,
  arv: 220000,
  refiLTV: 75,
  refiRate: 7.0,
  refiTerm: 30,
  refiClosingCosts: 4500,
  monthlyRent: 1750,
  vacancyPct: 8,
  propertyMgmtPct: 10,
  maintenancePct: 8,
  propertyTaxAnnual: 2400,
  insuranceAnnual: 1200,
  appreciationRate: 3,
  holdYears: 10,
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const N = (v: string) => parseFloat(v) || 0

function monthlyPmt(principal: number, annualRate: number, termYears: number) {
  if (annualRate === 0) return principal / (termYears * 12)
  const r = annualRate / 100 / 12
  const n = termYears * 12
  return principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1)
}

export default function BRRRRCalc() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = (k: keyof Inputs, v: string) => setInp(p => ({ ...p, [k]: N(v) }))

  const calc = useMemo(() => {
    const {
      purchasePrice, purchaseClosingCosts, rehabCost, rehabMonths, carryingCostsPct,
      arv, refiLTV, refiRate, refiTerm, refiClosingCosts,
      monthlyRent, vacancyPct, propertyMgmtPct, maintenancePct,
      propertyTaxAnnual, insuranceAnnual, appreciationRate, holdYears,
    } = inp

    const carryingCosts = (purchasePrice + rehabCost) * carryingCostsPct / 100 * (rehabMonths / 12)
    const allInCost = purchasePrice + purchaseClosingCosts + rehabCost + carryingCosts
    const equity = arv - allInCost
    const equityPct = arv > 0 ? equity / arv * 100 : 0

    const refiLoanAmt = arv * refiLTV / 100
    const cashOut = refiLoanAmt - allInCost - refiClosingCosts
    const cashLeftInDeal = Math.max(0, allInCost + refiClosingCosts - refiLoanAmt)
    const isInfiniteReturn = cashLeftInDeal <= 0

    const grossAnnualRent = monthlyRent * 12
    const vacancyLoss = grossAnnualRent * vacancyPct / 100
    const effectiveRent = grossAnnualRent - vacancyLoss
    const mgmtFee = effectiveRent * propertyMgmtPct / 100
    const maintenance = effectiveRent * maintenancePct / 100
    const totalExpenses = mgmtFee + maintenance + propertyTaxAnnual + insuranceAnnual
    const noi = effectiveRent - totalExpenses

    const refiPayment = monthlyPmt(refiLoanAmt, refiRate, refiTerm)
    const annualDebtService = refiPayment * 12
    const annualCashFlow = noi - annualDebtService
    const monthlyCashFlow = annualCashFlow / 12
    const cashOnCash = cashLeftInDeal > 0 ? annualCashFlow / cashLeftInDeal * 100 : Infinity
    const dscr = annualDebtService > 0 ? noi / annualDebtService : 0
    const capRate = arv > 0 ? noi / arv * 100 : 0

    const yearlyData = Array.from({ length: holdYears }, (_, i) => {
      const y = i + 1
      const propValue = arv * Math.pow(1 + appreciationRate / 100, y)
      const r = refiRate / 100 / 12
      const n = refiTerm * 12
      const paidMonths = y * 12
      const remainingLoan = paidMonths >= n ? 0 : refiLoanAmt * (Math.pow(1 + r, n) - Math.pow(1 + r, paidMonths)) / (Math.pow(1 + r, n) - 1)
      const propEquity = propValue - remainingLoan
      const cumCashFlow = annualCashFlow * y
      return {
        year: `Yr ${y}`,
        propValue: Math.round(propValue),
        propEquity: Math.round(propEquity),
        cumCashFlow: Math.round(cumCashFlow),
      }
    })

    const phaseData = [
      { phase: 'Purchase', amount: purchasePrice + purchaseClosingCosts },
      { phase: 'Rehab', amount: rehabCost },
      { phase: 'Carrying', amount: Math.round(carryingCosts) },
      { phase: 'Refi Close', amount: refiClosingCosts },
    ]

    const scoreFactors = [
      Math.min(30, equityPct > 20 ? 30 : equityPct > 10 ? 20 : 10),
      Math.min(20, isInfiniteReturn ? 20 : cashLeftInDeal < 10000 ? 15 : cashLeftInDeal < 25000 ? 10 : 5),
      Math.min(20, monthlyCashFlow > 400 ? 20 : monthlyCashFlow > 200 ? 14 : monthlyCashFlow > 0 ? 8 : 0),
      Math.min(15, dscr > 1.4 ? 15 : dscr > 1.2 ? 10 : dscr > 1.0 ? 6 : 0),
      Math.min(15, arv / allInCost > 1.3 ? 15 : arv / allInCost > 1.2 ? 10 : arv / allInCost > 1.1 ? 5 : 0),
    ]
    const brrrrScore = scoreFactors.reduce((a, b) => a + b, 0)

    return {
      carryingCosts, allInCost, equity, equityPct, refiLoanAmt, cashOut, cashLeftInDeal,
      isInfiniteReturn, effectiveRent, totalExpenses, noi, refiPayment, annualDebtService,
      annualCashFlow, monthlyCashFlow, cashOnCash, dscr, capRate,
      yearlyData, brrrrScore, phaseData,
    }
  }, [inp])

  const scoreColor = calc.brrrrScore >= 70 ? 'text-green-400' : calc.brrrrScore >= 50 ? 'text-yellow-400' : 'text-red-400'

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

  return (
    <div className="space-y-6 text-sm">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">BRRRR Strategy Calculator</h2>
          <p className="text-slate-400 text-xs mt-1">Buy · Rehab · Rent · Refinance · Repeat — check if you can pull capital out to redeploy into the next deal</p>
        </div>
        <div className="text-center ml-4">
          <p className={`text-4xl font-black ${scoreColor}`}>{calc.brrrrScore}</p>
          <p className="text-xs text-slate-500">BRRRR Score /100</p>
        </div>
      </div>

      <div className="flex gap-2 text-xs overflow-x-auto pb-1">
        {['🏚 Buy', '🔨 Rehab', '🏠 Rent', '🏦 Refinance', '🔁 Repeat'].map((s, i) => (
          <div key={i} className="flex-shrink-0 text-center bg-slate-800/50 border border-slate-700 rounded-lg py-2 px-3">
            <p className="font-bold text-slate-200">{s}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Buy & Rehab</p>
          {field('Purchase Price', 'purchasePrice', '', '$', '1000')}
          {field('Purchase Closing Costs', 'purchaseClosingCosts', '', '$')}
          {field('Rehab Budget', 'rehabCost', '', '$', '500')}
          {field('Rehab Duration', 'rehabMonths', 'mo', '', '1')}
          {field('Carrying Cost Rate (annualized)', 'carryingCostsPct', '%')}
          {field('After Repair Value (ARV)', 'arv', '', '$', '1000')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Carrying Costs</span><span className="text-slate-300">{fmt(calc.carryingCosts)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">All-In Cost</span><span className="text-white font-bold">{fmt(calc.allInCost)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Built-In Equity</span><span className={calc.equity > 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>{fmt(calc.equity)} ({calc.equityPct.toFixed(1)}%)</span></div>
            <div className="flex justify-between"><span className="text-slate-400">ARV / All-In</span><span className="text-blue-400 font-semibold">{(inp.arv / calc.allInCost).toFixed(2)}x</span></div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Refinance</p>
          {field('Refi LTV', 'refiLTV', '%')}
          {field('Refi Interest Rate', 'refiRate', '%')}
          {field('Refi Term', 'refiTerm', 'yr', '', '1')}
          {field('Refi Closing Costs', 'refiClosingCosts', '', '$')}
          <div className={`p-3 rounded-lg text-xs space-y-1.5 border ${calc.cashLeftInDeal === 0 ? 'border-green-700/50 bg-green-900/10' : 'border-slate-700 bg-slate-900/50'}`}>
            <div className="flex justify-between"><span className="text-slate-400">Refi Loan Amount</span><span className="text-white font-bold">{fmt(calc.refiLoanAmt)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Cash Pulled Out</span><span className={calc.cashOut > 0 ? 'text-green-400 font-bold' : 'text-orange-400'}>
              {calc.cashOut > 0 ? fmt(calc.cashOut) : '—'}
            </span></div>
            <div className="flex justify-between"><span className="text-slate-400">Cash Left in Deal</span>
              <span className={calc.isInfiniteReturn ? 'text-green-400 font-bold' : 'text-blue-400 font-bold'}>
                {calc.isInfiniteReturn ? '🎯 $0 — Infinite return!' : fmt(calc.cashLeftInDeal)}
              </span>
            </div>
            <div className="flex justify-between"><span className="text-slate-400">Monthly Payment</span><span className="text-white">{fmt(calc.refiPayment)}</span></div>
          </div>
          {field('Hold Period', 'holdYears', 'yr', '', '1')}
          {field('Annual Appreciation', 'appreciationRate', '%')}
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Rental Operations</p>
          {field('Monthly Rent', 'monthlyRent', '', '$')}
          {field('Vacancy Rate', 'vacancyPct', '%')}
          {field('Property Mgmt', 'propertyMgmtPct', '% of rent')}
          {field('Maintenance Reserve', 'maintenancePct', '% of rent')}
          {field('Property Tax (annual)', 'propertyTaxAnnual', '', '$')}
          {field('Insurance (annual)', 'insuranceAnnual', '', '$')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Effective Rent/yr</span><span className="text-slate-300">{fmt(calc.effectiveRent)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Total Expenses/yr</span><span className="text-red-400">{fmt(calc.totalExpenses)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">NOI/yr</span><span className="text-blue-400 font-bold">{fmt(calc.noi)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Debt Service/yr</span><span className="text-slate-300">{fmt(calc.annualDebtService)}</span></div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Monthly Cash Flow', value: fmt(calc.monthlyCashFlow), color: calc.monthlyCashFlow > 0 ? 'text-green-400' : 'text-red-400', sub: `${fmt(calc.annualCashFlow)}/yr` },
          { label: 'Cash-on-Cash Return', value: calc.isInfiniteReturn ? '∞' : `${calc.cashOnCash.toFixed(1)}%`, color: calc.cashOnCash > 10 || calc.isInfiniteReturn ? 'text-green-400' : calc.cashOnCash > 6 ? 'text-yellow-400' : 'text-red-400', sub: calc.isInfiniteReturn ? '$0 left in deal' : `On ${fmt(calc.cashLeftInDeal)} invested` },
          { label: 'DSCR', value: calc.dscr.toFixed(2), color: calc.dscr >= 1.25 ? 'text-green-400' : calc.dscr >= 1.0 ? 'text-yellow-400' : 'text-red-400', sub: 'Lender min: 1.20–1.25' },
          { label: 'Cap Rate', value: `${calc.capRate.toFixed(2)}%`, color: 'text-blue-400', sub: `NOI on ARV` },
        ].map(m => (
          <div key={m.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
            <p className={`text-2xl font-black ${m.color}`}>{m.value}</p>
            <p className="text-xs text-slate-400 mt-1">{m.label}</p>
            <p className="text-xs text-slate-500">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">All-In Cost Breakdown</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={calc.phaseData} layout="vertical">
              <XAxis type="number" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis dataKey="phase" type="category" width={70} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="amount" fill="#3b82f6" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Equity & Cash Flow Growth ({inp.holdYears} Yrs)</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={calc.yearlyData}>
              <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="propEquity" stroke="#3b82f6" strokeWidth={2} dot={false} name="Property Equity" />
              <Line type="monotone" dataKey="cumCashFlow" stroke="#22c55e" strokeWidth={2} dot={false} name="Cum. Cash Flow" />
              <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* BRRRR Checklist */}
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">BRRRR Deal Checklist</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {[
            { check: inp.arv / calc.allInCost >= 1.25, label: `ARV / All-In ≥ 1.25x (yours: ${(inp.arv / calc.allInCost).toFixed(2)}x)` },
            { check: calc.cashLeftInDeal <= inp.purchasePrice * 0.2, label: `Cash left ≤ 20% of purchase (yours: ${fmt(calc.cashLeftInDeal)})` },
            { check: calc.monthlyCashFlow > 200, label: `Cash flow > $200/mo (yours: ${fmt(calc.monthlyCashFlow)}/mo)` },
            { check: calc.dscr >= 1.2, label: `DSCR ≥ 1.20 (yours: ${calc.dscr.toFixed(2)})` },
            { check: calc.equityPct >= 20, label: `20%+ equity in ARV (yours: ${calc.equityPct.toFixed(1)}%)` },
            { check: inp.rehabMonths <= 6, label: `Rehab ≤ 6 months (yours: ${inp.rehabMonths} mo)` },
            { check: calc.capRate >= 5, label: `Cap rate ≥ 5% (yours: ${calc.capRate.toFixed(2)}%)` },
            { check: calc.isInfiniteReturn || calc.cashOnCash >= 8, label: `CoC ≥ 8% (yours: ${calc.isInfiniteReturn ? '∞' : calc.cashOnCash.toFixed(1) + '%'})` },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={item.check ? 'text-green-400' : 'text-red-400'}>{item.check ? '✓' : '✗'}</span>
              <span className={item.check ? 'text-slate-300' : 'text-slate-500'}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
