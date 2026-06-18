import { useState, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, ReferenceLine, Legend } from 'recharts'

interface Inputs {
  perspective: 'buyer' | 'seller'
  homePrice: number
  optionFee: number
  optionFeeCredited: boolean
  monthlyRent: number
  marketRent: number
  rentCredit: number
  optionPeriodMonths: number
  strikePriceType: 'fixed' | 'appreciation'
  strikePrice: number
  appreciationPct: number
  loanRate: number
  loanTermYears: number
  downPaymentPct: number
  maintenanceResponsibility: 'tenant' | 'landlord'
  buyerCreditScore: number
}

const DEF: Inputs = {
  perspective: 'buyer',
  homePrice: 300000,
  optionFee: 5000,
  optionFeeCredited: true,
  monthlyRent: 2400,
  marketRent: 2100,
  rentCredit: 300,
  optionPeriodMonths: 24,
  strikePriceType: 'fixed',
  strikePrice: 315000,
  appreciationPct: 4,
  loanRate: 7.0,
  loanTermYears: 30,
  downPaymentPct: 5,
  maintenanceResponsibility: 'tenant',
  buyerCreditScore: 620,
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const pct = (n: number) => `${n.toFixed(1)}%`
const N = (v: string) => parseFloat(v) || 0

export default function RentToOwn() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = (k: keyof Inputs, v: string | boolean | 'buyer' | 'seller' | 'fixed' | 'appreciation' | 'tenant' | 'landlord') =>
    setInp(p => ({ ...p, [k]: typeof DEF[k] === 'number' ? N(v as string) : v }))

  const calc = useMemo(() => {
    const { homePrice, optionFee, optionFeeCredited, monthlyRent, marketRent, rentCredit,
            optionPeriodMonths, strikePriceType, strikePrice, appreciationPct,
            loanRate, loanTermYears, downPaymentPct } = inp

    // Future home value at option expiry
    const futureValue = homePrice * Math.pow(1 + appreciationPct / 100 / 12, optionPeriodMonths)

    // Effective strike price
    const effectiveStrike = strikePriceType === 'fixed' ? strikePrice : futureValue

    // Total rent credits accumulated
    const totalRentCredits = rentCredit * optionPeriodMonths

    // Buyer accumulation
    const creditedOptionFee = optionFeeCredited ? optionFee : 0
    const totalAppliedToDown = totalRentCredits + creditedOptionFee

    // Required down payment at purchase
    const requiredDown = effectiveStrike * downPaymentPct / 100
    const gapToClose = Math.max(0, requiredDown - totalAppliedToDown)
    const downCoveredPct = Math.min(100, totalAppliedToDown / requiredDown * 100)

    // Mortgage on final purchase
    const loanAmount = effectiveStrike - Math.max(totalAppliedToDown, requiredDown)
    const r = loanRate / 100 / 12
    const n2 = loanTermYears * 12
    const monthlyPITI = loanAmount * r / (1 - Math.pow(1 + r, -n2)) + effectiveStrike * 0.012 / 12 + effectiveStrike * 0.006 / 12

    // Premium rent cost
    const totalRentPaid = monthlyRent * optionPeriodMonths
    const totalMarketRentWouldPay = marketRent * optionPeriodMonths
    const rentPremium = totalRentPaid - totalMarketRentWouldPay

    // Vs buying today scenario
    const buyTodayLoan = homePrice * (1 - downPaymentPct / 100)
    const buyTodayPmt = buyTodayLoan * r / (1 - Math.pow(1 + r, -n2))
    const buyTodayPITI = buyTodayPmt + homePrice * 0.012 / 12 + homePrice * 0.006 / 12
    const buyTodayEquityAtOptionEnd = homePrice * downPaymentPct / 100 +
      Array.from({ length: optionPeriodMonths }, (_, i) => {
        const bal = buyTodayLoan * Math.pow(1 + r, i) - buyTodayPmt * (Math.pow(1 + r, i) - 1) / r
        const prevBal = i === 0 ? buyTodayLoan : buyTodayLoan * Math.pow(1 + r, i - 1) - buyTodayPmt * (Math.pow(1 + r, i - 1) - 1) / r
        return prevBal - bal
      }).reduce((a, b) => a + b, 0)
    const buyTodayAppreciationGain = futureValue - homePrice

    // Whether it makes sense to exercise
    const exerciseGain = futureValue - effectiveStrike
    const netBuyerBenefit = exerciseGain - rentPremium
    const shouldExercise = futureValue > effectiveStrike

    // Year-by-year chart
    const chartData = Array.from({ length: Math.ceil(optionPeriodMonths / 12) + 1 }, (_, y) => {
      const mo = y * 12
      const fv = homePrice * Math.pow(1 + appreciationPct / 100 / 12, mo)
      const credits = Math.min(mo, optionPeriodMonths) * rentCredit + (optionFeeCredited ? optionFee : 0)
      return {
        year: y,
        homeValue: fv,
        strikePrice: effectiveStrike,
        creditsAccumulated: credits,
        rentPaid: monthlyRent * Math.min(mo, optionPeriodMonths),
      }
    })

    // Seller perspective
    const sellerOptionIncome = optionFee
    const sellerRentIncome = monthlyRent * optionPeriodMonths
    const sellerRentPremiumEarned = rentPremium
    const sellerRiskIfExpires = optionFee // keeps the option fee if buyer walks
    const sellerNetIfExercised = effectiveStrike - homePrice + rentPremium - totalRentCredits

    return {
      futureValue, effectiveStrike, totalRentCredits, creditedOptionFee,
      totalAppliedToDown, requiredDown, gapToClose, downCoveredPct,
      loanAmount, monthlyPITI, totalRentPaid, totalMarketRentWouldPay, rentPremium,
      buyTodayPITI, buyTodayEquityAtOptionEnd, buyTodayAppreciationGain,
      exerciseGain, netBuyerBenefit, shouldExercise,
      chartData, sellerOptionIncome, sellerRentIncome, sellerRentPremiumEarned,
      sellerRiskIfExpires, sellerNetIfExercised,
    }
  }, [inp])

  const field = (label: string, key: keyof Inputs, prefix = '', suffix = '', step = '1') => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{prefix}</span>}
        <input
          type="number" step={step}
          value={inp[key] as number}
          onChange={e => set(key, e.target.value)}
          className={`w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 ${prefix ? 'pl-5 pr-3' : suffix ? 'pl-3 pr-7' : 'px-3'}`}
        />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{suffix}</span>}
      </div>
    </div>
  )

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-lg font-bold text-white">Rent-to-Own / Lease-Purchase Analyzer</h2>
        <p className="text-slate-400 text-xs mt-1">Model rent-to-own arrangements from buyer and seller perspectives — option fee, rent credits, strike price, and exercise decision</p>
      </div>

      {/* Perspective */}
      <div className="flex gap-2">
        {(['buyer', 'seller'] as const).map(p => (
          <button key={p} onClick={() => set('perspective', p)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold border capitalize transition ${inp.perspective === p ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
            {p === 'buyer' ? '🏠 Buyer / Tenant' : '🏦 Seller / Landlord'}
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Deal Structure</p>
          {field('Current Home Price', 'homePrice', '$')}
          {field('Option Fee (Upfront)', 'optionFee', '$')}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Option Fee Applied to Down</span>
            <button onClick={() => set('optionFeeCredited', !inp.optionFeeCredited)}
              className={`w-11 h-6 rounded-full transition-colors ${inp.optionFeeCredited ? 'bg-blue-500' : 'bg-slate-700'}`}>
              <div className={`w-4 h-4 bg-white rounded-full mx-1 transition-transform ${inp.optionFeeCredited ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          {field('Monthly Rent', 'monthlyRent', '$')}
          {field('Market Rate Rent', 'marketRent', '$')}
          {field('Monthly Rent Credit', 'rentCredit', '$')}
          {field('Option Period', 'optionPeriodMonths', '', 'months')}
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Strike Price</p>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Strike Price Type</label>
            <select value={inp.strikePriceType} onChange={e => set('strikePriceType', e.target.value as 'fixed' | 'appreciation')}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
              <option value="fixed">Fixed Price</option>
              <option value="appreciation">Market Value at Option End</option>
            </select>
          </div>
          {inp.strikePriceType === 'fixed' && field('Fixed Strike Price', 'strikePrice', '$')}
          {field('Annual Appreciation %', 'appreciationPct', '', '%', '0.5')}
          <div className="p-3 bg-slate-900/50 rounded-lg space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Home Value at Option End</span>
              <span className="text-blue-400 font-bold">{fmt(calc.futureValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Effective Strike Price</span>
              <span className="text-purple-400 font-bold">{fmt(calc.effectiveStrike)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Exercise Gain</span>
              <span className={`font-bold ${calc.exerciseGain > 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(calc.exerciseGain)}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Mortgage at Purchase</p>
          {field('Loan Rate', 'loanRate', '', '%', '0.125')}
          {field('Loan Term', 'loanTermYears', '', 'years')}
          {field('Down Payment %', 'downPaymentPct', '', '%')}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Maintenance Responsibility</label>
            <select value={inp.maintenanceResponsibility} onChange={e => set('maintenanceResponsibility', e.target.value as 'tenant' | 'landlord')}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
              <option value="tenant">Tenant (Buyer pays repairs)</option>
              <option value="landlord">Landlord (Seller pays repairs)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Exercise Decision */}
      <div className={`rounded-xl p-5 border ${calc.shouldExercise ? 'bg-green-900/20 border-green-700/40' : 'bg-red-900/20 border-red-700/40'}`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            { label: 'Built-In Equity at Exercise', value: fmt(calc.exerciseGain), color: calc.exerciseGain > 0 ? 'text-green-400' : 'text-red-400' },
            { label: 'Total Rent Credits', value: fmt(calc.totalRentCredits), color: 'text-blue-400' },
            { label: 'Rent Premium Paid', value: fmt(calc.rentPremium), color: 'text-orange-400' },
            { label: 'Down Payment Covered', value: pct(calc.downCoveredPct), color: calc.downCoveredPct >= 100 ? 'text-green-400' : 'text-yellow-400' },
          ].map(c => (
            <div key={c.label}>
              <p className={`text-xl font-black ${c.color}`}>{c.value}</p>
              <p className="text-xs text-slate-400 mt-1">{c.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 text-center">
          <p className={`text-sm font-bold ${calc.shouldExercise ? 'text-green-300' : 'text-red-300'}`}>
            {calc.shouldExercise
              ? `✓ Exercise recommended — buying at ${fmt(calc.exerciseGain)} below market`
              : `⚠️ Walk away — home value (${fmt(calc.futureValue)}) is below strike price (${fmt(calc.effectiveStrike)}). Option fee is forfeited.`}
          </p>
        </div>
      </div>

      {/* Home Value vs Strike Chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Home Value vs Strike Price Over Time</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={calc.chartData}>
            <defs>
              <linearGradient id="valueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} label={{ value: 'Year', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 10 }} tickFormatter={v => `Yr ${v}`} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            <Area type="monotone" dataKey="homeValue" stroke="#3b82f6" fill="url(#valueGrad)" strokeWidth={2} name="Home Value" />
            <Area type="monotone" dataKey="strikePrice" stroke="#a855f7" fill="none" strokeWidth={2} strokeDasharray="6 3" name="Strike Price" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Seller Analysis (conditional) */}
      {inp.perspective === 'seller' && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Seller / Landlord Income Analysis</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Option Fee Received', value: fmt(calc.sellerOptionIncome), note: 'Non-refundable', color: 'text-green-400' },
              { label: 'Total Rent Collected', value: fmt(calc.sellerRentIncome), note: `Over ${inp.optionPeriodMonths} months`, color: 'text-blue-400' },
              { label: 'Rent Premium Earned', value: fmt(calc.sellerRentPremiumEarned), note: 'Above market', color: 'text-purple-400' },
              { label: 'If Buyer Walks Away', value: `Keep ${fmt(calc.sellerRiskIfExpires)} option fee`, note: 'Relist the property', color: 'text-yellow-400' },
              { label: 'Net If Buyer Exercises', value: fmt(calc.sellerNetIfExercised), note: 'vs selling today', color: calc.sellerNetIfExercised > 0 ? 'text-green-400' : 'text-red-400' },
            ].map(c => (
              <div key={c.label} className="bg-slate-900/50 rounded-lg p-3 text-center">
                <p className={`text-lg font-black ${c.color}`}>{c.value}</p>
                <p className="text-xs text-slate-300 mt-0.5">{c.label}</p>
                <p className="text-xs text-slate-500">{c.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Key Risks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-red-900/20 rounded-xl p-4 border border-red-700/40">
          <p className="text-xs font-bold text-red-300 uppercase tracking-widest mb-2">Buyer Risks</p>
          <div className="space-y-1.5">
            {[
              'Option fee and premium rent are forfeited if you don\'t exercise',
              'Seller may not maintain the property, causing condition issues at closing',
              inp.maintenanceResponsibility === 'tenant' ? 'You bear repair costs without the ownership tax benefits' : 'Seller retains maintenance — negotiate for escrow',
              'Credit score must improve sufficiently to qualify for a mortgage',
              'If seller can\'t deliver clear title, the deal falls through',
            ].map((t, i) => <p key={i} className="text-xs text-red-200/70 flex gap-1.5"><span>•</span><span>{t}</span></p>)}
          </div>
        </div>
        <div className="bg-orange-900/20 rounded-xl p-4 border border-orange-700/40">
          <p className="text-xs font-bold text-orange-300 uppercase tracking-widest mb-2">Seller Risks</p>
          <div className="space-y-1.5">
            {[
              'Tenant-buyer may not exercise, requiring you to re-market the property',
              'Locked into a fixed price if market appreciates significantly',
              'Tenant may damage the property or fail to maintain it during the lease',
              'If market drops below strike price, buyer walks and you still own it',
              'IRS treats option fee as ordinary income in year received',
            ].map((t, i) => <p key={i} className="text-xs text-orange-200/70 flex gap-1.5"><span>•</span><span>{t}</span></p>)}
          </div>
        </div>
      </div>
    </div>
  )
}
