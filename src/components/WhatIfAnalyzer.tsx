import { useMemo } from 'react'
import { useState } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function monthlyPayment(loan: number, annualRate: number, months = 360) {
  const r = annualRate / 100 / 12
  if (r === 0) return loan / months
  return (loan * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
}

type ScenarioKey = 'rates' | 'value' | 'timing' | 'downpayment'

export default function WhatIfAnalyzer() {
  const { result, input } = usePropertyStore()
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>('rates')

  const baseValue = result?.estimatedValue ?? 400000

  // Rate sensitivity
  const [baseRate, setBaseRate] = useState(7.25)
  const [downPct, setDownPct]   = useState(20)

  // Value sensitivity: what if the market moves up/down
  const [timingYears, setTimingYears] = useState(2)
  const [annualAppreciation, setAnnualAppreciation] = useState(3.5)

  const loanAmount = baseValue * (1 - downPct / 100)

  const rateData = useMemo(() => {
    return [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2].map(delta => {
      const rate = Math.max(1, baseRate + delta)
      const payment = monthlyPayment(loanAmount, rate)
      return {
        rate: `${rate.toFixed(2)}%`,
        payment: Math.round(payment),
        delta,
        label: delta === 0 ? 'Today' : `${delta > 0 ? '+' : ''}${delta}%`,
      }
    })
  }, [loanAmount, baseRate])

  const timingData = useMemo(() => {
    return Array.from({ length: timingYears * 2 + 1 }, (_, i) => {
      const yr = i - timingYears
      const futureValue = baseValue * Math.pow(1 + annualAppreciation / 100, yr)
      const futureLoan = futureValue * (1 - downPct / 100)
      const rateAtTime = Math.max(1, baseRate + (yr < 0 ? 0.5 : yr > 0 ? -0.25 : 0) * Math.abs(yr))
      const payment = monthlyPayment(futureLoan, rateAtTime)
      return {
        label: yr === 0 ? 'Now' : yr > 0 ? `+${yr}yr` : `${yr}yr`,
        value: Math.round(futureValue),
        payment: Math.round(payment),
        yr,
      }
    })
  }, [baseValue, downPct, baseRate, timingYears, annualAppreciation])

  const downPaymentData = useMemo(() => {
    return [5, 10, 15, 20, 25, 30].map(pct => {
      const loan = baseValue * (1 - pct / 100)
      const down = baseValue * pct / 100
      const payment = monthlyPayment(loan, baseRate)
      const hasPMI = pct < 20
      const pmiMonthly = hasPMI ? (loan * 0.005 / 12) : 0
      return {
        pct: `${pct}%`,
        payment: Math.round(payment + pmiMonthly),
        down: Math.round(down),
        loan: Math.round(loan),
        hasPMI,
      }
    })
  }, [baseValue, baseRate])

  const scenarios: { key: ScenarioKey; label: string; icon: string }[] = [
    { key: 'rates',       label: 'Rate Sensitivity',  icon: '📊' },
    { key: 'timing',      label: 'Buy Now vs Later',  icon: '⏳' },
    { key: 'downpayment', label: 'Down Payment',      icon: '💵' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">What-If Analyzer</h3>
        <p className="text-xs text-slate-500">Explore how rate changes, timing, and down payment affect your costs</p>
      </div>

      {result && (
        <div className="bg-blue-900/30 border border-blue-800/50 rounded-xl p-3 text-xs text-blue-300">
          Based on estimated value <strong>{fmt(baseValue)}</strong> · {downPct}% down = {fmt(loanAmount)} loan
        </div>
      )}

      {/* Scenario tabs */}
      <div className="flex gap-2">
        {scenarios.map(s => (
          <button key={s.key} onClick={() => setActiveScenario(s.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-semibold transition ${
              activeScenario === s.key ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
            }`}>
            <span>{s.icon}</span>{s.label}
          </button>
        ))}
      </div>

      {/* Global controls */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs text-slate-400 uppercase tracking-widest">Base Interest Rate</label>
            <span className="text-xs font-bold text-blue-400">{baseRate}%</span>
          </div>
          <input type="range" min={3} max={12} step={0.125} value={baseRate}
            onChange={e => setBaseRate(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs text-slate-400 uppercase tracking-widest">Down Payment</label>
            <span className="text-xs font-bold text-blue-400">{downPct}% ({fmt(baseValue * downPct / 100)})</span>
          </div>
          <input type="range" min={3} max={50} step={1} value={downPct}
            onChange={e => setDownPct(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
        </div>
      </div>

      {/* Rate Sensitivity */}
      {activeScenario === 'rates' && (
        <div className="space-y-4">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Monthly P&I Payment vs Interest Rate</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={rateData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false}
                  tickFormatter={v => `$${(v / 1000).toFixed(1)}K`} width={55} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
                  formatter={(v: number) => [fmt(v), 'Monthly P&I']} />
                <Bar dataKey="payment" radius={[4, 4, 0, 0]}>
                  {rateData.map((d, i) => (
                    <Cell key={i} fill={d.delta === 0 ? '#3b82f6' : d.delta < 0 ? '#22c55e' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {rateData.filter(d => d.delta !== 0 && Math.abs(d.delta) % 1 === 0).map(d => {
              const current = rateData.find(r => r.delta === 0)!
              const diff = d.payment - current.payment
              return (
                <div key={d.rate} className="flex justify-between items-center bg-slate-800/30 rounded-lg px-3 py-2 text-sm border border-slate-700/50">
                  <span className="text-slate-400">{d.rate} rate</span>
                  <span className="font-mono text-slate-200">{fmt(d.payment)}/mo</span>
                  <span className={`font-mono text-xs font-bold ${diff < 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {diff < 0 ? '' : '+'}{fmt(diff)}/mo
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Timing Analysis */}
      {activeScenario === 'timing' && (
        <div className="space-y-4">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-slate-400 uppercase tracking-widest">Analysis Window (years)</label>
                <span className="text-xs font-bold text-blue-400">±{timingYears} years</span>
              </div>
              <input type="range" min={1} max={5} step={1} value={timingYears}
                onChange={e => setTimingYears(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-slate-400 uppercase tracking-widest">Annual Appreciation</label>
                <span className="text-xs font-bold text-orange-400">{annualAppreciation}%/yr</span>
              </div>
              <input type="range" min={0} max={10} step={0.5} value={annualAppreciation}
                onChange={e => setAnnualAppreciation(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-orange-500" />
            </div>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Home Price Over Time</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={timingData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false}
                  tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} width={60} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
                  formatter={(v: number, name: string) => [fmt(v), name === 'value' ? 'Home Price' : 'Monthly Payment']} />
                <ReferenceLine x="Now" stroke="#64748b" strokeDasharray="4 4" />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {timingData.map((d, i) => (
                    <Cell key={i} fill={d.yr === 0 ? '#3b82f6' : d.yr < 0 ? '#22c55e' : '#f59e0b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {timingData.map(d => (
              <div key={d.label} className={`flex justify-between items-center rounded-lg px-3 py-2 text-sm border ${
                d.yr === 0 ? 'bg-blue-900/20 border-blue-700/50' : 'bg-slate-800/30 border-slate-700/50'
              }`}>
                <span className={d.yr === 0 ? 'text-blue-300 font-bold' : 'text-slate-400'}>{d.label}</span>
                <span className="font-mono text-slate-200">{fmt(d.value)}</span>
                <span className="text-xs text-slate-500">{fmt(d.payment)}/mo P&I</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Down Payment Comparison */}
      {activeScenario === 'downpayment' && (
        <div className="space-y-4">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Monthly Payment by Down Payment %</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={downPaymentData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="pct" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false}
                  tickFormatter={v => `$${(v / 1000).toFixed(1)}K`} width={55} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
                  formatter={(v: number) => [fmt(v), 'Monthly (P&I + PMI)']} />
                <Bar dataKey="payment" radius={[4, 4, 0, 0]}>
                  {downPaymentData.map((d, i) => (
                    <Cell key={i} fill={d.hasPMI ? '#f59e0b' : '#22c55e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-slate-600 text-center mt-2">
              <span className="inline-block w-2 h-2 bg-yellow-500 rounded-sm mr-1" />Yellow = PMI required (&lt;20% down)
              &nbsp;·&nbsp;
              <span className="inline-block w-2 h-2 bg-green-500 rounded-sm mr-1" />Green = No PMI
            </p>
          </div>

          <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <p className="text-xs text-slate-400 uppercase tracking-widest">Down Payment Comparison Table</p>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-800">
                <tr>
                  <th className="text-left py-2 px-4 text-xs text-slate-400 font-semibold">Down %</th>
                  <th className="text-right py-2 px-4 text-xs text-slate-400 font-semibold">Cash Needed</th>
                  <th className="text-right py-2 px-4 text-xs text-slate-400 font-semibold">Loan</th>
                  <th className="text-right py-2 px-4 text-xs text-slate-400 font-semibold">Monthly</th>
                </tr>
              </thead>
              <tbody>
                {downPaymentData.map(d => (
                  <tr key={d.pct} className={`border-t border-slate-700/50 ${d.pct === `${downPct}%` ? 'bg-blue-900/20' : ''}`}>
                    <td className="py-2 px-4">
                      <span className="font-mono text-slate-200">{d.pct}</span>
                      {d.hasPMI && <span className="ml-2 text-xs text-yellow-400 font-semibold">+PMI</span>}
                    </td>
                    <td className="py-2 px-4 text-right font-mono text-red-400">{fmt(d.down)}</td>
                    <td className="py-2 px-4 text-right font-mono text-slate-400">{fmt(d.loan)}</td>
                    <td className="py-2 px-4 text-right font-mono font-bold text-slate-200">{fmt(d.payment)}/mo</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-600 text-center">
        All scenarios assume 30-year fixed-rate mortgage. Does not include property tax, insurance, or HOA.
      </p>
    </div>
  )
}
