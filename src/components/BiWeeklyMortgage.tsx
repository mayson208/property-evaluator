import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, ReferenceLine } from 'recharts'

interface Inputs {
  loanAmount: number
  annualRate: number
  termYears: number
  extraMonthly: number
  startYear: number
}

const DEF: Inputs = {
  loanAmount: 380000,
  annualRate: 6.75,
  termYears: 30,
  extraMonthly: 0,
  startYear: new Date().getFullYear(),
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const N = (v: string) => parseFloat(v) || 0

function amortize(principal: number, annualRate: number, termYears: number, extraMonthly = 0) {
  const monthlyRate = annualRate / 100 / 12
  const numPayments = termYears * 12
  const basePayment = principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments) / (Math.pow(1 + monthlyRate, numPayments) - 1)
  const payment = basePayment + extraMonthly

  let balance = principal
  let totalInterest = 0
  let month = 0
  const monthly: { month: number; balance: number; interest: number; principal: number; cumInterest: number }[] = []

  while (balance > 0.01 && month < numPayments + 240) {
    const interestCharge = balance * monthlyRate
    const principalPaid = Math.min(payment - interestCharge, balance)
    balance -= principalPaid
    totalInterest += interestCharge
    month++
    monthly.push({ month, balance: Math.max(0, Math.round(balance)), interest: Math.round(interestCharge), principal: Math.round(principalPaid), cumInterest: Math.round(totalInterest) })
    if (balance <= 0) break
  }
  return { months: month, totalInterest, monthly, basePayment }
}

function biWeeklyAmortize(principal: number, annualRate: number, termYears: number) {
  // Bi-weekly = half monthly payment every 2 weeks = 26 payments/yr = 13 monthly payments worth/yr
  const monthlyRate = annualRate / 100 / 12
  const numPayments = termYears * 12
  const baseMonthlyPayment = principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments) / (Math.pow(1 + monthlyRate, numPayments) - 1)
  const biWeeklyPayment = baseMonthlyPayment / 2
  const biWeeklyRate = annualRate / 100 / 26

  let balance = principal
  let totalInterest = 0
  let period = 0
  const monthly: { month: number; balance: number; cumInterest: number }[] = []

  while (balance > 0.01 && period < numPayments * 2 + 400) {
    const interestCharge = balance * biWeeklyRate
    const principalPaid = Math.min(biWeeklyPayment - interestCharge, balance)
    balance -= principalPaid
    totalInterest += interestCharge
    period++
    if (period % 2 === 0) {
      monthly.push({ month: period / 2, balance: Math.max(0, Math.round(balance)), cumInterest: Math.round(totalInterest) })
    }
    if (balance <= 0) break
  }
  const months = Math.ceil(period / 2)
  return { months, totalInterest, monthly, biWeeklyPayment }
}

