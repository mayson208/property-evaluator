import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine, BarChart, Bar } from 'recharts'

interface Inputs {
  loanAmount: number
  fixedRate: number
  fixedTerm: number
  armInitialRate: number
  armInitialPeriod: number
  armAdjPeriod: number
  armCap1: number
  armCapPer: number
  armCapLife: number
  armFloor: number
  projectedIndex: number
  margin: number
  holdYears: number
  marginalTaxRate: number
}

const DEF: Inputs = {
  loanAmount: 500000,
  fixedRate: 7.25,
  fixedTerm: 30,
  armInitialRate: 5.875,
  armInitialPeriod: 7,
  armAdjPeriod: 1,
  armCap1: 2,
  armCapPer: 2,
  armCapLife: 5,
  armFloor: 2.5,
  projectedIndex: 3.5,
  margin: 2.75,
  holdYears: 10,
  marginalTaxRate: 32,
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const N = (v: string) => parseFloat(v) || 0

function monthlyPayment(principal: number, annualRate: number, months: number): number {
  if (annualRate === 0) return principal / months
  const r = annualRate / 100 / 12
  return principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1)
}

function amortize(principal: number, annualRate: number, payment: number) {
  const r = annualRate / 100 / 12
  const interest = principal * r
  const principalPaid = payment - interest
  return { interest, principalPaid, balance: principal - principalPaid }
}

