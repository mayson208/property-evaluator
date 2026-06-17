import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { usePropertyStore } from '../store/usePropertyStore'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function Slider({ label, value, min, max, step = 1, format, onChange }: {
  label: string; value: number; min: number; max: number; step?: number
  format: (v: number) => string; onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-xs text-slate-400 uppercase tracking-widest">{label}</label>
        <span className="text-xs font-bold text-blue-400">{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500"
      />
    </div>
  )
}

export default function MortgageCalc() {
  const { result } = usePropertyStore()
  const [homePrice, setHomePrice]   = useState(result?.estimatedValue ?? 400000)
  const [downPct, setDownPct]       = useState(20)
  const [rate, setRate]             = useState(7.25)
  const [termYrs, setTermYrs]       = useState(30)
  const [propTax, setPropTax]       = useState(1.1)
  const [insurance, setInsurance]   = useState(1800)
  const [pmi, setPmi]               = useState(0.5)

  // Sync home price if result changes
  useMemo(() => {
    if (result?.estimatedValue) setHomePrice(result.estimatedValue)
  }, [result?.estimatedValue])

  const downPayment = homePrice * downPct / 100
  const loan = homePrice - downPayment
  const monthlyRate = rate / 100 / 12
  const numPayments = termYrs * 12

  const monthlyPI = monthlyRate === 0
    ? loan / numPayments
    : (loan * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
      (Math.pow(1 + monthlyRate, numPayments) - 1)

  const monthlyTax = homePrice * propTax / 100 / 12
  const monthlyIns = insurance / 12
  const monthlyPMI = downPct < 20 ? loan * pmi / 100 / 12 : 0
  const totalMonthly = monthlyPI + monthlyTax + monthlyIns + monthlyPMI
  const totalPaid = monthlyPI * numPayments
  const totalInterest = totalPaid - loan

  // Amortisation schedule (yearly snapshots)
  const amortData = useMemo(() => {
    const data = []
    let balance = loan
    let totalPrincipal = 0
    let totalInt = 0

    for (let yr = 1; yr <= termYrs; yr++) {
      for (let mo = 0; mo < 12; mo++) {
        const interestPmt = balance * monthlyRate
        const principalPmt = monthlyPI - interestPmt
        balance = Math.max(0, balance - principalPmt)
        totalPrincipal += principalPmt
        totalInt += interestPmt
      }
      data.push({
        year: yr,
        balance: Math.round(balance / 1000),
        equity: Math.round((homePrice - balance) / 1000),
        cumInterest: Math.round(totalInt / 1000),
      })
    }
    return data
  }, [loan, monthlyRate, monthlyPI, termYrs, homePrice])

  // Comparison: 15yr vs 30yr
  const rate15 = rate - 0.5
  const m15 = (loan * (rate15 / 100 / 12) * Math.pow(1 + rate15 / 100 / 12, 180)) /
              (Math.pow(1 + rate15 / 100 / 12, 180) - 1)
  const totalInt15 = m15 * 180 - loan

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Mortgage Calculator</h3>
        <p className="text-xs text-slate-500">Full PITI payment breakdown and amortisation</p>
      </div>

      {/* Inputs */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-4">
        <Slider label="Home Price" value={homePrice} min={50000} max={5000000} step={5000}
          format={v => fmt(v)} onChange={setHomePrice} />
        <Slider label="Down Payment" value={downPct} min={3} max={100} step={1}
          format={v => `${v}% (${fmt(homePrice * v / 100)})`} onChange={setDownPct} />
        <Slider label="Interest Rate" value={rate} min={2} max={12} step={0.125}
          format={v => `${v}%`} onChange={setRate} />
        <div>
          <label className="text-xs text-slate-400 uppercase tracking-widest block mb-2">Loan Term</label>
          <div className="flex gap-2">
            {[10, 15, 20, 30].map(yr => (
              <button key={yr} onClick={() => setTermYrs(yr)}
                className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition border ${
                  termYrs === yr ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                }`}>
                {yr}yr
              </button>
            ))}
          </div>
        </div>
        <Slider label="Property Tax Rate" value={propTax} min={0.3} max={3} step={0.1}
          format={v => `${v}% (${fmt(homePrice * v / 100)}/yr)`} onChange={setPropTax} />
        <Slider label="Annual Insurance" value={insurance} min={600} max={10000} step={100}
          format={v => fmt(v) + '/yr'} onChange={setInsurance} />
        {downPct < 20 && (
          <Slider label="PMI Rate" value={pmi} min={0.1} max={1.5} step={0.1}
            format={v => `${v}%`} onChange={setPmi} />
        )}
      </div>

      {/* Monthly breakdown */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Monthly Payment</p>
        <div className="text-4xl font-black text-white mb-4">{fmt(totalMonthly)}/mo</div>
        <div className="space-y-2">
          {[
            { label: 'Principal & Interest', amount: monthlyPI, color: 'bg-blue-500' },
            { label: 'Property Tax',          amount: monthlyTax, color: 'bg-purple-500' },
            { label: 'Insurance',             amount: monthlyIns, color: 'bg-cyan-500' },
            ...(monthlyPMI > 0 ? [{ label: 'PMI', amount: monthlyPMI, color: 'bg-orange-500' }] : []),
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3 text-sm">
              <div className={`w-2.5 h-2.5 rounded-sm flex-shrink-0 ${item.color}`} />
              <span className="text-slate-400 flex-1">{item.label}</span>
              <span className="text-slate-200 font-semibold font-mono">{fmt(item.amount)}/mo</span>
              <span className="text-slate-600 text-xs w-12 text-right">
                {((item.amount / totalMonthly) * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Loan summary */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Loan Amount',    value: fmt(loan) },
          { label: 'Total Payments', value: fmt(totalPaid) },
          { label: 'Total Interest', value: fmt(totalInterest) },
          { label: 'Interest %',     value: `${((totalInterest / loan) * 100).toFixed(0)}% of loan` },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className="text-base font-bold text-slate-200 mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* 15 vs 30 year comparison */}
      {termYrs === 30 && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">15yr vs 30yr Comparison</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500 mb-1">30-Year @ {rate}%</p>
              <p className="font-bold text-slate-200">{fmt(monthlyPI)}/mo</p>
              <p className="text-red-400 text-xs mt-0.5">+{fmt(totalInterest)} interest</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">15-Year @ {rate15}%</p>
              <p className="font-bold text-slate-200">{fmt(m15)}/mo</p>
              <p className="text-green-400 text-xs mt-0.5">Save {fmt(totalInterest - totalInt15)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Amortisation chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Amortisation ($K)</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={amortData} margin={{ top: 5, right: 10, left: 5, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false}
              tickFormatter={v => `Yr${v}`} interval={Math.floor(termYrs / 6)} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false}
              tickFormatter={v => `$${v}K`} width={60} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v: number) => [`$${v}K`, '']} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#64748b' }} />
            <Line type="monotone" dataKey="balance"     name="Remaining Balance" stroke="#ef4444" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="equity"      name="Equity"            stroke="#22c55e" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="cumInterest" name="Cum. Interest"     stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
