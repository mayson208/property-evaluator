import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

// Standard deductions 2024
const STD_DEDUCTION: Record<string, number> = {
  single:   14600,
  mfj:      29200,
  hoh:      21900,
}

// Federal ordinary income tax brackets 2024 (simplified — marginal)
function marginalRate(income: number, status: string): number {
  const brackets = status === 'mfj'
    ? [[0, 23200, 0.10], [23200, 94300, 0.12], [94300, 201050, 0.22], [201050, 383900, 0.24], [383900, 487450, 0.32], [487450, 731200, 0.35], [731200, Infinity, 0.37]]
    : [[0, 11600, 0.10], [11600, 47150, 0.12], [47150, 100525, 0.22], [100525, 191950, 0.24], [191950, 243725, 0.32], [243725, 609350, 0.35], [609350, Infinity, 0.37]]
  for (const [lo, hi, rate] of brackets) {
    if (income >= lo && income < hi) return rate as number
  }
  return 0.37
}

function calcYearInterest(loan: number, annualRate: number, term: number, year: number): number {
  const r   = annualRate / 100 / 12
  const n   = term * 12
  const pmt = r === 0 ? loan / n : loan * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  let balance = loan
  let totalInterest = 0
  for (let mo = 1; mo <= year * 12; mo++) {
    const interest  = balance * r
    const principal = Math.min(balance, pmt - interest)
    totalInterest  += interest
    balance        -= principal
  }
  let prevBalance = loan
  let prevInterest = 0
  for (let mo = 1; mo <= (year - 1) * 12; mo++) {
    const interest  = prevBalance * r
    const principal = Math.min(prevBalance, pmt - interest)
    prevInterest   += interest
    prevBalance    -= principal
  }
  return totalInterest - prevInterest
}

