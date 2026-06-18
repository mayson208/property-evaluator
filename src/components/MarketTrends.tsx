import { useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from 'recharts'
import { usePropertyStore } from '../store/usePropertyStore'
import { generateMarketData } from '../engine/market'

const STATE_PPF: Record<string, number> = {
  CA: 520, NY: 480, WA: 420, MA: 410, CO: 380, TX: 195, FL: 265,
  IL: 195, AZ: 230, NV: 245, OR: 310, GA: 190, NC: 185, OH: 165,
  PA: 175, MI: 160, MN: 195, WI: 155, MO: 145, TN: 195, VA: 240,
  SC: 185, AL: 148, KY: 148, IN: 155, UT: 280, ID: 250, MT: 255,
  WY: 215, NM: 180, OK: 145, KS: 145, NE: 165, SD: 185, ND: 185,
  IA: 148, AR: 135, LA: 148, MS: 130, WV: 120, ME: 265, NH: 295,
  VT: 265, RI: 310, CT: 285, NJ: 360, DE: 245, MD: 295, HI: 650,
  AK: 285, DC: 620,
}

function fmt(n: number) {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(2)}M`
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`
  return `$${n}`
}

function StatCard({ label, value, sub, up }: { label: string; value: string; sub?: string; up?: boolean }) {
  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
      <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-xl font-black text-white">{value}</p>
      {sub && (
        <p className={`text-xs mt-0.5 ${up === true ? 'text-green-400' : up === false ? 'text-red-400' : 'text-slate-500'}`}>
          {sub}
        </p>
      )}
    </div>
  )
}

export default function MarketTrends() {
  const { input, result } = usePropertyStore()

  const basePPF = STATE_PPF[input.state.toUpperCase()] ?? 200
  const data = useMemo(() => generateMarketData(input.state, basePPF), [input.state, basePPF])

  const latest  = data[data.length - 1]
  const prev1yr = data[data.length - 13]  // year ago
  const prev6mo = data[data.length - 7]   // 6 months ago
  const prev3mo = data[data.length - 4]   // 3 months ago
  const pctChange = ((latest.medianPrice - prev1yr.medianPrice) / prev1yr.medianPrice) * 100
  const pct6mo    = ((latest.medianPrice - prev6mo.medianPrice) / prev6mo.medianPrice) * 100
  const pct3mo    = ((latest.medianPrice - prev3mo.medianPrice) / prev3mo.medianPrice) * 100
  const ppfChange = ((latest.pricePerSqft - prev1yr.pricePerSqft) / prev1yr.pricePerSqft) * 100

  // Market condition score (lower inventory + lower DOM + higher appreciation = seller's market)
  const marketScore = Math.round(
    (latest.inventory < 3 ? 80 : latest.inventory < 6 ? 50 : 20) * 0.4 +
    (latest.daysOnMarket < 20 ? 80 : latest.daysOnMarket < 35 ? 55 : 25) * 0.3 +
    (pctChange > 5 ? 80 : pctChange > 0 ? 55 : 30) * 0.3
  )
  const marketLabel = marketScore >= 65 ? "Seller's Market" : marketScore >= 40 ? 'Balanced Market' : "Buyer's Market"
  const marketColor = marketScore >= 65 ? 'text-green-400' : marketScore >= 40 ? 'text-yellow-400' : 'text-blue-400'

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">
          {input.state || 'US'} Market — Last 24 Months
        </h3>
        <p className="text-xs text-slate-500">Simulated market data based on state averages</p>
      </div>

      {/* Market condition banner */}
      <div className={`rounded-xl p-4 border flex items-center justify-between ${
        marketScore >= 65 ? 'bg-green-900/20 border-green-700/50' :
        marketScore >= 40 ? 'bg-yellow-900/20 border-yellow-700/50' :
        'bg-blue-900/20 border-blue-700/50'
      }`}>
        <div>
          <p className={`text-lg font-black ${marketColor}`}>{marketLabel}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {marketScore >= 65
              ? 'Low inventory and fast sales favor sellers — prices trending up'
              : marketScore >= 40
              ? 'Balanced conditions — neither buyers nor sellers have a clear advantage'
              : 'High inventory and slower sales give buyers more negotiating power'}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-3xl font-black text-white">{marketScore}</p>
          <p className="text-xs text-slate-500">Market Score</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Median Price"
          value={fmt(latest.medianPrice)}
          sub={`${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(1)}% YoY`}
          up={pctChange >= 0}
        />
        <StatCard
          label="Price / sqft"
          value={`$${latest.pricePerSqft}`}
          sub={`${ppfChange >= 0 ? '+' : ''}${ppfChange.toFixed(1)}% YoY`}
          up={ppfChange >= 0}
        />
        <StatCard
          label="Days on Market"
          value={`${latest.daysOnMarket}`}
          sub={latest.daysOnMarket < 20 ? 'Moving fast' : latest.daysOnMarket < 40 ? 'Normal pace' : 'Slower market'}
        />
        <StatCard
          label="Inventory"
          value={`${latest.inventory.toFixed(1)} mo`}
          sub={latest.inventory < 3 ? "Seller's market" : latest.inventory < 6 ? 'Balanced' : "Buyer's market"}
          up={latest.inventory < 3 ? true : undefined}
        />
      </div>

      {/* Price momentum */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">Price Momentum</p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: '3-Month', pct: pct3mo },
            { label: '6-Month', pct: pct6mo },
            { label: '12-Month', pct: pctChange },
          ].map(m => (
            <div key={m.label} className="text-center">
              <p className="text-xs text-slate-500 mb-1">{m.label}</p>
              <p className={`text-xl font-black ${m.pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {m.pct >= 0 ? '+' : ''}{m.pct.toFixed(1)}%
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Median price chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Median Home Price</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="month"
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickLine={false}
              interval={3}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={fmt}
              width={65}
            />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v: number) => [fmt(v), 'Median Price']}
            />
            {result && (
              <ReferenceLine y={result.estimatedValue} stroke="#60a5fa" strokeDasharray="4 4"
                label={{ value: 'Your Home', fill: '#60a5fa', fontSize: 11 }} />
            )}
            <Area type="monotone" dataKey="medianPrice" stroke="#3b82f6" strokeWidth={2}
              fill="url(#priceGrad)" dot={false} activeDot={{ r: 4, fill: '#3b82f6' }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Price per sqft chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Price per Sqft</p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} interval={3} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false}
              tickFormatter={v => `$${v}`} width={50} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v: number) => [`$${v}`, '$/sqft']}
            />
            {result && (
              <ReferenceLine y={result.pricePerSqft} stroke="#a78bfa" strokeDasharray="4 4"
                label={{ value: 'Your $/sqft', fill: '#a78bfa', fontSize: 11 }} />
            )}
            <Line type="monotone" dataKey="pricePerSqft" stroke="#a78bfa" strokeWidth={2}
              dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Days on market chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Days on Market</p>
        <ResponsiveContainer width="100%" height={130}>
          <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="domGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} interval={3} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} width={35} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v: number) => [`${v} days`, 'Avg DOM']}
            />
            <Area type="monotone" dataKey="daysOnMarket" stroke="#f59e0b" strokeWidth={2}
              fill="url(#domGrad)" dot={false} activeDot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
