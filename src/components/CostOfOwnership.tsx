import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { getAnnualPropertyTax, getAnnualInsurance, getAnnualMaintenance } from '../engine/valuation'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

const COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4']

export default function CostOfOwnership() {
  const { result, input } = usePropertyStore()

  const homeValue = result?.estimatedValue ?? 350000
  const state     = input.state || 'TX'
  const yearBuilt = input.yearBuilt || 2000

  const [hoa, setHoa]               = useState(0)
  const [utilities, setUtilities]   = useState(250)
  const [loanAmount, setLoanAmount] = useState(Math.round(homeValue * 0.8))
  const [interestRate, setInterestRate] = useState(7.25)

  const costs = useMemo(() => {
    const annualTax         = getAnnualPropertyTax(homeValue, state)
    const annualInsurance   = getAnnualInsurance(homeValue)
    const annualMaintenance = getAnnualMaintenance(homeValue, yearBuilt)
    const annualHoa         = hoa * 12
    const annualUtilities   = utilities * 12

    // Mortgage interest (first-year approximation = full loan × rate)
    const annualInterest = Math.round(loanAmount * (interestRate / 100))

    const total = annualTax + annualInsurance + annualMaintenance + annualHoa + annualUtilities + annualInterest

    const items = [
      { name: 'Property Tax',  annual: annualTax,         color: COLORS[0] },
      { name: 'Insurance',     annual: annualInsurance,   color: COLORS[1] },
      { name: 'Maintenance',   annual: annualMaintenance, color: COLORS[2] },
      { name: 'HOA',           annual: annualHoa,         color: COLORS[3] },
      { name: 'Utilities',     annual: annualUtilities,   color: COLORS[4] },
      { name: 'Mortgage Int.', annual: annualInterest,    color: COLORS[5] },
    ].filter(i => i.annual > 0)

    return { annualTax, annualInsurance, annualMaintenance, annualHoa, annualUtilities, annualInterest, total, items }
  }, [homeValue, state, yearBuilt, hoa, utilities, loanAmount, interestRate])

  const effectiveRate = homeValue > 0 ? (costs.total / homeValue) * 100 : 0

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Cost of Ownership</h3>
        <p className="text-xs text-slate-500">Annual carrying costs beyond the mortgage principal</p>
      </div>

      {result && (
        <div className="bg-blue-900/30 border border-blue-800/50 rounded-xl p-3 text-xs text-blue-300">
          Based on estimated value of <strong>{fmt(homeValue)}</strong> in <strong>{state}</strong>.
          Adjust the sliders below for your actual situation.
        </div>
      )}

      {/* Adjustable inputs */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-4">
        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Adjust Your Costs</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-slate-400 uppercase tracking-widest">HOA (monthly)</label>
              <span className="text-xs font-bold text-blue-400">{fmt(hoa)}/mo</span>
            </div>
            <input type="range" min={0} max={1500} step={25} value={hoa}
              onChange={e => setHoa(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-slate-400 uppercase tracking-widest">Utilities (monthly)</label>
              <span className="text-xs font-bold text-blue-400">{fmt(utilities)}/mo</span>
            </div>
            <input type="range" min={0} max={1000} step={25} value={utilities}
              onChange={e => setUtilities(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs text-slate-400 uppercase tracking-widest">Loan Balance</label>
            <span className="text-xs font-bold text-purple-400">{fmt(loanAmount)}</span>
          </div>
          <input type="range" min={0} max={Math.round(homeValue * 1.05)} step={5000} value={loanAmount}
            onChange={e => setLoanAmount(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-purple-500" />
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs text-slate-400 uppercase tracking-widest">Interest Rate</label>
            <span className="text-xs font-bold text-purple-400">{interestRate}%</span>
          </div>
          <input type="range" min={3} max={12} step={0.125} value={interestRate}
            onChange={e => setInterestRate(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-purple-500" />
        </div>
      </div>

      {/* Hero totals */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Annual Total</p>
          <p className="text-2xl font-black text-white">{fmt(costs.total)}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Monthly</p>
          <p className="text-2xl font-black text-blue-400">{fmt(Math.round(costs.total / 12))}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">% of Value</p>
          <p className="text-2xl font-black text-orange-400">{effectiveRate.toFixed(2)}%</p>
        </div>
      </div>

      {/* Bar chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Annual Cost Breakdown</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={costs.items} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} width={45} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v: number) => [fmt(v), 'Annual']}
            />
            <Bar dataKey="annual" radius={[4, 4, 0, 0]}>
              {costs.items.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detail table */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Item-by-Item Breakdown</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-800">
            <tr>
              <th className="text-left py-2 px-4 text-xs text-slate-400 font-semibold">Cost</th>
              <th className="text-right py-2 px-4 text-xs text-slate-400 font-semibold">Monthly</th>
              <th className="text-right py-2 px-4 text-xs text-slate-400 font-semibold">Annual</th>
              <th className="text-right py-2 px-4 text-xs text-slate-400 font-semibold">% Total</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'Property Tax',   annual: costs.annualTax,         note: `${(getAnnualPropertyTax(homeValue, state) / homeValue * 100).toFixed(2)}% eff. rate` },
              { label: 'Homeowner\'s Insurance', annual: costs.annualInsurance, note: '~0.5% of value' },
              { label: 'Maintenance & Repairs',  annual: costs.annualMaintenance, note: yearBuilt < 1990 ? '1.5%/yr (older home)' : '1.0%/yr' },
              { label: 'HOA Dues',       annual: costs.annualHoa,         note: hoa > 0 ? `${fmt(hoa)}/mo` : 'Not applicable' },
              { label: 'Utilities',      annual: costs.annualUtilities,   note: `${fmt(utilities)}/mo est.` },
              { label: 'Mortgage Interest', annual: costs.annualInterest, note: `${interestRate}% on ${fmt(loanAmount)}` },
            ].map(row => (
              <tr key={row.label} className="border-t border-slate-700/50">
                <td className="py-2 px-4 text-slate-300">
                  <div>{row.label}</div>
                  <div className="text-xs text-slate-600">{row.note}</div>
                </td>
                <td className="py-2 px-4 text-right font-mono text-slate-400">{fmt(Math.round(row.annual / 12))}</td>
                <td className="py-2 px-4 text-right font-mono text-slate-200">{fmt(row.annual)}</td>
                <td className="py-2 px-4 text-right font-mono text-slate-500">
                  {costs.total > 0 ? `${((row.annual / costs.total) * 100).toFixed(0)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-600 bg-slate-800/70">
            <tr>
              <td className="py-2.5 px-4 font-bold text-white">Total</td>
              <td className="py-2.5 px-4 text-right font-mono font-bold text-white">{fmt(Math.round(costs.total / 12))}</td>
              <td className="py-2.5 px-4 text-right font-mono font-bold text-white">{fmt(costs.total)}</td>
              <td className="py-2.5 px-4 text-right font-mono text-slate-400">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Property tax based on {state} effective rate. Insurance and maintenance are national averages and vary significantly by location and age.
      </p>
    </div>
  )
}
