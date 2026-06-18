import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis } from 'recharts'

interface MonthInput { occupancy: number; adr: number }

interface Inputs {
  purchasePrice: number
  downPaymentPct: number
  mortgageRate: number
  mortgageTerm: number
  avgADR: number
  avgOccupancy: number
  platformFeePct: number
  cleaningFeePerStay: number
  avgStayNights: number
  propertyMgmtPct: number
  suppliesMo: number
  utilitiesMo: number
  insuranceAnnual: number
  propertyTaxAnnual: number
  hoa: number
  annualMaintPct: number
  longTermRent: number
  longTermVacancyPct: number
  longTermMgmtPct: number
  useSeasonality: boolean
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const DEFAULT_SEASONAL: MonthInput[] = [
  { occupancy: 55, adr: 140 }, { occupancy: 58, adr: 145 }, { occupancy: 65, adr: 155 },
  { occupancy: 72, adr: 168 }, { occupancy: 80, adr: 185 }, { occupancy: 88, adr: 210 },
  { occupancy: 92, adr: 225 }, { occupancy: 90, adr: 220 }, { occupancy: 78, adr: 178 },
  { occupancy: 68, adr: 158 }, { occupancy: 60, adr: 148 }, { occupancy: 58, adr: 152 },
]

const DEF: Inputs = {
  purchasePrice: 450000, downPaymentPct: 25, mortgageRate: 7.25, mortgageTerm: 30,
  avgADR: 180, avgOccupancy: 72, platformFeePct: 3, cleaningFeePerStay: 120, avgStayNights: 3.5,
  propertyMgmtPct: 20, suppliesMo: 150, utilitiesMo: 220,
  insuranceAnnual: 3200, propertyTaxAnnual: 5400, hoa: 0, annualMaintPct: 1.5,
  longTermRent: 2200, longTermVacancyPct: 6, longTermMgmtPct: 10, useSeasonality: false,
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const N = (v: string) => parseFloat(v) || 0

function monthlyMortgagePmt(principal: number, annualRate: number, termYears: number) {
  if (annualRate === 0) return principal / (termYears * 12)
  const r = annualRate / 100 / 12
  const n = termYears * 12
  return principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1)
}

export default function ShortTermRental() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const [months, setMonths] = useState<MonthInput[]>(DEFAULT_SEASONAL)
  const set = (k: keyof Inputs, v: string | boolean) =>
    setInp(p => ({ ...p, [k]: typeof DEF[k] === 'boolean' ? v : N(v as string) }))
  const setMonth = (i: number, k: keyof MonthInput, v: string) =>
    setMonths(ms => ms.map((m, idx) => idx === i ? { ...m, [k]: N(v) } : m))

