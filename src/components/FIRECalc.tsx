import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, AreaChart, Area } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function FIRECalc() {
  // Personal situation
  const [monthlyExpenseTarget, setMonthlyExpenseTarget] = useState(5000)
  const [currentAge,           setCurrentAge]           = useState(32)
  const [currentSavings,       setCurrentSavings]       = useState(50000)
  const [monthlySavingsRate,   setMonthlySavingsRate]   = useState(2000)

  // Property assumptions
  const [avgPropertyPrice,    setAvgPropertyPrice]    = useState(250000)
  const [downPctPerProp,      setDownPctPerProp]       = useState(20)
  const [closingCostsPct,     setClosingCostsPct]      = useState(3)
  const [cashFlowPerProp,     setCashFlowPerProp]      = useState(300)   // monthly after all expenses
  const [appreciationRate,    setAppreciationRate]     = useState(4)      // % / yr
  const [cashFlowGrowthRate,  setCashFlowGrowthRate]   = useState(3)      // % / yr (rent growth)
  const [equityPulloutYears,  setEquityPulloutYears]   = useState(5)      // BRRRR-style: pull equity every N years

  // Current portfolio
  const [existingUnits,       setExistingUnits]        = useState(0)
  const [existingMonthlyFlow, setExistingMonthlyFlow]  = useState(0)

  const calc = useMemo(() => {
    const cashNeededPerProp = avgPropertyPrice * (downPctPerProp + closingCostsPct) / 100
    const annualSavings     = monthlySavingsRate * 12

    // How many properties to hit target cash flow
    const propertiesNeeded  = Math.ceil((monthlyExpenseTarget - existingMonthlyFlow) / cashFlowPerProp)
    const totalPropsTarget  = propertiesNeeded + existingUnits

    // Simulate year by year acquisition
    const MAX_YEARS = 40
    const results = []
    let savings    = currentSavings
    let units      = existingUnits
    let monthlyFlow = existingMonthlyFlow
    let portfolioValue = existingUnits * avgPropertyPrice
    let totalDebt  = existingUnits * avgPropertyPrice * (1 - downPctPerProp / 100)
    let fireYear   = null

    for (let yr = 0; yr <= MAX_YEARS; yr++) {
      const age = currentAge + yr

      // Check if FIRE reached
      if (monthlyFlow >= monthlyExpenseTarget && fireYear === null) {
        fireYear = yr
      }

      // Appreciate portfolio
      portfolioValue *= (1 + appreciationRate / 100)
      monthlyFlow    *= (1 + cashFlowGrowthRate / 100)
      const equity    = portfolioValue - totalDebt
      const netWorth  = savings + equity

      results.push({
        yr, age, units, savings: Math.round(savings), portfolioValue: Math.round(portfolioValue),
        equity: Math.round(equity), monthlyFlow: Math.round(monthlyFlow), netWorth: Math.round(netWorth),
        targetFlow: monthlyExpenseTarget,
      })

      // Each year: save money, acquire property if possible
      savings += annualSavings + monthlyFlow * 12  // passive income reinvested too
      if (savings >= cashNeededPerProp) {
        const newUnits = Math.floor(savings / cashNeededPerProp)
        const acquired = Math.min(newUnits, 3)  // max 3/yr for realism
        units          += acquired
        portfolioValue += acquired * avgPropertyPrice
        totalDebt      += acquired * avgPropertyPrice * (1 - downPctPerProp / 100)
        monthlyFlow    += acquired * cashFlowPerProp
        savings        -= acquired * cashNeededPerProp
      }

      // BRRRR equity pullout: every N years, refinance and pull cash to buy more
      if (yr > 0 && yr % equityPulloutYears === 0) {
        const pullableEquity = portfolioValue * 0.75 - totalDebt  // 75% LTV refi
        if (pullableEquity > cashNeededPerProp) {
          const additionalUnits = Math.floor(pullableEquity / cashNeededPerProp)
          const acquiredBRRRR   = Math.min(additionalUnits, 2)
          units          += acquiredBRRRR
          portfolioValue += acquiredBRRRR * avgPropertyPrice
          totalDebt      += pullableEquity + acquiredBRRRR * avgPropertyPrice * (1 - downPctPerProp / 100)
          monthlyFlow    += acquiredBRRRR * cashFlowPerProp
        }
      }
    }

    // S&P 500 comparison path
    const sp500Data = []
    let sp500Balance = currentSavings
    const sp500Return = 0.10  // 10% / yr
    for (let yr = 0; yr <= MAX_YEARS; yr++) {
      sp500Balance = (sp500Balance + annualSavings) * (1 + sp500Return)
      sp500Data.push({ yr, sp500: Math.round(sp500Balance) })
    }

    // For safe withdrawal rate (4% rule): how much portfolio to fund expenses?
    const portfolioForFIRE  = monthlyExpenseTarget * 12 / 0.04

    return { results, fireYear, cashNeededPerProp, propertiesNeeded, totalPropsTarget, portfolioForFIRE, sp500Data }
  }, [monthlyExpenseTarget, currentAge, currentSavings, monthlySavingsRate,
      avgPropertyPrice, downPctPerProp, closingCostsPct, cashFlowPerProp, appreciationRate,
      cashFlowGrowthRate, equityPulloutYears, existingUnits, existingMonthlyFlow])

  // Merge chart data
  const chartData = calc.results.map((r, i) => ({
    ...r,
    sp500: calc.sp500Data[i]?.sp500 ?? 0,
  }))

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

  const fireResult = calc.results[calc.fireYear ?? 0]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Real Estate FIRE Calculator</h3>
        <p className="text-xs text-slate-500">
          Model your path to Financial Independence via rental real estate. See how many properties you need,
          when you hit your income target, and compare to the stock market path.
        </p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Your Goals</p>
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-slate-400">Monthly Passive Income Target</label>
              <span className="text-xs font-bold text-blue-400">{fmt(monthlyExpenseTarget)}</span>
            </div>
            <input type="range" min={1000} max={20000} step={250} value={monthlyExpenseTarget}
              onChange={e => setMonthlyExpenseTarget(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
          </div>
          <Slider label="Your Current Age" value={currentAge} min={20} max={60} step={1} onChange={setCurrentAge} />
          <Slider label="Current Savings / Investment Capital" value={currentSavings} min={0} max={500000} step={5000} onChange={setCurrentSavings} prefix="$" />
          <Slider label="Monthly Savings Rate" value={monthlySavingsRate} min={500} max={15000} step={250} onChange={setMonthlySavingsRate} prefix="$" />
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest pt-1">Existing Portfolio</p>
          <Slider label="Units Owned Now" value={existingUnits} min={0} max={20} step={1} onChange={setExistingUnits} />
          <Slider label="Current Monthly Cash Flow" value={existingMonthlyFlow} min={0} max={10000} step={100} onChange={setExistingMonthlyFlow} prefix="$" />
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Property Assumptions</p>
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-slate-400">Avg Property Price</label>
              <span className="text-xs font-bold text-blue-400">{fmt(avgPropertyPrice)}</span>
            </div>
            <input type="range" min={50000} max={1000000} step={10000} value={avgPropertyPrice}
              onChange={e => setAvgPropertyPrice(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
          </div>
          <Slider label="Down Payment %" value={downPctPerProp} min={5} max={30} step={5} onChange={setDownPctPerProp} suffix="%" />
          <Slider label="Closing Costs %" value={closingCostsPct} min={1} max={5} step={0.5} onChange={setClosingCostsPct} suffix="%" />
          <div className="bg-slate-900/60 rounded-lg p-2 text-xs text-center">
            Cash needed per property: <span className="font-black text-yellow-400">{fmt(calc.cashNeededPerProp)}</span>
          </div>
          <Slider label="Monthly Cash Flow / Property" value={cashFlowPerProp} min={0} max={2000} step={50} onChange={setCashFlowPerProp} prefix="$" />
          <Slider label="Annual Appreciation" value={appreciationRate} min={0} max={10} step={0.5} onChange={setAppreciationRate} suffix="%" />
          <Slider label="Annual Cash Flow Growth" value={cashFlowGrowthRate} min={0} max={8} step={0.5} onChange={setCashFlowGrowthRate} suffix="%" />
          <Slider label="Equity Recycling Interval (BRRRR)" value={equityPulloutYears} min={3} max={10} step={1} onChange={setEquityPulloutYears} suffix=" yrs" />
        </div>
      </div>

      {/* FIRE result */}
      {calc.fireYear !== null ? (
        <div className="bg-green-900/20 border border-green-700/50 rounded-xl p-5">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
            <div>
              <p className="text-xs text-slate-400 mb-1">FIRE Age</p>
              <p className="text-3xl font-black text-green-400">{currentAge + calc.fireYear}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Years to FIRE</p>
              <p className="text-3xl font-black text-blue-400">{calc.fireYear}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Units at FIRE</p>
              <p className="text-3xl font-black text-white">{fireResult?.units ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Monthly Flow</p>
              <p className="text-3xl font-black text-green-400">{fmt(fireResult?.monthlyFlow ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Portfolio Value</p>
              <p className="text-2xl font-black text-purple-400">{fmt(fireResult?.portfolioValue ?? 0)}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-4 text-center">
          <p className="text-yellow-400 font-bold">FIRE not reached within 40 years at current settings.</p>
          <p className="text-xs text-slate-500 mt-1">Increase cash flow per door, savings rate, or consider more properties.</p>
        </div>
      )}

      {/* Properties needed */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Properties Needed',   val: calc.propertiesNeeded + (existingUnits > 0 ? ` (have ${existingUnits})` : ''), color: 'text-blue-400' },
          { label: 'Cash per Property',   val: fmt(calc.cashNeededPerProp),  color: 'text-yellow-400' },
          { label: 'Total Cash Needed',   val: fmt(calc.cashNeededPerProp * calc.propertiesNeeded), color: 'text-orange-400' },
          { label: 'S&P 500 for FIRE (4%)', val: fmt(calc.portfolioForFIRE), color: 'text-slate-300' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-lg font-black ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Cash flow timeline chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Monthly Cash Flow Over Time</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData.slice(0, 25)} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="cfGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="age" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number) => [fmt(v)]} labelFormatter={v => `Age ${v}`} />
            <ReferenceLine y={monthlyExpenseTarget} stroke="#f59e0b" strokeDasharray="4 4"
              label={{ value: 'FIRE Target', position: 'insideRight', fill: '#f59e0b', fontSize: 9 }} />
            <Area type="monotone" dataKey="monthlyFlow" name="Monthly Cash Flow" stroke="#10b981" fill="url(#cfGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Net worth comparison */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Net Worth: Real Estate vs S&P 500 Path</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData.slice(0, 30)} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="age" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} tickFormatter={v => `$${(v / 1000000).toFixed(1)}M`} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number) => [fmt(v)]} labelFormatter={v => `Age ${v}`} />
            <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
            <Line type="monotone" dataKey="netWorth"  name="RE Portfolio Net Worth" stroke="#10b981" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="sp500"     name="S&P 500 Path"           stroke="#64748b" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Year-by-year table (first 15 years) */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-4 py-2 bg-slate-800/80 border-b border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Year-by-Year Projection</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700 text-slate-500">
                <th className="px-3 py-2 text-left">Year</th>
                <th className="px-3 py-2 text-right">Age</th>
                <th className="px-3 py-2 text-right">Units</th>
                <th className="px-3 py-2 text-right">Portfolio</th>
                <th className="px-3 py-2 text-right">Equity</th>
                <th className="px-3 py-2 text-right">Monthly Flow</th>
                <th className="px-3 py-2 text-right">vs Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {calc.results.slice(0, 20).map(r => (
                <tr key={r.yr} className={r.yr === (calc.fireYear ?? -1) ? 'bg-green-900/20' : ''}>
                  <td className="px-3 py-1.5 text-slate-400">{r.yr === 0 ? 'Now' : `Yr ${r.yr}`} {r.yr === calc.fireYear ? '🔥' : ''}</td>
                  <td className="px-3 py-1.5 text-right text-slate-400">{r.age}</td>
                  <td className="px-3 py-1.5 text-right text-slate-300 font-bold">{r.units}</td>
                  <td className="px-3 py-1.5 text-right text-slate-300">{fmt(r.portfolioValue)}</td>
                  <td className="px-3 py-1.5 text-right text-green-400">{fmt(r.equity)}</td>
                  <td className="px-3 py-1.5 text-right font-bold">
                    <span className={r.monthlyFlow >= monthlyExpenseTarget ? 'text-green-400' : 'text-slate-300'}>{fmt(r.monthlyFlow)}</span>
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <span className={r.monthlyFlow >= monthlyExpenseTarget ? 'text-green-400' : 'text-slate-500'}>
                      {r.monthlyFlow >= monthlyExpenseTarget ? '✓ FIRE' : `${Math.round((r.monthlyFlow / monthlyExpenseTarget) * 100)}%`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Wisdom */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Real Estate FIRE Principles</p>
        <div className="space-y-1.5 text-xs text-slate-400">
          {[
            '🔑 The key metric: monthly cash flow after ALL expenses (mortgage, taxes, insurance, vacancy, management, maintenance).',
            '🔁 BRRRR accelerates the timeline: use appreciation to refinance, pull equity, and buy more without adding new capital.',
            '📊 The 1% rule is a starting filter: monthly rent ≥ 1% of purchase price suggests positive cash flow in most markets.',
            '🏠 Don\'t count on appreciation — use it as a bonus. Your FIRE plan should work on cash flow alone.',
            '📋 Passive income is taxed favorably: depreciation shields most rental income; with REP status, losses can offset W-2 income.',
            '⚖️ Risk of RE-FIRE: concentrated asset class, illiquidity, local market risk. Consider diversifying at >10 units.',
            '💡 Inflation hedging: rents tend to rise with inflation, making RE FIRE more durable than a fixed-withdrawal stock portfolio.',
            '🎯 Practical path: one property / year for 5-10 years, reinvest cash flow, leverage equity for next acquisition.',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
