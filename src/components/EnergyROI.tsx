import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

interface Upgrade {
  id: string
  name: string
  icon: string
  costLow: number
  costHigh: number
  annualSavingsLow: number
  annualSavingsHigh: number
  lifespan: number
  federalCredit: number
  valueAdd: number
  description: string
}

const UPGRADES: Upgrade[] = [
  {
    id: 'solar',
    name: 'Solar Panels (6kW)',
    icon: '☀️',
    costLow: 15000, costHigh: 25000,
    annualSavingsLow: 1200, annualSavingsHigh: 2400,
    lifespan: 25,
    federalCredit: 0.30,
    valueAdd: 15000,
    description: 'Reduces or eliminates electric bill. Federal tax credit of 30% through 2032 (IRA).',
  },
  {
    id: 'heatpump',
    name: 'Heat Pump (HVAC)',
    icon: '♨️',
    costLow: 5000, costHigh: 12000,
    annualSavingsLow: 400, annualSavingsHigh: 1200,
    lifespan: 15,
    federalCredit: 0.30,
    valueAdd: 5000,
    description: '30% federal tax credit (up to $2,000). 2–3× more efficient than electric resistance heating.',
  },
  {
    id: 'insulation',
    name: 'Air Sealing & Insulation',
    icon: '🏠',
    costLow: 1500, costHigh: 5000,
    annualSavingsLow: 200, annualSavingsHigh: 700,
    lifespan: 40,
    federalCredit: 0.30,
    valueAdd: 2000,
    description: '30% federal credit (up to $1,200). Often the highest ROI upgrade — reduces heating/cooling load.',
  },
  {
    id: 'windows',
    name: 'Energy-Efficient Windows',
    icon: '🪟',
    costLow: 8000, costHigh: 18000,
    annualSavingsLow: 200, annualSavingsHigh: 600,
    lifespan: 20,
    federalCredit: 0.30,
    valueAdd: 8000,
    description: 'Up to $600 in federal credits. ENERGY STAR rated windows reduce heating and cooling.',
  },
  {
    id: 'waterheater',
    name: 'Heat Pump Water Heater',
    icon: '🚿',
    costLow: 1200, costHigh: 2500,
    annualSavingsLow: 250, annualSavingsHigh: 550,
    lifespan: 15,
    federalCredit: 0.30,
    valueAdd: 1000,
    description: '30% federal credit (up to $2,000). 3–4× more efficient than standard electric water heaters.',
  },
  {
    id: 'battery',
    name: 'Home Battery (13.5kWh)',
    icon: '🔋',
    costLow: 8000, costHigh: 15000,
    annualSavingsLow: 300, annualSavingsHigh: 900,
    lifespan: 10,
    federalCredit: 0.30,
    valueAdd: 5000,
    description: 'Stores solar energy, provides backup power. 30% federal credit. Often paired with solar.',
  },
  {
    id: 'ledlighting',
    name: 'LED Lighting Upgrade',
    icon: '💡',
    costLow: 200, costHigh: 800,
    annualSavingsLow: 150, annualSavingsHigh: 400,
    lifespan: 15,
    federalCredit: 0,
    valueAdd: 0,
    description: 'Lowest-cost upgrade with fast payback. No federal credit but very high ROI.',
  },
  {
    id: 'evcharger',
    name: 'EV Charger (Level 2)',
    icon: '⚡',
    costLow: 800, costHigh: 2500,
    annualSavingsLow: 400, annualSavingsHigh: 1200,
    lifespan: 10,
    federalCredit: 0.30,
    valueAdd: 5000,
    description: '30% federal credit (up to $1,000). Saves vs public charging. Adds value for EV households.',
  },
]

