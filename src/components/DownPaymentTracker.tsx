import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function DownPaymentTracker() {
  const { result } = usePropertyStore()

  const targetPrice    = result?.estimatedValue ?? 400000
  const [downPct,      setDownPct]      = useState(20)
  const [saved,        setSaved]        = useState(30000)
  const [monthlyAdd,   setMonthlyAdd]   = useState(1500)
  const [savingsRate,  setSavingsRate]  = useState(4.5)
  const [appRate,      setAppRate]      = useState(3.5)
  const [investReturn, setInvestReturn] = useState(7.0)

  const downTarget = targetPrice * (downPct / 100)
  const gap        = Math.max(0, downTarget - saved)

  const { chartData, monthsToGoal } = useMemo(() => {
    let balance   = saved
    let homePrice = targetPrice
    let invested  = saved
    const pts = []
    let goalMonth: number | null = null

    for (let mo = 0; mo <= 120; mo++) {
      if (mo > 0) {
        balance   += monthlyAdd
        balance   *= (1 + savingsRate / 100 / 12)
        homePrice *= (1 + appRate / 100 / 12)
        invested  *= (1 + investReturn / 100 / 12)
        invested  += monthlyAdd
      }
      const newTarget = homePrice * (downPct / 100)
      if (goalMonth === null && balance >= newTarget && mo > 0) goalMonth = mo

      if (mo % 3 === 0) {
        pts.push({
          mo:         mo,
          label:      mo === 0 ? 'Now' : `${mo}mo`,
          savings:    Math.round(balance),
          downTarget: Math.round(newTarget),
          homePrice:  Math.round(homePrice),
          invested:   Math.round(invested),
        })
      }
    }
    return { chartData: pts, monthsToGoal: goalMonth }
  }, [saved, monthlyAdd, savingsRate, appRate, downPct, targetPrice, investReturn])

  const monthsToGoalFixed = useMemo(() => {
    if (gap <= 0) return 0
    let balance = saved
    for (let mo = 1; mo <= 600; mo++) {
      balance += monthlyAdd
      balance *= (1 + savingsRate / 100 / 12)
      if (balance >= downTarget) return mo
    }
    return null
  }, [saved, monthlyAdd, savingsRate, downTarget, gap])

  const pmiSavingsMonth = useMemo(() => {
    const threshold10pct = targetPrice * 0.1
    let balance = saved
    if (saved >= threshold10pct) return 0
    for (let mo = 1; mo <= 600; mo++) {
      balance += monthlyAdd
      balance *= (1 + savingsRate / 100 / 12)
      if (balance >= threshold10pct) return mo
    }
    return null
  }, [saved, monthlyAdd, savingsRate, targetPrice])

  const yearsToGoal = monthsToGoal !== null ? (monthsToGoal / 12).toFixed(1) : null

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Down Payment Savings Tracker</h3>
        <p className="text-xs text-slate-500">
          Track your path to your down payment goal. See how saving rate and home appreciation interact.
        </p>
      </div>

      {/* Inputs */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Your Savings Plan</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'Down Payment Target',   value: downPct,       min: 3,    max: 30,     step: 1,     set: setDownPct,      fmt: (v: number) => `${v}% (${fmt(targetPrice * v / 100)})` },
            { label: 'Currently Saved',        value: saved,         min: 0,    max: 300000, step: 1000,  set: setSaved,        fmt: (v: number) => fmt(v) },
            { label: 'Monthly Contribution',   value: monthlyAdd,    min: 100,  max: 10000,  step: 100,   set: setMonthlyAdd,   fmt: (v: number) => `${fmt(v)}/mo` },
            { label: 'Savings Account APY',    value: savingsRate,   min: 0,    max: 8,      step: 0.25,  set: setSavingsRate,  fmt: (v: number) => `${v.toFixed(2)}% APY` },
            { label: 'Home Appreciation Rate', value: appRate,       min: 0,    max: 10,     step: 0.25,  set: setAppRate,      fmt: (v: number) => `${v.toFixed(2)}%/yr` },
            { label: 'Alt. Investment Return', value: investReturn,  min: 0,    max: 15,     step: 0.25,  set: setInvestReturn, fmt: (v: number) => `${v.toFixed(2)}%/yr` },
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
        </div>
      </div>

      {/* Progress and goal */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'Down Payment Goal',
            value: fmt(downTarget),
            sub:   `${downPct}% of ${fmt(targetPrice)}`,
            color: 'text-white',
          },
          {
            label: 'Currently Saved',
            value: fmt(saved),
            sub:   `${Math.min(100, (saved / downTarget * 100)).toFixed(0)}% of goal`,
            color: saved >= downTarget ? 'text-green-400' : 'text-blue-400',
          },
          {
            label: 'Gap to Goal',
            value: gap > 0 ? fmt(gap) : 'Already there!',
            sub:   gap > 0 ? `${monthsToGoalFixed ? `~${monthsToGoalFixed} mo to close` : 'check plan'}` : 'congrats!',
            color: gap > 0 ? 'text-red-400' : 'text-green-400',
          },
          {
            label: 'Estimated Time',
            value: monthsToGoal !== null ? `${yearsToGoal} yrs` : appRate > savingsRate ? 'Home outpacing savings' : 'Over 10 yrs',
            sub:   monthsToGoal !== null ? `${monthsToGoal} months` : 'increase monthly saving',
            color: monthsToGoal !== null && monthsToGoal <= 36 ? 'text-green-400' : monthsToGoal !== null && monthsToGoal <= 72 ? 'text-yellow-400' : 'text-red-400',
          },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-600 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-slate-400">Progress to {downPct}% down</span>
          <span className="font-bold text-blue-400">{Math.min(100, (saved / downTarget * 100)).toFixed(1)}%</span>
        </div>
        <div className="h-4 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all"
            style={{ width: `${Math.min(100, (saved / downTarget * 100))}%` }}
          />
        </div>
        <div className="flex justify-between text-xs mt-2 text-slate-600">
          <span>{fmt(saved)}</span>
          <span>{fmt(downTarget)}</span>
        </div>

        {/* 10% milestone */}
        {saved < targetPrice * 0.1 && (
          <div className="mt-3 text-xs text-slate-500">
            <span className="text-orange-400 font-semibold">10% milestone</span> (minimum for many loans):{' '}
            {pmiSavingsMonth !== null ? (
              <span>reach in <span className="text-orange-400">{pmiSavingsMonth} months ({(pmiSavingsMonth / 12).toFixed(1)} yrs)</span></span>
            ) : 'Increase monthly savings'}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Savings vs Down Payment Target (10yr)</p>
        <p className="text-xs text-slate-600 mb-4">
          The target line rises as home prices appreciate at {appRate}%/yr.
          {monthsToGoal !== null && ` Lines cross at month ${monthsToGoal}.`}
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} interval={3} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} width={55} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v: number, name: string) => [fmt(v), name]} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            {monthsToGoal !== null && (
              <ReferenceLine x={`${monthsToGoal}mo`} stroke="#22c55e" strokeDasharray="4 4"
                label={{ value: 'Goal!', fill: '#22c55e', fontSize: 10 }} />
            )}
            <Line type="monotone" dataKey="savings"    name="Your Savings"      stroke="#3b82f6" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="downTarget" name="Down Payment Needed" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="5 3" />
            <Line type="monotone" dataKey="invested"   name="If Invested Instead" stroke="#a855f7" strokeWidth={1.5} dot={false} strokeDasharray="3 2" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Milestone table */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Quarterly Milestones</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700">
                <th className="text-left pb-2">Month</th>
                <th className="text-right pb-2">Savings Balance</th>
                <th className="text-right pb-2">Down Needed</th>
                <th className="text-right pb-2">Gap</th>
                <th className="text-right pb-2">Invested Alternative</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {chartData.filter(d => [0, 12, 24, 36, 48, 60, 84, 120].includes(d.mo)).map(d => {
                const gap = d.downTarget - d.savings
                const isGoal = d.savings >= d.downTarget
                return (
                  <tr key={d.mo} className={isGoal ? 'bg-green-900/10' : ''}>
                    <td className="py-2 text-slate-400 font-semibold">{d.label}{isGoal && <span className="ml-2 text-green-400">← Goal!</span>}</td>
                    <td className={`text-right py-2 font-bold ${isGoal ? 'text-green-400' : 'text-blue-400'}`}>{fmt(d.savings)}</td>
                    <td className="text-right py-2 text-slate-400">{fmt(d.downTarget)}</td>
                    <td className={`text-right py-2 font-bold ${gap <= 0 ? 'text-green-400' : 'text-red-400'}`}>{gap <= 0 ? 'Met!' : fmt(gap)}</td>
                    <td className="text-right py-2 text-purple-400">{fmt(d.invested)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Savings balance compounds monthly at your APY rate. Home price appreciates annually.
        3% minimum down is available for some conventional loans; FHA minimum is 3.5%.
        Down payments below 20% typically require PMI.
      </p>
    </div>
  )
}