export default function BiWeeklyMortgage() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = (k: keyof Inputs, v: string) => setInp(p => ({ ...p, [k]: N(v) }))

  const calc = useMemo(() => {
    const { loanAmount, annualRate, termYears, extraMonthly, startYear } = inp

    // Option 1: Standard monthly
    const monthly = amortize(loanAmount, annualRate, termYears, 0)

    // Option 2: Bi-weekly (half payment every 2 weeks = 26 payments/yr)
    const biweekly = biWeeklyAmortize(loanAmount, annualRate, termYears)

    // Option 3: One extra full payment per year
    const oneExtraPerYear = amortize(loanAmount, annualRate, termYears, monthly.basePayment / 12)

    // Option 4: User-defined extra monthly
    const customExtra = extraMonthly > 0 ? amortize(loanAmount, annualRate, termYears, extraMonthly) : null

    const stdMonths = monthly.months
    const biweeklyMonths = biweekly.months
    const oneExtraMonths = oneExtraPerYear.months

    const biweeklySaved = monthly.totalInterest - biweekly.totalInterest
    const biweeklyYearsSaved = (stdMonths - biweeklyMonths) / 12
    const oneExtraSaved = monthly.totalInterest - oneExtraPerYear.totalInterest
    const oneExtraYearsSaved = (stdMonths - oneExtraMonths) / 12

    const customSaved = customExtra ? monthly.totalInterest - customExtra.totalInterest : 0
    const customYearsSaved = customExtra ? (stdMonths - customExtra.months) / 12 : 0

    // Payoff year
    const toYear = (months: number) => startYear + Math.ceil(months / 12)

    // Yearly balance chart (sample every 12 months for all 4 scenarios)
    const maxYears = Math.ceil(stdMonths / 12)
    const yearlyData = Array.from({ length: maxYears + 1 }, (_, i) => {
      const m = i * 12
      const std = monthly.monthly[m - 1]?.balance ?? (m === 0 ? loanAmount : 0)
      const bw = biweekly.monthly[m - 1]?.balance ?? (m === 0 ? loanAmount : 0)
      const oe = oneExtraPerYear.monthly[m - 1]?.balance ?? (m === 0 ? loanAmount : 0)
      const cx = customExtra ? (customExtra.monthly[m - 1]?.balance ?? (m === 0 ? loanAmount : 0)) : undefined
      return {
        year: `${startYear + i}`,
        standard: m === 0 ? loanAmount : std,
        biweekly: m === 0 ? loanAmount : bw,
        oneExtra: m === 0 ? loanAmount : oe,
        ...(cx !== undefined ? { custom: m === 0 ? loanAmount : cx } : {}),
      }
    }).filter((_, i) => i % 2 === 0 || i === 0)

    // Interest saved comparison for bar chart
    const comparison = [
      { name: 'Standard Monthly', interest: Math.round(monthly.totalInterest), months: stdMonths, payment: Math.round(monthly.basePayment) },
      { name: 'Bi-Weekly', interest: Math.round(biweekly.totalInterest), months: biweeklyMonths, payment: Math.round(biweekly.biWeeklyPayment) },
      { name: '1 Extra/Year', interest: Math.round(oneExtraPerYear.totalInterest), months: oneExtraMonths, payment: Math.round(monthly.basePayment + monthly.basePayment / 12) },
      ...(customExtra ? [{ name: `+$${extraMonthly}/mo Extra`, interest: Math.round(customExtra.totalInterest), months: customExtra.months, payment: Math.round(monthly.basePayment + extraMonthly) }] : []),
    ]

    return {
      monthly, biweekly, oneExtraPerYear, customExtra,
      biweeklySaved, biweeklyYearsSaved, biweeklyMonths, stdMonths, oneExtraMonths,
      oneExtraSaved, oneExtraYearsSaved, customSaved, customYearsSaved,
      toYear, yearlyData, comparison,
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
        <h2 className="text-lg font-bold text-white">Mortgage Acceleration Calculator</h2>
        <p className="text-slate-400 text-xs mt-1">Bi-weekly payments vs extra monthly vs one extra payment per year — years saved, interest saved, payoff date comparison</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Standard Payoff', value: `${inp.startYear + Math.ceil(calc.stdMonths / 12)}`, sub: `${calc.stdMonths} months`, color: 'text-slate-300' },
          { label: 'Bi-Weekly Payoff', value: `${calc.toYear(calc.biweeklyMonths)}`, sub: `${calc.biweeklyYearsSaved.toFixed(1)} yrs early`, color: 'text-blue-400' },
          { label: 'Bi-Weekly Interest Saved', value: fmt(calc.biweeklySaved), sub: 'vs standard monthly', color: 'text-green-400' },
          { label: 'Monthly Payment', value: fmt(calc.monthly.basePayment), sub: 'P&I only', color: 'text-white' },
        ].map(m => (
          <div key={m.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
            <p className={`text-2xl font-black ${m.color}`}>{m.value}</p>
            <p className="text-xs text-slate-400 mt-1">{m.label}</p>
            <p className="text-xs text-slate-500">{m.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Inputs */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Loan Details</p>
          {field('Loan Amount', 'loanAmount', '', '$')}
          {field('Interest Rate', 'annualRate', '%')}
          {field('Loan Term', 'termYears', 'yr')}
          {field('Loan Start Year', 'startYear')}
          {field('Extra Monthly Payment (optional)', 'extraMonthly', '', '$')}
        </div>

        {/* Strategy Comparison */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Strategy Comparison</p>
          <div className="space-y-2">
            {[
              {
                label: 'Standard Monthly',
                months: calc.stdMonths,
                interest: calc.monthly.totalInterest,
                payment: calc.monthly.basePayment,
                saved: 0,
                yearsSaved: 0,
                color: 'border-slate-600',
                badge: '',
              },
              {
                label: 'Bi-Weekly (÷2 every 2 wks)',
                months: calc.biweeklyMonths,
                interest: calc.biweekly.totalInterest,
                payment: calc.biweekly.biWeeklyPayment,
                saved: calc.biweeklySaved,
                yearsSaved: calc.biweeklyYearsSaved,
                color: 'border-blue-600',
                badge: '★ Most Popular',
              },
              {
                label: '1 Extra Full Payment / Year',
                months: calc.oneExtraMonths,
                interest: calc.oneExtraPerYear.totalInterest,
                payment: calc.monthly.basePayment,
                saved: calc.oneExtraSaved,
                yearsSaved: calc.oneExtraYearsSaved,
                color: 'border-purple-600',
                badge: '',
              },
              ...(calc.customExtra ? [{
                label: `+$${inp.extraMonthly}/mo Extra`,
                months: calc.customExtra.months,
                interest: calc.customExtra.totalInterest,
                payment: calc.monthly.basePayment + inp.extraMonthly,
                saved: calc.customSaved,
                yearsSaved: calc.customYearsSaved,
                color: 'border-green-600',
                badge: 'Custom',
              }] : []),
            ].map(s => (
              <div key={s.label} className={`p-3 rounded-lg border ${s.color} bg-slate-900/50`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-200">{s.label}</span>
                  {s.badge && <span className="text-xs bg-blue-600/30 text-blue-300 px-2 py-0.5 rounded-full">{s.badge}</span>}
                </div>
                <div className="grid grid-cols-2 gap-x-4 text-xs">
                  <div><span className="text-slate-500">Payoff: </span><span className="text-slate-300">{inp.startYear + Math.ceil(s.months / 12)} ({s.months}mo)</span></div>
                  <div><span className="text-slate-500">Payment: </span><span className="text-slate-300">{fmt(s.payment)}</span></div>
                  <div><span className="text-slate-500">Total Interest: </span><span className="text-orange-400">{fmt(s.interest)}</span></div>
                  {s.saved > 0 && <div><span className="text-slate-500">Saved: </span><span className="text-green-400 font-bold">{fmt(s.saved)} · {s.yearsSaved.toFixed(1)}yr</span></div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Balance Over Time */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Loan Balance Over Time</p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={calc.yearlyData}>
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 9 }} interval={3} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
            <Line type="monotone" dataKey="standard" stroke="#64748b" strokeWidth={2} dot={false} name="Standard Monthly" strokeDasharray="5 3" />
            <Line type="monotone" dataKey="biweekly" stroke="#3b82f6" strokeWidth={2} dot={false} name="Bi-Weekly" />
            <Line type="monotone" dataKey="oneExtra" stroke="#a855f7" strokeWidth={2} dot={false} name="1 Extra/Year" />
            {calc.customExtra && <Line type="monotone" dataKey="custom" stroke="#22c55e" strokeWidth={2} dot={false} name={`+$${inp.extraMonthly}/mo`} />}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Interest comparison bar chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Total Interest Paid by Strategy</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={calc.comparison}>
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 9 }} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Bar dataKey="interest" name="Total Interest" radius={[4, 4, 0, 0]} fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Mortgage Acceleration — Quick Guide</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
          {[
            '📆 True bi-weekly: 26 half-payments/yr = 13 full payments — one extra payment equivalent per year automatically',
            '🏦 Lender bi-weekly programs: some charge setup fees ($200-400) — just make extra payments yourself instead, it\'s free',
            '💰 Extra $100/mo on a $300k 30yr at 7%: saves ~$60k in interest and 5+ years — small amounts compound dramatically',
            '⚡ Best strategy: send extra as principal-only — call/write "apply to principal" on the check/memo to avoid misapplication',
            '📊 Refi vs accelerate: compare actual interest rate — if your rate is 3%, investing the extra often beats paying it down',
            '🔑 High-rate mortgages (>6.5%): paying down is likely better than most bond/CD alternatives at same after-tax risk',
            '📋 ARM loans: acceleration less predictable — focus on locking in fixed rate first if rate reset risk is high',
            '💡 Round up payment: rounding to the nearest $100 is the simplest way to start — most people never miss $50-80/mo',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
