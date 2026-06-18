import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, AreaChart, Area, defs, linearGradient } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function monthlyPmt(principal: number, annualRate: number, termMonths: number) {
  if (annualRate === 0) return principal / termMonths
  const r = annualRate / 100 / 12
  return principal * (r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1)
}

export default function PMIRemoval() {
  const [originalLoan,    setOriginalLoan]    = useState(320000)
  const [currentBalance,  setCurrentBalance]  = useState(295000)
  const [homeValue,       setHomeValue]        = useState(360000)
  const [interestRate,    setInterestRate]     = useState(6.5)
  const [pmiRate,         setPmiRate]          = useState(0.85)      // % of loan/yr
  const [monthsPaid,      setMonthsPaid]       = useState(18)
  const [termYears,       setTermYears]        = useState(30)
  const [homeAppreciation, setHomeAppreciation] = useState(4)        // % / yr for refi scenario
  const [refiRate,        setRefiRate]         = useState(6.75)      // current refi rate
  const [refiCosts,       setRefiCosts]        = useState(6000)      // closing costs

  const calc = useMemo(() => {
    const termMonths    = termYears * 12
    const remainingMo   = termMonths - monthsPaid
    const pmt           = monthlyPmt(originalLoan, interestRate, termMonths)
    const pmiMonthly    = currentBalance * pmiRate / 100 / 12

    // LTV tracking
    const currentLTV    = currentBalance / homeValue * 100
    const targetLTV80   = homeValue * 0.80   // 20% equity (request removal)
    const targetLTV78   = homeValue * 0.78   // automatic cancellation
    const balanceDrop80 = Math.max(currentBalance - targetLTV80, 0)
    const balanceDrop78 = Math.max(currentBalance - targetLTV78, 0)

    // Strategy 1: Natural amortization (no extra payments)
    // Find month when balance hits 78% of ORIGINAL loan value (HPA law)
    const hpaTarget78   = originalLoan * 0.78  // HPA automatic cancellation at 78% of original value
    const hpaTarget80   = originalLoan * 0.80  // can request at 80% of original

    let moTo80Original  = 0
    let moTo78Original  = 0
    let bal = currentBalance
    for (let mo = 1; mo <= remainingMo; mo++) {
      const interest = bal * interestRate / 100 / 12
      const principal = pmt - interest
      bal -= principal
      if (moTo80Original === 0 && bal <= hpaTarget80) moTo80Original = mo
      if (moTo78Original === 0 && bal <= hpaTarget78) moTo78Original = mo
      if (moTo80Original > 0 && moTo78Original > 0) break
    }
    const totalPMINatural = pmiMonthly * moTo78Original
    const pmiMonthsNatural = moTo78Original

    // Strategy 2: Request removal at 20% current-value equity
    // Make extra monthly payment to accelerate
    // Or wait for appreciation to lift the home value
    // Here: just extra payments to hit 80% of current value
    let moToRemoval80 = 0
    let extraToHit80  = 0
    if (currentBalance <= targetLTV80) {
      moToRemoval80 = 0
      extraToHit80  = 0
    } else {
      // How much extra monthly to reach 80% current value in minimum months?
      extraToHit80  = balanceDrop80   // just pay it all now (lump sum)
      moToRemoval80 = 0
    }

    // Strategy 3: Lump sum to hit 80% LTV
    const lumpSumNeeded = balanceDrop80
    const pmiFutureNatural = pmiMonthly * moTo78Original
    const savingsFromLump  = pmiFutureNatural - 0  // pay lump now, zero PMI
    const netBenefitLump   = savingsFromLump - lumpSumNeeded

    // Strategy 4: Refinance — only makes sense if home appreciated enough
    const refiBalance  = currentBalance
    const refiLTV      = refiBalance / homeValue * 100
    const refiSavePMI  = refiLTV <= 80
    const refiPmt      = monthlyPmt(refiBalance, refiRate, termYears * 12)
    const origPmt      = pmt + pmiMonthly
    const refiMonthlySaving = origPmt - refiPmt
    const refiBreakEven = refiCosts / Math.max(refiMonthlySaving, 1)

    // Chart: cumulative PMI paid under each strategy
    const chartData = Array.from({ length: Math.min(pmiMonthsNatural + 6, 120) }, (_, i) => {
      const mo        = i + 1
      const natural   = mo <= pmiMonthsNatural ? Math.round(pmiMonthly * mo) : Math.round(pmiMonthly * pmiMonthsNatural)
      const withLump  = lumpSumNeeded          // constant: paid upfront
      return { mo: `Mo ${mo}`, 'Natural (No Action)': natural, 'Lump Sum Now': withLump }
    })

    // Balance schedule for chart
    const balanceData = []
    let runBal = currentBalance
    for (let mo = 1; mo <= Math.min(remainingMo, 120); mo++) {
      const interest  = runBal * interestRate / 100 / 12
      const principal = pmt - interest
      runBal -= principal
      const value80   = homeValue * 0.80
      const value78   = homeValue * 0.78
      const orig80    = originalLoan * 0.80
      const orig78    = originalLoan * 0.78
      balanceData.push({
        mo,
        Balance: Math.round(runBal),
        '80% Current Value': Math.round(value80),
        '78% Current Value': Math.round(value78),
        '80% Original':      Math.round(orig80),
        '78% Original (Auto)': Math.round(orig78),
      })
    }

    return {
      pmiMonthly, currentLTV, lumpSumNeeded, balanceDrop80, balanceDrop78, targetLTV80, targetLTV78,
      moTo80Original, moTo78Original, totalPMINatural, pmiMonthsNatural,
      refiLTV, refiSavePMI, refiPmt, refiMonthlySaving, refiBreakEven,
      netBenefitLump, pmiFutureNatural, pmt, chartData, balanceData,
    }
  }, [originalLoan, currentBalance, homeValue, interestRate, pmiRate, monthsPaid, termYears, homeAppreciation, refiRate, refiCosts])

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

  const strategies = [
    {
      id: 'natural',
      name: 'Wait (Natural Amortization)',
      icon: '⏱️',
      cost: calc.totalPMINatural,
      timeline: `${calc.pmiMonthsNatural} months (${(calc.pmiMonthsNatural / 12).toFixed(1)} yrs)`,
      verdict: 'Do nothing — PMI auto-cancels at 78% of original loan',
      color: 'border-slate-700',
    },
    {
      id: 'request',
      name: 'Request Removal at 20% Equity',
      icon: '📋',
      cost: calc.pmiMonthly * calc.moTo80Original + 300,  // $300 appraisal
      timeline: `~${calc.moTo80Original} months + appraisal`,
      verdict: 'Request cancellation once balance hits 80% of current value (needs appraisal)',
      color: 'border-blue-700/50',
    },
    {
      id: 'lump',
      name: 'Lump Sum to 80% LTV',
      icon: '💰',
      cost: calc.lumpSumNeeded,
      timeline: 'Immediately',
      verdict: calc.lumpSumNeeded <= 0 ? 'Already at 80% LTV — just request removal!' : `Pay ${fmt(calc.lumpSumNeeded)} extra → eliminate PMI today`,
      color: calc.netBenefitLump > 0 ? 'border-green-700/50' : 'border-slate-700',
    },
    {
      id: 'refi',
      name: 'Refinance',
      icon: '🔁',
      cost: refiCosts,
      timeline: `Break-even: ${calc.refiBreakEven > 0 ? Math.round(calc.refiBreakEven) + ' months' : 'Never'}`,
      verdict: calc.refiSavePMI
        ? `LTV at ${calc.refiLTV.toFixed(0)}% — new loan has no PMI. Monthly saving: ${fmt(calc.refiMonthlySaving)}`
        : `LTV at ${calc.refiLTV.toFixed(0)}% — PMI still required on new loan`,
      color: calc.refiSavePMI && calc.refiMonthlySaving > 0 ? 'border-green-700/50' : 'border-slate-700',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">PMI Removal Planner</h3>
        <p className="text-xs text-slate-500">
          Private Mortgage Insurance costs you real money every month. Compare four strategies to eliminate it:
          wait it out, request removal, pay a lump sum, or refinance.
        </p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Loan Details</p>
          <Slider label="Original Loan Amount" value={originalLoan} min={50000} max={2000000} step={5000} onChange={setOriginalLoan} prefix="$" />
          <Slider label="Current Balance" value={currentBalance} min={10000} max={originalLoan} step={1000} onChange={setCurrentBalance} prefix="$" />
          <Slider label="Current Home Value" value={homeValue} min={currentBalance} max={5000000} step={5000} onChange={setHomeValue} prefix="$" />
          <Slider label="Interest Rate" value={interestRate} min={3} max={12} step={0.125} onChange={setInterestRate} suffix="%" />
          <Slider label="PMI Rate" value={pmiRate} min={0.3} max={1.5} step={0.05} onChange={setPmiRate} suffix="%" />
          <Slider label="Months Paid So Far" value={monthsPaid} min={1} max={24} step={1} onChange={setMonthsPaid} suffix=" mo" />
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Refi Details</p>
          <Slider label="Refi Interest Rate" value={refiRate} min={3} max={12} step={0.125} onChange={setRefiRate} suffix="%" />
          <Slider label="Refi Closing Costs" value={refiCosts} min={0} max={20000} step={500} onChange={setRefiCosts} prefix="$" />
          <Slider label="Home Appreciation (refi timing)" value={homeAppreciation} min={0} max={10} step={0.5} onChange={setHomeAppreciation} suffix="%" />

          <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Current LTV</span>
              <span className={`font-bold ${calc.currentLTV <= 80 ? 'text-green-400' : 'text-yellow-400'}`}>{calc.currentLTV.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Monthly PMI</span>
              <span className="text-red-400 font-bold">{fmt(calc.pmiMonthly)}/mo</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Monthly P&I</span>
              <span className="text-slate-300 font-bold">{fmt(calc.pmt)}/mo</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Need to remove PMI</span>
              <span className="text-blue-400 font-bold">{fmt(calc.lumpSumNeeded)} extra</span>
            </div>
          </div>
        </div>
      </div>

      {/* Strategy comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {strategies.map(s => (
          <div key={s.id} className={`rounded-xl border p-4 bg-slate-800/50 ${s.color}`}>
            <div className="flex items-start gap-2 mb-2">
              <span className="text-lg">{s.icon}</span>
              <div>
                <p className="text-xs font-bold text-slate-200">{s.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.verdict}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center mt-3">
              <div className="bg-slate-900/60 rounded-lg p-2">
                <p className="text-xs text-slate-600">Cost</p>
                <p className="text-sm font-black text-red-400">{fmt(s.cost)}</p>
              </div>
              <div className="bg-slate-900/60 rounded-lg p-2">
                <p className="text-xs text-slate-600">Timeline</p>
                <p className="text-xs font-bold text-blue-400 leading-tight">{s.timeline}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Cumulative PMI paid chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Cumulative PMI Paid: Wait vs Lump Sum</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={calc.chartData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="mo" tick={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(1)}K`} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number) => [fmt(v)]} />
            <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
            <Line type="monotone" dataKey="Natural (No Action)" stroke="#ef4444" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Lump Sum Now" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
        <p className="text-xs text-slate-600 text-center mt-1">
          Lump sum break-even: ~{calc.netBenefitLump > 0 ? Math.round(calc.lumpSumNeeded / calc.pmiMonthly) : '∞'} months after payment
        </p>
      </div>

      {/* Balance decline chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Balance vs PMI Removal Thresholds</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={calc.balanceData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="mo" tick={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number) => [fmt(v)]} />
            <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
            <Line type="monotone" dataKey="Balance"             stroke="#3b82f6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="80% Current Value"   stroke="#10b981" strokeWidth={1} dot={false} strokeDasharray="4 2" />
            <Line type="monotone" dataKey="78% Original (Auto)" stroke="#f59e0b" strokeWidth={1} dot={false} strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Rules */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">HPA Rules (Homeowners Protection Act)</p>
        <div className="space-y-1.5 text-xs text-slate-400">
          {[
            '📋 At 80% LTV (of original value): you can REQUEST PMI cancellation in writing. Lender may require a new appraisal to confirm value hasn\'t dropped.',
            '✅ At 78% LTV (of original value): PMI must be AUTOMATICALLY cancelled — no action needed. Calendar this date.',
            '⚠️ The HPA thresholds are based on the ORIGINAL purchase price or appraised value at origination, NOT the current market value.',
            '🏠 To use current appreciated value (to hit 20% equity faster): request a new appraisal ($400-600) and provide to lender in writing.',
            '🔄 FHA MIP is different: if you put < 10% down on FHA, MIP is for LIFE of the loan — you must refinance to a conventional loan to remove it.',
            '💡 VA and USDA loans have no PMI — only a one-time funding fee at origination.',
            '📞 Write to your servicer — PMI cancellation requests must be in writing and the lender has 30 days to respond.',
            '🔍 Check your Closing Disclosure (page 1) for the exact date PMI is scheduled to cancel.',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
