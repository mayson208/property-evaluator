import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, ReferenceLine } from 'recharts'

type NoteType = 'performing' | 'subPerforming' | 'nonPerforming'
type ExitStrategy = 'hold' | 'reperform' | 'foreclose' | 'sellNote'

interface Inputs {
  noteType: NoteType
  originalLoanAmount: number
  currentBalance: number
  propertyValue: number
  interestRate: number
  remainingTermMonths: number
  monthlyPayment: number
  purchasePrice: number
  monthsBehind: number
  exitStrategy: ExitStrategy
  reperformMonths: number
  sellNoteAtPct: number
  foreclosureCost: number
  foreclosureMonths: number
  repairCostAfterForeclosure: number
  arvAfterRepair: number
  discountForResale: number
}

const DEF: Inputs = {
  noteType: 'nonPerforming',
  originalLoanAmount: 180000,
  currentBalance: 142000,
  propertyValue: 195000,
  interestRate: 6.5,
  remainingTermMonths: 240,
  monthlyPayment: 1050,
  purchasePrice: 85000,
  monthsBehind: 14,
  exitStrategy: 'reperform',
  reperformMonths: 6,
  sellNoteAtPct: 80,
  foreclosureCost: 8500,
  foreclosureMonths: 12,
  repairCostAfterForeclosure: 25000,
  arvAfterRepair: 195000,
  discountForResale: 10,
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const pct = (n: number) => `${n.toFixed(2)}%`
const N = (v: string) => parseFloat(v) || 0

export default function NoteInvesting() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = (k: keyof Inputs, v: string | NoteType | ExitStrategy) =>
    setInp(p => ({ ...p, [k]: typeof DEF[k] === 'number' ? N(v as string) : v }))

  const calc = useMemo(() => {
    const { currentBalance, propertyValue, interestRate, remainingTermMonths,
            monthlyPayment, purchasePrice, exitStrategy,
            reperformMonths, sellNoteAtPct, foreclosureCost, foreclosureMonths,
            repairCostAfterForeclosure, arvAfterRepair, discountForResale } = inp

    // Basic ratios
    const ltv = currentBalance / propertyValue * 100
    const purchaseToBal = purchasePrice / currentBalance * 100
    const purchaseToValue = purchasePrice / propertyValue * 100
    const equity = propertyValue - currentBalance
    const discount = (1 - purchasePrice / currentBalance) * 100

    // Yield if performing (hold to maturity)
    const r = interestRate / 100 / 12
    const calcYield = () => {
      if (monthlyPayment <= 0 || remainingTermMonths <= 0) return 0
      // IRR: pmt stream vs purchase price
      let rate = 0.01
      for (let i = 0; i < 100; i++) {
        const pv = monthlyPayment * (1 - Math.pow(1 + rate, -remainingTermMonths)) / rate
        const diff = pv - purchasePrice
        if (Math.abs(diff) < 1) break
        rate += diff > 0 ? 0.0001 : -0.0001
        rate = Math.max(0.0001, rate)
      }
      return rate * 12 * 100
    }
    const holdYield = calcYield()

    // Amortization schedule
    interface AmorRow { month: number; payment: number; interest: number; principal: number; balance: number; cumProfit: number }
    const schedule: AmorRow[] = []
    let bal = currentBalance
    let cumProfit = -purchasePrice
    for (let m = 1; m <= Math.min(remainingTermMonths, 360); m++) {
      const interest = bal * r
      const principal = Math.min(monthlyPayment - interest, bal)
      bal = Math.max(0, bal - principal)
      cumProfit += monthlyPayment
      schedule.push({ month: m, payment: monthlyPayment, interest, principal, balance: bal, cumProfit })
      if (bal <= 0) break
    }
    const breakEvenMonth = schedule.find(r2 => r2.cumProfit >= 0)?.month ?? 0

    // Exit analysis
    let exitProfit = 0
    let exitROI = 0
    let exitNotes: string[] = []

    if (exitStrategy === 'hold') {
      const totalPmts = monthlyPayment * remainingTermMonths
      exitProfit = totalPmts - purchasePrice
      exitROI = exitProfit / purchasePrice * 100
      exitNotes = [`Collect ${fmt(monthlyPayment)}/mo for ${remainingTermMonths} months`, `Total collected: ${fmt(totalPmts)}`]
    } else if (exitStrategy === 'reperform') {
      const modifiedBalance = currentBalance
      const totalAfterReperform = monthlyPayment * (remainingTermMonths - reperformMonths) + monthlyPayment * reperformMonths * 0.25
      exitProfit = totalAfterReperform - purchasePrice
      exitROI = exitProfit / purchasePrice * 100
      exitNotes = [`Work with borrower for ${reperformMonths} months to reperform`, `Partial payments during modification period`, `Full payments resume → sell or hold at premium`]
    } else if (exitStrategy === 'sellNote') {
      const salePrice = currentBalance * sellNoteAtPct / 100
      exitProfit = salePrice - purchasePrice
      exitROI = exitProfit / purchasePrice * 100
      exitNotes = [`Sell reperformed note at ${sellNoteAtPct}¢ on the dollar`, `Note sale price: ${fmt(salePrice)}`, `Annualized return depends on hold time`]
    } else if (exitStrategy === 'foreclose') {
      const salePrice = arvAfterRepair * (1 - discountForResale / 100)
      const agentFees = salePrice * 0.06
      exitProfit = salePrice - agentFees - repairCostAfterForeclosure - foreclosureCost - purchasePrice
      exitROI = exitProfit / purchasePrice * 100
      const holdMonths = foreclosureMonths + 3
      exitNotes = [
        `Foreclose in ~${foreclosureMonths} months (state timeline varies)`,
        `Repair cost: ${fmt(repairCostAfterForeclosure)}`,
        `Legal/process fees: ${fmt(foreclosureCost)}`,
        `Sell REO at ${100 - discountForResale}% ARV`,
      ]
    }

    // Scenario comparison
    const scenarioData = [
      { name: 'Hold', profit: (monthlyPayment * remainingTermMonths - purchasePrice) },
      { name: 'Sell Note', profit: (currentBalance * sellNoteAtPct / 100 - purchasePrice) },
      { name: 'Foreclose', profit: (arvAfterRepair * (1 - discountForResale / 100) * 0.94 - repairCostAfterForeclosure - foreclosureCost - purchasePrice) },
    ]

    // Chart: cumulative profit over first 60 months
    const profitChart = schedule.slice(0, 60).map(r2 => ({
      month: r2.month,
      cumProfit: r2.cumProfit,
    }))

    return {
      ltv, purchaseToBal, purchaseToValue, equity, discount,
      holdYield, schedule, breakEvenMonth,
      exitProfit, exitROI, exitNotes,
      scenarioData, profitChart,
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

  const noteTypeColors: Record<NoteType, string> = {
    performing: 'text-green-400',
    subPerforming: 'text-yellow-400',
    nonPerforming: 'text-red-400',
  }

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-lg font-bold text-white">Mortgage Note Investing</h2>
        <p className="text-slate-400 text-xs mt-1">Analyze buying discounted mortgage notes — performing, sub-performing, and non-performing — with exit strategy modeling</p>
      </div>

      {/* Note Type */}
      <div className="flex gap-2">
        {([['performing', '✅ Performing'], ['subPerforming', '⚠️ Sub-Performing'], ['nonPerforming', '🔴 Non-Performing']] as [NoteType, string][]).map(([t, label]) => (
          <button key={t} onClick={() => set('noteType', t)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${inp.noteType === t ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Note Details</p>
          {field('Original Loan Amount', 'originalLoanAmount', '$')}
          {field('Current Unpaid Balance', 'currentBalance', '$')}
          {field('Property Value (BPO)', 'propertyValue', '$')}
          {field('Note Interest Rate', 'interestRate', '', '%', '0.125')}
          {field('Remaining Term', 'remainingTermMonths', '', 'months')}
          {field('Contractual Monthly Payment', 'monthlyPayment', '$')}
          {inp.noteType !== 'performing' && field('Months Behind', 'monthsBehind', '', 'mo')}
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Purchase Terms</p>
          {field('Note Purchase Price', 'purchasePrice', '$')}
          <div className="p-3 bg-slate-900/50 rounded-lg space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Discount to UPB</span>
              <span className="text-orange-400 font-bold">{calc.discount.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Purchase / UPB</span>
              <span className="text-slate-300">{calc.purchaseToBal.toFixed(1)}¢ on $</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Purchase / Value</span>
              <span className="text-slate-300">{calc.purchaseToValue.toFixed(1)}% of BPO</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Borrower Equity</span>
              <span className={`font-bold ${calc.equity > 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(calc.equity)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">LTV</span>
              <span className={`font-bold ${calc.ltv < 80 ? 'text-green-400' : calc.ltv < 95 ? 'text-yellow-400' : 'text-red-400'}`}>{pct(calc.ltv)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Hold Yield (IRR)</span>
              <span className="text-purple-400 font-bold">{pct(calc.holdYield)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Break-Even Month</span>
              <span className="text-blue-400 font-bold">Month {calc.breakEvenMonth}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Exit Strategy</p>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Exit Plan</label>
            <select value={inp.exitStrategy} onChange={e => set('exitStrategy', e.target.value as ExitStrategy)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
              <option value="hold">Hold to Maturity</option>
              <option value="reperform">Re-Perform &amp; Hold</option>
              <option value="sellNote">Sell Reperformed Note</option>
              <option value="foreclose">Foreclose &amp; REO</option>
            </select>
          </div>
          {inp.exitStrategy === 'reperform' && field('Months to Reperform', 'reperformMonths', '', 'mo')}
          {inp.exitStrategy === 'sellNote' && field('Sell Note At', 'sellNoteAtPct', '', '¢ on $')}
          {inp.exitStrategy === 'foreclose' && <>
            {field('Foreclosure Cost', 'foreclosureCost', '$')}
            {field('Foreclosure Timeline', 'foreclosureMonths', '', 'months')}
            {field('Repair Cost (REO)', 'repairCostAfterForeclosure', '$')}
            {field('ARV After Repair', 'arvAfterRepair', '$')}
            {field('Resale Discount', 'discountForResale', '', '%')}
          </>}
        </div>
      </div>

      {/* Exit Result Banner */}
      <div className={`rounded-xl p-5 border ${calc.exitProfit > 0 ? 'bg-green-900/20 border-green-700/40' : 'bg-red-900/20 border-red-700/40'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-widest">Exit Profit</p>
            <p className={`text-3xl font-black mt-1 ${calc.exitProfit > 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(calc.exitProfit)}</p>
            <p className="text-sm text-slate-400 mt-1">ROI: <span className={`font-bold ${calc.exitROI > 0 ? 'text-green-400' : 'text-red-400'}`}>{pct(calc.exitROI)}</span></p>
          </div>
          <div className="space-y-1">
            {calc.exitNotes.map((n2, i) => (
              <div key={i} className="flex gap-2 text-xs text-slate-400">
                <span className="text-blue-400">→</span>
                <span>{n2}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scenario Comparison */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Exit Strategy Comparison</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={calc.scenarioData}>
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <ReferenceLine y={0} stroke="#475569" />
            <Bar dataKey="profit" name="Profit" radius={[4, 4, 0, 0]}
              fill="#3b82f6"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Cumulative Profit Chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Cumulative Profit (If Held — First 60 Months)</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={calc.profitChart}>
            <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} label={{ value: 'Month', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 10 }} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} labelFormatter={v => `Month ${v}`} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 2" label={{ value: 'Break-even', fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }} />
            <Line type="monotone" dataKey="cumProfit" stroke="#22c55e" strokeWidth={2} dot={false} name="Cumulative Profit" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Due Diligence */}
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Note Investing Due Diligence</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { icon: '📋', text: 'Order a Broker Price Opinion (BPO) or drive-by appraisal on the underlying property' },
            { icon: '🔍', text: 'Pull a title search — verify lien position, no unrecorded liens or HOA priority claims' },
            { icon: '📄', text: 'Review the original promissory note and deed of trust — confirm they are complete and recordable' },
            { icon: '🗓', text: 'Request 12-24 months payment history + any prior modification agreements' },
            { icon: '⚖️', text: 'Check state foreclosure timeline — judicial (12-24 mo) vs non-judicial (3-6 mo) dramatically affects NPL strategy' },
            { icon: '🏦', text: 'Verify loan servicer transfer requirements — some loans have servicing restrictions on transfer' },
            { icon: '💼', text: 'IRA/QRP purchases: confirm custodian allows note investments and will hold the collateral' },
            { icon: '🔒', text: 'Secure an assignment of mortgage/deed of trust + allonge on the note at closing' },
          ].map(t => (
            <div key={t.icon} className="flex gap-2 text-xs text-slate-400">
              <span className="mt-0.5">{t.icon}</span>
              <span>{t.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
