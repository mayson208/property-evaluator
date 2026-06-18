import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, Cell } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
function monthlyPmt(bal: number, rate: number, months: number) {
  if (rate === 0 || months === 0) return bal / Math.max(months, 1)
  const r = rate / 100 / 12
  return bal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
}
function remainingBal(principal: number, rate: number, termMonths: number, elapsedMonths: number) {
  const pmt = monthlyPmt(principal, rate, termMonths)
  const r   = rate / 100 / 12
  if (r === 0) return principal - (pmt * elapsedMonths)
  return principal * Math.pow(1 + r, elapsedMonths) - pmt * (Math.pow(1 + r, elapsedMonths) - 1) / r
}

export default function MortgageRecast() {
  const [originalLoan,   setOriginalLoan]   = useState(380000)
  const [currentBalance, setCurrentBalance] = useState(340000)
  const [interestRate,   setInterestRate]   = useState(6.75)
  const [remainingYears, setRemainingYears]  = useState(27)
  const [lumpSum,        setLumpSum]        = useState(50000)
  const [recastFee,      setRecastFee]      = useState(250)    // typical $150-500
  const [refiRate,       setRefiRate]       = useState(6.25)   // available refi rate
  const [refiCosts,      setRefiCosts]      = useState(8000)

  const calc = useMemo(() => {
    const remainingMonths = remainingYears * 12

    // Current situation
    const currentPmt      = monthlyPmt(currentBalance, interestRate, remainingMonths)
    const currentTotalInt = currentPmt * remainingMonths - currentBalance

    // Recast: pay lump sum, same rate and remaining term, new payment on reduced balance
    const recastBalance   = currentBalance - lumpSum
    const recastPmt       = monthlyPmt(recastBalance, interestRate, remainingMonths)
    const recastSaving    = currentPmt - recastPmt
    const recastTotalInt  = recastPmt * remainingMonths - recastBalance
    const recastNetSaving = (currentTotalInt - recastTotalInt) - recastFee  // interest saved minus fee
    const recastBreakEven = recastFee / recastSaving  // months

    // Extra payments (same monthly amount, accelerate payoff)
    // If you put $lumpSum as extra payment and keep paying same $currentPmt
    let extraBal = currentBalance - lumpSum
    let extraMonths = 0
    const extraPmt = currentPmt  // keep same payment
    while (extraBal > 0 && extraMonths < remainingMonths) {
      const interest = extraBal * interestRate / 100 / 12
      extraBal -= (extraPmt - interest)
      extraMonths++
    }
    const extraMonthsSaved = remainingMonths - extraMonths
    const extraTotalInt    = extraPmt * extraMonths - (currentBalance - lumpSum)
    const extraIntSaved    = currentTotalInt - extraTotalInt

    // Refinance: new loan at new rate
    const refiBalance  = currentBalance
    const refiPmt      = monthlyPmt(refiBalance, refiRate, remainingMonths)
    const refiSaving   = currentPmt - refiPmt
    const refiTotalInt = refiPmt * remainingMonths - refiBalance
    const refiIntSaved = currentTotalInt - refiTotalInt - refiCosts
    const refiBreakEven = refiCosts / Math.max(refiSaving, 1)

    // Invest lump sum (8% return instead)
    const investGrowth10yr = lumpSum * Math.pow(1.08, 10)
    const investGrowth30yr = lumpSum * Math.pow(1.08, remainingYears)

    // Chart data: balance decline over time for each scenario
    const chartData = Array.from({ length: remainingYears + 1 }, (_, yr) => {
      const mo = yr * 12
      const current = Math.max(remainingBal(currentBalance, interestRate, remainingMonths, mo), 0)
      const recast  = Math.max(remainingBal(recastBalance, interestRate, remainingMonths, Math.min(mo, remainingMonths)), 0)
      const refi    = Math.max(remainingBal(refiBalance, refiRate, remainingMonths, mo), 0)
      return { yr, Current: Math.round(current), Recast: Math.round(recast), Refinance: Math.round(refi) }
    })

    // Payment comparison bar
    const pmtBar = [
      { name: 'Current',   pmt: Math.round(currentPmt), color: '#64748b' },
      { name: 'Recast',    pmt: Math.round(recastPmt),  color: '#3b82f6' },
      { name: 'Refinance', pmt: Math.round(refiPmt),    color: '#10b981' },
    ]

    return {
      currentPmt, currentTotalInt, recastBalance, recastPmt, recastSaving, recastTotalInt,
      recastNetSaving, recastBreakEven, extraMonths, extraMonthsSaved, extraIntSaved,
      refiPmt, refiSaving, refiTotalInt, refiIntSaved, refiBreakEven, investGrowth10yr,
      chartData, pmtBar,
    }
  }, [originalLoan, currentBalance, interestRate, remainingYears, lumpSum, recastFee, refiRate, refiCosts])

  const Slider = ({ label, value, min, max, step, onChange, prefix = '', suffix = '' }: {
    label: string; value: number; min: number; max: number; step: number;
    onChange: (v: number) => void; prefix?: string; suffix?: string
  }) => (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-xs text-slate-400">{label}</label>
        <span className="text-xs font-bold text-blue-400">{prefix}{value.toLocaleString()}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
    </div>
  )

  const bestStrategy = calc.recastNetSaving > calc.refiIntSaved && calc.recastNetSaving > 0
    ? 'Recast' : calc.refiIntSaved > calc.recastNetSaving && calc.refiSaving > 0 ? 'Refinance' : 'Extra Payments'

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Mortgage Recast Analyzer</h3>
        <p className="text-xs text-slate-500">
          A mortgage recast lets you make a lump-sum principal payment and have your lender recalculate
          (recast) your monthly payment — no credit check, no new loan, just a $150-500 fee.
        </p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Current Mortgage</p>
          <Slider label="Current Balance" value={currentBalance} min={50000} max={2000000} step={5000} onChange={setCurrentBalance} prefix="$" />
          <Slider label="Interest Rate" value={interestRate} min={2} max={10} step={0.125} onChange={setInterestRate} suffix="%" />
          <Slider label="Remaining Term" value={remainingYears} min={1} max={30} step={1} onChange={setRemainingYears} suffix=" yrs" />
          <div className="bg-slate-900/60 rounded-lg p-2 text-xs text-center">
            Current Monthly Payment: <span className="font-black text-blue-400">{fmt(calc.currentPmt)}</span>
          </div>
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest pt-1">Your Lump Sum</p>
          <Slider label="Lump Sum to Apply" value={lumpSum} min={5000} max={500000} step={5000} onChange={setLumpSum} prefix="$" />
          <Slider label="Recast Fee" value={recastFee} min={0} max={1000} step={50} onChange={setRecastFee} prefix="$" />
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Refinance Alternative</p>
          <Slider label="Available Refi Rate" value={refiRate} min={2} max={10} step={0.125} onChange={setRefiRate} suffix="%" />
          <Slider label="Refi Closing Costs" value={refiCosts} min={0} max={25000} step={500} onChange={setRefiCosts} prefix="$" />

          {/* Quick comparison */}
          <div className="space-y-2 pt-2">
            {[
              { label: 'Recast Payment',         val: fmt(calc.recastPmt) + '/mo',    sub: `-${fmt(calc.recastSaving)}/mo saved`,   color: 'text-blue-400' },
              { label: 'Refi Payment',            val: fmt(calc.refiPmt) + '/mo',      sub: `-${fmt(calc.refiSaving)}/mo saved`,     color: 'text-green-400' },
              { label: 'Recast Break-even',      val: Math.round(calc.recastBreakEven) + ' months', sub: 'fee payback',              color: 'text-yellow-400' },
              { label: 'Refi Break-even',        val: Math.round(calc.refiBreakEven) + ' months',   sub: 'closing cost payback',     color: 'text-orange-400' },
            ].map(s => (
              <div key={s.label} className="bg-slate-900/60 rounded-lg px-3 py-2 flex justify-between items-center">
                <div>
                  <p className="text-xs text-slate-400">{s.label}</p>
                  <p className="text-xs text-slate-600">{s.sub}</p>
                </div>
                <p className={`text-sm font-black ${s.color}`}>{s.val}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recommendation */}
      <div className="bg-blue-900/20 border border-blue-700/50 rounded-xl p-4">
        <div className="flex justify-between items-center mb-2">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Recommended Strategy</p>
          <span className="text-lg font-black text-blue-400">{bestStrategy}</span>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center text-xs">
          <div className="bg-slate-900/60 rounded-xl p-3 border border-blue-700/30">
            <p className="text-slate-500 mb-1">Recast: Total Interest Saved</p>
            <p className="text-blue-400 font-black text-base">{fmt(calc.recastNetSaving)}</p>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-3 border border-green-700/30">
            <p className="text-slate-500 mb-1">Refi: Total Interest Saved</p>
            <p className="text-green-400 font-black text-base">{fmt(calc.refiIntSaved)}</p>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-3 border border-purple-700/30">
            <p className="text-slate-500 mb-1">Extra Pmt: Months Saved</p>
            <p className="text-purple-400 font-black text-base">{calc.extraMonthsSaved} mo</p>
          </div>
        </div>
      </div>

      {/* Payment bar chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Monthly Payment Comparison</p>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={calc.pmtBar} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} tickFormatter={v => `$${v.toLocaleString()}`} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number) => [fmt(v) + '/mo', 'Payment']} />
            <Bar dataKey="pmt" radius={[6, 6, 0, 0]}>
              {calc.pmtBar.map((b, i) => <Cell key={i} fill={b.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Balance chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Loan Balance Decline Over Time</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={calc.chartData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="yr" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} label={{ value: 'Years', position: 'insideBottom', fill: '#475569', fontSize: 10 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number) => [fmt(v)]} />
            <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
            <Line type="monotone" dataKey="Current"   stroke="#64748b" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
            <Line type="monotone" dataKey="Recast"    stroke="#3b82f6" strokeWidth={2}   dot={false} />
            <Line type="monotone" dataKey="Refinance" stroke="#10b981" strokeWidth={2}   dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* When to use each */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Recast vs Refinance vs Extra Payments</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <p className="font-bold text-blue-400 mb-2">✓ Recast when:</p>
            <ul className="space-y-1 text-slate-400">
              <li>• Your current rate is at or near market</li>
              <li>• You have a lump sum (inheritance, bonus, sale proceeds)</li>
              <li>• You want a lower payment without a new loan</li>
              <li>• You have a large loan — recast isn't available below ~$50K</li>
              <li>• Your credit or income won't qualify for a refi</li>
            </ul>
          </div>
          <div>
            <p className="font-bold text-green-400 mb-2">✓ Refinance when:</p>
            <ul className="space-y-1 text-slate-400">
              <li>• Rates dropped significantly (0.75%+ from your rate)</li>
              <li>• You want to change your term (15 vs 30 yr)</li>
              <li>• You want to drop PMI via home appreciation</li>
              <li>• You can break even on closing costs within 24-36 months</li>
              <li>• You need cash-out for improvements</li>
            </ul>
          </div>
          <div>
            <p className="font-bold text-purple-400 mb-2">✓ Extra payments when:</p>
            <ul className="space-y-1 text-slate-400">
              <li>• Your lender doesn't allow recasting (FHA, VA, USDA)</li>
              <li>• You want to pay off faster (not just lower the payment)</li>
              <li>• The lump sum is small (under $10K)</li>
              <li>• You want maximum flexibility — you can stop anytime</li>
              <li>• Your lender charges high recast fees</li>
            </ul>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Not all loans are recastable: conventional and jumbo loans typically allow recasting; FHA, VA, and USDA loans do not.
        Contact your servicer to confirm eligibility and the exact fee before sending funds.
      </p>
    </div>
  )
}
