import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
function fmtK(n: number) {
  return n >= 1000 ? `$${(n / 1000).toFixed(0)}K` : fmt(n)
}

function monthlyPayment(principal: number, annualRate: number, termYears: number) {
  const r = annualRate / 100 / 12
  const n = termYears * 12
  if (r === 0) return principal / n
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

function solveMaxPrice(
  grossMonthlyIncome: number,
  monthlyDebts: number,
  downPaymentAmt: number,
  annualRate: number,
  termYears: number,
  annualInsurancePct: number,
  monthlyHoa: number,
  annualTaxPct: number,
  dtiLimit: number,
): number {
  const maxPITI = grossMonthlyIncome * dtiLimit - monthlyDebts
  if (maxPITI <= 0) return 0

  let lo = 0, hi = 5_000_000
  for (let i = 0; i < 50; i++) {
    const mid   = (lo + hi) / 2
    const loan  = Math.max(0, mid - downPaymentAmt)
    const pi    = monthlyPayment(loan, annualRate, termYears)
    const tax   = (mid * annualTaxPct / 100) / 12
    const ins   = (mid * annualInsurancePct / 100) / 12
    const pmi   = (downPaymentAmt / mid) < 0.2 ? (loan * 0.0085) / 12 : 0
    const total = pi + tax + ins + pmi + monthlyHoa
    if (total < maxPITI) lo = mid
    else hi = mid
  }
  return Math.round(lo / 1000) * 1000
}

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  fmt: (v: number) => string
}

function Slider({ label, value, min, max, step, onChange, fmt: fmtFn }: SliderProps) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-xs text-slate-400 uppercase tracking-widest">{label}</label>
        <span className="text-xs font-bold text-blue-400">{fmtFn(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
    </div>
  )
}

