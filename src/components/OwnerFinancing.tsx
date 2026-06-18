import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, Cell } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
function fmtPct(n: number) { return `${n.toFixed(2)}%` }

function monthlyPmt(principal: number, annualRate: number, termYears: number) {
  const r = annualRate / 100 / 12
  const n = termYears * 12
  if (r === 0 || n === 0) return 0
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

function calcBalance(loan: number, rate: number, term: number, monthsPaid: number): number {
  const r = rate / 100 / 12
  const n = term * 12
  if (r === 0) return Math.max(0, loan - (loan / n) * monthsPaid)
  const pmt = loan * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  return loan * Math.pow(1 + r, monthsPaid) - pmt * (Math.pow(1 + r, monthsPaid) - 1) / r
}

export default function OwnerFinancing() {
  const { result, input, interestRate } = usePropertyStore()

  const homeVal = result?.estimatedValue ?? 400000

  // Deal terms
  const [salePrice,      setSalePrice]      = useState(homeVal)
  const [downPct,        setDownPct]        = useState(10)
  const [sellerRate,     setSellerRate]     = useState(Math.min(8, interestRate + 1))  // seller charges higher rate
  const [termYrs,        setTermYrs]        = useState(30)
  const [balloonYrs,     setBalloonYrs]     = useState(5)  // 0 = no balloon
  const [hasBalloon,     setHasBalloon]     = useState(true)
  const [dueOnSale,      setDueOnSale]      = useState(false)  // seller has existing mortgage

  // Seller's existing mortgage (if any)
  const [sellerLoanBal,  setSellerLoanBal]  = useState(Math.round(homeVal * 0.3))
  const [sellerLoanRate, setSellerLoanRate] = useState(interestRate - 0.5)
  const [sellerLoanMo,   setSellerLoanMo]   = useState(0)  // months remaining
  const [hasSellerLoan,  setHasSellerLoan]  = useState(false)

  // Conventional alternative
  const [convRate,       setConvRate]       = useState(interestRate)

  const analysis = useMemo(() => {
    const downDollar    = salePrice * downPct / 100
    const loanAmount    = salePrice - downDollar
    const monthly       = monthlyPmt(loanAmount, sellerRate, termYrs)
    const balloonBalance = hasBalloon ? calcBalance(loanAmount, sellerRate, termYrs, balloonYrs * 12) : 0
    const totalInterestFull = monthly * termYrs * 12 - loanAmount
    const totalInterestToBalloon = hasBalloon ? (monthly * balloonYrs * 12 - (loanAmount - balloonBalance)) : totalInterestFull

    // Seller's perspective: yield on capital deployed
    const sellerNetInvested = loanAmount - (hasSellerLoan ? sellerLoanBal : 0)
    const sellerYield       = sellerRate  // approx — they earn the rate

    // Conventional comparison
    const convMonthly   = monthlyPmt(loanAmount, convRate, 30)
    const monthlySavings = convMonthly - monthly  // positive = conv more expensive

    // Seller's monthly income
    const sellerExistingPmt = hasSellerLoan ? monthlyPmt(sellerLoanBal, sellerLoanRate, 30 - sellerLoanMo / 12) : 0
    const sellerNetMonthly  = monthly - sellerExistingPmt

    // Year-by-year amortization
    const maxYrs = hasBalloon ? balloonYrs : termYrs
    const chartData = Array.from({ length: maxYrs + 1 }, (_, yr) => {
      const balance  = yr === 0 ? loanAmount : calcBalance(loanAmount, sellerRate, termYrs, yr * 12)
      const equity   = salePrice - balance
      const cumInt   = monthly * yr * 12 - (loanAmount - balance)
      return { yr, balance: Math.round(balance), equity: Math.round(equity), cumInt: Math.round(cumInt) }
    })

    const installmentSaleTax = loanAmount * 0.20  // rough capital gains spread over term (simplified)

    return {
      downDollar, loanAmount, monthly, balloonBalance, totalInterestFull, totalInterestToBalloon,
      sellerNetInvested, sellerYield, convMonthly, monthlySavings,
      sellerExistingPmt, sellerNetMonthly, chartData, installmentSaleTax,
    }
  }, [salePrice, downPct, sellerRate, termYrs, balloonYrs, hasBalloon, hasSellerLoan, sellerLoanBal, sellerLoanRate, sellerLoanMo, convRate])

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Owner / Seller Financing</h3>
        <p className="text-xs text-slate-500">
          Model a seller-carried note (land contract / installment sale). Analyze from both buyer and seller
          perspectives — monthly payments, balloon, seller yield, and installment tax benefits.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Seller-Carried Note',   value: fmt(analysis.loanAmount),    color: 'text-white' },
          { label: 'Monthly Payment',        value: fmt(analysis.monthly),        color: 'text-blue-400' },
          { label: 'vs Conventional',        value: `${analysis.monthlySavings >= 0 ? '-' : '+'}${fmt(Math.abs(analysis.monthlySavings))}/mo`, color: analysis.monthlySavings >= 0 ? 'text-green-400' : 'text-red-400' },
          { label: hasBalloon ? `Balloon at Yr ${balloonYrs}` : 'Full Amort', value: hasBalloon ? fmt(analysis.balloonBalance) : '—', color: 'text-yellow-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Deal Terms (Buyer's View)</p>
          {[
            { label: 'Sale Price',         value: salePrice,   min: 50000, max: 5000000, step: 5000,  set: setSalePrice,   fmt: fmt },
            { label: 'Down Payment %',     value: downPct,     min: 0,     max: 40,      step: 1,     set: setDownPct,     fmt: (v: number) => `${v}% = ${fmt(salePrice * v / 100)}` },
            { label: 'Seller\'s Note Rate',value: sellerRate,  min: 4,     max: 15,      step: 0.25,  set: setSellerRate,  fmt: (v: number) => `${v.toFixed(2)}%` },
            { label: 'Amortization Term',  value: termYrs,     min: 5,     max: 30,      step: 5,     set: setTermYrs,     fmt: (v: number) => `${v} yr` },
            { label: 'Conventional Rate',  value: convRate,    min: 3,     max: 12,      step: 0.125, set: setConvRate,    fmt: (v: number) => `${v.toFixed(3)}% (bank)` },
          ].map(s => (
            <div key={s.label}>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-slate-400 uppercase tracking-widest">{s.label}</label>
                <span className="text-xs font-bold text-blue-400">{s.fmt(s.value)}</span>
              </div>
              <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                onChange={e => s.set(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
            </div>
          ))}

          <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 pt-1">
            <div className={`w-10 h-5 rounded-full cursor-pointer ${hasBalloon ? 'bg-yellow-600' : 'bg-slate-700'}`}
              onClick={() => setHasBalloon(!hasBalloon)}>
              <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${hasBalloon ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
            Balloon payment required
          </label>

          {hasBalloon && (
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-slate-400 uppercase tracking-widest">Balloon Due At Year</label>
                <span className="text-xs font-bold text-yellow-400">{balloonYrs} yr ({fmt(analysis.balloonBalance)} due)</span>
              </div>
              <input type="range" min={1} max={termYrs - 1} step={1} value={balloonYrs}
                onChange={e => setBalloonYrs(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-yellow-400" />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Seller's Existing Mortgage</p>
              <div className={`w-10 h-5 rounded-full cursor-pointer ${hasSellerLoan ? 'bg-purple-600' : 'bg-slate-700'}`}
                onClick={() => setHasSellerLoan(!hasSellerLoan)}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${hasSellerLoan ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
            </div>
            {hasSellerLoan && (
              <div className="space-y-3">
                {[
                  { label: 'Remaining Balance',  value: sellerLoanBal,  min: 0, max: salePrice * 0.9, step: 5000, set: setSellerLoanBal, fmt: fmt },
                  { label: 'Seller\'s Rate',     value: sellerLoanRate, min: 2, max: 10,  step: 0.125, set: setSellerLoanRate, fmt: (v: number) => `${v.toFixed(3)}%` },
                ].map(s => (
                  <div key={s.label}>
                    <div className="flex justify-between mb-1">
                      <label className="text-xs text-slate-400 uppercase tracking-widest">{s.label}</label>
                      <span className="text-xs font-bold text-purple-400">{s.fmt(s.value)}</span>
                    </div>
                    <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                      onChange={e => s.set(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-purple-500" />
                  </div>
                ))}
                <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-lg p-2 text-xs text-yellow-400">
                  ⚠️ Due-on-sale clause: most conventional mortgages require full payoff on transfer.
                  Check if seller's loan has this clause before proceeding.
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Seller's Perspective</p>
            <div className="space-y-1.5 text-xs">
              {[
                { label: 'Note amount (seller finances)', value: fmt(analysis.loanAmount) },
                { label: 'Note interest rate',           value: fmtPct(sellerRate) },
                { label: 'Monthly note income',          value: fmt(analysis.monthly) },
                hasSellerLoan ? { label: 'Less: existing mortgage pmt', value: `-${fmt(analysis.sellerExistingPmt)}` } : null,
                { label: 'Net monthly income',           value: fmt(analysis.sellerNetMonthly), bold: true },
                { label: `Total interest earned (${hasBalloon ? `${balloonYrs}yr to balloon` : `${termYrs}yr full`})`, value: fmt(hasBalloon ? analysis.totalInterestToBalloon : analysis.totalInterestFull) },
              ].filter(Boolean).map((r: any) => (
                <div key={r.label} className={`flex justify-between ${r.bold ? 'border-t border-slate-700 pt-1 font-bold text-green-400' : ''}`}>
                  <span className="text-slate-500">{r.label}</span>
                  <span className={r.bold ? 'text-green-400' : 'text-slate-300'}>{r.value}</span>
                </div>
              ))}
            </div>

            <div className="mt-3 bg-blue-900/20 border border-blue-700/40 rounded-lg p-3 text-xs text-slate-400">
              <strong className="text-blue-400">Installment Sale Tax Benefit:</strong>{' '}
              Seller may spread capital gains taxes across payment years instead of paying all in year of sale.
              Consult a CPA for IRS installment sale rules (IRC §453).
            </div>
          </div>
        </div>
      </div>

      {/* Amortization chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">
          Loan Balance & Equity {hasBalloon ? `(to balloon at Year ${balloonYrs})` : `Over ${termYrs} Years`}
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={analysis.chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="gradBal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="gradEq" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="yr" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false}
              label={{ value: 'Year', position: 'insideBottom', offset: -3, fill: '#64748b', fontSize: 10 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} width={55} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number, n: string) => [fmt(v), n === 'balance' ? 'Loan Balance' : n === 'equity' ? 'Equity' : 'Cumul. Interest']} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
            <Area type="monotone" dataKey="balance" stroke="#ef4444" fill="url(#gradBal)" strokeWidth={2} name="balance" />
            <Area type="monotone" dataKey="equity"  stroke="#22c55e" fill="url(#gradEq)"  strokeWidth={2} name="equity" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Owner Financing Key Points</p>
        <div className="space-y-1.5 text-xs text-slate-400">
          {[
            '📝 A real estate attorney must draft the promissory note and security agreement / deed of trust.',
            '🏦 Seller financing bypasses traditional underwriting — great for buyers with non-standard income or recent credit events.',
            '⚠️ Due-on-sale clauses in the seller\'s existing mortgage may require payoff — verify before structuring the deal.',
            '💰 Seller earns a higher rate than bank savings while buyer gets financing without conventional qualification.',
            '🎯 Balloon payments are common — buyer must refinance or sell before the balloon date.',
            '📊 Installment sale (IRC §453) lets seller spread capital gains tax across years received — significant for high-gain properties.',
            '🔒 Title transfers at closing in a contract for deed/land contract in some states; in others, title transfers only after full payoff.',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Owner financing structures vary significantly by state. Always use a licensed real estate attorney
        and consult a CPA regarding installment sale tax treatment.
      </p>
    </div>
  )
}