  const calc = useMemo(() => {
    const {
      purchasePrice, downPaymentPct, mortgageRate, mortgageTerm,
      avgADR, avgOccupancy, platformFeePct, cleaningFeePerStay, avgStayNights,
      propertyMgmtPct, suppliesMo, utilitiesMo, insuranceAnnual, propertyTaxAnnual,
      hoa, annualMaintPct, longTermRent, longTermVacancyPct, longTermMgmtPct, useSeasonality,
    } = inp

    const downPayment = purchasePrice * downPaymentPct / 100
    const loanAmount = purchasePrice - downPayment
    const monthlyMortgage = monthlyMortgagePmt(loanAmount, mortgageRate, mortgageTerm)

    let strGrossRevenue = 0
    const monthlyRevData = MONTH_NAMES.map((name, i) => {
      const occ = useSeasonality ? months[i].occupancy : avgOccupancy
      const adr = useSeasonality ? months[i].adr : avgADR
      const nights = 30 * occ / 100
      const revenue = nights * adr
      const stays = nights / Math.max(1, avgStayNights)
      const cleaning = stays * cleaningFeePerStay
      strGrossRevenue += revenue
      return { month: name, nights: Math.round(nights), revenue: Math.round(revenue), cleaning: Math.round(cleaning) }
    })

    const annualCleaningRevenue = monthlyRevData.reduce((s, m) => s + m.cleaning, 0)
    const totalGrossRevenue = strGrossRevenue + annualCleaningRevenue
    const platformFees = strGrossRevenue * platformFeePct / 100
    const mgmtFees = totalGrossRevenue * propertyMgmtPct / 100

    const annualSupplies = suppliesMo * 12
    const annualUtilities = utilitiesMo * 12
    const annualMaint = purchasePrice * annualMaintPct / 100
    const annualHOA = hoa * 12
    const annualMortgage = monthlyMortgage * 12
    const operatingExpenses = annualSupplies + annualUtilities + insuranceAnnual + propertyTaxAnnual + annualMaint + annualHOA

    const strNOI = totalGrossRevenue - platformFees - mgmtFees - operatingExpenses
    const strCashFlow = strNOI - annualMortgage
    const strCashFlowMo = strCashFlow / 12
    const strCoC = downPayment > 0 ? strCashFlow / downPayment * 100 : 0
    const strCapRate = purchasePrice > 0 ? strNOI / purchasePrice * 100 : 0

    const ltrGrossRent = longTermRent * 12
    const ltrEffectiveRent = ltrGrossRent * (1 - longTermVacancyPct / 100)
    const ltrMgmtFee = ltrEffectiveRent * longTermMgmtPct / 100
    const ltrNOI = ltrEffectiveRent - ltrMgmtFee - insuranceAnnual - propertyTaxAnnual - annualMaint - annualHOA
    const ltrCashFlow = ltrNOI - annualMortgage
    const ltrCashFlowMo = ltrCashFlow / 12
    const ltrCoC = downPayment > 0 ? ltrCashFlow / downPayment * 100 : 0
    const ltrCapRate = purchasePrice > 0 ? ltrNOI / purchasePrice * 100 : 0

    const strAdvantage = strCashFlow - ltrCashFlow
    const revPAR = strGrossRevenue / 365
    const avgNightsBooked = monthlyRevData.reduce((s, m) => s + m.nights, 0)

    const radarData = [
      { metric: 'Cash Flow', STR: Math.min(100, Math.max(0, (strCashFlowMo + 500) / 20)), LTR: Math.min(100, Math.max(0, (ltrCashFlowMo + 500) / 20)) },
      { metric: 'Cap Rate', STR: Math.min(100, strCapRate * 10), LTR: Math.min(100, ltrCapRate * 10) },
      { metric: 'Cash-on-Cash', STR: Math.min(100, Math.max(0, strCoC * 5)), LTR: Math.min(100, Math.max(0, ltrCoC * 5)) },
      { metric: 'Stability', STR: 35, LTR: 85 },
      { metric: 'Low Effort', STR: 20, LTR: 78 },
      { metric: 'Rev Upside', STR: 90, LTR: 42 },
    ]

    const strExpenseBreakdown = [
      { name: 'Mortgage', amount: Math.round(annualMortgage) },
      { name: 'Platform Fees', amount: Math.round(platformFees) },
      { name: 'Mgmt Fees', amount: Math.round(mgmtFees) },
      { name: 'Utilities', amount: Math.round(annualUtilities) },
      { name: 'Supplies', amount: Math.round(annualSupplies) },
      { name: 'Maint/Tax/Ins', amount: Math.round(annualMaint + propertyTaxAnnual + insuranceAnnual) },
    ]

    return {
      downPayment, loanAmount, monthlyMortgage,
      strGrossRevenue, annualCleaningRevenue, totalGrossRevenue, platformFees, mgmtFees,
      strNOI, strCashFlow, strCashFlowMo, strCoC, strCapRate,
      ltrNOI, ltrCashFlow, ltrCashFlowMo, ltrCoC, ltrCapRate,
      strAdvantage, revPAR, avgNightsBooked,
      monthlyRevData, radarData, strExpenseBreakdown,
    }
  }, [inp, months])

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
      <div>
        <h2 className="text-lg font-bold text-white">Short-Term Rental (STR) Analyzer</h2>
        <p className="text-slate-400 text-xs mt-1">Compare Airbnb/VRBO revenue vs long-term rental — ADR, occupancy, platform fees, seasonality, and true cash-on-cash</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Property & Financing</p>
          {field('Purchase Price', 'purchasePrice', '', '$', '1000')}
          {field('Down Payment', 'downPaymentPct', '%')}
          {field('Mortgage Rate', 'mortgageRate', '%')}
          {field('Mortgage Term', 'mortgageTerm', 'yr', '', '1')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Down Payment</span><span className="text-white">{fmt(calc.downPayment)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Monthly Mortgage</span><span className="text-red-400 font-bold">{fmt(calc.monthlyMortgage)}</span></div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">STR Performance</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Use Monthly Seasonality</span>
            <button onClick={() => set('useSeasonality', !inp.useSeasonality)}
              className={`w-11 h-6 rounded-full transition-colors ${inp.useSeasonality ? 'bg-green-500' : 'bg-slate-700'}`}>
              <div className={`w-4 h-4 bg-white rounded-full mx-1 transition-transform ${inp.useSeasonality ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          {!inp.useSeasonality && <>
            {field('Avg Daily Rate (ADR)', 'avgADR', '', '$')}
            {field('Annual Occupancy', 'avgOccupancy', '%')}
          </>}
          {field('Platform Fee (host)', 'platformFeePct', '%')}
          {field('Cleaning Fee / Stay', 'cleaningFeePerStay', '', '$')}
          {field('Avg Stay Length', 'avgStayNights', 'nights')}
          {field('Property Mgmt Fee', 'propertyMgmtPct', '% of rev')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Nights Booked/yr</span><span className="text-slate-300">{calc.avgNightsBooked}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">RevPAR</span><span className="text-blue-400 font-bold">{fmt(calc.revPAR)}/night</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Gross STR Revenue</span><span className="text-green-400 font-bold">{fmt(calc.strGrossRevenue)}</span></div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Expenses & LTR</p>
          {field('Supplies / month', 'suppliesMo', '', '$')}
          {field('Utilities / month', 'utilitiesMo', '', '$')}
          {field('Insurance (annual)', 'insuranceAnnual', '', '$')}
          {field('Property Tax (annual)', 'propertyTaxAnnual', '', '$')}
          {field('HOA / month', 'hoa', '', '$')}
          {field('Maintenance / CapEx', 'annualMaintPct', '% of val')}
          <hr className="border-slate-700" />
          {field('Long-Term Rent/mo', 'longTermRent', '', '$')}
          {field('LTR Vacancy', 'longTermVacancyPct', '%')}
          {field('LTR Mgmt Fee', 'longTermMgmtPct', '%')}
        </div>
      </div>

      {/* Seasonality Grid */}
      {inp.useSeasonality && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Monthly Seasonality</p>
          <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
            {MONTH_NAMES.map((name, i) => (
              <div key={name} className="text-center">
                <p className="text-xs text-slate-500 mb-1">{name}</p>
                <input type="number" value={months[i].occupancy} onChange={e => setMonth(i, 'occupancy', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded text-xs text-center text-white py-1 mb-1 focus:outline-none focus:border-blue-500" />
                <input type="number" value={months[i].adr} onChange={e => setMonth(i, 'adr', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded text-xs text-center text-white py-1 focus:outline-none focus:border-blue-500" />
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">Top = occupancy (%), bottom = ADR ($)</p>
        </div>
      )}

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: 'Short-Term Rental (STR)', cashFlow: calc.strCashFlowMo, coc: calc.strCoC, capRate: calc.strCapRate, noi: calc.strNOI, accent: 'blue' },
          { label: 'Long-Term Rental (LTR)', cashFlow: calc.ltrCashFlowMo, coc: calc.ltrCoC, capRate: calc.ltrCapRate, noi: calc.ltrNOI, accent: 'slate' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl p-4 border ${s.accent === 'blue' ? 'bg-blue-900/15 border-blue-700/40' : 'bg-slate-800/50 border-slate-700'}`}>
            <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${s.accent === 'blue' ? 'text-blue-300' : 'text-slate-300'}`}>{s.label}</p>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <p className={`text-2xl font-black ${s.cashFlow > 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(s.cashFlow)}/mo</p>
                <p className="text-xs text-slate-400">Monthly Cash Flow</p>
              </div>
              <div>
                <p className={`text-2xl font-black ${s.coc > 8 ? 'text-green-400' : s.coc > 4 ? 'text-yellow-400' : 'text-red-400'}`}>{s.coc.toFixed(1)}%</p>
                <p className="text-xs text-slate-400">Cash-on-Cash</p>
              </div>
              <div>
                <p className="text-2xl font-black text-purple-400">{s.capRate.toFixed(2)}%</p>
                <p className="text-xs text-slate-400">Cap Rate</p>
              </div>
              <div>
                <p className="text-2xl font-black text-white">{fmt(s.noi)}</p>
                <p className="text-xs text-slate-400">Annual NOI</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className={`rounded-xl p-4 border text-center ${calc.strAdvantage > 0 ? 'bg-green-900/15 border-green-700/40' : 'bg-orange-900/15 border-orange-700/40'}`}>
        <p className={`text-3xl font-black ${calc.strAdvantage > 0 ? 'text-green-400' : 'text-orange-400'}`}>
          {calc.strAdvantage > 0 ? '+' : ''}{fmt(calc.strAdvantage)}/yr
        </p>
        <p className="text-xs text-slate-400 mt-1">STR {calc.strAdvantage > 0 ? 'outperforms' : 'underperforms'} LTR by {fmt(Math.abs(calc.strAdvantage))} annually</p>
      </div>

      {/* Charts */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Monthly STR Revenue (Room + Cleaning)</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={calc.monthlyRevData}>
            <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="revenue" name="Room Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} stackId="a" />
            <Bar dataKey="cleaning" name="Cleaning Revenue" fill="#22c55e" radius={[0, 0, 0, 0]} stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">STR vs LTR Score Radar</p>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={calc.radarData}>
              <PolarGrid stroke="#334155" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Radar name="STR" dataKey="STR" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.25} />
              <Radar name="LTR" dataKey="LTR" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.15} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">STR Annual Cost Breakdown</p>
          <div className="space-y-2.5">
            {calc.strExpenseBreakdown.map(e => (
              <div key={e.name}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-slate-400">{e.name}</span>
                  <span className="text-slate-300">{fmt(e.amount)}</span>
                </div>
                <div className="bg-slate-700 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${Math.min(100, e.amount / calc.totalGrossRevenue * 100)}%` }} />
                </div>
              </div>
            ))}
            <div className="flex justify-between text-xs font-bold border-t border-slate-700 pt-2 mt-2">
              <span className="text-slate-300">Total Gross Revenue</span>
              <span className="text-green-400">{fmt(calc.totalGrossRevenue)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">STR Key Considerations</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
          {[
            '📋 Check local STR ordinances — many cities require permits, limit nights/year, or ban STRs entirely',
            '💰 Platform fees: Airbnb host-only ~3%; VRBO ~5% + CC processing (~3%); always model gross then net',
            '🏠 STR requires specialty insurance — standard homeowners policies exclude commercial hosting activity',
            '📊 RevPAR = ADR × Occupancy — benchmark against AirDNA or Mashvisor data for your market',
            '🧹 Cleaning fees are pass-through revenue but add friction — high fees hurt booking conversion rates',
            '💼 Self-managing takes 5–10 hrs/week; professional STR managers charge 20–30% of revenue',
            '⚠️ Augusta Rule (§280A): primary residence rented ≤14 days/yr → rental income tax-free, no deductions',
            '🔄 STR depreciation: personal property items (furniture, appliances) qualify for 5-yr MACRS and bonus depr',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