export default function TaxBenefits() {
  const { result, downPaymentPct, interestRate } = usePropertyStore()

  const [filingStatus, setFilingStatus] = useState<'single' | 'mfj' | 'hoh'>('mfj')
  const [annualIncome,  setAnnualIncome]  = useState(120000)
  const [stateTaxPaid,  setStateTaxPaid]  = useState(8000)
  const [annualTaxPct,  setAnnualTaxPct]  = useState(1.1)
  const [loanTermYears, setLoanTermYears] = useState(30)

  const purchasePrice = result?.estimatedValue ?? 0
  const loanAmt       = purchasePrice * (1 - downPaymentPct / 100)
  const annualPropTax = purchasePrice * annualTaxPct / 100

  const stdDed = STD_DEDUCTION[filingStatus]

  const analysis = useMemo(() => {
    const years = Array.from({ length: 30 }, (_, i) => i + 1)
    return years.map(yr => {
      const interestDeduction = Math.min(loanAmt <= 750000 ? calcYearInterest(loanAmt, interestRate, loanTermYears, yr) : calcYearInterest(750000, interestRate, loanTermYears, yr), calcYearInterest(loanAmt, interestRate, loanTermYears, yr))
      const saltDeduction     = Math.min(annualPropTax + stateTaxPaid, 10000)
      const totalItemized     = interestDeduction + saltDeduction
      const benefitOver       = Math.max(0, totalItemized - stdDed)
      const rate              = marginalRate(annualIncome, filingStatus)
      const taxSaving         = benefitOver * rate

      return { yr, interestDeduction, saltDeduction, totalItemized, benefitOver, taxSaving, rate }
    })
  }, [loanAmt, interestRate, loanTermYears, annualPropTax, stateTaxPaid, stdDed, annualIncome, filingStatus])

  const yr1 = analysis[0]
  const yr5 = analysis[4]

  const breakEvenYear = analysis.findIndex(a => a.totalItemized <= stdDed) + 1
  const lastBenefitYr = analysis.findLastIndex(a => a.benefitOver > 0) + 1

  const lifetimeSavings = analysis.reduce((s, a) => s + a.taxSaving, 0)

  const chartData = analysis
    .filter(a => a.yr <= 15)
    .map(a => ({
      yr: `Yr ${a.yr}`,
      itemized: Math.round(a.totalItemized),
      standard: stdDed,
      saving: Math.round(a.taxSaving),
    }))

  if (!result) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-4xl mb-3">🏛</p>
        <p>Run a valuation first to see your homeownership tax benefits</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Tax Benefits of Homeownership</h3>
        <p className="text-xs text-slate-500">
          Mortgage interest deduction, SALT deduction, and when itemizing beats the standard deduction
        </p>
      </div>

      {/* Inputs */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-4">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Filing Status</p>
          <div className="flex gap-2">
            {[
              { id: 'single', label: 'Single' },
              { id: 'mfj',    label: 'Married Filing Jointly' },
              { id: 'hoh',    label: 'Head of Household' },
            ].map(s => (
              <button key={s.id}
                onClick={() => setFilingStatus(s.id as typeof filingStatus)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${filingStatus === s.id ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Annual Gross Income',  value: annualIncome,  min: 20000,  max: 600000, step: 5000, set: setAnnualIncome,  fmt: (v: number) => fmt(v) },
            { label: 'Annual State & Local Tax Paid', value: stateTaxPaid, min: 0, max: 50000, step: 500, set: setStateTaxPaid, fmt: (v: number) => fmt(v) },
            { label: 'Property Tax Rate',    value: annualTaxPct,  min: 0.3, max: 3, step: 0.05, set: setAnnualTaxPct, fmt: (v: number) => `${v.toFixed(2)}%` },
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
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Loan Term</p>
            <div className="flex gap-2">
              {[10, 15, 20, 30].map(t => (
                <button key={t}
                  onClick={() => setLoanTermYears(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${loanTermYears === t ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                  {t}yr
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Year 1 summary */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Year 1 Tax Picture</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            { label: 'Mortgage Interest',  value: fmt(yr1.interestDeduction), color: 'text-blue-400' },
            { label: 'SALT Deduction',     value: fmt(yr1.saltDeduction) + (yr1.saltDeduction >= 10000 ? ' (capped)' : ''), color: 'text-purple-400' },
            { label: 'Total Itemized',     value: fmt(yr1.totalItemized),     color: yr1.totalItemized > stdDed ? 'text-green-400' : 'text-red-400' },
            { label: 'Tax Savings Yr 1',   value: yr1.taxSaving > 0 ? fmt(yr1.taxSaving) : '$0', color: yr1.taxSaving > 0 ? 'text-green-400' : 'text-slate-500' },
          ].map(s => (
            <div key={s.label}>
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-slate-700">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Standard deduction ({filingStatus.toUpperCase()}, 2024)</span>
            <span className="font-bold text-slate-300">{fmt(stdDed)}</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-slate-500">Itemized deductions (Year 1)</span>
            <span className={`font-bold ${yr1.totalItemized > stdDed ? 'text-green-400' : 'text-red-400'}`}>{fmt(yr1.totalItemized)}</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-slate-500">Benefit above standard deduction</span>
            <span className={`font-bold ${yr1.benefitOver > 0 ? 'text-green-400' : 'text-slate-500'}`}>{yr1.benefitOver > 0 ? `+${fmt(yr1.benefitOver)}` : 'None'}</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-slate-500">Your marginal rate</span>
            <span className="font-bold text-slate-300">{(yr1.rate * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {yr1.totalItemized <= stdDed && (
        <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-4">
          <p className="text-xs text-yellow-400 font-semibold">
            Your itemized deductions ({fmt(yr1.totalItemized)}) don't exceed the {filingStatus === 'mfj' ? 'married filing jointly' : filingStatus} standard deduction ({fmt(stdDed)}).
            You likely won't benefit from itemizing in Year 1.
            {loanAmt > 750000 && ' Note: mortgage interest deduction is capped at $750K loan balance.'}
          </p>
        </div>
      )}

      {/* Insight cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: 'Years You Itemize',
            value: lastBenefitYr > 0 ? `${lastBenefitYr} yrs` : 'None',
            sub: 'until std ded wins',
            color: lastBenefitYr > 10 ? 'text-green-400' : lastBenefitYr > 0 ? 'text-yellow-400' : 'text-slate-500',
          },
          {
            label: 'Yr 1–5 Avg Savings',
            value: fmt(analysis.slice(0, 5).reduce((s, a) => s + a.taxSaving, 0) / 5),
            sub: 'per year avg',
            color: 'text-blue-400',
          },
          {
            label: '30yr Tax Savings',
            value: fmt(lifetimeSavings),
            sub: 'total at current rates',
            color: 'text-purple-400',
          },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-600 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Itemized vs Standard Deduction — First 15 Years</p>
        <p className="text-xs text-slate-600 mb-4">
          Itemize when the blue bar exceeds the dashed line. Tax savings shown in green.
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="yr" tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} width={50} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v: number, name: string) => [fmt(v), name]} />
            <ReferenceLine y={stdDed} stroke="#64748b" strokeDasharray="4 4"
              label={{ value: 'Std Ded', fill: '#64748b', fontSize: 10, position: 'right' }} />
            <Bar dataKey="itemized" name="Total Itemized" radius={[3, 3, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.itemized >= stdDed ? '#3b82f6' : '#475569'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Year-by-year breakdown */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Year-by-Year Deduction Detail</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700">
                <th className="text-left pb-2">Year</th>
                <th className="text-right pb-2">Interest</th>
                <th className="text-right pb-2">SALT</th>
                <th className="text-right pb-2">Total Itemized</th>
                <th className="text-right pb-2">Benefit over Std</th>
                <th className="text-right pb-2">Est. Tax Saving</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {analysis.filter(a => a.yr <= 10 || a.yr % 5 === 0).map(a => (
                <tr key={a.yr} className={a.benefitOver > 0 ? '' : 'opacity-50'}>
                  <td className="py-2 text-slate-400 font-semibold">Year {a.yr}</td>
                  <td className="text-right py-2 text-slate-300">{fmt(a.interestDeduction)}</td>
                  <td className="text-right py-2 text-slate-300">{fmt(a.saltDeduction)}</td>
                  <td className={`text-right py-2 font-semibold ${a.totalItemized > stdDed ? 'text-blue-400' : 'text-slate-500'}`}>{fmt(a.totalItemized)}</td>
                  <td className={`text-right py-2 font-bold ${a.benefitOver > 0 ? 'text-green-400' : 'text-slate-600'}`}>{a.benefitOver > 0 ? `+${fmt(a.benefitOver)}` : '—'}</td>
                  <td className={`text-right py-2 font-bold ${a.taxSaving > 0 ? 'text-green-400' : 'text-slate-600'}`}>{a.taxSaving > 0 ? fmt(a.taxSaving) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Based on 2024 tax law. SALT deduction capped at $10,000. Mortgage interest deduction capped at $750K loan balance (post-Dec 2017).
        Consult a tax professional for your situation. Does not include state income tax effects.
      </p>
    </div>
  )
}
