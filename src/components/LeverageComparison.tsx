import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, ReferenceLine } from 'recharts'

interface Inputs {
  propertyValue: number
  annualNOI: number
  annualAppreciation: number
  holdYears: number
  ltv30: number
  rate30: number
  ltv60: number
  rate60: number
  ltv80: number
  rate80: number
  termYears: number
  sellingCostsPct: number
}

const DEF: Inputs = {
  propertyValue: 500000,
  annualNOI: 32000,
  annualAppreciation: 4,
  holdYears: 10,
  ltv30: 30,
  rate30: 6.5,
  ltv60: 60,
  rate60: 7.0,
  ltv80: 80,
  rate80: 7.5,
  termYears: 30,
  sellingCostsPct: 6,
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const pct = (n: number) => `${n.toFixed(2)}%`
const N = (v: string) => parseFloat(v) || 0

function monthlyPmt(principal: number, annualRate: number, termYears: number) {
  if (annualRate === 0) return 0
  const r = annualRate / 100 / 12
  const n = termYears * 12
  return principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1)
}

function remainingBalance(principal: number, annualRate: number, termYears: number, monthsPaid: number) {
  if (annualRate === 0) return principal * (1 - monthsPaid / (termYears * 12))
  const r = annualRate / 100 / 12
  const n = termYears * 12
  return principal * (Math.pow(1 + r, n) - Math.pow(1 + r, monthsPaid)) / (Math.pow(1 + r, n) - 1)
}

function calcScenario(
  propertyValue: number, noi: number, ltv: number, rate: number,
  termYears: number, appreciation: number, holdYears: number, sellingCostsPct: number,
  label: string, color: string
) {
  const loan = propertyValue * ltv / 100
  const equity = propertyValue - loan
  const payment = monthlyPmt(loan, rate, termYears)
  const annualDebt = payment * 12
  const annualCF = noi - annualDebt
  const cocReturn = equity > 0 ? annualCF / equity * 100 : 0
  const capRate = propertyValue > 0 ? noi / propertyValue * 100 : 0
  const breakEvenCapRate = rate // rough: cap rate must exceed interest rate for positive leverage
  const positiveLeverage = capRate > rate

  const exitValue = propertyValue * Math.pow(1 + appreciation / 100, holdYears)
  const exitLoan = remainingBalance(loan, rate, termYears, holdYears * 12)
  const exitEquity = exitValue * (1 - sellingCostsPct / 100) - exitLoan
  const totalReturn = annualCF * holdYears + (exitEquity - equity)
  const totalROI = equity > 0 ? totalReturn / equity * 100 : 0
  const annualizedROI = equity > 0 ? (Math.pow(1 + totalROI / 100, 1 / holdYears) - 1) * 100 : 0

  const yearlyData = Array.from({ length: holdYears }, (_, i) => {
    const y = i + 1
    const propVal = propertyValue * Math.pow(1 + appreciation / 100, y)
    const loanBal = remainingBalance(loan, rate, termYears, y * 12)
    const eq = propVal - loanBal
    const cumCF = annualCF * y
    return { year: y, equity: Math.round(eq), cumCF: Math.round(cumCF), propVal: Math.round(propVal), totalWealth: Math.round(eq + cumCF) }
  })

  return { label, color, loan, equity, payment, annualDebt, annualCF, cocReturn, capRate, breakEvenCapRate, positiveLeverage, exitValue, exitLoan, exitEquity, totalReturn, totalROI, annualizedROI, yearlyData, ltv }
}

