import { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

interface Property {
  id: string
  label: string
  currentValue: number
  purchasePrice: number
  yearPurchased: number
  mortgageBalance: number
  monthlyRent: number
  monthlyExpenses: number   // insurance, tax, maintenance, vacancy reserve
  monthlyDebtService: number
}

const DEFAULT_PROPERTIES: Property[] = [
  {
    id: '1', label: '123 Main St (Primary)',
    currentValue: 450000, purchasePrice: 280000, yearPurchased: 2016,
    mortgageBalance: 180000, monthlyRent: 0, monthlyExpenses: 1200, monthlyDebtService: 1400,
  },
  {
    id: '2', label: '456 Oak Ave (Rental)',
    currentValue: 320000, purchasePrice: 220000, yearPurchased: 2019,
    mortgageBalance: 190000, monthlyRent: 2400, monthlyExpenses: 700, monthlyDebtService: 1100,
  },
  {
    id: '3', label: '789 Elm Rd (Rental)',
    currentValue: 270000, purchasePrice: 200000, yearPurchased: 2021,
    mortgageBalance: 175000, monthlyRent: 1900, monthlyExpenses: 600, monthlyDebtService: 980,
  },
]

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316', '#84cc16']

let nextId = 4
function makeId() { return String(nextId++) }

function emptyProperty(): Property {
  return {
    id: makeId(), label: 'New Property',
    currentValue: 300000, purchasePrice: 250000, yearPurchased: 2022,
    mortgageBalance: 200000, monthlyRent: 1800, monthlyExpenses: 600, monthlyDebtService: 1000,
  }
}

export default function PortfolioTracker() {
  const [properties, setProperties] = useState<Property[]>(DEFAULT_PROPERTIES)
  const [selectedId,  setSelectedId]  = useState<string | null>(null)

  const update = (id: string, field: keyof Property, value: string | number) => {
    setProperties(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  const addProperty = () => {
    const p = emptyProperty()
    setProperties(prev => [...prev, p])
    setSelectedId(p.id)
  }

  const removeProperty = (id: string) => {
    setProperties(prev => prev.filter(p => p.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  const metrics = useMemo(() => {
    const year = new Date().getFullYear()
    return properties.map(p => {
      const equity       = p.currentValue - p.mortgageBalance
      const ltv          = p.mortgageBalance / p.currentValue * 100
      const grossRentAnn = p.monthlyRent * 12
      const expenseAnn   = p.monthlyExpenses * 12
      const debtAnn      = p.monthlyDebtService * 12
      const noi          = grossRentAnn - expenseAnn
      const cashFlow     = noi - debtAnn
      const capRate      = p.currentValue > 0 ? noi / p.currentValue * 100 : 0
      const totalCashIn  = p.purchasePrice * 0.20 + p.purchasePrice * 0.03  // 20% down + 3% closing
      const coc          = totalCashIn > 0 && p.monthlyRent > 0 ? cashFlow / totalCashIn * 100 : 0
      const onePercent   = p.currentValue > 0 ? p.monthlyRent / p.currentValue * 100 : 0
      const totalReturn  = p.purchasePrice > 0 ? (p.currentValue - p.purchasePrice) / p.purchasePrice * 100 : 0
      const holdYears    = year - p.yearPurchased
      const annualReturn = holdYears > 0 ? (Math.pow(1 + totalReturn / 100, 1 / holdYears) - 1) * 100 : 0
      return { ...p, equity, ltv, noi, cashFlow, capRate, coc, onePercent, totalReturn, holdYears, annualReturn, grossRentAnn }
    })
  }, [properties])

  const totals = useMemo(() => {
    const totalValue    = metrics.reduce((s, m) => s + m.currentValue, 0)
    const totalDebt     = metrics.reduce((s, m) => s + m.mortgageBalance, 0)
    const totalEquity   = totalValue - totalDebt
    const totalNOI      = metrics.reduce((s, m) => s + m.noi, 0)
    const totalCashFlow = metrics.reduce((s, m) => s + m.cashFlow, 0)
    const totalRent     = metrics.reduce((s, m) => s + m.grossRentAnn, 0)
    const portfolioCapRate = totalValue > 0 ? totalNOI / totalValue * 100 : 0
    const overallLTV    = totalValue > 0 ? totalDebt / totalValue * 100 : 0
    const rentals       = metrics.filter(m => m.monthlyRent > 0)
    const avgCoc        = rentals.length > 0 ? rentals.reduce((s, m) => s + m.coc, 0) / rentals.length : 0
    const totalGain     = metrics.reduce((s, m) => s + (m.currentValue - m.purchasePrice), 0)

    // Health score
    let score = 0
    if (portfolioCapRate >= 6)   score += 2
    else if (portfolioCapRate >= 4) score += 1
    if (overallLTV <= 70)        score += 2
    else if (overallLTV <= 80)   score += 1
    if (totalCashFlow > 0)       score += 2
    if (avgCoc >= 8)             score += 2
    else if (avgCoc >= 5)        score += 1
    if (rentals.length >= 2)     score += 1

    const health = score >= 8 ? { label: 'Excellent', color: 'text-green-400', bg: 'bg-green-900/20 border-green-700/50' }
      : score >= 6 ? { label: 'Good', color: 'text-blue-400', bg: 'bg-blue-900/20 border-blue-700/50' }
      : score >= 4 ? { label: 'Fair', color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-700/50' }
      : { label: 'Needs Work', color: 'text-red-400', bg: 'bg-red-900/20 border-red-700/50' }

    return { totalValue, totalDebt, totalEquity, totalNOI, totalCashFlow, totalRent, portfolioCapRate, overallLTV, avgCoc, totalGain, health, score }
  }, [metrics])

  const equityData  = metrics.map(m => ({ name: m.label.split('(')[0].trim(), value: Math.max(m.equity, 0) }))
  const cashFlowData = metrics.map((m, i) => ({ name: m.label.split('(')[0].trim(), cf: m.cashFlow, color: COLORS[i % COLORS.length] }))

  const selected = selectedId ? metrics.find(m => m.id === selectedId) : null

  const NumInput = ({ label, value, field, propId, prefix = '', suffix = '' }: {
    label: string; value: number; field: keyof Property; propId: string; prefix?: string; suffix?: string
  }) => (
    <div>
      <label className="text-xs text-slate-500">{label}</label>
      <div className="flex items-center gap-1 mt-0.5">
        {prefix && <span className="text-xs text-slate-500">{prefix}</span>}
        <input type="number" value={value}
          onChange={e => update(propId, field, Number(e.target.value))}
          className="w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-sm text-slate-200" />
        {suffix && <span className="text-xs text-slate-500">{suffix}</span>}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Portfolio Tracker</h3>
          <p className="text-xs text-slate-500">Track all your properties — equity, cash flow, cap rates, and overall portfolio health.</p>
        </div>
        <button onClick={addProperty}
          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-semibold transition flex-shrink-0">
          + Add Property
        </button>
      </div>

      {/* Portfolio health banner */}
      <div className={`rounded-xl p-4 border ${totals.health.bg}`}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Portfolio Health</p>
          <span className={`text-xl font-black ${totals.health.color}`}>{totals.health.label}</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div className="h-2 rounded-full bg-gradient-to-r from-blue-600 to-green-500 transition-all"
            style={{ width: `${(totals.score / 9) * 100}%` }} />
        </div>
      </div>

      {/* Totals grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Portfolio Value',  val: fmt(totals.totalValue),     color: 'text-white' },
          { label: 'Total Equity',           val: fmt(totals.totalEquity),    color: 'text-green-400' },
          { label: 'Annual NOI',             val: fmt(totals.totalNOI),       color: 'text-blue-400' },
          { label: 'Annual Cash Flow',       val: fmt(totals.totalCashFlow),  color: totals.totalCashFlow >= 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'Portfolio Cap Rate',     val: totals.portfolioCapRate.toFixed(1) + '%', color: totals.portfolioCapRate >= 6 ? 'text-green-400' : 'text-yellow-400' },
          { label: 'Overall LTV',            val: totals.overallLTV.toFixed(1) + '%',  color: totals.overallLTV <= 70 ? 'text-green-400' : 'text-yellow-400' },
          { label: 'Avg Cash-on-Cash',       val: totals.avgCoc.toFixed(1) + '%',      color: totals.avgCoc >= 8 ? 'text-green-400' : 'text-yellow-400' },
          { label: 'Total Appreciation',     val: fmt(totals.totalGain),      color: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-lg font-black ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">Equity Distribution</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={equityData} dataKey="value" cx="50%" cy="50%" outerRadius={60} paddingAngle={3}>
                {equityData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(v: number) => [fmt(v), 'Equity']} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">Monthly Cash Flow by Property</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={cashFlowData.map(d => ({ ...d, cf: Math.round(d.cf / 12) }))} margin={{ top: 0, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(v: number) => [fmt(v), 'Monthly CF']} />
              <Bar dataKey="cf" radius={[4, 4, 0, 0]}>
                {cashFlowData.map((d, i) => (
                  <Cell key={i} fill={d.cf >= 0 ? COLORS[i % COLORS.length] : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Properties table */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-4 py-2 bg-slate-800/80 border-b border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Property Details</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700 text-slate-500">
                <th className="px-3 py-2 text-left">Property</th>
                <th className="px-3 py-2 text-right">Value</th>
                <th className="px-3 py-2 text-right">Equity</th>
                <th className="px-3 py-2 text-right">LTV</th>
                <th className="px-3 py-2 text-right">Mo. Rent</th>
                <th className="px-3 py-2 text-right">Mo. CF</th>
                <th className="px-3 py-2 text-right">Cap Rate</th>
                <th className="px-3 py-2 text-right">CoC</th>
                <th className="px-3 py-2 text-right">1% Rule</th>
                <th className="px-3 py-2 text-right">Ann. Appr</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {metrics.map((m, i) => (
                <tr key={m.id}
                  className={`cursor-pointer transition ${selectedId === m.id ? 'bg-blue-900/20' : 'hover:bg-slate-700/20'}`}
                  onClick={() => setSelectedId(selectedId === m.id ? null : m.id)}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-slate-300 font-semibold max-w-[120px] truncate">{m.label}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-300">{fmt(m.currentValue)}</td>
                  <td className="px-3 py-2 text-right text-green-400 font-semibold">{fmt(m.equity)}</td>
                  <td className="px-3 py-2 text-right">
                    <span className={m.ltv <= 70 ? 'text-green-400' : m.ltv <= 80 ? 'text-yellow-400' : 'text-red-400'}>
                      {m.ltv.toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-300">{m.monthlyRent > 0 ? fmt(m.monthlyRent) : '—'}</td>
                  <td className="px-3 py-2 text-right font-semibold">
                    <span className={m.cashFlow >= 0 ? 'text-green-400' : 'text-red-400'}>{fmt(m.cashFlow / 12)}/mo</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {m.monthlyRent > 0 ? (
                      <span className={m.capRate >= 6 ? 'text-green-400' : m.capRate >= 4 ? 'text-yellow-400' : 'text-red-400'}>
                        {m.capRate.toFixed(1)}%
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {m.monthlyRent > 0 ? (
                      <span className={m.coc >= 8 ? 'text-green-400' : m.coc >= 5 ? 'text-yellow-400' : 'text-red-400'}>
                        {m.coc.toFixed(1)}%
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {m.monthlyRent > 0 ? (
                      <span className={m.onePercent >= 1 ? 'text-green-400' : m.onePercent >= 0.75 ? 'text-yellow-400' : 'text-red-400'}>
                        {m.onePercent.toFixed(2)}%
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={m.annualReturn >= 5 ? 'text-green-400' : 'text-slate-400'}>
                      {m.annualReturn.toFixed(1)}%/yr
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={e => { e.stopPropagation(); removeProperty(m.id) }}
                      className="text-slate-600 hover:text-red-400 transition text-xs px-1">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inline editor for selected property */}
      {selected && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-blue-700/50">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Edit: {selected.label}</p>
            <button onClick={() => setSelectedId(null)} className="text-slate-500 hover:text-slate-300 text-xs">Close ✕</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="col-span-2 sm:col-span-3">
              <label className="text-xs text-slate-500">Label / Address</label>
              <input type="text" value={selected.label}
                onChange={e => update(selected.id, 'label', e.target.value)}
                className="mt-0.5 w-full bg-slate-900 border border-slate-600 rounded-lg px-2 py-1 text-sm text-slate-200" />
            </div>
            <NumInput label="Current Value ($)" value={selected.currentValue} field="currentValue" propId={selected.id} prefix="$" />
            <NumInput label="Purchase Price ($)" value={selected.purchasePrice} field="purchasePrice" propId={selected.id} prefix="$" />
            <NumInput label="Year Purchased" value={selected.yearPurchased} field="yearPurchased" propId={selected.id} />
            <NumInput label="Mortgage Balance ($)" value={selected.mortgageBalance} field="mortgageBalance" propId={selected.id} prefix="$" />
            <NumInput label="Monthly Rent ($)" value={selected.monthlyRent} field="monthlyRent" propId={selected.id} prefix="$" />
            <NumInput label="Monthly Expenses ($)" value={selected.monthlyExpenses} field="monthlyExpenses" propId={selected.id} prefix="$" />
            <NumInput label="Monthly Debt Service ($)" value={selected.monthlyDebtService} field="monthlyDebtService" propId={selected.id} prefix="$" />
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-2 font-bold">Metric Benchmarks</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-xs text-slate-500">
          <p><span className="text-green-400">Cap Rate ≥ 6%</span> = strong cash producer</p>
          <p><span className="text-green-400">CoC ≥ 8%</span> = solid return on cash invested</p>
          <p><span className="text-green-400">1% Rule ≥ 1%</span> = passes quick cash flow test</p>
          <p><span className="text-green-400">LTV ≤ 70%</span> = well-positioned equity buffer</p>
          <p><span className="text-yellow-400">4-6% Cap Rate</span> = typical for appreciating markets</p>
          <p><span className="text-red-400">Negative CF</span> = speculative / appreciation bet</p>
        </div>
      </div>
    </div>
  )
}
