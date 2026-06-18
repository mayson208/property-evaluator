import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

interface Component {
  id: string
  name: string
  icon: string
  lifespan: number
  replacementCost: number
  lastReplaced: number
}

export default function MaintenanceReserve() {
  const { result, input } = usePropertyStore()

  const homeValue = result?.estimatedValue ?? 350000
  const age       = new Date().getFullYear() - (input.yearBuilt || 2000)
  const currentYear = new Date().getFullYear()

  const [components, setComponents] = useState<Component[]>([
    { id: 'roof',      name: 'Roof',               icon: '🏠', lifespan: 25, replacementCost: 15000, lastReplaced: input.yearBuilt || 2000 },
    { id: 'hvac',      name: 'HVAC System',         icon: '❄️', lifespan: 15, replacementCost: 8000,  lastReplaced: Math.max(input.yearBuilt || 2000, currentYear - 8) },
    { id: 'waterheater', name: 'Water Heater',      icon: '🚿', lifespan: 12, replacementCost: 1200,  lastReplaced: Math.max(input.yearBuilt || 2000, currentYear - 5) },
    { id: 'exterior',  name: 'Exterior Paint',      icon: '🎨', lifespan: 8,  replacementCost: 5000,  lastReplaced: Math.max(input.yearBuilt || 2000, currentYear - 4) },
    { id: 'appliances', name: 'Major Appliances',   icon: '🍳', lifespan: 12, replacementCost: 6000,  lastReplaced: Math.max(input.yearBuilt || 2000, currentYear - 6) },
    { id: 'floors',    name: 'Flooring',            icon: '🪵', lifespan: 20, replacementCost: 12000, lastReplaced: Math.max(input.yearBuilt || 2000, currentYear - 10) },
    { id: 'windows',   name: 'Windows & Doors',     icon: '🪟', lifespan: 20, replacementCost: 10000, lastReplaced: input.yearBuilt || 2000 },
    { id: 'plumbing',  name: 'Plumbing (repiping)', icon: '🔧', lifespan: 40, replacementCost: 8000,  lastReplaced: input.yearBuilt || 2000 },
    { id: 'electrical', name: 'Electrical Panel',   icon: '⚡', lifespan: 30, replacementCost: 4000,  lastReplaced: input.yearBuilt || 2000 },
    { id: 'driveway',  name: 'Driveway / Concrete', icon: '🚗', lifespan: 20, replacementCost: 5000,  lastReplaced: Math.max(input.yearBuilt || 2000, currentYear - 8) },
    { id: 'landscaping', name: 'Landscaping / Irrigation', icon: '🌿', lifespan: 10, replacementCost: 3000, lastReplaced: currentYear - 3 },
    { id: 'deck',      name: 'Deck / Fence',        icon: '🏗', lifespan: 15, replacementCost: 6000,  lastReplaced: Math.max(input.yearBuilt || 2000, currentYear - 7) },
  ])

  const [reserveFund,    setReserveFund]    = useState(5000)
  const [monthlySaving,  setMonthlySaving]  = useState(400)
  const [savingsRate,    setSavingsRate]    = useState(4.0)
  const [lookAheadYears, setLookAheadYears] = useState(10)

  const updateComponent = (id: string, patch: Partial<Component>) => {
    setComponents(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }

  const analysis = useMemo(() => {
    return components.map(c => {
      const ageOfComponent  = currentYear - c.lastReplaced
      const yearsRemaining  = Math.max(0, c.lifespan - ageOfComponent)
      const yearsOverdue    = Math.max(0, ageOfComponent - c.lifespan)
      const annualReserve   = c.replacementCost / c.lifespan
      const urgency         = yearsRemaining === 0 ? 'overdue' : yearsRemaining <= 2 ? 'urgent' : yearsRemaining <= 5 ? 'soon' : 'healthy'
      const dueYear         = c.lastReplaced + c.lifespan

      return { ...c, ageOfComponent, yearsRemaining, yearsOverdue, annualReserve, urgency, dueYear }
    })
  }, [components, currentYear])

  const totalAnnualReserve = analysis.reduce((s, c) => s + c.annualReserve, 0)
  const recommended1Pct    = homeValue * 0.01 / 12
  const recommended50      = homeValue * 0.005 / 12 + (age * 5)
  const overdue            = analysis.filter(c => c.urgency === 'overdue')
  const urgent             = analysis.filter(c => c.urgency === 'urgent')

  const upcomingCosts = useMemo(() => {
    const costs: { year: number; name: string; cost: number; icon: string }[] = []
    for (const c of analysis) {
      let nextDue = c.dueYear
      while (nextDue <= currentYear + lookAheadYears) {
        if (nextDue >= currentYear) costs.push({ year: nextDue, name: c.name, cost: c.replacementCost, icon: c.icon })
        nextDue += c.lifespan
      }
    }
    return costs.sort((a, b) => a.year - b.year)
  }, [analysis, currentYear, lookAheadYears])

  const yearlyFundData = useMemo(() => {
    let balance  = reserveFund
    const years: { yr: string; balance: number; costs: number }[] = []
    for (let yr = 0; yr <= lookAheadYears; yr++) {
      const year      = currentYear + yr
      const yearCosts = upcomingCosts.filter(c => c.year === year).reduce((s, c) => s + c.cost, 0)
      if (yr > 0) {
        balance += monthlySaving * 12
        balance *= (1 + savingsRate / 100)
        balance -= yearCosts
      }
      years.push({ yr: `${year}`, balance: Math.round(balance), costs: Math.round(yearCosts) })
    }
    return years
  }, [reserveFund, monthlySaving, savingsRate, upcomingCosts, currentYear, lookAheadYears])

  if (!result) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-4xl mb-3">🔧</p>
        <p>Run a valuation first to set up your maintenance reserve plan</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Maintenance Reserve Planner</h3>
        <p className="text-xs text-slate-500">
          Track when major home systems need replacement and build a reserve fund to cover them.
        </p>
      </div>

      {/* Alerts */}
      {overdue.length > 0 && (
        <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4">
          <p className="text-xs text-red-400 font-bold mb-2">⚠ Overdue Replacements</p>
          <ul className="space-y-1 text-xs text-slate-400">
            {overdue.map(c => (
              <li key={c.id}>{c.icon} <strong className="text-red-300">{c.name}</strong> — {c.yearsOverdue} year{c.yearsOverdue !== 1 ? 's' : ''} past expected lifespan (est. {fmt(c.replacementCost)})</li>
            ))}
          </ul>
        </div>
      )}

      {urgent.length > 0 && (
        <div className="bg-orange-900/20 border border-orange-700/40 rounded-xl p-4">
          <p className="text-xs text-orange-400 font-bold mb-2">Coming Up (within 2 years)</p>
          <ul className="space-y-1 text-xs text-slate-400">
            {urgent.map(c => (
              <li key={c.id}>{c.icon} <strong className="text-orange-300">{c.name}</strong> — due ~{c.dueYear} (est. {fmt(c.replacementCost)})</li>
            ))}
          </ul>
        </div>
      )}

      {/* Reserve fund */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Reserve Fund Settings</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Current Reserve Balance', value: reserveFund,    min: 0,    max: 100000, step: 500, set: setReserveFund,   fmt: fmt },
            { label: 'Monthly Contribution',    value: monthlySaving,  min: 0,    max: 2000,   step: 25,  set: setMonthlySaving, fmt: (v: number) => `${fmt(v)}/mo` },
            { label: 'Savings APY',             value: savingsRate,    min: 0,    max: 8,      step: 0.25, set: setSavingsRate,  fmt: (v: number) => `${v.toFixed(2)}%` },
            { label: 'Look Ahead',              value: lookAheadYears, min: 3,    max: 30,     step: 1,   set: setLookAheadYears, fmt: (v: number) => `${v} yrs` },
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

        <div className="grid grid-cols-3 gap-3 mt-2">
          {[
            { label: 'Recommended (1% Rule)',  value: fmt(recommended1Pct) + '/mo', color: 'text-blue-400' },
            { label: 'Your Monthly Saving',    value: fmt(monthlySaving) + '/mo',  color: monthlySaving >= recommended1Pct ? 'text-green-400' : 'text-red-400' },
            { label: 'Component-Based Target', value: fmt(totalAnnualReserve / 12) + '/mo', color: 'text-purple-400' },
          ].map(s => (
            <div key={s.label} className="bg-slate-900/60 rounded-lg p-3 text-center">
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className={`text-sm font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Reserve fund projection chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Reserve Fund Projection</p>
        <p className="text-xs text-slate-600 mb-4">Balance after deducting estimated replacement costs each year</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={yearlyFundData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="yr" tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} interval={1} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => v >= 0 ? `$${(v / 1000).toFixed(0)}K` : `-$${(Math.abs(v) / 1000).toFixed(0)}K`} width={50} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v: number, name: string) => [fmt(v), name]} />
            <Bar dataKey="balance" name="Reserve Balance" radius={[3, 3, 0, 0]}>
              {yearlyFundData.map((d, i) => <Cell key={i} fill={d.balance >= 0 ? '#3b82f6' : '#ef4444'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {yearlyFundData.some(d => d.balance < 0) && (
          <p className="text-xs text-red-400 text-center mt-2">⚠ Fund goes negative — increase monthly saving or defer non-critical repairs</p>
        )}
      </div>

      {/* Components table */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Home System Status</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700">
                <th className="text-left pb-2">Component</th>
                <th className="text-right pb-2">Last Replaced</th>
                <th className="text-right pb-2">Lifespan</th>
                <th className="text-right pb-2">Years Left</th>
                <th className="text-right pb-2">Due Year</th>
                <th className="text-right pb-2">Est. Cost</th>
                <th className="text-right pb-2">Monthly Reserve</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {analysis.map(c => (
                <tr key={c.id}>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <span>{c.icon}</span>
                      <span className="text-slate-300 font-semibold">{c.name}</span>
                    </div>
                  </td>
                  <td className="text-right py-2">
                    <input
                      type="number"
                      value={c.lastReplaced}
                      onChange={e => updateComponent(c.id, { lastReplaced: Number(e.target.value) })}
                      className="w-16 bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded px-1 py-0.5 text-right"
                    />
                  </td>
                  <td className="text-right py-2 text-slate-400">{c.lifespan}yr</td>
                  <td className="text-right py-2">
                    <span className={`font-bold ${
                      c.urgency === 'overdue' ? 'text-red-400' :
                      c.urgency === 'urgent'  ? 'text-orange-400' :
                      c.urgency === 'soon'    ? 'text-yellow-400' : 'text-green-400'
                    }`}>
                      {c.urgency === 'overdue' ? 'OVERDUE' : `${c.yearsRemaining}yr`}
                    </span>
                  </td>
                  <td className="text-right py-2 text-slate-400">{c.dueYear}</td>
                  <td className="text-right py-2 text-slate-300">
                    <input
                      type="number"
                      value={c.replacementCost}
                      onChange={e => updateComponent(c.id, { replacementCost: Number(e.target.value) })}
                      className="w-20 bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded px-1 py-0.5 text-right"
                    />
                  </td>
                  <td className="text-right py-2 text-blue-400 font-semibold">{fmt(c.annualReserve / 12)}</td>
                </tr>
              ))}
              <tr className="border-t border-slate-600 font-bold">
                <td className="py-2 text-slate-300" colSpan={5}>Total Monthly Reserve Needed</td>
                <td className="text-right py-2 text-slate-300">{fmt(analysis.reduce((s, c) => s + c.replacementCost, 0))}</td>
                <td className="text-right py-2 text-blue-400">{fmt(totalAnnualReserve / 12)}/mo</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Upcoming costs list */}
      {upcomingCosts.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Upcoming Replacements ({lookAheadYears}yr Horizon)</p>
          <div className="space-y-2">
            {upcomingCosts.map((c, i) => (
              <div key={`${c.name}-${c.year}-${i}`} className="flex items-center gap-3 text-xs">
                <span className="text-slate-500 w-10 flex-shrink-0">{c.year}</span>
                <span>{c.icon}</span>
                <span className="text-slate-300 flex-1">{c.name}</span>
                <span className="text-orange-400 font-bold">{fmt(c.cost)}</span>
              </div>
            ))}
            <div className="border-t border-slate-700 pt-2 flex justify-between text-xs font-bold">
              <span className="text-slate-400">Total over {lookAheadYears} years</span>
              <span className="text-orange-400">{fmt(upcomingCosts.reduce((s, c) => s + c.cost, 0))}</span>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-600 text-center">
        Replacement costs are estimates. Actual costs vary by location, contractor, and material prices.
        1% rule: set aside 1% of home value per year (~{fmt(recommended1Pct)}/mo for this property).
        Higher for older homes; adjust "Last Replaced" for each system to reflect your actual history.
      </p>
    </div>
  )
}
