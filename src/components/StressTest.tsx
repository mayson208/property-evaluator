import { useMemo } from 'react'
import { useState } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { calculateInvestment } from '../engine/market'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function StatusBadge({ value, threshold, prefix = '' }: { value: number; threshold: number; prefix?: string }) {
  const ok = value >= threshold
  return (
    <span className={`text-sm font-black ${ok ? 'text-green-400' : 'text-red-400'}`}>
      {prefix}{value >= 0 ? '' : '-'}{fmt(Math.abs(value))}/mo
    </span>
  )
}

export default function StressTest() {
  const { result, monthlyRent: storeRent, downPaymentPct, interestRate } = usePropertyStore()

  const baseRent = storeRent > 0 ? storeRent : (result?.estimatedValue ? Math.round(result.estimatedValue * 0.007) : 2500)
  const propValue = result?.estimatedValue ?? 400000

  const [baseVacancy, setBaseVacancy] = useState(8)
  const [basePropTax, setBasePropTax] = useState(1.1)
  const [testCount, setTestCount]     = useState(100)   // number of scenarios

  // Run sweep: rent −30% to +30%, vacancy 0% to 30%
  const sweepData = useMemo(() => {
    const pts = []
    for (let rentDelta = -30; rentDelta <= 30; rentDelta += 5) {
      const rent = baseRent * (1 + rentDelta / 100)
      const analysis = calculateInvestment(propValue, rent, downPaymentPct, interestRate, {
        taxes: propValue * basePropTax / 100,
        insurance: Math.round(propValue * 0.005),
        maintenance: 1.0,
        vacancy: baseVacancy,
      })
      pts.push({
        rentChange: `${rentDelta >= 0 ? '+' : ''}${rentDelta}%`,
        cashFlow: Math.round(analysis.monthlyCashFlow),
        capRate: Math.round(analysis.capRate * 10) / 10,
        coc: Math.round(analysis.cashOnCash * 10) / 10,
      })
    }
    return pts
  }, [propValue, baseRent, downPaymentPct, interestRate, basePropTax, baseVacancy])

  const vacancySweep = useMemo(() => {
    return [0, 5, 10, 15, 20, 25, 30].map(vac => {
      const analysis = calculateInvestment(propValue, baseRent, downPaymentPct, interestRate, {
        taxes: propValue * basePropTax / 100,
        insurance: Math.round(propValue * 0.005),
        maintenance: 1.0,
        vacancy: vac,
      })
      return {
        label: `${vac}%`,
        cashFlow: Math.round(analysis.monthlyCashFlow),
        vacancy: vac,
      }
    })
  }, [propValue, baseRent, downPaymentPct, interestRate, basePropTax])

  const rateSweep = useMemo(() => {
    return [4, 5, 6, 7, 7.25, 8, 9, 10, 11, 12].map(rate => {
      const analysis = calculateInvestment(propValue, baseRent, downPaymentPct, rate, {
        taxes: propValue * basePropTax / 100,
        insurance: Math.round(propValue * 0.005),
        maintenance: 1.0,
        vacancy: baseVacancy,
      })
      return {
        label: `${rate}%`,
        cashFlow: Math.round(analysis.monthlyCashFlow),
        rate,
      }
    })
  }, [propValue, baseRent, downPaymentPct, basePropTax, baseVacancy])

  const base = calculateInvestment(propValue, baseRent, downPaymentPct, interestRate, {
    taxes: propValue * basePropTax / 100,
    insurance: Math.round(propValue * 0.005),
    maintenance: 1.0,
    vacancy: baseVacancy,
  })

  const rentBreakEvenDrop = sweepData.find(p => p.cashFlow < 0)?.rentChange ?? 'Never (>-30%)'
  const vacancyBreakEven  = vacancySweep.find(p => p.cashFlow < 0)?.vacancy ?? null

  if (!result) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-4xl mb-3">⚡</p>
        <p>Run a valuation first to stress-test your investment</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Investment Stress Test</h3>
        <p className="text-xs text-slate-500">
          See how rent drops, vacancy spikes, and rate changes affect your cash flow
        </p>
      </div>

      {/* Base case */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">Base Case</p>
        <div className="grid grid-cols-4 gap-4 text-center">
          {[
            { label: 'Monthly Cash Flow', value: fmt(base.monthlyCashFlow), color: base.monthlyCashFlow >= 0 ? 'text-green-400' : 'text-red-400' },
            { label: 'Cap Rate',          value: `${base.capRate.toFixed(2)}%`, color: 'text-blue-400' },
            { label: 'Cash-on-Cash',      value: `${base.cashOnCash.toFixed(1)}%`, color: 'text-purple-400' },
            { label: 'Break-even Rent',   value: rentBreakEvenDrop, color: 'text-orange-400' },
          ].map(s => (
            <div key={s.label}>
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className={`text-lg font-black ${s.color}`}>{String(s.value)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Base Assumptions</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-slate-400 uppercase tracking-widest">Base Vacancy</label>
              <span className="text-xs font-bold text-blue-400">{baseVacancy}%</span>
            </div>
            <input type="range" min={0} max={20} step={1} value={baseVacancy}
              onChange={e => setBaseVacancy(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-slate-400 uppercase tracking-widest">Property Tax Rate</label>
              <span className="text-xs font-bold text-blue-400">{basePropTax}%</span>
            </div>
            <input type="range" min={0.3} max={3} step={0.1} value={basePropTax}
              onChange={e => setBasePropTax(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
          </div>
        </div>
      </div>

      {/* Rent sensitivity chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Monthly Cash Flow vs Rent Change</p>
        <p className="text-xs text-slate-600 mb-4">Base rent: {fmt(baseRent)}/mo</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={sweepData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="rentChange" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false}
              tickFormatter={v => `$${v}`} width={60} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v: number) => [fmt(v), 'Monthly Cash Flow']} />
            <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" label={{ value: 'Break-even', fill: '#64748b', fontSize: 10 }} />
            <Line type="monotone" dataKey="cashFlow" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Vacancy sensitivity */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Cash Flow vs Vacancy Rate</p>
        {vacancyBreakEven !== null && (
          <p className="text-xs text-orange-400 mb-4">
            Cash flow turns negative at {vacancyBreakEven}% vacancy
          </p>
        )}
        <div className="space-y-2">
          {vacancySweep.map(v => (
            <div key={v.label} className="flex items-center gap-3">
              <span className="text-xs text-slate-400 w-8 flex-shrink-0">{v.label}</span>
              <div className="flex-1 h-5 bg-slate-700 rounded overflow-hidden relative">
                <div
                  className={`h-full rounded transition-all ${v.cashFlow >= 0 ? 'bg-blue-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, Math.abs(v.cashFlow) / (Math.abs(base.monthlyCashFlow) * 1.5) * 100)}%` }}
                />
              </div>
              <span className={`text-xs font-bold w-20 text-right ${v.cashFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {fmt(v.cashFlow)}/mo
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Interest rate sensitivity */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Cash Flow vs Interest Rate (30yr fixed)</p>
        <div className="space-y-2">
          {rateSweep.map(r => (
            <div key={r.label} className={`flex items-center gap-3 ${r.rate === interestRate ? 'opacity-100' : 'opacity-70'}`}>
              <span className={`text-xs w-10 flex-shrink-0 ${r.rate === interestRate ? 'text-blue-400 font-bold' : 'text-slate-400'}`}>{r.label}</span>
              <div className="flex-1 h-5 bg-slate-700 rounded overflow-hidden">
                <div
                  className={`h-full rounded ${r.cashFlow >= 0 ? 'bg-blue-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(100, Math.abs(r.cashFlow) / (Math.abs(base.monthlyCashFlow) * 2 || 100) * 100)}%` }}
                />
              </div>
              <span className={`text-xs font-bold w-24 text-right ${r.cashFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {fmt(r.cashFlow)}/mo
                {r.rate === interestRate && <span className="text-blue-400 ml-1">◀</span>}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Stress test uses the base rental assumptions from the Investment tab. Adjust them there for more accurate results.
        All scenarios assume 30-year fixed financing.
      </p>
    </div>
  )
}