export default function AffordabilityCalc() {
  const { result, interestRate } = usePropertyStore()

  const [annualIncome,   setAnnualIncome]   = useState(120000)
  const [monthlyDebts,   setMonthlyDebts]   = useState(500)
  const [downPaymentAmt, setDownPaymentAmt] = useState(80000)
  const [rate,           setRate]           = useState(interestRate)
  const [termYears,      setTermYears]      = useState(30)
  const [annualTaxPct,   setAnnualTaxPct]   = useState(1.1)
  const [annualInsPct,   setAnnualInsPct]   = useState(0.5)
  const [monthlyHoa,     setMonthlyHoa]     = useState(0)

  const grossMonthly = annualIncome / 12

  const limits = useMemo(() => {
    return [
      { label: '28% Front-End', pct: 0.28, color: '#22c55e', desc: 'Conservative — housing only' },
      { label: '36% Back-End',  pct: 0.36, color: '#3b82f6', desc: 'Standard lender guideline'  },
      { label: '43% Back-End',  pct: 0.43, color: '#f59e0b', desc: 'Max conventional loan'      },
    ].map(l => {
      const max = solveMaxPrice(grossMonthly, monthlyDebts, downPaymentAmt, rate, termYears, annualInsPct, monthlyHoa, annualTaxPct, l.pct)
      const loan = Math.max(0, max - downPaymentAmt)
      const pi   = monthlyPayment(loan, rate, termYears)
      const tax  = (max * annualTaxPct / 100) / 12
      const ins  = (max * annualInsPct / 100) / 12
      const pmi  = max > 0 && (downPaymentAmt / max) < 0.2 ? (loan * 0.0085) / 12 : 0
      const total = pi + tax + ins + pmi + monthlyHoa
      return { ...l, max, loan, pi, tax, ins, pmi, total }
    })
  }, [grossMonthly, monthlyDebts, downPaymentAmt, rate, termYears, annualTaxPct, annualInsPct, monthlyHoa])

  const subjectPrice  = result?.estimatedValue ?? 0
  const subjectLoan   = Math.max(0, subjectPrice - downPaymentAmt)
  const subjectPI     = monthlyPayment(subjectLoan, rate, termYears)
  const subjectTax    = (subjectPrice * annualTaxPct / 100) / 12
  const subjectIns    = (subjectPrice * annualInsPct / 100) / 12
  const subjectPMI    = subjectPrice > 0 && (downPaymentAmt / subjectPrice) < 0.2 ? (subjectLoan * 0.0085) / 12 : 0
  const subjectPITI   = subjectPI + subjectTax + subjectIns + subjectPMI + monthlyHoa
  const frontEndDTI   = subjectPrice > 0 ? (subjectPITI / grossMonthly) * 100 : 0
  const backEndDTI    = subjectPrice > 0 ? ((subjectPITI + monthlyDebts) / grossMonthly) * 100 : 0
  const hasPMI        = subjectPrice > 0 && (downPaymentAmt / subjectPrice) < 0.2
  const downPct       = subjectPrice > 0 ? (downPaymentAmt / subjectPrice) * 100 : 0
  const affordable36  = backEndDTI <= 36 || !result
  const affordable43  = backEndDTI <= 43 || !result

  const chartData = limits.map(l => ({ name: l.label.split(' ')[0], max: l.max, color: l.color }))

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Affordability Calculator</h3>
        <p className="text-xs text-slate-500">
          How much home can you afford? Based on standard DTI lending guidelines.
        </p>
      </div>

      {/* Inputs */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-4">
        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Your Financial Profile</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Slider label="Annual Gross Income"   value={annualIncome}    min={30000} max={600000} step={5000}  onChange={setAnnualIncome}   fmt={fmtK} />
          <Slider label="Monthly Debt Payments" value={monthlyDebts}    min={0}     max={5000}   step={50}    onChange={setMonthlyDebts}   fmt={v => `${fmt(v)}/mo`} />
          <Slider label="Down Payment Saved"    value={downPaymentAmt}  min={5000}  max={500000} step={5000}  onChange={setDownPaymentAmt} fmt={fmtK} />
          <Slider label="Interest Rate"         value={rate}            min={2}     max={14}     step={0.125} onChange={setRate}           fmt={v => `${v.toFixed(3)}%`} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-700">
          <Slider label="Annual Tax Rate"  value={annualTaxPct} min={0.3} max={3}    step={0.05} onChange={setAnnualTaxPct} fmt={v => `${v.toFixed(2)}%`} />
          <Slider label="Annual Insurance" value={annualInsPct} min={0.2} max={2}    step={0.05} onChange={setAnnualInsPct} fmt={v => `${v.toFixed(2)}%`} />
          <Slider label="Monthly HOA"      value={monthlyHoa}   min={0}   max={2000} step={25}   onChange={setMonthlyHoa}  fmt={v => `${fmt(v)}/mo`} />
        </div>
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Loan Term</p>
          <div className="flex gap-2">
            {[10, 15, 20, 30].map(t => (
              <button key={t}
                onClick={() => setTermYears(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${termYears === t ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                {t}yr
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Max price cards */}
      <div className="grid grid-cols-3 gap-3">
        {limits.map(l => (
          <div key={l.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
            <p className="text-xs text-slate-500 mb-1">{l.label}</p>
            <p className="text-xs text-slate-600 mb-2">{l.desc}</p>
            <p className="text-2xl font-black" style={{ color: l.color }}>{fmtK(l.max)}</p>
            <p className="text-xs text-slate-500 mt-1">max home price</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Max Affordable Price by DTI Rule</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 5, right: 30, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} width={55} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v: number) => [fmt(v), 'Max Home Price']} />
            {result && <ReferenceLine y={subjectPrice} stroke="#f472b6" strokeDasharray="4 4"
              label={{ value: 'Subject', fill: '#f472b6', fontSize: 10, position: 'right' }} />}
            <Bar dataKey="max" radius={[4, 4, 0, 0]}>
              {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly breakdown table */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Monthly Payment Breakdown at Each Limit</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700">
                <th className="text-left pb-2">Rule</th>
                <th className="text-right pb-2">Max Price</th>
                <th className="text-right pb-2">P&amp;I</th>
                <th className="text-right pb-2">Tax</th>
                <th className="text-right pb-2">Ins</th>
                <th className="text-right pb-2">PMI</th>
                <th className="text-right pb-2">HOA</th>
                <th className="text-right pb-2 font-bold text-slate-400">Total/mo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {limits.map(l => (
                <tr key={l.label} className="text-slate-300">
                  <td className="py-2 font-semibold" style={{ color: l.color }}>{l.label}</td>
                  <td className="text-right py-2 font-bold text-white">{fmt(l.max)}</td>
                  <td className="text-right py-2">{fmt(l.pi)}</td>
                  <td className="text-right py-2">{fmt(l.tax)}</td>
                  <td className="text-right py-2">{fmt(l.ins)}</td>
                  <td className="text-right py-2">{l.pmi > 0 ? <span className="text-orange-400">{fmt(l.pmi)}</span> : '—'}</td>
                  <td className="text-right py-2">{monthlyHoa > 0 ? fmt(monthlyHoa) : '—'}</td>
                  <td className="text-right py-2 font-bold text-white">{fmt(l.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Subject property check */}
      {result && (
        <div className={`rounded-xl p-5 border ${affordable43 ? 'bg-green-900/20 border-green-700/40' : 'bg-red-900/20 border-red-700/40'}`}>
          <p className="text-xs font-bold uppercase tracking-widest mb-3 text-slate-400">Subject Property Analysis</p>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-2xl font-black text-white mb-0.5">{fmt(subjectPrice)}</p>
              <p className="text-xs text-slate-500">estimated value · {downPct.toFixed(1)}% down</p>
            </div>
            <div className="text-right">
              <p className={`text-lg font-black ${affordable36 ? 'text-green-400' : affordable43 ? 'text-yellow-400' : 'text-red-400'}`}>
                {affordable36 ? 'Affordable' : affordable43 ? 'Stretch' : 'Over Budget'}
              </p>
              <p className="text-xs text-slate-500">back-end DTI: {backEndDTI.toFixed(1)}%</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Monthly PITI+HOA', value: fmt(subjectPITI), sub: '/mo',          color: 'text-white' },
              { label: 'Front-End DTI',    value: `${frontEndDTI.toFixed(1)}%`, sub: 'target ≤28%', color: frontEndDTI <= 28 ? 'text-green-400' : frontEndDTI <= 36 ? 'text-yellow-400' : 'text-red-400' },
              { label: 'Back-End DTI',     value: `${backEndDTI.toFixed(1)}%`,  sub: 'target ≤36%', color: backEndDTI  <= 36 ? 'text-green-400' : backEndDTI  <= 43 ? 'text-yellow-400' : 'text-red-400' },
              { label: 'PMI Required',     value: hasPMI ? 'Yes' : 'No', sub: hasPMI ? `~${fmt(subjectPMI)}/mo` : 'down ≥20%', color: hasPMI ? 'text-orange-400' : 'text-green-400' },
            ].map(s => (
              <div key={s.label} className="bg-slate-900/60 rounded-lg p-3 text-center">
                <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-600">{s.sub}</p>
              </div>
            ))}
          </div>

          {hasPMI && (
            <div className="mt-3 bg-orange-900/20 border border-orange-700/30 rounded-lg p-3">
              <p className="text-xs text-orange-400 font-semibold">
                PMI applies — your {downPct.toFixed(1)}% down is below the 20% threshold.
                You'd need {fmt(subjectPrice * 0.2)} down to avoid PMI ({fmt(subjectPrice * 0.2 - downPaymentAmt)} more needed).
              </p>
            </div>
          )}
        </div>
      )}

      {!result && (
        <div className="text-center py-8 text-slate-500">
          <p className="text-3xl mb-2">💡</p>
          <p className="text-sm">Run a valuation to compare the subject property against your affordability limits.</p>
        </div>
      )}

      <p className="text-xs text-slate-600 text-center">
        DTI rules: 28% front-end (housing only), 36% back-end (conventional), 43% back-end (FHA / max conventional).
        PMI estimated at 0.85% annually when down payment is below 20%.
      </p>
    </div>
  )
}
