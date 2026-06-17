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

  const latest = data[data.length - 1]
  const prev   = data[data.length - 13]  // year ago
  const pctChange = ((latest.medianPrice - prev.medianPrice) / prev.medianPrice) * 100
  const ppfChange = ((latest.pricePerSqft - prev.pricePerSqft) / prev.pricePerSqft) * 100

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">
          {input.state || 'US'} Market — Last 24 Months
        </h3>
        <p className="text-xs text-slate-500">Simulated market data based on state averages</p>
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
          sub="avg days to sell"
        />
        <StatCard
          label="Inventory"
          value={`${latest.inventory.toFixed(1)} mo`}
          sub={latest.inventory < 3 ? "Seller's market" : latest.inventory < 6 ? 'Balanced' : "Buyer's market"}
          up={latest.inventory < 3 ? true : undefined}
        />
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