export default function EnergyROI() {
  const { result } = usePropertyStore()

  const [selected,        setSelected]        = useState<Set<string>>(new Set(['solar', 'heatpump', 'insulation']))
  const [electricRate,    setElectricRate]    = useState(0.14)
  const [inflationRate,   setInflationRate]   = useState(3.5)
  const [hasTaxLiability, setHasTaxLiability] = useState(true)

  const homeValue = result?.estimatedValue ?? 400000

  const analysis = useMemo(() => {
    return UPGRADES.map(u => {
      const midCost    = (u.costLow + u.costHigh) / 2
      const midSavings = ((u.annualSavingsLow + u.annualSavingsHigh) / 2) * (electricRate / 0.14)
      const credit     = hasTaxLiability ? midCost * u.federalCredit : 0
      const netCost    = midCost - credit
      const payback    = netCost / midSavings
      const lifetimeNet = midSavings * u.lifespan - netCost
      const roi        = ((midSavings * u.lifespan - netCost) / netCost) * 100
      const irr        = payback > 0 ? (1 / payback) * 100 : 0

      return { ...u, midCost, midSavings, credit, netCost, payback, lifetimeNet, roi, irr }
    })
  }, [electricRate, hasTaxLiability])

  const selectedItems = analysis.filter(a => selected.has(a.id))
  const totalCost     = selectedItems.reduce((s, a) => s + a.midCost, 0)
  const totalCredit   = selectedItems.reduce((s, a) => s + a.credit, 0)
  const totalNetCost  = selectedItems.reduce((s, a) => s + a.netCost, 0)
  const totalAnnual   = selectedItems.reduce((s, a) => s + a.midSavings, 0)
  const totalValueAdd = selectedItems.reduce((s, a) => s + a.valueAdd, 0)
  const avgPayback    = totalAnnual > 0 ? totalNetCost / totalAnnual : 0

  const chartData = analysis.map(a => ({
    name: a.name.split(' ')[0],
    payback: Math.round(a.payback * 10) / 10,
    roi: Math.round(a.roi),
    selected: selected.has(a.id),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Energy Efficiency ROI</h3>
        <p className="text-xs text-slate-500">
          Calculate payback periods and lifetime savings for green home upgrades.
          Federal tax credits from the Inflation Reduction Act (IRA) included.
        </p>
      </div>

      {/* Settings */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Assumptions</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-slate-400 uppercase tracking-widest">Electricity Rate</label>
              <span className="text-xs font-bold text-blue-400">${electricRate.toFixed(2)}/kWh</span>
            </div>
            <input type="range" min={0.06} max={0.40} step={0.01} value={electricRate}
              onChange={e => setElectricRate(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
            <p className="text-xs text-slate-600 mt-1">US avg ~$0.14. CA/HI up to $0.35+</p>
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-slate-400 uppercase tracking-widest">Energy Cost Inflation</label>
              <span className="text-xs font-bold text-blue-400">{inflationRate.toFixed(1)}%/yr</span>
            </div>
            <input type="range" min={0} max={8} step={0.25} value={inflationRate}
              onChange={e => setInflationRate(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
          </div>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setHasTaxLiability(!hasTaxLiability)}
            className={`w-10 h-5 rounded-full transition-all relative ${hasTaxLiability ? 'bg-blue-600' : 'bg-slate-600'}`}>
            <span className={`absolute w-4 h-4 bg-white rounded-full top-0.5 transition-all ${hasTaxLiability ? 'left-5' : 'left-0.5'}`} />
          </div>
          <span className="text-xs text-slate-400">I have federal tax liability to use credits</span>
        </label>
      </div>

      {/* Upgrade cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {analysis.map(a => {
          const isSelected = selected.has(a.id)
          return (
            <div key={a.id}
              onClick={() => setSelected(prev => {
                const next = new Set(prev)
                next.has(a.id) ? next.delete(a.id) : next.add(a.id)
                return next
              })}
              className={`rounded-xl p-4 border cursor-pointer transition-all ${
                isSelected ? 'border-blue-500 bg-blue-900/20' : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
              }`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{a.icon}</span>
                  <p className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-300'}`}>{a.name}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-bold flex-shrink-0 ${
                  a.payback <= 5 ? 'bg-green-900/40 text-green-400' :
                  a.payback <= 12 ? 'bg-blue-900/40 text-blue-400' : 'bg-slate-700 text-slate-400'
                }`}>
                  {a.payback.toFixed(1)}yr payback
                </span>
              </div>

              <p className="text-xs text-slate-500 mb-3">{a.description}</p>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-slate-600">Net Cost</p>
                  <p className="text-sm font-bold text-red-400">{fmt(a.netCost)}</p>
                  {a.credit > 0 && <p className="text-xs text-green-400">−{fmt(a.credit)} credit</p>}
                </div>
                <div>
                  <p className="text-xs text-slate-600">Annual Save</p>
                  <p className="text-sm font-bold text-green-400">{fmt(a.midSavings)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-600">Lifetime Net</p>
                  <p className={`text-sm font-bold ${a.lifetimeNet >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {a.lifetimeNet >= 0 ? '+' : ''}{fmt(a.lifetimeNet)}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Selected summary */}
      {selectedItems.length > 0 && (
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Selected Package Summary</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
            {[
              { label: 'Total Cost',     value: fmt(totalCost),        color: 'text-slate-300' },
              { label: 'Federal Credits', value: `-${fmt(totalCredit)}`, color: 'text-green-400' },
              { label: 'Net Cost',        value: fmt(totalNetCost),     color: 'text-red-400' },
              { label: 'Annual Savings',  value: fmt(totalAnnual),      color: 'text-green-400' },
              { label: 'Avg Payback',     value: `${avgPayback.toFixed(1)} yrs`, color: avgPayback <= 8 ? 'text-green-400' : 'text-yellow-400' },
            ].map(s => (
              <div key={s.label}>
                <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
          {totalValueAdd > 0 && (
            <p className="text-xs text-slate-500 text-center mt-3">
              These upgrades may add approx. <span className="text-blue-400 font-bold">{fmt(totalValueAdd)}</span> to home resale value.
            </p>
          )}
        </div>
      )}

      {/* Payback chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Payback Period by Upgrade</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => `${v}yr`} width={35} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v: number) => [`${v} years`, 'Payback Period']} />
            <ReferenceLine y={10} stroke="#64748b" strokeDasharray="4 4"
              label={{ value: '10yr', fill: '#64748b', fontSize: 10, position: 'right' }} />
            <Bar dataKey="payback" radius={[4, 4, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.payback <= 5 ? '#22c55e' : d.payback <= 10 ? '#3b82f6' : '#64748b'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-4 justify-center mt-2 text-xs">
          {[['#22c55e', '≤5yr (excellent)'], ['#3b82f6', '5–10yr (good)'], ['#64748b', '>10yr (fair)']].map(([c, l]) => (
            <span key={l} className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />{l}
            </span>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Costs and savings are estimates. Actual results vary by home size, climate, utility rates, and installer.
        Federal credits are non-refundable and require sufficient tax liability. Consult an energy auditor and tax professional.
        IRA credits effective through 2032.
      </p>
    </div>
  )
}