export default function FixedVsARM() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = (k: keyof Inputs, v: string) => setInp(p => ({ ...p, [k]: N(v) }))

  const calc = useMemo(() => {
    const {
      loanAmount, fixedRate, fixedTerm, armInitialRate,
      armInitialPeriod, armAdjPeriod, armCap1, armCapPer, armCapLife,
      armFloor, projectedIndex, margin, holdYears, marginalTaxRate
    } = inp

    const holdMonths = holdYears * 12
    const fixedPayment = monthlyPayment(loanAmount, fixedRate, fixedTerm * 12)

    // Build month-by-month schedule
    let fixedBal = loanAmount
    let armBal = loanAmount

    // ARM: compute rate each month
    const armPayment0 = monthlyPayment(loanAmount, armInitialRate, fixedTerm * 12)
    let armRate = armInitialRate
    let armPayment = armPayment0
    const fullyIndexedRate = Math.max(armFloor, projectedIndex + margin)

    const monthlyData: {
      month: number
      fixedPayment: number
      armPayment: number
      fixedInterest: number
      armInterest: number
      fixedBal: number
      armBal: number
      armRate: number
      fixedCumInterest: number
      armCumInterest: number
      cumulativeSavings: number
    }[] = []

    let fixedCumInterest = 0
    let armCumInterest = 0

    for (let m = 1; m <= holdMonths; m++) {
      // ARM rate adjustments
      if (m > armInitialPeriod * 12) {
        const adjNumber = Math.floor((m - armInitialPeriod * 12 - 1) / (armAdjPeriod * 12)) + 1
        if ((m - armInitialPeriod * 12 - 1) % (armAdjPeriod * 12) === 0) {
          let newRate = fullyIndexedRate
          const cap1Limit = armInitialRate + armCap1
          const capLifeLimit = armInitialRate + armCapLife
          const capPerLimit = armRate + armCapPer

          if (adjNumber === 1) newRate = Math.min(newRate, cap1Limit)
          else newRate = Math.min(newRate, capPerLimit)
          newRate = Math.min(newRate, capLifeLimit)
          newRate = Math.max(newRate, armFloor)
          armRate = newRate
          const remainingMonths = fixedTerm * 12 - m + 1
          armPayment = monthlyPayment(armBal, armRate, Math.max(1, remainingMonths))
        }
      }

      const fixedA = amortize(fixedBal, fixedRate, fixedPayment)
      const armA = amortize(armBal, armRate, armPayment)

      fixedCumInterest += fixedA.interest
      armCumInterest += armA.interest

      fixedBal = fixedA.balance
      armBal = armA.balance

      if (m % 12 === 0 || m === holdMonths) {
        monthlyData.push({
          month: m,
          fixedPayment,
          armPayment,
          fixedInterest: fixedA.interest,
          armInterest: armA.interest,
          fixedBal: Math.max(0, fixedBal),
          armBal: Math.max(0, armBal),
          armRate,
          fixedCumInterest,
          armCumInterest,
          cumulativeSavings: fixedCumInterest - armCumInterest,
        })
      }
    }

    const yearlyData = monthlyData.map(r => ({
      year: Math.ceil(r.month / 12),
      fixedPayment: r.fixedPayment,
      armPayment: r.armPayment,
      fixedBal: r.fixedBal,
      armBal: r.armBal,
      armRate: r.armRate,
      fixedCumInterest: r.fixedCumInterest,
      armCumInterest: r.armCumInterest,
      cumulativeSavings: r.cumulativeSavings,
    }))

    const last = yearlyData[yearlyData.length - 1] ?? { fixedCumInterest: 0, armCumInterest: 0, cumulativeSavings: 0, fixedBal: loanAmount, armBal: loanAmount }

    // After-tax savings (mortgage interest deduction)
    const afterTaxSavings = last.cumulativeSavings * (1 - marginalTaxRate / 100)

    // Break-even: month where ARM cumulative interest > fixed
    // (if ARM starts cheaper, find where savings flip negative)
    const breakEvenYear = yearlyData.find(r => r.cumulativeSavings < 0)?.year ?? null

    // Max possible ARM rate scenarios
    const maxArmRate = armInitialRate + armCapLife
    const maxArmPayment = monthlyPayment(loanAmount, maxArmRate, fixedTerm * 12)
    const worstCaseMonthlyDiff = maxArmPayment - fixedPayment

    // Year-by-year payment comparison for bar chart
    const paymentComparison = yearlyData.map(r => ({
      year: `Yr ${r.year}`,
      Fixed: Math.round(r.fixedPayment),
      ARM: Math.round(r.armPayment),
      armRate: r.armRate,
    }))

    return {
      fixedPayment, armPayment0, armPayment0Diff: fixedPayment - armPayment0,
      yearlyData, paymentComparison,
      last, afterTaxSavings, breakEvenYear,
      maxArmRate, maxArmPayment, worstCaseMonthlyDiff,
      fullyIndexedRate,
    }
  }, [inp])

  const field = (label: string, key: keyof Inputs, suffix = '', step = '0.01') => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div className="relative">
        <input type="number" step={step} value={inp[key] as number} onChange={e => set(key, e.target.value)}
          className={`w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 ${suffix ? 'pl-3 pr-8' : 'pl-3 pr-3'}`} />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{suffix}</span>}
      </div>
    </div>
  )

  const armSavings = calc.last.cumulativeSavings
  const armWins = armSavings > 0

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-lg font-bold text-white">Fixed vs ARM Mortgage Comparison</h2>
        <p className="text-slate-400 text-xs mt-1">Model rate adjustments, lifetime caps, worst-case scenarios, and true break-even across your planned hold period</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Fixed Rate */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Loan & Fixed Rate</p>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Loan Amount</label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
              <input type="number" step="1000" value={inp.loanAmount} onChange={e => set('loanAmount', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 pl-5 pr-3 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          {field('Fixed Rate', 'fixedRate', '%')}
          {field('Loan Term (years)', 'fixedTerm', 'yr', '1')}
          {field('Your Tax Rate', 'marginalTaxRate', '%', '1')}
          {field('Planned Hold (years)', 'holdYears', 'yr', '1')}
          <div className="p-2 bg-slate-900/50 rounded-lg space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-slate-400">Fixed Monthly Payment</span><span className="text-white font-bold">{fmt(calc.fixedPayment)}</span></div>
          </div>
        </div>

        {/* ARM Inputs */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">ARM Structure</p>
          {field('Initial ARM Rate', 'armInitialRate', '%')}
          {field('Initial Fixed Period (yrs)', 'armInitialPeriod', 'yr', '1')}
          {field('Adjustment Period (yrs)', 'armAdjPeriod', 'yr', '1')}
          <div className="grid grid-cols-3 gap-2">
            {field('1st Adj Cap', 'armCap1', '%', '0.25')}
            {field('Per Adj Cap', 'armCapPer', '%', '0.25')}
            {field('Lifetime Cap', 'armCapLife', '%', '0.25')}
          </div>
          {field('Floor Rate', 'armFloor', '%', '0.25')}
          <div className="p-2 bg-slate-900/50 rounded-lg space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-slate-400">ARM Initial Payment</span><span className="text-green-400 font-bold">{fmt(calc.armPayment0)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Monthly Savings vs Fixed</span><span className="text-green-400 font-semibold">{fmt(calc.armPayment0Diff)}</span></div>
          </div>
        </div>

        {/* Index / Projection */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Rate Projection</p>
          {field('Projected Index (SOFR/CMT)', 'projectedIndex', '%')}
          {field('Margin (add to index)', 'margin', '%')}
          <div className="p-3 bg-blue-900/20 border border-blue-700/40 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-blue-300">Fully Indexed Rate</span><span className="text-white font-bold">{calc.fullyIndexedRate.toFixed(3)}%</span></div>
            <div className="flex justify-between"><span className="text-blue-300">Maximum ARM Rate</span><span className="text-orange-400 font-bold">{calc.maxArmRate.toFixed(2)}%</span></div>
            <div className="flex justify-between"><span className="text-blue-300">Max ARM Payment</span><span className="text-orange-400 font-bold">{fmt(calc.maxArmPayment)}</span></div>
            <div className="flex justify-between"><span className="text-blue-300">Worst-Case vs Fixed</span>
              <span className={calc.worstCaseMonthlyDiff > 0 ? 'text-red-400 font-bold' : 'text-green-400 font-bold'}>
                {calc.worstCaseMonthlyDiff > 0 ? '+' : ''}{fmt(calc.worstCaseMonthlyDiff)}/mo
              </span>
            </div>
          </div>
          <div className="p-3 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <p className="text-slate-400 font-semibold">ARM Structure: {inp.armInitialPeriod}/{inp.armAdjPeriod}</p>
            <p className="text-slate-500">Caps: {inp.armCap1}/{inp.armCapPer}/{inp.armCapLife} (first/per/lifetime)</p>
          </div>
        </div>
      </div>

      {/* Summary Banner */}
      <div className={`rounded-xl p-5 border ${armWins ? 'bg-green-900/20 border-green-700/40' : 'bg-orange-900/20 border-orange-700/40'}`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-3xl font-black text-white">{fmt(armSavings)}</p>
            <p className="text-xs text-slate-400">ARM Total Interest Savings</p>
            <p className="text-xs text-slate-500">Over {inp.holdYears}-year hold</p>
          </div>
          <div>
            <p className="text-3xl font-black text-blue-400">{fmt(calc.afterTaxSavings)}</p>
            <p className="text-xs text-slate-400">After-Tax Savings</p>
            <p className="text-xs text-slate-500">At {inp.marginalTaxRate}% rate</p>
          </div>
          <div>
            <p className="text-3xl font-black text-purple-400">{fmt(calc.armPayment0Diff)}/mo</p>
            <p className="text-xs text-slate-400">Initial Monthly Savings</p>
            <p className="text-xs text-slate-500">First {inp.armInitialPeriod} years</p>
          </div>
          <div>
            <p className={`text-3xl font-black ${calc.breakEvenYear ? 'text-red-400' : 'text-green-400'}`}>
              {calc.breakEvenYear ? `Yr ${calc.breakEvenYear}` : 'Never'}
            </p>
            <p className="text-xs text-slate-400">Fixed Becomes Cheaper By</p>
            <p className="text-xs text-slate-500">{calc.breakEvenYear ? 'ARM costs more after this' : 'ARM stays cheaper through hold'}</p>
          </div>
        </div>
      </div>

      {/* Payment Over Time */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Monthly Payment Over Time</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={calc.paymentComparison}>
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(1)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="stepAfter" dataKey="Fixed" stroke="#3b82f6" strokeWidth={2} dot={false} />
            <Line type="stepAfter" dataKey="ARM" stroke="#f59e0b" strokeWidth={2} dot={false} />
            <ReferenceLine x={`Yr ${inp.armInitialPeriod}`} stroke="#ef444466" strokeDasharray="4 2" label={{ value: 'First Adj', fill: '#ef4444', fontSize: 9 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Cumulative Interest */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Cumulative Interest Paid</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={calc.yearlyData}>
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => `Yr ${v}`} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="fixedCumInterest" stroke="#3b82f6" strokeWidth={2} dot={false} name="Fixed Cumulative Interest" />
            <Line type="monotone" dataKey="armCumInterest" stroke="#f59e0b" strokeWidth={2} dot={false} name="ARM Cumulative Interest" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Loan Balance Comparison */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-1">Remaining Loan Balance</p>
        <p className="text-xs text-slate-500 mb-3">Lower ARM payments = slower paydown — check equity at sale time</p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={calc.yearlyData}>
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => `Yr ${v}`} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="fixedBal" stroke="#3b82f6" strokeWidth={2} dot={false} name="Fixed Balance" />
            <Line type="monotone" dataKey="armBal" stroke="#f59e0b" strokeWidth={2} dot={false} name="ARM Balance" />
          </LineChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-2 gap-4 mt-3 text-xs">
          <div className="p-2 bg-slate-900/50 rounded-lg space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Fixed Balance at Yr {inp.holdYears}</span><span className="text-blue-400 font-bold">{fmt(calc.last.fixedBal)}</span></div>
          </div>
          <div className="p-2 bg-slate-900/50 rounded-lg space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">ARM Balance at Yr {inp.holdYears}</span><span className="text-yellow-400 font-bold">{fmt(calc.last.armBal)}</span></div>
          </div>
        </div>
      </div>

      {/* Decision Guide */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-green-900/15 border border-green-700/30 rounded-xl p-4">
          <p className="text-xs font-bold text-green-400 mb-2">✓ Choose ARM if…</p>
          <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
            <li>You plan to sell or refinance before the first adjustment</li>
            <li>Interest rates are expected to fall — lower index = lower rate</li>
            <li>You'll invest the monthly savings at a return {'>'} rate risk</li>
            <li>Your income will rise, absorbing worst-case payment increases</li>
            <li>The property is an investment — ARM cash flow benefits NOI</li>
          </ul>
        </div>
        <div className="bg-blue-900/15 border border-blue-700/30 rounded-xl p-4">
          <p className="text-xs font-bold text-blue-400 mb-2">✓ Choose Fixed if…</p>
          <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
            <li>You plan to hold beyond the ARM initial period</li>
            <li>Rates are historically low — lock in while you can</li>
            <li>Your income is fixed and can't absorb payment shock</li>
            <li>The property is a primary residence — stability matters</li>
            <li>Worst-case ARM payment would strain your DTI</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
