import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, ReferenceLine } from 'recharts'

interface PointOption {
  points: number
  rate: number
}

interface Inputs {
  loanAmount: number
  baseRate: number
  loanTermYears: number
  expectedHoldYears: number
  taxBracket: number
  itemize: boolean
  customOptions: boolean
  option1Points: number
  option1Rate: number
  option2Points: number
  option2Rate: number
  option3Points: number
  option3Rate: number
  reinvestSavings: boolean
  reinvestReturn: number
}

const DEF: Inputs = {
  loanAmount: 450000,
  baseRate: 7.5,
  loanTermYears: 30,
  expectedHoldYears: 7,
  taxBracket: 22,
  itemize: true,
  customOptions: false,
  option1Points: 0,
  option1Rate: 7.5,
  option2Points: 1,
  option2Rate: 7.125,
  option3Points: 2,
  option3Rate: 6.75,
  reinvestSavings: false,
  reinvestReturn: 7,
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const N = (v: string) => parseFloat(v) || 0

function calcMortgage(principal: number, annualRate: number, termMonths: number) {
  const r = annualRate / 100 / 12
  if (r === 0) return principal / termMonths
  return principal * r / (1 - Math.pow(1 + r, -termMonths))
}

function totalInterest(principal: number, annualRate: number, termMonths: number, holdMonths: number) {
  const r = annualRate / 100 / 12
  const pmt = calcMortgage(principal, annualRate, termMonths)
  let bal = principal
  let totalInt = 0
  for (let m = 0; m < Math.min(holdMonths, termMonths); m++) {
    const interest = bal * r
    totalInt += interest
    bal -= (pmt - interest)
  }
  return totalInt
}

export default function MortgagePointsCalc() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = (k: keyof Inputs, v: string | boolean) =>
    setInp(p => ({ ...p, [k]: typeof DEF[k] === 'number' ? N(v as string) : v }))

  const calc = useMemo(() => {
    const { loanAmount, loanTermYears, expectedHoldYears, taxBracket, itemize,
            option1Points, option1Rate, option2Points, option2Rate, option3Points, option3Rate,
            reinvestSavings, reinvestReturn } = inp

    const options: PointOption[] = [
      { points: option1Points, rate: option1Rate },
      { points: option2Points, rate: option2Rate },
      { points: option3Points, rate: option3Rate },
    ]

    const termMonths = loanTermYears * 12
    const holdMonths = expectedHoldYears * 12

    const analyzed = options.map(opt => {
      const pointsCost = loanAmount * opt.points / 100
      const afterTaxPointsCost = itemize ? pointsCost * (1 - taxBracket / 100) : pointsCost
      const monthlyPayment = calcMortgage(loanAmount, opt.rate, termMonths)
      const intOverHold = totalInterest(loanAmount, opt.rate, termMonths, holdMonths)
      const afterTaxInterest = itemize ? intOverHold * (1 - taxBracket / 100) : intOverHold
      const totalCost = afterTaxPointsCost + afterTaxInterest

      return { ...opt, pointsCost, afterTaxPointsCost, monthlyPayment, intOverHold, afterTaxInterest, totalCost }
    })

    // Break-even analysis (option 0 = no points baseline)
    const baseline = analyzed[0]
    const withBreakEvens = analyzed.map((opt, i) => {
      if (i === 0) return { ...opt, breakEvenMonths: 0, breakEvenYears: 0, netSavingsAtHold: 0 }
      const monthlySavings = baseline.monthlyPayment - opt.monthlyPayment
      const afterTaxMonthlySavings = itemize ? monthlySavings * (1 - taxBracket / 100) : monthlySavings
      const breakEvenMonths = afterTaxMonthlySavings > 0 ? opt.afterTaxPointsCost / afterTaxMonthlySavings : Infinity
      const breakEvenYears = breakEvenMonths / 12
      const netSavingsAtHold = afterTaxMonthlySavings * holdMonths - opt.afterTaxPointsCost

      return { ...opt, monthlySavings, afterTaxMonthlySavings, breakEvenMonths, breakEvenYears, netSavingsAtHold }
    })

    // Year-by-year cumulative cost chart
    const chartData = Array.from({ length: Math.min(loanTermYears, 30) + 1 }, (_, y) => {
      const row: Record<string, number> = { year: y }
      withBreakEvens.forEach((opt, i) => {
        const mo = y * 12
        const intAcc = totalInterest(loanAmount, opt.rate, termMonths, mo)
        const afterTaxInt = itemize ? intAcc * (1 - taxBracket / 100) : intAcc
        const pts = itemize ? opt.pointsCost * (1 - taxBracket / 100) : opt.pointsCost
        row[`Option ${i + 1} (${opt.points} pts)`] = pts + afterTaxInt
      })
      return row
    })

    // Monthly savings over hold
    const savingsTimeline = Array.from({ length: holdMonths + 1 }, (_, m) => {
      const row: Record<string, number> = { month: m }
      withBreakEvens.slice(1).forEach((opt, i) => {
        const cum = (opt.afterTaxMonthlySavings ?? 0) * m - opt.afterTaxPointsCost
        row[`${opt.points} pts`] = cum
      })
      return row
    })

    // Best option at hold period
    const bestAtHold = withBreakEvens.reduce((best, opt) =>
      opt.totalCost < best.totalCost ? opt : best)

    return { analyzed: withBreakEvens, chartData, savingsTimeline, bestAtHold, baseline }
  }, [inp])

  const OPTION_COLORS = ['#64748b', '#3b82f6', '#22c55e', '#f59e0b']

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-lg font-bold text-white">Mortgage Points Break-Even Calculator</h2>
        <p className="text-slate-400 text-xs mt-1">Compare up to 3 point/rate combinations — break-even months, after-tax cost, and total savings at your expected hold period</p>
      </div>

      {/* Main Inputs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Loan Amount', key: 'loanAmount' as const, prefix: '$' },
          { label: 'Loan Term', key: 'loanTermYears' as const, suffix: ' yrs' },
          { label: 'Expected Hold', key: 'expectedHoldYears' as const, suffix: ' yrs' },
          { label: 'Tax Bracket', key: 'taxBracket' as const, suffix: '%' },
        ].map(f => (
          <div key={f.key}>
            <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
            <div className="relative">
              {f.prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{f.prefix}</span>}
              <input type="number" value={inp[f.key] as number} onChange={e => set(f.key, e.target.value)}
                className={`w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 ${f.prefix ? 'pl-5 pr-3' : f.suffix ? 'pl-3 pr-8' : 'px-3'}`} />
              {f.suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{f.suffix}</span>}
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2 col-span-2 md:col-span-1">
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input type="checkbox" checked={inp.itemize} onChange={e => set('itemize', e.target.checked)} className="accent-blue-500" />
            Itemize deductions
          </label>
        </div>
      </div>

      {/* Point Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {([
          { label: 'Option 1 (No Points)', pointsKey: 'option1Points' as const, rateKey: 'option1Rate' as const, color: 'border-slate-700' },
          { label: 'Option 2', pointsKey: 'option2Points' as const, rateKey: 'option2Rate' as const, color: 'border-blue-700/50' },
          { label: 'Option 3', pointsKey: 'option3Points' as const, rateKey: 'option3Rate' as const, color: 'border-green-700/50' },
        ]).map((opt, i) => {
          const result = calc.analyzed[i]
          return (
            <div key={opt.label} className={`bg-slate-800/50 rounded-xl p-4 border ${opt.color} space-y-3`}>
              <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">{opt.label}</p>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Discount Points</label>
                <div className="relative">
                  <input type="number" step="0.25" value={inp[opt.pointsKey]} onChange={e => set(opt.pointsKey, e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500" />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">pts</span>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Interest Rate</label>
                <div className="relative">
                  <input type="number" step="0.125" value={inp[opt.rateKey]} onChange={e => set(opt.rateKey, e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500" />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">%</span>
                </div>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-slate-400">Points Cost</span><span className="text-red-400">{fmt(result.pointsCost)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">After-Tax Points</span><span className="text-orange-400">{fmt(result.afterTaxPointsCost)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Monthly Payment</span><span className="text-white font-bold">{fmt(result.monthlyPayment)}</span></div>
                {i > 0 && result.afterTaxMonthlySavings !== undefined && <>
                  <div className="flex justify-between border-t border-slate-700 pt-1.5"><span className="text-slate-400">Monthly Savings</span><span className="text-green-400">{fmt(result.afterTaxMonthlySavings)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Break-Even</span><span className={`font-bold ${result.breakEvenYears! < inp.expectedHoldYears ? 'text-green-400' : 'text-red-400'}`}>
                    {isFinite(result.breakEvenYears!) ? `${result.breakEvenYears!.toFixed(1)} yrs` : 'N/A'}
                  </span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Net @ {inp.expectedHoldYears}yr Hold</span><span className={`font-bold ${result.netSavingsAtHold! > 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(result.netSavingsAtHold!)}</span></div>
                </>}
                {i > 0 && <div className={`text-center py-1 rounded text-xs font-bold mt-1 ${result.breakEvenYears! < inp.expectedHoldYears ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'}`}>
                  {result.breakEvenYears! < inp.expectedHoldYears ? '✓ Worth it at your hold period' : '✗ Won\'t break even'}
                </div>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Best Option */}
      <div className="bg-blue-900/20 rounded-xl p-4 border border-blue-700/40 text-center">
        <p className="text-xs text-slate-400 uppercase tracking-widest">Best Option at {inp.expectedHoldYears}-Year Hold</p>
        <p className="text-2xl font-black text-white mt-1">{calc.bestAtHold.points} Points @ {calc.bestAtHold.rate}%</p>
        <p className="text-sm text-blue-300 mt-1">Lowest after-tax total cost: {fmt(calc.bestAtHold.totalCost)}</p>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Cumulative After-Tax Cost Over Time</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={calc.chartData}>
              <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} label={{ value: 'Year', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 10 }} />
              <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine x={inp.expectedHoldYears} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: `Hold (${inp.expectedHoldYears}yr)`, fill: '#f59e0b', fontSize: 10 }} />
              {Object.keys(calc.chartData[0] ?? {}).filter(k => k !== 'year').map((key, i) => (
                <Line key={key} type="monotone" dataKey={key} stroke={OPTION_COLORS[i]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Cumulative Savings vs No-Points (Monthly)</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={calc.savingsTimeline}>
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} label={{ value: 'Month', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 10 }} />
              <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={0} stroke="#475569" />
              {Object.keys(calc.savingsTimeline[0] ?? {}).filter(k => k !== 'month').map((key, i) => (
                <Line key={key} type="monotone" dataKey={key} stroke={[OPTION_COLORS[1], OPTION_COLORS[2]][i]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Points Strategy Guide</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
          {[
            '✓ 1 point typically buys 0.25% rate reduction — but this varies by lender and market conditions',
            '✓ Points are tax-deductible in the year paid on a purchase mortgage (if you itemize)',
            '✓ On a refinance, points must be amortized over the loan life — no upfront deduction',
            '⚠️ Points only make sense if you hold long enough to break even — use your actual hold period',
            '💡 Negative points (lender credits) — accept a higher rate in exchange for lender paying closing costs',
            '💡 If you plan to refinance within 2 years, avoid paying points — you lose the unrecovered portion',
            '🔍 Ask lenders for the same quote with 0, 1, and 2 points — compare all-in cost transparently',
            '📊 For investment properties: points reduce taxable income but cash flow analysis drives the decision',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}

const OPTION_COLORS = ['#64748b', '#3b82f6', '#22c55e', '#f59e0b']