export default function LeverageComparison() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = (k: keyof Inputs, v: string) => setInp(p => ({ ...p, [k]: N(v) }))

  const calc = useMemo(() => {
    const { propertyValue, annualNOI, annualAppreciation, holdYears, termYears, sellingCostsPct } = inp
    const capRate = propertyValue > 0 ? annualNOI / propertyValue * 100 : 0

    const scenarios = [
      calcScenario(propertyValue, annualNOI, 0, 0, termYears, annualAppreciation, holdYears, sellingCostsPct, 'All Cash (0% LTV)', '#94a3b8'),
      calcScenario(propertyValue, annualNOI, inp.ltv30, inp.rate30, termYears, annualAppreciation, holdYears, sellingCostsPct, `${inp.ltv30}% LTV @ ${inp.rate30}%`, '#22c55e'),
      calcScenario(propertyValue, annualNOI, inp.ltv60, inp.rate60, termYears, annualAppreciation, holdYears, sellingCostsPct, `${inp.ltv60}% LTV @ ${inp.rate60}%`, '#3b82f6'),
      calcScenario(propertyValue, annualNOI, inp.ltv80, inp.rate80, termYears, annualAppreciation, holdYears, sellingCostsPct, `${inp.ltv80}% LTV @ ${inp.rate80}%`, '#f59e0b'),
    ]

    // Break-even leverage rate (where LTV60 CoC = all-cash CoC)
    const cashCoC = scenarios[0].cocReturn
    const breakEvenRate = capRate // simplified: leverage adds value only when cap rate > mortgage rate

    // Combined year-by-year for chart
    const years = Array.from({ length: holdYears }, (_, i) => ({
      year: `Yr ${i + 1}`,
      ...Object.fromEntries(scenarios.map(s => [s.label, s.yearlyData[i]?.totalWealth ?? 0])),
    }))

    // Equity multiple for each
    const equityMultiples = scenarios.map(s => ({
      label: s.label,
      em: s.equity > 0 ? (s.equity + s.totalReturn) / s.equity : 1,
      annualizedROI: s.annualizedROI,
      cocReturn: s.cocReturn,
      equityInvested: s.equity,
    }))

    // CoC vs LTV
    const cocByLTV = [
      { ltv: 0, coc: scenarios[0].cocReturn, annROI: scenarios[0].annualizedROI },
      { ltv: inp.ltv30, coc: scenarios[1].cocReturn, annROI: scenarios[1].annualizedROI },
      { ltv: inp.ltv60, coc: scenarios[2].cocReturn, annROI: scenarios[2].annualizedROI },
      { ltv: inp.ltv80, coc: scenarios[3].cocReturn, annROI: scenarios[3].annualizedROI },
    ]

    return { scenarios, capRate, breakEvenRate, years, equityMultiples, cocByLTV }
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

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-lg font-bold text-white">Leverage Comparison Tool</h2>
        <p className="text-slate-400 text-xs mt-1">Compare all-cash vs 3 leverage scenarios — cash-on-cash, annualized ROI, equity multiple, total wealth at exit, and the break-even mortgage rate</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Property */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Property</p>
          {field('Property Value', 'propertyValue', '', '$', '5000')}
          {field('Annual NOI', 'annualNOI', '', '$', '500')}
          {field('Annual Appreciation', 'annualAppreciation', '%')}
          {field('Hold Period', 'holdYears', 'yr', '', '1')}
          {field('Loan Term', 'termYears', 'yr', '', '1')}
          {field('Selling Costs at Exit', 'sellingCostsPct', '%')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Cap Rate</span><span className="text-blue-400 font-bold">{pct(calc.capRate)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Leverage Adds Value When</span><span className="text-green-400">Cap Rate {'>'} Mortgage Rate</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Break-Even Rate</span><span className="text-yellow-400 font-bold">{pct(calc.capRate)}</span></div>
          </div>
        </div>

        {/* Leverage Scenarios */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Leverage Scenarios</p>
          <div className="grid grid-cols-2 gap-2">
            {field('Scenario 2 LTV', 'ltv30', '%')}
            {field('Scenario 2 Rate', 'rate30', '%')}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {field('Scenario 3 LTV', 'ltv60', '%')}
            {field('Scenario 3 Rate', 'rate60', '%')}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {field('Scenario 4 LTV', 'ltv80', '%')}
            {field('Scenario 4 Rate', 'rate80', '%')}
          </div>
          <div className="p-3 bg-blue-900/20 border border-blue-700/40 rounded-lg text-xs">
            <p className="text-blue-300 font-semibold mb-1">Positive vs Negative Leverage</p>
            <p className="text-slate-400">Leverage is <span className="text-green-400 font-semibold">positive</span> when cap rate {'>'} interest rate — each dollar borrowed amplifies returns.</p>
            <p className="text-slate-400 mt-1">Leverage is <span className="text-red-400 font-semibold">negative</span> when cap rate {'<'} interest rate — debt service exceeds what the property earns per dollar borrowed.</p>
          </div>
        </div>
      </div>

      {/* Scenario Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {calc.scenarios.map(s => (
          <div key={s.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full" style={{ background: s.color }} />
              <p className="text-xs font-bold text-slate-300 truncate">{s.label}</p>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Cash Invested</span><span className="text-white font-bold">{fmt(s.equity)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Monthly CF</span><span className={s.annualCF > 0 ? 'text-green-400' : 'text-red-400'}>{fmt(s.annualCF / 12)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">CoC Return</span><span className={s.cocReturn > 8 ? 'text-green-400 font-bold' : s.cocReturn > 0 ? 'text-yellow-400' : 'text-red-400 font-bold'}>{s.cocReturn.toFixed(1)}%</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Ann. ROI</span><span className="text-blue-400 font-bold">{s.annualizedROI.toFixed(1)}%</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Total Wealth</span><span className="text-purple-400 font-bold">{fmt(s.exitEquity + s.annualCF * inp.holdYears)}</span></div>
              <div className={`text-center py-1 rounded mt-1 ${s.positiveLeverage || s.ltv === 0 ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'} font-bold`}>
                {s.ltv === 0 ? 'No Leverage' : s.positiveLeverage ? '✓ Positive Leverage' : '✗ Negative Leverage'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Total Wealth Over Time */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Total Wealth (Equity + Cumulative Cash Flow) Over Time</p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={calc.years}>
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {calc.scenarios.map(s => (
              <Line key={s.label} type="monotone" dataKey={s.label} stroke={s.color} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* CoC Return vs LTV */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Cash-on-Cash Return vs LTV</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={calc.cocByLTV}>
              <XAxis dataKey="ltv" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => `${v}% LTV`} />
              <YAxis tickFormatter={v => `${v.toFixed(1)}%`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <ReferenceLine y={0} stroke="#475569" />
              <Bar dataKey="coc" name="Cash-on-Cash %" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Annualized ROI vs LTV</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={calc.cocByLTV}>
              <XAxis dataKey="ltv" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => `${v}% LTV`} />
              <YAxis tickFormatter={v => `${v.toFixed(1)}%`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <ReferenceLine y={0} stroke="#475569" />
              <Bar dataKey="annROI" name="Annualized ROI %" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Leverage Principles</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
          {[
            '📐 Positive leverage: Cap Rate > Mortgage Rate → debt amplifies your equity returns; negative leverage destroys returns',
            '⚠️ Leverage amplifies losses equally — a 20% drop in value wipes 100% of equity at 80% LTV',
            '💰 CoC return jumps with leverage in positive-leverage environments — but total cash flow shrinks with higher debt service',
            '🔁 Capital efficiency: 80% LTV on one deal = controlling 5 properties with the same cash as 1 all-cash deal',
            '📊 Annualized ROI benefits most from appreciation when leveraged — leverage amplifies both cash flow AND equity gains',
            '🏦 Lender debt-coverage requirements (DSCR ≥ 1.20–1.25) effectively cap how much leverage a property can carry',
            '🧮 Break-even rate: when mortgage rate = cap rate, leverage neither helps nor hurts cash flow (before appreciation)',
            '💡 Conservative investors use 60–70% LTV; aggressive investors use 80%+ — risk tolerance must match hold-period plan',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
