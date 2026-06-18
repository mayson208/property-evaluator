import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts'

interface Inputs {
  loanAmount: number
  arv: number
  purchasePrice: number
  rehabCost: number
  interestRate: number
  loanTermMonths: number
  points: number
  originationFee: number
  appraisalFee: number
  processingFee: number
  exitStrategy: 'flip' | 'refi' | 'sellNote'
  flipSalePrice: number
  flipAgentPct: number
  refiRate: number
  refiTermYears: number
  noteDiscount: number
}

const DEF: Inputs = {
  loanAmount: 200000,
  arv: 320000,
  purchasePrice: 180000,
  rehabCost: 60000,
  interestRate: 11,
  loanTermMonths: 12,
  points: 2,
  originationFee: 1500,
  appraisalFee: 600,
  processingFee: 500,
  exitStrategy: 'flip',
  flipSalePrice: 320000,
  flipAgentPct: 6,
  refiRate: 7.25,
  refiTermYears: 30,
  noteDiscount: 15,
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const pct = (n: number) => `${n.toFixed(2)}%`
const N = (v: string) => parseFloat(v) || 0

function n(v: string) { return N(v) }

export default function PrivateLendingCalc() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = (k: keyof Inputs, v: string | 'flip' | 'refi' | 'sellNote') =>
    setInp(p => ({ ...p, [k]: typeof DEF[k] === 'number' ? N(v as string) : v }))

  const calc = useMemo(() => {
    const { loanAmount, arv, purchasePrice, rehabCost, interestRate, loanTermMonths,
            points, originationFee, appraisalFee, processingFee,
            exitStrategy, flipSalePrice, flipAgentPct, refiRate, refiTermYears, noteDiscount } = inp

    const totalCost = purchasePrice + rehabCost
    const ltvPurchase = loanAmount / purchasePrice * 100
    const ltvArv = loanAmount / arv * 100
    const ltvAIV = loanAmount / totalCost * 100

    // Lender income
    const pointsFee = loanAmount * points / 100
    const totalOrigination = pointsFee + originationFee + appraisalFee + processingFee
    const monthlyInterest = loanAmount * (interestRate / 100) / 12
    const totalInterest = monthlyInterest * loanTermMonths
    const grossLenderIncome = totalOrigination + totalInterest

    // APR (simplified — all fees amortized over term)
    const allFees = totalOrigination
    const netProceeds = loanAmount - allFees
    // monthly rate that yields loanAmount payments from netProceeds
    let aprMonthly = (interestRate / 100) / 12
    for (let i = 0; i < 50; i++) {
      const r = aprMonthly
      const pmt = monthlyInterest
      const pv = pmt * (1 - Math.pow(1 + r, -loanTermMonths)) / r
      const diff = pv - netProceeds
      if (Math.abs(diff) < 0.01) break
      aprMonthly += diff > 0 ? 0.0001 : -0.0001
    }
    const apr = aprMonthly * 12 * 100

    // Yield on capital deployed (lender perspective)
    const yieldOnCapital = (grossLenderIncome / loanAmount) * 100

    // Borrower costs
    const totalBorrowerCost = totalOrigination + totalInterest
    const effectiveCostPct = totalBorrowerCost / loanAmount * 100

    // Exit analysis
    let exitProfit = 0
    let exitLabel = ''
    if (exitStrategy === 'flip') {
      const agentFee = flipSalePrice * flipAgentPct / 100
      const closingCosts = flipSalePrice * 0.015
      exitProfit = flipSalePrice - totalCost - totalBorrowerCost - agentFee - closingCosts
      exitLabel = 'Net flip profit after all costs'
    } else if (exitStrategy === 'refi') {
      const rate = refiRate / 100 / 12
      const n2 = refiTermYears * 12
      const refiPayment = arv * 0.75 * rate / (1 - Math.pow(1 + rate, -n2))
      const equityKept = arv * 0.25 - (totalCost - loanAmount)
      exitProfit = refiPayment * 12 // annual cashflow potential
      exitLabel = `Refi payment: ${fmt(refiPayment)}/mo | Equity retained: ${fmt(equityKept)}`
    } else {
      const noteValue = loanAmount * (1 - noteDiscount / 100)
      const remainingBalance = loanAmount // simplified: no amortization on interest-only
      exitProfit = noteValue
      exitLabel = `Note sold at ${100 - noteDiscount}¢ on the dollar`
    }

    // Risk ratios
    const cushion = arv - loanAmount
    const cushionPct = cushion / arv * 100

    // Monthly interest schedule
    const schedule = Array.from({ length: loanTermMonths }, (_, i) => ({
      month: i + 1,
      interest: monthlyInterest,
      cumulative: monthlyInterest * (i + 1),
      balance: loanAmount,
    }))

    // Comparable financing
    const bankRate = 7.25
    const bankMonthlyPmt = loanAmount * (bankRate / 100 / 12) / (1 - Math.pow(1 + bankRate / 100 / 12, -360))
    const bankTotalInterest = bankMonthlyPmt * 360 - loanAmount
    const bankCostDuringTerm = bankMonthlyPmt * loanTermMonths
    const hardMoneyPremium = totalBorrowerCost - bankCostDuringTerm

    return {
      ltvPurchase, ltvArv, ltvAIV, pointsFee, totalOrigination,
      monthlyInterest, totalInterest, grossLenderIncome, apr, yieldOnCapital,
      totalBorrowerCost, effectiveCostPct, exitProfit, exitLabel,
      cushion, cushionPct, schedule, bankMonthlyPmt, bankTotalInterest,
      bankCostDuringTerm, hardMoneyPremium, netProceeds,
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

  const ltvColor = (v: number) => v <= 65 ? 'text-green-400' : v <= 75 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-lg font-bold text-white">Private / Hard Money Lending</h2>
        <p className="text-slate-400 text-xs mt-1">Analyze private loans from both lender and borrower perspectives — costs, yield, LTV, and exit strategy</p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Deal */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">The Deal</p>
          {field('Loan Amount', 'loanAmount', '$')}
          {field('Purchase Price', 'purchasePrice', '$')}
          {field('Rehab Budget', 'rehabCost', '$')}
          {field('After Repair Value (ARV)', 'arv', '$')}
        </div>

        {/* Loan Terms */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Loan Terms</p>
          {field('Interest Rate', 'interestRate', '', '%', '0.25')}
          {field('Loan Term', 'loanTermMonths', '', 'months')}
          {field('Points', 'points', '', 'pts', '0.25')}
          {field('Origination Fee', 'originationFee', '$')}
          {field('Appraisal Fee', 'appraisalFee', '$')}
          {field('Processing Fee', 'processingFee', '$')}
        </div>

        {/* Exit Strategy */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Exit Strategy</p>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Borrower Exit</label>
            <select
              value={inp.exitStrategy}
              onChange={e => set('exitStrategy', e.target.value as 'flip' | 'refi' | 'sellNote')}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="flip">Fix &amp; Flip</option>
              <option value="refi">Refinance (BRRRR)</option>
              <option value="sellNote">Lender Sells Note</option>
            </select>
          </div>
          {inp.exitStrategy === 'flip' && <>
            {field('Target Sale Price', 'flipSalePrice', '$')}
            {field('Agent Commission', 'flipAgentPct', '', '%', '0.5')}
          </>}
          {inp.exitStrategy === 'refi' && <>
            {field('Refi Rate', 'refiRate', '', '%', '0.125')}
            {field('Refi Term', 'refiTermYears', '', 'yrs')}
          </>}
          {inp.exitStrategy === 'sellNote' && <>
            {field('Note Discount', 'noteDiscount', '', '%')}
          </>}
        </div>
      </div>

      {/* LTV Cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'LTV / Purchase', value: calc.ltvPurchase, note: 'Lender benchmark: ≤70%' },
          { label: 'LTV / ARV', value: calc.ltvArv, note: 'Hard money max: 70% ARV' },
          { label: 'LTV / All-In Cost', value: calc.ltvAIV, note: 'Total deal exposure' },
        ].map(c => (
          <div key={c.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
            <p className={`text-2xl font-black ${ltvColor(c.value)}`}>{pct(c.value)}</p>
            <p className="text-xs font-semibold text-slate-300 mt-1">{c.label}</p>
            <p className="text-xs text-slate-500 mt-0.5">{c.note}</p>
          </div>
        ))}
      </div>

      {/* Lender Income Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Lender Income</p>
          <div className="space-y-2">
            {[
              { label: 'Points', value: calc.pointsFee },
              { label: 'Origination Fee', value: inp.originationFee },
              { label: 'Appraisal Fee', value: inp.appraisalFee },
              { label: 'Processing Fee', value: inp.processingFee },
            ].map(r => (
              <div key={r.label} className="flex justify-between text-xs">
                <span className="text-slate-400">{r.label}</span>
                <span className="text-slate-200 font-semibold">{fmt(r.value)}</span>
              </div>
            ))}
            <div className="border-t border-slate-600 pt-2 flex justify-between text-xs">
              <span className="text-slate-400">Total Origination</span>
              <span className="text-yellow-400 font-bold">{fmt(calc.totalOrigination)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Monthly Interest</span>
              <span className="text-slate-200 font-semibold">{fmt(calc.monthlyInterest)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Total Interest ({inp.loanTermMonths} mo)</span>
              <span className="text-slate-200 font-semibold">{fmt(calc.totalInterest)}</span>
            </div>
            <div className="border-t border-slate-600 pt-2 flex justify-between">
              <span className="text-sm font-bold text-white">Gross Lender Income</span>
              <span className="text-green-400 font-black text-sm">{fmt(calc.grossLenderIncome)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Yield on Capital</span>
              <span className="text-green-400 font-bold">{pct(calc.yieldOnCapital)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Effective APR</span>
              <span className="text-blue-400 font-bold">{pct(calc.apr)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">ARV Cushion (Lender Safety)</span>
              <span className={`font-bold ${calc.cushionPct > 30 ? 'text-green-400' : calc.cushionPct > 20 ? 'text-yellow-400' : 'text-red-400'}`}>
                {fmt(calc.cushion)} ({pct(calc.cushionPct)})
              </span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Borrower Cost Summary</p>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Net Loan Proceeds</span>
              <span className="text-slate-200 font-semibold">{fmt(calc.netProceeds)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Total Origination Costs</span>
              <span className="text-red-400 font-semibold">{fmt(calc.totalOrigination)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Total Interest</span>
              <span className="text-red-400 font-semibold">{fmt(calc.totalInterest)}</span>
            </div>
            <div className="border-t border-slate-600 pt-2 flex justify-between">
              <span className="text-sm font-bold text-white">Total Borrower Cost</span>
              <span className="text-red-400 font-black text-sm">{fmt(calc.totalBorrowerCost)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Effective Cost %</span>
              <span className="text-red-400 font-bold">{pct(calc.effectiveCostPct)}</span>
            </div>
            <div className="border-t border-slate-600 pt-2 space-y-1">
              <p className="text-xs text-slate-400 font-semibold">vs Conventional Bank Loan</p>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Bank payment ({inp.loanTermMonths} mo)</span>
                <span className="text-slate-200">{fmt(calc.bankCostDuringTerm)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Hard Money Premium</span>
                <span className="text-orange-400 font-bold">{fmt(calc.hardMoneyPremium)}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Speed, no-income-doc access, and rehab financing justify the premium for the right deal</p>
            </div>
          </div>
        </div>
      </div>

      {/* Exit Analysis */}
      <div className={`rounded-xl p-4 border ${calc.exitProfit > 0 ? 'bg-green-900/20 border-green-700/40' : 'bg-red-900/20 border-red-700/40'}`}>
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-1">Exit Analysis</p>
        <p className="text-2xl font-black text-white">{inp.exitStrategy === 'refi' ? '' : fmt(calc.exitProfit)}</p>
        <p className={`text-sm font-semibold mt-1 ${calc.exitProfit > 0 ? 'text-green-400' : 'text-red-400'}`}>{calc.exitLabel}</p>
      </div>

      {/* Interest Schedule Chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Cumulative Interest Earned (Lender)</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={calc.schedule}>
            <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} label={{ value: 'Month', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 10 }} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} labelFormatter={v => `Month ${v}`} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Line type="monotone" dataKey="cumulative" stroke="#22c55e" strokeWidth={2} dot={false} name="Cumulative Interest" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Income Breakdown Bar */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Lender Income Breakdown</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={[
            { name: 'Points', value: calc.pointsFee },
            { name: 'Orig Fees', value: inp.originationFee + inp.appraisalFee + inp.processingFee },
            { name: 'Interest', value: calc.totalInterest },
          ]} layout="vertical">
            <XAxis type="number" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={65} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tips */}
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Private Lending Guidelines</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { icon: '🏠', text: 'Never lend above 70% ARV — this gives 30% equity cushion for foreclosure scenarios' },
            { icon: '📋', text: 'Use title insurance and record a first-position deed of trust; confirm no senior liens' },
            { icon: '💼', text: 'Vet the borrower\'s track record: comps sold, holding period, cost overruns on prior deals' },
            { icon: '📅', text: 'Extension fees (1-2 pts/mo) protect lenders when borrowers miss the payoff deadline' },
            { icon: '⚠️', text: 'Hard money is interest-only; no principal paid down — full balloon due at term' },
            { icon: '🔒', text: 'Require personal guarantee + cross-collateralization on experienced borrower deals' },
          ].map(t => (
            <div key={t.icon} className="flex gap-2 text-xs text-slate-400">
              <span>{t.icon}</span>
              <span>{t.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
