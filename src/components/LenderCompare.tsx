import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line, Legend } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
function fmtPct(n: number) { return `${n.toFixed(3)}%` }

function monthlyPmt(principal: number, annualRate: number, termYears: number) {
  const r = annualRate / 100 / 12
  const n = termYears * 12
  if (r === 0 || n === 0) return 0
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

function calcAPR(principal: number, nominalRate: number, termYears: number, fees: number): number {
  const pmt = monthlyPmt(principal, nominalRate, termYears)
  const n = termYears * 12
  const net = principal - fees
  // Newton-Raphson to solve for monthly rate
  let r = nominalRate / 100 / 12
  for (let i = 0; i < 50; i++) {
    const f   = pmt * (1 - Math.pow(1 + r, -n)) / r - net
    const fp  = pmt * (Math.pow(1 + r, -n) * n / r - (1 - Math.pow(1 + r, -n)) / (r * r))
    const rn  = r - f / fp
    if (Math.abs(rn - r) < 1e-10) { r = rn; break }
    r = rn
  }
  return r * 12 * 100
}

interface Lender {
  id: number
  name: string
  rate: number
  points: number
  originFee: number
  appraisalFee: number
  titleFee: number
  otherFees: number
  termYrs: number
  color: string
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444']

const DEFAULT_LENDERS: Lender[] = [
  { id: 1, name: 'Bank A',       rate: 7.000, points: 0,    originFee: 1500, appraisalFee: 550, titleFee: 1200, otherFees: 400,  termYrs: 30, color: COLORS[0] },
  { id: 2, name: 'Credit Union', rate: 6.750, points: 0.5,  originFee: 900,  appraisalFee: 500, titleFee: 1100, otherFees: 300,  termYrs: 30, color: COLORS[1] },
  { id: 3, name: 'Broker',       rate: 6.875, points: 1.0,  originFee: 0,    appraisalFee: 550, titleFee: 1200, otherFees: 250,  termYrs: 30, color: COLORS[2] },
  { id: 4, name: 'Online Lender',rate: 7.125, points: 0,    originFee: 800,  appraisalFee: 500, titleFee: 950,  otherFees: 200,  termYrs: 30, color: COLORS[3] },
]

export default function LenderCompare() {
  const { result, input, interestRate } = usePropertyStore()
  const homeVal   = result?.estimatedValue ?? 400000
  const downPct   = input.downPaymentPct ?? 20
  const defaultLoan = homeVal * (1 - downPct / 100)

  const [loanAmount,  setLoanAmount]  = useState(Math.round(defaultLoan))
  const [lenders, setLenders]         = useState<Lender[]>(DEFAULT_LENDERS.map((l, i) => i === 0 ? { ...l, rate: interestRate } : l))
  const [breakEvenYrs, setBreakEvenYrs] = useState(5)

  const updateLender = (id: number, field: keyof Lender, value: number | string) => {
    setLenders(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l))
  }

  const computed = useMemo(() => lenders.map(l => {
    const pointsCost    = loanAmount * l.points / 100
    const totalFees     = pointsCost + l.originFee + l.appraisalFee + l.titleFee + l.otherFees
    const monthly       = monthlyPmt(loanAmount, l.rate, l.termYrs)
    const apr           = calcAPR(loanAmount, l.rate, l.termYrs, totalFees)
    const totalInterest = monthly * l.termYrs * 12 - loanAmount
    const totalCost     = totalInterest + totalFees
    const costAt5yr     = monthly * breakEvenYrs * 12 + totalFees
    return { ...l, pointsCost, totalFees, monthly, apr, totalInterest, totalCost, costAt5yr }
  }), [lenders, loanAmount, breakEvenYrs])

  // Best in class
  const bestMonthly  = Math.min(...computed.map(c => c.monthly))
  const bestAPR      = Math.min(...computed.map(c => c.apr))
  const bestTotal    = Math.min(...computed.map(c => c.totalCost))
  const bestShortTerm = Math.min(...computed.map(c => c.costAt5yr))

  // Savings vs most expensive
  const worstMonthly = Math.max(...computed.map(c => c.monthly))

  // Build cumulative cost over time chart
  const chartData = useMemo(() => {
    return Array.from({ length: 31 }, (_, yr) => {
      const row: Record<string, number | string> = { year: yr }
      computed.forEach(c => {
        row[c.name] = Math.round(c.monthly * yr * 12 + c.totalFees)
      })
      return row
    })
  }, [computed])

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Lender Comparison</h3>
        <p className="text-xs text-slate-500">
          Compare up to 4 loan offers side-by-side — APR, monthly payment, total cost, and short-term
          break-even. Don't just compare rates; compare total cost of borrowing.
        </p>
      </div>

      {/* Loan amount */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <div className="flex justify-between mb-1">
          <label className="text-xs text-slate-400 uppercase tracking-widest">Loan Amount</label>
          <span className="text-xs font-bold text-blue-400">{fmt(loanAmount)}</span>
        </div>
        <input type="range" min={50000} max={2000000} step={5000} value={loanAmount}
          onChange={e => setLoanAmount(Number(e.target.value))}
          className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
      </div>

      {/* Lender input cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {lenders.map((l, idx) => {
          const c = computed[idx]
          return (
            <div key={l.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full" style={{ background: l.color }} />
                <input
                  className="text-sm font-bold bg-transparent text-slate-200 border-b border-slate-600 focus:outline-none focus:border-blue-500 w-full"
                  value={l.name}
                  onChange={e => updateLender(l.id, 'name', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                {[
                  { label: 'Rate %',        field: 'rate',        min: 2,    max: 12,    step: 0.125 },
                  { label: 'Points',        field: 'points',      min: 0,    max: 4,     step: 0.125 },
                  { label: 'Origination $', field: 'originFee',   min: 0,    max: 5000,  step: 100 },
                  { label: 'Appraisal $',   field: 'appraisalFee',min: 300,  max: 1200,  step: 50 },
                  { label: 'Title/Escrow $',field: 'titleFee',    min: 500,  max: 4000,  step: 100 },
                  { label: 'Other Fees $',  field: 'otherFees',   min: 0,    max: 3000,  step: 50 },
                ].map(f => (
                  <div key={f.field}>
                    <label className="text-slate-500 text-xs uppercase tracking-widest">{f.label}</label>
                    <input type="number"
                      value={l[f.field as keyof Lender] as number}
                      onChange={e => updateLender(l.id, f.field as keyof Lender, Number(e.target.value))}
                      min={f.min} max={f.max} step={f.step}
                      className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-slate-200 text-xs mt-0.5" />
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-700 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-slate-500">Monthly</p>
                  <p className={`font-black text-base ${c.monthly === bestMonthly ? 'text-green-400' : 'text-slate-200'}`}>{fmt(c.monthly)}</p>
                </div>
                <div>
                  <p className="text-slate-500">APR</p>
                  <p className={`font-black text-base ${c.apr === bestAPR ? 'text-green-400' : 'text-slate-200'}`}>{fmtPct(c.apr)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Total Fees</p>
                  <p className="font-bold text-slate-300">{fmt(c.totalFees)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Total Cost</p>
                  <p className={`font-bold ${c.totalCost === bestTotal ? 'text-green-400' : 'text-slate-300'}`}>{fmt(c.totalCost)}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary comparison table */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Side-by-Side Summary</p>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Break-even horizon:</span>
            <select value={breakEvenYrs} onChange={e => setBreakEvenYrs(Number(e.target.value))}
              className="bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded px-2 py-1">
              {[3, 5, 7, 10, 15, 20, 30].map(y => <option key={y} value={y}>{y} yr</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700">
                <th className="pb-2 text-left pr-4">Metric</th>
                {computed.map(c => (
                  <th key={c.id} className="pb-2 pr-4 text-left" style={{ color: c.color }}>{c.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Interest Rate',     vals: computed.map(c => fmtPct(c.rate)),       best: bestMonthly },
                { label: 'Points',            vals: computed.map(c => `${c.points} pts`),    best: null },
                { label: 'Total Fees',        vals: computed.map(c => fmt(c.totalFees)),      best: null },
                { label: 'Monthly Payment',   vals: computed.map(c => fmt(c.monthly)),        bestVal: bestMonthly, rawVals: computed.map(c => c.monthly) },
                { label: 'APR',               vals: computed.map(c => fmtPct(c.apr)),         bestVal: bestAPR,     rawVals: computed.map(c => c.apr) },
                { label: `Total Cost (${lenders[0].termYrs}yr)`, vals: computed.map(c => fmt(c.totalCost)), bestVal: bestTotal, rawVals: computed.map(c => c.totalCost) },
                { label: `Cost at ${breakEvenYrs}yr`,  vals: computed.map(c => fmt(c.costAt5yr)), bestVal: bestShortTerm, rawVals: computed.map(c => c.costAt5yr) },
                { label: 'vs Cheapest (mo)',  vals: computed.map(c => c.monthly === bestMonthly ? '✓ Best' : `-${fmt(c.monthly - bestMonthly)}/mo`), best: null },
              ].map(row => (
                <tr key={row.label} className="border-t border-slate-700/50">
                  <td className="py-1.5 pr-4 text-slate-500">{row.label}</td>
                  {row.vals.map((v, i) => (
                    <td key={i} className={`py-1.5 pr-4 font-semibold ${
                      'rawVals' in row && row.rawVals && row.rawVals[i] === row.bestVal
                        ? 'text-green-400' : 'text-slate-300'
                    }`}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly payment bar chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Monthly Payment Comparison</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={computed.map(c => ({ name: c.name, monthly: Math.round(c.monthly), color: c.color }))}
            margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => `$${v.toLocaleString()}`} width={60} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number) => [fmt(v), 'Monthly Payment']} />
            <Bar dataKey="monthly" radius={[4, 4, 0, 0]}>
              {computed.map((c, i) => <Cell key={i} fill={c.monthly === bestMonthly ? '#22c55e' : c.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Cumulative cost over time */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Cumulative Cost Over Time (includes fees)</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false}
              label={{ value: 'Year', position: 'insideBottom', offset: -3, fill: '#64748b', fontSize: 10 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} width={55} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number) => [fmt(v)]} labelFormatter={v => `Year ${v}`} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
            {lenders.map(l => (
              <Line key={l.name} type="monotone" dataKey={l.name}
                stroke={l.color} dot={false} strokeWidth={2} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Loan Shopping Tips</p>
        <div className="space-y-1.5 text-xs text-slate-400">
          {[
            '📋 Get a Loan Estimate (LE) from each lender — federal law requires it within 3 business days of application.',
            '⚖️ APR is the best single comparison metric — it includes fees. Rate alone is misleading.',
            '🏃 If you plan to move or refi within 5–7 years, choose the lowest upfront cost (fees+rate) not the lowest total interest.',
            '🔐 Lock your rate once you\'re under contract — rate locks typically last 30–60 days.',
            '🏦 Credit unions and community banks often have lower fees; online lenders often have lower rates.',
            '📞 Ask each lender to match a competitor\'s rate or fees — many will when shown a better Loan Estimate.',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        APR calculated per TILA using Newton-Raphson iteration. Actual APR on your Loan Estimate may vary.
        Always compare official Loan Estimates, not verbal quotes.
      </p>
    </div>
  )
}
