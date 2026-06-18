import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line, ReferenceLine } from 'recharts'

type BedroomSize = '0br' | '1br' | '2br' | '3br' | '4br'
type InspectionOutcome = 'pass' | 'minor' | 'major'

const FMR_RATES: Record<BedroomSize, number> = {
  '0br': 850, '1br': 1050, '2br': 1350, '3br': 1700, '4br': 2100,
}
const BR_LABELS: Record<BedroomSize, string> = {
  '0br': 'Studio', '1br': '1 Bedroom', '2br': '2 Bedrooms', '3br': '3 Bedrooms', '4br': '4 Bedrooms',
}

interface Inputs {
  bedroomSize: BedroomSize
  fmrOverride: number
  useFmrOverride: boolean
  paymentStandardPct: number
  actualRent: number
  tenantIncomePct: number
  marketRent: number
  propertyValue: number
  annualExpenses: number
  vacancyRateMarket: number
  vacancyRateS8: number
  inspectionCost: number
  inspectionOutcome: InspectionOutcome
  repairCostMinor: number
  repairCostMajor: number
  annualRentGrowth: number
  holdYears: number
  numUnits: number
}

const DEF: Inputs = {
  bedroomSize: '2br',
  fmrOverride: 1350,
  useFmrOverride: false,
  paymentStandardPct: 110,
  actualRent: 1400,
  tenantIncomePct: 30,
  marketRent: 1500,
  propertyValue: 280000,
  annualExpenses: 6800,
  vacancyRateMarket: 8,
  vacancyRateS8: 3,
  inspectionCost: 120,
  inspectionOutcome: 'minor',
  repairCostMinor: 800,
  repairCostMajor: 3500,
  annualRentGrowth: 3,
  holdYears: 10,
  numUnits: 1,
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const N = (v: string) => parseFloat(v) || 0

export default function Section8Calc() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = <K extends keyof Inputs>(k: K, v: Inputs[K]) =>
    setInp(p => ({ ...p, [k]: v }))
  const setN = (k: keyof Inputs, v: string) => set(k as keyof Inputs, N(v) as never)

  const calc = useMemo(() => {
    const {
      bedroomSize, paymentStandardPct, actualRent, tenantIncomePct,
      marketRent, propertyValue, annualExpenses,
      vacancyRateMarket, vacancyRateS8, inspectionCost,
      inspectionOutcome, repairCostMinor, repairCostMajor,
      annualRentGrowth, holdYears, numUnits, useFmrOverride, fmrOverride,
    } = inp

    const fmr = useFmrOverride ? fmrOverride : FMR_RATES[bedroomSize]
    const paymentStandard = fmr * paymentStandardPct / 100

    // Tenant portion is 30% of adjusted gross income, but the HAP is payment standard minus that
    // The tenant pays the difference between actual rent and HAP (cannot be more than 40% of income at initial lease)
    const hapAmount = Math.min(paymentStandard, actualRent)
    const tenantPortion = actualRent - hapAmount
    const tenantPortionPct = actualRent > 0 ? tenantPortion / actualRent * 100 : 0

    // Effective annual income
    const s8EffectiveRent = actualRent * (1 - vacancyRateS8 / 100)
    const marketEffectiveRent = marketRent * (1 - vacancyRateMarket / 100)

    const s8AnnualRevenue = s8EffectiveRent * 12 * numUnits
    const marketAnnualRevenue = marketEffectiveRent * 12 * numUnits

    // First-year inspection costs
    const inspectionRepairCost = inspectionOutcome === 'pass' ? 0 : inspectionOutcome === 'minor' ? repairCostMinor : repairCostMajor
    const totalInspectionFirstYear = (inspectionCost + inspectionRepairCost) * numUnits
    const annualInspectionOngoing = inspectionCost * numUnits

    // NOI comparison
    const s8NOI = s8AnnualRevenue - annualExpenses * numUnits - annualInspectionOngoing
    const marketNOI = marketAnnualRevenue - annualExpenses * numUnits

    const s8NetFirstYear = s8NOI - totalInspectionFirstYear
    const s8CapRate = propertyValue > 0 ? s8NOI / propertyValue * 100 : 0
    const marketCapRate = propertyValue > 0 ? marketNOI / propertyValue * 100 : 0

    // Premium/discount
    const rentDiff = actualRent - marketRent
    const rentDiffPct = marketRent > 0 ? rentDiff / marketRent * 100 : 0
    const annualNOIDiff = s8NOI - marketNOI
    const isPremium = actualRent >= marketRent

    // Year-by-year comparison (S8 rent grows at FMR adjustment ~2-3%/yr; market at user input)
    const yearlyComparison = Array.from({ length: holdYears }, (_, i) => {
      const y = i + 1
      const s8Rent = actualRent * Math.pow(1.025, y - 1) // FMR typically grows 2-2.5%/yr
      const mktRent = marketRent * Math.pow(1 + annualRentGrowth / 100, y - 1)
      const s8Rev = s8Rent * 12 * numUnits * (1 - vacancyRateS8 / 100)
      const mktRev = mktRent * 12 * numUnits * (1 - vacancyRateMarket / 100)
      const s8Noi = s8Rev - annualExpenses * numUnits - annualInspectionOngoing - (y === 1 ? inspectionRepairCost * numUnits : 0)
      const mktNoi = mktRev - annualExpenses * numUnits
      return { year: `Yr ${y}`, s8NOI: Math.round(s8Noi), marketNOI: Math.round(mktNoi), s8Rent: Math.round(s8Rent), mktRent: Math.round(mktRent) }
    })

    const cumulativeS8 = yearlyComparison.reduce((s, y) => s + y.s8NOI, 0)
    const cumulativeMarket = yearlyComparison.reduce((s, y) => s + y.marketNOI, 0)

    // Risk profile
    const govtPaymentPct = hapAmount / actualRent * 100
    const paymentRisk = govtPaymentPct > 80 ? 'Very Low' : govtPaymentPct > 60 ? 'Low' : govtPaymentPct > 40 ? 'Moderate' : 'Higher'

    // Pros and cons
    const pros = [
      `Guaranteed HAP payment (${fmt(hapAmount)}/mo, ${govtPaymentPct.toFixed(0)}% of rent) from housing authority`,
      vacancyRateS8 < vacancyRateMarket ? `Lower vacancy (${vacancyRateS8}% vs ${vacancyRateMarket}% market) — tenants rarely leave vouchers` : 'Stable long-term tenants',
      `Rent set at ${paymentStandardPct}% of FMR — ${isPremium ? 'currently above market in your area' : 'competitive with market'}`,
      'Automatic lease renewal path reduces re-listing costs',
    ]
    const cons = [
      `Annual HQS inspection required — $${inspectionCost} + any repairs needed to pass`,
      'Rent increases require PHA approval — can lag market in fast-rising markets',
      `FMR growth typically 2-2.5%/yr vs your local ${annualRentGrowth}% market projection`,
      'Upfront paperwork, RFTA process, PHA payment delays possible',
    ]

    return {
      fmr, paymentStandard, hapAmount, tenantPortion, tenantPortionPct,
      s8EffectiveRent, marketEffectiveRent,
      s8AnnualRevenue, marketAnnualRevenue,
      totalInspectionFirstYear, annualInspectionOngoing, inspectionRepairCost,
      s8NOI, marketNOI, s8NetFirstYear, s8CapRate, marketCapRate,
      rentDiff, rentDiffPct, annualNOIDiff, isPremium,
      yearlyComparison, cumulativeS8, cumulativeMarket,
      govtPaymentPct, paymentRisk, pros, cons,
    }
  }, [inp])

  const field = (label: string, key: keyof Inputs, suffix = '', prefix = '') => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{prefix}</span>}
        <input type="number" value={inp[key] as number} onChange={e => setN(key, e.target.value)}
          className={`w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 ${prefix ? 'pl-5 pr-3' : suffix ? 'pl-3 pr-8' : 'px-3'}`} />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{suffix}</span>}
      </div>
    </div>
  )

  const noiBetter = calc.s8NOI >= calc.marketNOI

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-lg font-bold text-white">Section 8 / HCV Analyzer</h2>
        <p className="text-slate-400 text-xs mt-1">Housing Choice Voucher landlord analysis — HAP payment, FMR comparison, inspection ROI, S8 vs market rent NOI over time</p>
      </div>

      {/* Verdict Banner */}
      <div className={`rounded-xl p-4 border ${noiBetter ? 'bg-green-900/20 border-green-700/40' : 'bg-yellow-900/20 border-yellow-700/40'}`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{noiBetter ? '✅' : '⚠️'}</span>
          <div>
            <p className={`font-bold ${noiBetter ? 'text-green-300' : 'text-yellow-300'}`}>
              Section 8 {noiBetter ? 'outperforms' : 'underperforms'} market rent by {fmt(Math.abs(calc.annualNOIDiff))}/yr in NOI
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {fmt(calc.hapAmount)}/mo guaranteed from housing authority · {calc.govtPaymentPct.toFixed(0)}% of rent covered by government · Payment risk: {calc.paymentRisk}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* HCV Setup */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">HCV / Section 8 Setup</p>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Bedroom Size</label>
            <select value={inp.bedroomSize} onChange={e => set('bedroomSize', e.target.value as BedroomSize)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
              {(Object.keys(BR_LABELS) as BedroomSize[]).map(k => <option key={k} value={k}>{BR_LABELS[k]}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Override Local FMR</span>
            <button onClick={() => set('useFmrOverride', !inp.useFmrOverride)}
              className={`w-10 h-5 rounded-full transition-colors ${inp.useFmrOverride ? 'bg-blue-500' : 'bg-slate-700'}`}>
              <div className={`w-4 h-4 bg-white rounded-full mx-0.5 transition-transform ${inp.useFmrOverride ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          {inp.useFmrOverride
            ? field('Local FMR (HUD published)', 'fmrOverride', '', '$')
            : <div className="p-2 bg-slate-900/50 rounded-lg text-xs"><span className="text-slate-400">HUD National FMR ({BR_LABELS[inp.bedroomSize]}): </span><span className="text-white font-bold">{fmt(FMR_RATES[inp.bedroomSize])}/mo</span></div>}
          {field('Payment Standard (% of FMR)', 'paymentStandardPct', '%')}
          {field('Your Actual Rent Ask', 'actualRent', '', '$')}
          {field('Market Rent (comparable)', 'marketRent', '', '$')}
          {field('Number of Units', 'numUnits', 'units')}
          <div className="p-2 bg-blue-900/20 border border-blue-700/30 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-blue-300">Payment Standard</span><span className="text-white font-bold">{fmt(calc.paymentStandard)}/mo</span></div>
            <div className="flex justify-between"><span className="text-slate-400">HAP (govt pays)</span><span className="text-green-400 font-bold">{fmt(calc.hapAmount)}/mo</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Tenant Portion</span><span className="text-orange-400">{fmt(calc.tenantPortion)}/mo ({calc.tenantPortionPct.toFixed(0)}%)</span></div>
          </div>
        </div>

        {/* Operations */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Operations & Inspection</p>
          {field('Annual Operating Expenses', 'annualExpenses', '/unit/yr', '$')}
          {field('S8 Vacancy Rate', 'vacancyRateS8', '%')}
          {field('Market Vacancy Rate', 'vacancyRateMarket', '%')}
          {field('Annual HQS Inspection Fee', 'inspectionCost', '', '$')}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Inspection Outcome (First Year)</label>
            <div className="space-y-1">
              {([['pass', '✅ Pass — no repairs needed'], ['minor', '⚠️ Minor — small repairs required'], ['major', '❌ Major — significant work required']] as const).map(([v, label]) => (
                <label key={v} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs ${inp.inspectionOutcome === v ? 'border-blue-500 bg-blue-900/20' : 'border-slate-700'}`}>
                  <input type="radio" name="inspection" value={v} checked={inp.inspectionOutcome === v} onChange={() => set('inspectionOutcome', v)} />
                  <span className="text-slate-200">{label}</span>
                </label>
              ))}
            </div>
          </div>
          {inp.inspectionOutcome === 'minor' && field('Minor Repair Cost', 'repairCostMinor', '', '$')}
          {inp.inspectionOutcome === 'major' && field('Major Repair Cost', 'repairCostMajor', '', '$')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Yr-1 Inspection Total</span><span className="text-red-400">{fmt(calc.totalInspectionFirstYear)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Ongoing Annual Inspection</span><span className="text-orange-400">{fmt(calc.annualInspectionOngoing)}</span></div>
          </div>
        </div>

        {/* NOI Comparison */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">NOI Comparison</p>
          {field('Property Value', 'propertyValue', '', '$')}
          {field('Annual Rent Growth (market)', 'annualRentGrowth', '%')}
          {field('Hold Period', 'holdYears', 'yr')}
          <div className="space-y-2">
            {[
              { label: 'S8 Annual Revenue', value: fmt(calc.s8AnnualRevenue), color: 'text-blue-400' },
              { label: 'S8 Annual NOI', value: fmt(calc.s8NOI), color: 'text-blue-400' },
              { label: 'S8 Cap Rate', value: `${calc.s8CapRate.toFixed(2)}%`, color: 'text-blue-400' },
              { label: 'Market Annual Revenue', value: fmt(calc.marketAnnualRevenue), color: 'text-purple-400' },
              { label: 'Market Annual NOI', value: fmt(calc.marketNOI), color: 'text-purple-400' },
              { label: 'Market Cap Rate', value: `${calc.marketCapRate.toFixed(2)}%`, color: 'text-purple-400' },
            ].map(m => (
              <div key={m.label} className="flex justify-between items-center text-xs">
                <span className="text-slate-400">{m.label}</span>
                <span className={`font-bold ${m.color}`}>{m.value}</span>
              </div>
            ))}
            <div className={`flex justify-between items-center p-2 rounded-lg border ${noiBetter ? 'border-green-700/40 bg-green-900/20' : 'border-yellow-700/40 bg-yellow-900/20'}`}>
              <span className="text-xs text-slate-300 font-semibold">S8 Annual NOI Advantage</span>
              <span className={`text-sm font-black ${noiBetter ? 'text-green-400' : 'text-yellow-400'}`}>{noiBetter ? '+' : ''}{fmt(calc.annualNOIDiff)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 10-Year Comparison Chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-1">Annual NOI Comparison — Section 8 vs Market Rate</p>
        <p className="text-xs text-slate-500 mb-3">S8 rent grows at HUD FMR adjustment (~2.5%/yr); market rent at your projected rate ({inp.annualRentGrowth}%/yr)</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={calc.yearlyComparison}>
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
            <Bar dataKey="s8NOI" name="Section 8 NOI" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="marketNOI" name="Market Rate NOI" fill="#a855f7" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-700 text-xs">
          <div className="text-center"><span className="text-slate-400">Cumulative S8 NOI: </span><span className="text-blue-400 font-bold">{fmt(calc.cumulativeS8)}</span></div>
          <div className="text-center"><span className="text-slate-400">Cumulative Market NOI: </span><span className="text-purple-400 font-bold">{fmt(calc.cumulativeMarket)}</span></div>
        </div>
      </div>

      {/* Rent Trajectory */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Rent Trajectory (Monthly)</p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={calc.yearlyComparison}>
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis tickFormatter={v => `$${v}`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="s8Rent" stroke="#3b82f6" strokeWidth={2} dot={false} name="S8 Contract Rent" />
            <Line type="monotone" dataKey="mktRent" stroke="#a855f7" strokeWidth={2} dot={false} name="Market Rent" strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Pros/Cons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-green-900/10 rounded-xl p-4 border border-green-700/30">
          <p className="text-xs font-bold text-green-300 uppercase tracking-widest mb-2">Advantages of Section 8</p>
          <ul className="space-y-1.5">
            {calc.pros.map((p, i) => <li key={i} className="text-xs text-slate-300 flex gap-2"><span className="text-green-400 mt-0.5 flex-shrink-0">✓</span>{p}</li>)}
          </ul>
        </div>
        <div className="bg-red-900/10 rounded-xl p-4 border border-red-700/30">
          <p className="text-xs font-bold text-red-300 uppercase tracking-widest mb-2">Drawbacks to Consider</p>
          <ul className="space-y-1.5">
            {calc.cons.map((c, i) => <li key={i} className="text-xs text-slate-300 flex gap-2"><span className="text-red-400 mt-0.5 flex-shrink-0">✗</span>{c}</li>)}
          </ul>
        </div>
      </div>

      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">HCV / Section 8 Quick Reference</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
          {[
            '📋 RFTA (Request for Tenancy Approval): required before PHA can approve — complete before lease signing',
            '🏠 HQS (Housing Quality Standards): annual inspection plus initial inspection at move-in; local jurisdictions vary',
            '💰 Payment standard 90-110% of FMR: PHAs can set locally; 110% areas are often undersupplied — premium rents possible',
            '🔒 HAP contract: signed between landlord and PHA; separate from lease; protects payment regardless of tenant non-payment',
            '📅 Rent increases: submit 60-90 days before anniversary date; PHA approves based on current payment standard and rent reasonableness',
            '⚖️ Fair Market Rents (FMR): HUD publishes annually in October; look up your metro at huduser.gov/portal/datasets/fmr',
            '🚫 Source of income laws: some states/cities ban refusal to accept Section 8 — check local ordinance before declining',
            '💡 Market tip: in high-cost metros, S8 payment standard sometimes exceeds achievable market rent — major landlord advantage',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
