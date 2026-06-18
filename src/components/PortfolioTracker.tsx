import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, LineChart, Line } from 'recharts'

interface Property {
  id: string
  name: string
  type: 'sfr' | 'multifamily' | 'commercial' | 'str' | 'land' | 'mhp'
  purchasePrice: number
  currentValue: number
  loanBalance: number
  monthlyRent: number
  monthlyExpenses: number
  monthlyMortgage: number
  purchaseYear: number
  appreciationRate: number
}

const TYPES = { sfr: 'SFR', multifamily: 'Multifamily', commercial: 'Commercial', str: 'STR/Airbnb', land: 'Land', mhp: 'MHP' }
const TYPE_COLORS: Record<string, string> = { sfr: '#3b82f6', multifamily: '#22c55e', commercial: '#f59e0b', str: '#a855f7', land: '#94a3b8', mhp: '#ef4444' }

const DEF_PROPERTIES: Property[] = [
  { id: '1', name: '123 Main St (SFR)', type: 'sfr', purchasePrice: 280000, currentValue: 385000, loanBalance: 195000, monthlyRent: 2200, monthlyExpenses: 450, monthlyMortgage: 1180, purchaseYear: 2018, appreciationRate: 4 },
  { id: '2', name: '456 Oak Ave (Duplex)', type: 'multifamily', purchasePrice: 420000, currentValue: 560000, loanBalance: 310000, monthlyRent: 3400, monthlyExpenses: 720, monthlyMortgage: 2050, purchaseYear: 2020, appreciationRate: 4 },
  { id: '3', name: '789 Pine Rd (SFR)', type: 'sfr', purchasePrice: 195000, currentValue: 248000, loanBalance: 128000, monthlyRent: 1650, monthlyExpenses: 320, monthlyMortgage: 890, purchaseYear: 2019, appreciationRate: 3.5 },
  { id: '4', name: '321 River Dr (STR)', type: 'str', purchasePrice: 550000, currentValue: 620000, loanBalance: 420000, monthlyRent: 5800, monthlyExpenses: 1400, monthlyMortgage: 3100, purchaseYear: 2022, appreciationRate: 5 },
]

let nextId = 5

