import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, AreaChart, Area } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function monthlyPayment(principal: number, annualRate: number, months: number) {
  if (annualRate === 0) return principal / months
  const r = annualRate / 100 / 12
  return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
}

function remainingBalance(principal: number, annualRate: number, termMonths: number, elapsedMonths: number) {
  const pmt = monthlyPayment(principal, annualRate, termMonths)
  const r   = annualRate / 100 / 12
  if (r === 0) return principal - (pmt * elapsedMonths)
  return principal * Math.pow(1 + r, elapsedMonths) - pmt * (Math.pow(1 + r, elapsedMonths) - 1) / r
}

type ArmType = '5/1' | '7/1' | '10/1' | '3/1'

export default function ArmAnalyzer() {
  const [loanAmount,    setLoanAmount]    = useState(400000)
  const [armType,       setArmType]       = useState<ArmType>('7/1')
  const [initialRate,   setInitialRate]   = useState(5.875)
  const [index,         setIndex]         = useState(4.5)    // current index (SOFR etc)
  const [margin,        setMargin]        = useState(2.75)   // spread over index
  const [adjCapPeriod,  setAdjCapPeriod]  = useState(2)      // % cap per adjustment
  const [adjCapFirst,   setAdjCapFirst]   = useState(5)      // % cap on first adjustment
  const [lifeCap,       setLifeCap]       = useState(5)      // % cap over initial rate
  const [fixedRate,     setFixedRate]     = useState(7.0)    // comparable 30yr fixed
  const [indexScenario, setIndexScenario] = useState<'flat' | 'rise2' | 'rise4' | 'fall2'>('rise2')
  const [termYears]                        = useState(30)

  const fixedPeriodYrs = armType === '3/1' ? 3 : armType === '5/1' ? 5 : armType === '7/1' ? 7 : 10

  const calc = useMemo(() => {
    const termMonths     = termYears * 12
    const fixedMonths    = fixedPeriodYrs * 12
    const fullyIndexed   = index + margin
    const maxRate        = initialRate + lifeCap

    // Index trajectory based on scenario
    function getIndex(yr: number) {
      const yrsAfterFixed = yr - fixedPeriodYrs
      if (indexScenario === 'flat')  return index
      if (indexScenario === 'rise2') return index + Math.min(yrsAfterFixed * 0.5, 2)
      if (indexScenario === 'rise4') return index + Math.min(yrsAfterFixed * 1, 4)
      return index - Math.min(yrsAfterFixed * 0.5, 2)  // fall2
    }

    // ARM monthly payment schedule
    const armData: { yr: number; armPmt: number; fixedPmt: number; armRate: number; armBalance: number; fixedBalance: number; cumArmInt: number; cumFixedInt: number }[] = []
    let armRate       = initialRate
    let armBalance    = loanAmount
    let cumArmInt     = 0
    let fixedBalance  = loanAmount
    let cumFixedInt   = 0
    const fixedPmt    = monthlyPayment(loanAmount, fixedRate, termMonths)

    for (let yr = 1; yr <= termYears; yr++) {
      // ARM: recalculate rate if in adjustment period
      if (yr > fixedPeriodYrs) {
        const adjIndex    = getIndex(yr)
        const targetRate  = adjIndex + margin
        const capForAdj   = yr === fixedPeriodYrs + 1 ? adjCapFirst : adjCapPeriod
        const newRate     = Math.min(
          Math.max(targetRate, armRate - adjCapPeriod),  // floor cap
          Math.min(armRate + capForAdj, initialRate + lifeCap)  // ceiling cap
        )
        armRate = Math.max(newRate, 0)
      }

      const remainingMonths = termMonths - (yr - 1) * 12
      const armPmt  = monthlyPayment(armBalance, armRate, remainingMonths)
      const armInt  = armBalance * (armRate / 100 / 12) * 12
      armBalance    = Math.max(remainingBalance(armBalance, armRate, remainingMonths, 12), 0)
      cumArmInt    += armInt

      const fixedInt  = fixedBalance * (fixedRate / 100 / 12) * 12
      fixedBalance    = Math.max(remainingBalance(fixedBalance, fixedRate, termMonths, yr * 12), 0)
      cumFixedInt    += fixedInt

      armData.push({
        yr,
        armPmt:    Math.round(armPmt),
        fixedPmt:  Math.round(fixedPmt),
        armRate:   Math.round(armRate * 10) / 10,
        armBalance: Math.round(armBalance),
        fixedBalance: Math.round(fixedBalance),
        cumArmInt:  Math.round(cumArmInt),
        cumFixedInt: Math.round(cumFixedInt),
      })
    }

    // First adjustment payment (worst-case: maxRate)
    const firstAdjPmt   = monthlyPayment(
      remainingBalance(loanAmount, initialRate, termMonths, fixedMonths),
      Math.min(initialRate + adjCapFirst, maxRate),
      termMonths - fixedMonths
    )
    const paymentShock  = firstAdjPmt - monthlyPayment(loanAmount, initialRate, termMonths)
    const maxPmt        = monthlyPayment(
      remainingBalance(loanAmount, initialRate, termMonths, fixedMonths),
      maxRate,
      termMonths - fixedMonths
    )

    // Break-even: when does fixed save more than ARM?
    // During fixed period, ARM saves (fixedPmt - armInitialPmt) per month
    const armInitialPmt = monthlyPayment(loanAmount, initialRate, termMonths)
    const monthlySaving = fixedPmt - armInitialPmt
    const breakEven     = armData.find(d => d.cumArmInt > d.cumFixedInt)
    const breakEvenYr   = breakEven ? breakEven.yr : null

    // Scenarios: best case, base, worst case first-adj payment
    const firstAdjBalance = remainingBalance(loanAmount, initialRate, termMonths, fixedMonths)
    const firstAdjMonths  = termMonths - fixedMonths
    const worstFirstPmt   = monthlyPayment(firstAdjBalance, Math.min(initialRate + adjCapFirst, maxRate), firstAdjMonths)
    const baseFirstPmt    = monthlyPayment(firstAdjBalance, Math.max(fullyIndexed, initialRate - adjCapPeriod), firstAdjMonths)
    const bestFirstPmt    = monthlyPayment(firstAdjBalance, Math.max(initialRate - adjCapPeriod, 0), firstAdjMonths)

    return { armData, fixedPmt, armInitialPmt, firstAdjPmt, maxPmt, paymentShock, breakEvenYr,
      monthlySaving, fullyIndexed, maxRate, worstFirstPmt, baseFirstPmt, bestFirstPmt, firstAdjBalance }
  }, [loanAmount, armType, initialRate, index, margin, adjCapPeriod, adjCapFirst, lifeCap, fixedRate, indexScenario, termYears, fixedPeriodYrs])

  const Slider = ({ label, value, min, max, step, onChange, suffix = '' }: {
    label: string; value: number; min: number; max: number; step: number;
    onChange: (v: number) => void; suffix?: string
  }) => (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-xs text-slate-400">{label}</label>
        <span className="text-xs font-bold text-blue-400">{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
    </div>
  )

  const scenarios = [
    { id: 'flat',  label: 'Rates Flat',     color: 'text-blue-400' },
    { id: 'rise2', label: '+2% Over 4 Yrs', color: 'text-yellow-400' },
    { id: 'rise4', label: '+4% Over 4 Yrs', color: 'text-red-400' },
    { id: 'fall2', label: '-2% Over 4 Yrs', color: 'text-green-400' },
  ] as const

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">ARM Analyzer</h3>
        <p className="text-xs text-slate-500">
          Model adjustable-rate mortgage payments across rate scenarios. See payment shock at first adjustment,
          worst-case max payment, and break-even point vs a fixed-rate mortgage.
        </p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Loan Details</p>
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-slate-400">Loan Amount</label>
              <span className="text-xs font-bold text-blue-400">{fmt(loanAmount)}</span>
            </div>
            <input type="range" min={50000} max={2000000} step={10000} value={loanAmount}
              onChange={e => setLoanAmount(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
          </div>
          <div>
            <label className="text-xs text-slate-400">ARM Type</label>
            <div className="grid grid-cols-4 gap-1 mt-1">
              {(['3/1', '5/1', '7/1', '10/1'] as ArmType[]).map(t => (
                <button key={t} onClick={() => setArmType(t)}
                  className={`py-1.5 rounded-lg text-xs font-bold transition ${armType === t ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                  {t} ARM
                </button>
              ))}
            </div>
          </div>
          <Slider label="Initial (Teaser) Rate" value={initialRate} min={3} max={9} step={0.125} onChange={setInitialRate} suffix="%" />
          <Slider label="Comparable 30-yr Fixed Rate" value={fixedRate} min={4} max={11} step={0.125} onChange={setFixedRate} suffix="%" />
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Rate Caps & Index</p>
          <Slider label="Current Index (SOFR/T-Bill)" value={index} min={1} max={8} step={0.125} onChange={setIndex} suffix="%" />
          <Slider label="Margin (added to index)" value={margin} min={1} max={4} step={0.125} onChange={setMargin} suffix="%" />
          <Slider label="First Adjustment Cap" value={adjCapFirst} min={1} max={6} step={1} onChange={setAdjCapFirst} suffix="%" />
          <Slider label="Subsequent Adj. Cap (per period)" value={adjCapPeriod} min={1} max={4} step={1} onChange={setAdjCapPeriod} suffix="%" />
          <Slider label="Lifetime Cap (over initial)" value={lifeCap} min={3} max={8} step={1} onChange={setLifeCap} suffix="%" />

          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest pt-1">Rate Scenario After Fixed Period</p>
          <div className="grid grid-cols-2 gap-1">
            {scenarios.map(s => (
              <button key={s.id} onClick={() => setIndexScenario(s.id as typeof indexScenario)}
                className={`py-1.5 rounded-lg text-xs font-bold transition ${indexScenario === s.id ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Key numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: `Initial Payment (${armType} ARM)`, val: fmt(calc.armInitialPmt) + '/mo', color: 'text-green-400' },
          { label: '30-yr Fixed Payment',               val: fmt(calc.fixedPmt) + '/mo',      color: 'text-slate-300' },
          { label: 'Monthly Saving (fixed period)',      val: fmt(calc.monthlySaving) + '/mo', color: calc.monthlySaving > 0 ? 'text-blue-400' : 'text-red-400' },
          { label: 'Fully Indexed Rate',                val: calc.fullyIndexed.toFixed(2) + '%', color: 'text-yellow-400' },
          { label: 'First Adj. Payment (worst case)',   val: fmt(calc.worstFirstPmt) + '/mo', color: 'text-red-400' },
          { label: 'Payment Shock (worst case)',         val: '+' + fmt(calc.worstFirstPmt - calc.armInitialPmt), color: 'text-red-400' },
          { label: 'Max Rate (life cap)',               val: calc.maxRate.toFixed(2) + '%',   color: 'text-orange-400' },
          { label: 'Max Ever Payment',                  val: fmt(calc.maxPmt) + '/mo',        color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-base font-black ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* First adjustment scenarios */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">First Adjustment — Payment Scenarios</p>
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: 'Best Case (rates fall)', val: fmt(calc.bestFirstPmt), color: 'text-green-400', sub: `Rate ≤ ${Math.max(initialRate - adjCapPeriod, 0).toFixed(2)}%` },
            { label: 'Base Case (rates flat)', val: fmt(calc.baseFirstPmt), color: 'text-blue-400',  sub: `Fully indexed ${calc.fullyIndexed.toFixed(2)}%` },
            { label: 'Worst Case (+adj cap)',  val: fmt(calc.worstFirstPmt), color: 'text-red-400', sub: `Rate ${Math.min(initialRate + adjCapFirst, calc.maxRate).toFixed(2)}%` },
          ].map(s => (
            <div key={s.label} className="bg-slate-900/60 rounded-xl p-3 border border-slate-700">
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className={`text-xl font-black ${s.color}`}>{s.val}</p>
              <p className="text-xs text-slate-600 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Payment trajectory chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">
          Monthly Payment Over Time — ARM vs Fixed ({indexScenario === 'flat' ? 'Rates Flat' : indexScenario === 'rise2' ? '+2% Scenario' : indexScenario === 'rise4' ? '+4% Scenario' : '-2% Scenario'})
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={calc.armData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="yr" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} label={{ value: 'Year', position: 'insideBottom', fill: '#475569', fontSize: 10 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(1)}K`} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number, name: string) => [fmt(v), name]} />
            <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
            <ReferenceLine x={fixedPeriodYrs} stroke="#f59e0b" strokeDasharray="4 4"
              label={{ value: 'First adj', position: 'top', fill: '#f59e0b', fontSize: 9 }} />
            {calc.breakEvenYr && (
              <ReferenceLine x={calc.breakEvenYr} stroke="#ef4444" strokeDasharray="4 4"
                label={{ value: 'Fixed wins', position: 'top', fill: '#ef4444', fontSize: 9 }} />
            )}
            <Line type="stepAfter" dataKey="armPmt" name={`${armType} ARM Payment`} stroke="#10b981" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="fixedPmt" name="30-yr Fixed Payment" stroke="#64748b" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Cumulative interest chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Cumulative Interest Paid — ARM vs Fixed</p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={calc.armData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="yr" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number) => [fmt(v)]} />
            <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
            <Line type="monotone" dataKey="cumArmInt" name="ARM Cum. Interest" stroke="#10b981" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="cumFixedInt" name="Fixed Cum. Interest" stroke="#64748b" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
        {calc.breakEvenYr && (
          <p className="text-xs text-slate-500 text-center mt-2">
            Fixed-rate mortgage pays less cumulative interest after year <strong className="text-white">{calc.breakEvenYr}</strong>
          </p>
        )}
      </div>

      {/* ARM pros/cons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-green-900/10 border border-green-800/40 rounded-xl p-4">
          <p className="text-xs font-bold text-green-400 uppercase tracking-widest mb-2">When ARM Makes Sense</p>
          <div className="space-y-1.5 text-xs text-slate-400">
            {[
              `You'll sell or refinance within ${fixedPeriodYrs} years (before first adjustment)`,
              'You expect rates to fall — ARM lets you benefit without refinancing',
              'You need the lower initial payment to qualify or buy more house',
              'Jumbo loan: ARM spreads are often narrowest in jumbo market',
              'You have sufficient income cushion to absorb payment shock',
            ].map((t, i) => <p key={i}>✓ {t}</p>)}
          </div>
        </div>
        <div className="bg-red-900/10 border border-red-800/40 rounded-xl p-4">
          <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-2">When ARM Is Risky</p>
          <div className="space-y-1.5 text-xs text-slate-400">
            {[
              `You plan to stay past year ${fixedPeriodYrs} and may face ${fmt(calc.worstFirstPmt)}/mo shock`,
              'Your income is variable — payment shock could be unmanageable',
              'Rates are historically low — limited room to fall, high room to rise',
              'You\'re already at your DTI limit with the initial payment',
              'You can\'t refinance easily (self-employed, credit issues, declining value)',
            ].map((t, i) => <p key={i}>✗ {t}</p>)}
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        ARM caps and index vary by lender and loan product. Always review the ARM disclosure ("CHARM" booklet)
        and model your own worst-case scenario before choosing an adjustable-rate mortgage.
      </p>
    </div>
  )
}
