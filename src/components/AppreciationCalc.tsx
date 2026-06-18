import { useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function fmtPct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

// Historical US average appreciation by year (rough estimates based on NAR/FHFA data)
const ANNUAL_RATES: Record<number, number> = {
  2000: 7.2, 2001: 6.4, 2002: 7.1, 2003: 8.0, 2004: 11.1, 2005: 12.4,
  2006: 0.2, 2007: -4.5, 2008: -12.0, 2009: -5.0, 2010: -1.8,
  2011: -3.9, 2012: 6.5, 2013: 10.8, 2014: 5.6, 2015: 5.5,
  2016: 5.8, 2017: 6.2, 2018: 5.5, 2019: 3.8, 2020: 8.4,
  2021: 18.8, 2022: 5.2, 2023: 3.0, 2024: 4.2, 2025: 3.5,
}

function getAppreciation(purchasePrice: number, purchaseYear: number): { year: number; value: number; rate: number }[] {
  const currentYear = new Date().getFullYear()
  const points = []
  let value = purchasePrice

  for (let yr = purchaseYear; yr <= currentYear; yr++) {
    const rate = ANNUAL_RATES[yr] ?? 3.5
    if (yr > purchaseYear) value = value * (1 + rate / 100)
    points.push({ year: yr, value: Math.round(value), rate })
  }
  return points
}

function futureProject(currentValue: number, currentYear: number, rate: number) {
  const points = []
  let value = currentValue
  for (let yr = currentYear; yr <= currentYear + 10; yr++) {
    points.push({ year: yr, value: Math.round(value) })
    value = value * (1 + rate / 100)
  }
  return points
}

export default function AppreciationCalc() {
  const [purchasePrice, setPurchasePrice] = useState(300000)
  const [purchaseYear, setPurchaseYear]   = useState(2015)
  const [futureRate, setFutureRate]       = useState(3.5)

  const currentYear = new Date().getFullYear()
  const history = useMemo(() => getAppreciation(purchasePrice, purchaseYear), [purchasePrice, purchaseYear])
  const currentValue = history[history.length - 1]?.value ?? purchasePrice
  const totalGain = currentValue - purchasePrice
  const totalPct = ((currentValue - purchasePrice) / purchasePrice) * 100
  const years = currentYear - purchaseYear
  const cagr = years > 0 ? (Math.pow(currentValue / purchasePrice, 1 / years) - 1) * 100 : 0

  const future = useMemo(() => futureProject(currentValue, currentYear, futureRate), [currentValue, currentYear, futureRate])
  const val5yr  = future[5]?.value  ?? currentValue
  const val10yr = future[10]?.value ?? currentValue

  // Combine for chart
  const combined = [
    ...history.map(p => ({ year: p.year, historical: p.value, projected: undefined as number | undefined })),
    ...future.slice(1).map(p => ({ year: p.year, historical: undefined as number | undefined, projected: p.value })),
  ]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Appreciation Calculator</h3>
        <p className="text-xs text-slate-500">Historical US market appreciation + future projection</p>
      </div>

      {/* Inputs */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-widest block mb-1">Purchase Price</label>
            <input
              type="number"
              value={purchasePrice}
              onChange={e => setPurchasePrice(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-widest block mb-1">Year Purchased</label>
            <input
              type="number"
              min={2000}
              max={currentYear}
              value={purchaseYear}
              onChange={e => setPurchaseYear(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs text-slate-400 uppercase tracking-widest">Future Rate</label>
            <span className="text-xs font-bold text-blue-400">{futureRate}%/yr</span>
          </div>
          <input type="range" min={0} max={12} step={0.5} value={futureRate}
            onChange={e => setFutureRate(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-xs text-slate-600 mt-1">
            <span>0% (flat)</span><span>3.5% (hist. avg)</span><span>12% (boom)</span>
          </div>
        </div>
      </div>

      {/* Current value hero */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 border border-slate-700">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs text-slate-400 mb-1">Estimated Current Value</p>
            <p className="text-3xl font-black text-white">{fmt(currentValue)}</p>
            <p className="text-sm text-slate-400 mt-1">Purchased {fmt(purchasePrice)} in {purchaseYear}</p>
          </div>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-slate-500">Total Gain</p>
              <p className={`text-xl font-black ${totalGain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalGain >= 0 ? '+' : ''}{fmt(totalGain)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Total Return</p>
              <p className={`text-lg font-bold ${totalPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {fmtPct(totalPct)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">CAGR ({years} yrs)</p>
              <p className="text-lg font-bold text-blue-400">{fmtPct(cagr)}/yr</p>
            </div>
          </div>
        </div>
      </div>

      {/* Combined chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">
          Historical Value · <span className="text-blue-400">Projected ({futureRate}%/yr)</span>
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={combined} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} width={60} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v: number) => [fmt(v), '']}
            />
            <ReferenceLine x={currentYear} stroke="#64748b" strokeDasharray="4 4"
              label={{ value: 'Today', fill: '#94a3b8', fontSize: 11 }} />
            <Area type="monotone" dataKey="historical" name="Historical" stroke="#22c55e"
              strokeWidth={2} fill="url(#histGrad)" dot={false} connectNulls={false} />
            <Area type="monotone" dataKey="projected" name="Projected" stroke="#3b82f6"
              strokeWidth={2} fill="url(#projGrad)" dot={false} strokeDasharray="5 3" connectNulls={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Annual history table */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Year-by-Year Breakdown</p>
        </div>
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-800">
              <tr>
                <th className="text-left py-2 px-4 text-xs text-slate-400 font-semibold">Year</th>
                <th className="text-right py-2 px-4 text-xs text-slate-400 font-semibold">Rate</th>
                <th className="text-right py-2 px-4 text-xs text-slate-400 font-semibold">Value</th>
                <th className="text-right py-2 px-4 text-xs text-slate-400 font-semibold">Gain</th>
              </tr>
            </thead>
            <tbody>
              {history.map((p, i) => {
                const gain = p.value - (history[i - 1]?.value ?? purchasePrice)
                return (
                  <tr key={p.year} className="border-t border-slate-700/50">
                    <td className="py-1.5 px-4 font-mono text-slate-300">{p.year}</td>
                    <td className={`py-1.5 px-4 text-right font-mono ${p.rate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {fmtPct(p.rate)}
                    </td>
                    <td className="py-1.5 px-4 text-right font-mono text-slate-200">{fmt(p.value)}</td>
                    <td className={`py-1.5 px-4 text-right font-mono ${gain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {i === 0 ? '—' : `${gain >= 0 ? '+' : ''}${fmt(gain)}`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Future projections */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '5-Year Value',  value: val5yr,  gain: val5yr - currentValue },
          { label: '10-Year Value', value: val10yr, gain: val10yr - currentValue },
          { label: '10-yr Return',  value: null,    gain: ((val10yr - currentValue) / currentValue) * 100, isPct: true },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">{s.label}</p>
            {s.value !== null && <p className="text-lg font-black text-white">{fmt(s.value)}</p>}
            <p className={`text-sm font-bold mt-0.5 ${s.gain >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {s.isPct ? fmtPct(s.gain) : `+${fmt(s.gain)}`}
            </p>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-600 text-center">
        Historical rates based on US national averages (NAR/FHFA). Actual appreciation varies significantly by location, condition, and market cycle.
      </p>
    </div>
  )
}