function newProp(): Property {
  return { id: String(nextId++), name: `New Property`, type: 'sfr', purchasePrice: 300000, currentValue: 320000, loanBalance: 240000, monthlyRent: 1800, monthlyExpenses: 400, monthlyMortgage: 1400, purchaseYear: new Date().getFullYear(), appreciationRate: 4 }
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const fmtM = (n: number) => n >= 1000000 ? `$${(n / 1000000).toFixed(2)}M` : fmt(n)

export default function PortfolioTracker() {
  const [properties, setProperties] = useState<Property[]>(DEF_PROPERTIES)
  const [selected, setSelected] = useState<string | null>(null)
  const [projYears, setProjYears] = useState(10)

  const updateProp = (id: string, k: keyof Property, v: string) =>
    setProperties(ps => ps.map(p => p.id === id ? { ...p, [k]: typeof p[k] === 'number' ? parseFloat(v) || 0 : v } : p))

  const calc = useMemo(() => {
    const propMetrics = properties.map(p => {
      const equity = p.currentValue - p.loanBalance
      const gain = p.currentValue - p.purchasePrice
      const gainPct = p.purchasePrice > 0 ? gain / p.purchasePrice * 100 : 0
      const annualRent = p.monthlyRent * 12
      const annualExpenses = p.monthlyExpenses * 12
      const annualMortgage = p.monthlyMortgage * 12
      const noi = annualRent - annualExpenses
      const cashFlow = noi - annualMortgage
      const capRate = p.currentValue > 0 ? noi / p.currentValue * 100 : 0
      const dscr = annualMortgage > 0 ? noi / annualMortgage : Infinity
      const yearsHeld = new Date().getFullYear() - p.purchaseYear
      return { ...p, equity, gain, gainPct, annualRent, annualExpenses, annualMortgage, noi, cashFlow, capRate, dscr, yearsHeld }
    })

    const totalValue = propMetrics.reduce((s, p) => s + p.currentValue, 0)
    const totalDebt = propMetrics.reduce((s, p) => s + p.loanBalance, 0)
    const totalEquity = totalValue - totalDebt
    const totalAnnualRent = propMetrics.reduce((s, p) => s + p.annualRent, 0)
    const totalNOI = propMetrics.reduce((s, p) => s + p.noi, 0)
    const totalCashFlow = propMetrics.reduce((s, p) => s + p.cashFlow, 0)
    const totalDebtService = propMetrics.reduce((s, p) => s + p.annualMortgage, 0)
    const portfolioCapRate = totalValue > 0 ? totalNOI / totalValue * 100 : 0
    const portfolioDSCR = totalDebtService > 0 ? totalNOI / totalDebtService : 0
    const overallLTV = totalValue > 0 ? totalDebt / totalValue * 100 : 0

    const byType: Record<string, { count: number; value: number; equity: number; cashFlow: number }> = {}
    propMetrics.forEach(p => {
      if (!byType[p.type]) byType[p.type] = { count: 0, value: 0, equity: 0, cashFlow: 0 }
      byType[p.type].count++
      byType[p.type].value += p.currentValue
      byType[p.type].equity += p.equity
      byType[p.type].cashFlow += p.cashFlow
    })
    const typeBreakdown = Object.entries(byType).map(([type, v]) => ({ name: TYPES[type as keyof typeof TYPES] ?? type, type, ...v }))

    const yearlyProjection = Array.from({ length: projYears }, (_, i) => {
      const y = i + 1
      let projValue = 0, projEquity = 0, projCF = 0
      propMetrics.forEach(p => {
        const val = p.currentValue * Math.pow(1 + p.appreciationRate / 100, y)
        const rent = p.annualRent * Math.pow(1.03, y)
        const noi2 = rent - p.annualExpenses
        const cf = noi2 - p.annualMortgage
        projValue += val
        projEquity += val - p.loanBalance * 0.97 ** y
        projCF += cf
      })
      return { year: `Yr ${y}`, value: Math.round(projValue), equity: Math.round(projEquity), annualCF: Math.round(projCF) }
    })

    return { propMetrics, totalValue, totalDebt, totalEquity, totalAnnualRent, totalNOI, totalCashFlow, totalDebtService, portfolioCapRate, portfolioDSCR, overallLTV, typeBreakdown, yearlyProjection }
  }, [properties, projYears])

  const selProp = calc.propMetrics.find(p => p.id === selected)

  return (
    <div className="space-y-6 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Portfolio Tracker</h2>
          <p className="text-slate-400 text-xs mt-1">Aggregate metrics across all properties — equity, NOI, cash flow, DSCR, and multi-year projections</p>
        </div>
        <button onClick={() => setProperties(ps => [...ps, newProp()])} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition">
          + Add Property
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Portfolio Value', value: fmtM(calc.totalValue), color: 'text-white' },
          { label: 'Total Equity', value: fmtM(calc.totalEquity), color: 'text-green-400' },
          { label: 'Annual Cash Flow', value: fmt(calc.totalCashFlow), color: calc.totalCashFlow > 0 ? 'text-blue-400' : 'text-red-400' },
          { label: 'Annual Gross Rent', value: fmt(calc.totalAnnualRent), color: 'text-purple-400' },
        ].map(m => (
          <div key={m.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
            <p className={`text-2xl font-black ${m.color}`}>{m.value}</p>
            <p className="text-xs text-slate-400 mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Portfolio Cap Rate', value: `${calc.portfolioCapRate.toFixed(2)}%`, color: calc.portfolioCapRate >= 6 ? 'text-green-400' : 'text-yellow-400' },
          { label: 'Portfolio DSCR', value: calc.portfolioDSCR.toFixed(2), color: calc.portfolioDSCR >= 1.25 ? 'text-green-400' : 'text-red-400' },
          { label: 'Overall LTV', value: `${calc.overallLTV.toFixed(1)}%`, color: calc.overallLTV <= 65 ? 'text-green-400' : calc.overallLTV <= 80 ? 'text-yellow-400' : 'text-red-400' },
          { label: 'Total Debt', value: fmtM(calc.totalDebt), color: 'text-orange-400' },
        ].map(m => (
          <div key={m.label} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center">
            <p className={`text-xl font-black ${m.color}`}>{m.value}</p>
            <p className="text-xs text-slate-400 mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Property Table */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-3 border-b border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Properties ({properties.length}) — Click to edit</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700 bg-slate-900/50">
                <th className="text-left py-2 px-3">Property</th>
                <th className="text-right py-2 px-3">Value</th>
                <th className="text-right py-2 px-3">Equity</th>
                <th className="text-right py-2 px-3">NOI/yr</th>
                <th className="text-right py-2 px-3">CF/mo</th>
                <th className="text-right py-2 px-3">Cap Rate</th>
                <th className="text-right py-2 px-3">DSCR</th>
                <th className="text-right py-2 px-3">Gain%</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {calc.propMetrics.map(p => (
                <tr key={p.id} className={`cursor-pointer transition ${selected === p.id ? 'bg-blue-900/20' : 'hover:bg-slate-700/20'}`}
                  onClick={() => setSelected(s => s === p.id ? null : p.id)}>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: TYPE_COLORS[p.type] }} />
                      <span className="text-slate-200 font-semibold">{p.name}</span>
                    </div>
                    <p className="text-slate-500 ml-4">{TYPES[p.type]} · {p.yearsHeld}yr hold</p>
                  </td>
                  <td className="text-right py-2 px-3 text-slate-300">{fmt(p.currentValue)}</td>
                  <td className="text-right py-2 px-3 text-green-400 font-bold">{fmt(p.equity)}</td>
                  <td className="text-right py-2 px-3 text-blue-400">{fmt(p.noi)}</td>
                  <td className={`text-right py-2 px-3 font-bold ${p.cashFlow / 12 >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(p.cashFlow / 12)}</td>
                  <td className={`text-right py-2 px-3 ${p.capRate >= 6 ? 'text-green-400' : 'text-yellow-400'}`}>{p.capRate.toFixed(2)}%</td>
                  <td className={`text-right py-2 px-3 ${p.dscr >= 1.25 ? 'text-green-400' : 'text-red-400'}`}>{p.dscr === Infinity ? '∞' : p.dscr.toFixed(2)}</td>
                  <td className={`text-right py-2 px-3 ${p.gainPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>{p.gainPct.toFixed(1)}%</td>
                  <td className="py-2 px-3 text-center">
                    <button onClick={e => { e.stopPropagation(); setProperties(ps => ps.filter(x => x.id !== p.id)) }} className="text-slate-600 hover:text-red-400">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-600 bg-slate-900/50 font-bold text-xs">
                <td className="py-2 px-3 text-slate-300">TOTAL ({properties.length} properties)</td>
                <td className="text-right py-2 px-3 text-white">{fmtM(calc.totalValue)}</td>
                <td className="text-right py-2 px-3 text-green-400">{fmtM(calc.totalEquity)}</td>
                <td className="text-right py-2 px-3 text-blue-400">{fmt(calc.totalNOI)}</td>
                <td className={`text-right py-2 px-3 ${calc.totalCashFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(calc.totalCashFlow / 12)}</td>
                <td className="text-right py-2 px-3 text-yellow-400">{calc.portfolioCapRate.toFixed(2)}%</td>
                <td className={`text-right py-2 px-3 ${calc.portfolioDSCR >= 1.25 ? 'text-green-400' : 'text-red-400'}`}>{calc.portfolioDSCR.toFixed(2)}</td>
                <td className="py-2 px-3"></td>
                <td className="py-2 px-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Edit Panel */}
      {selProp && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-blue-700/40">
          <p className="text-xs font-bold text-blue-300 uppercase tracking-widest mb-3">Editing: {selProp.name}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(['name', 'currentValue', 'loanBalance', 'monthlyRent', 'monthlyExpenses', 'monthlyMortgage', 'purchasePrice', 'purchaseYear', 'appreciationRate'] as const).map(key => (
              <div key={key}>
                <label className="block text-xs text-slate-400 mb-1 capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
                <input value={String(selProp[key])} onChange={e => updateProp(selProp.id, key, e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500" />
              </div>
            ))}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Type</label>
              <select value={selProp.type} onChange={e => updateProp(selProp.id, 'type', e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500">
                {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Value by Type</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={calc.typeBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {calc.typeBreakdown.map((t, i) => <Cell key={i} fill={TYPE_COLORS[t.type] ?? '#94a3b8'} />)}
              </Pie>
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Monthly Cash Flow by Property</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={calc.propMetrics.map(p => ({ name: p.name.split(' (')[0], cf: Math.round(p.cashFlow / 12) }))}>
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 9 }} />
              <YAxis tickFormatter={v => `$${v}`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="cf" name="Monthly Cash Flow" radius={[4, 4, 0, 0]} fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Projection */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Portfolio Projection</p>
          <div className="flex items-center gap-1 text-xs">
            {[5, 10, 15, 20].map(y => (
              <button key={y} onClick={() => setProjYears(y)}
                className={`px-2 py-1 rounded ${projYears === y ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>{y}yr</button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={calc.yearlyProjection}>
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="value" stroke="#94a3b8" strokeWidth={2} dot={false} name="Portfolio Value" strokeDasharray="5 3" />
            <Line type="monotone" dataKey="equity" stroke="#3b82f6" strokeWidth={2} dot={false} name="Total Equity" />
            <Line type="monotone" dataKey="annualCF" stroke="#22c55e" strokeWidth={2} dot={false} name="Annual Cash Flow" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
