import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { usePropertyStore } from '../store/usePropertyStore'
import { calculateInvestment } from '../engine/market'

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
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500"
      />
    </div>
  )
}

function MetricCard({ label, value, note, highlight }: { label: string; value: string; note?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl p-4 border ${highlight ? 'bg-blue-900/20 border-blue-700/50' : 'bg-slate-800/50 border-slate-700'}`}>
      <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-xl font-black ${highlight ? 'text-blue-400' : 'text-white'}`}>{value}</p>
      {note && <p className="text-xs text-slate-500 mt-0.5">{note}</p>}
    </div>
  )
}

export default function InvestmentAnalysis() {
  const { result, monthlyRent, setMonthlyRent, downPaymentPct, setDownPaymentPct, interestRate, setInterestRate } = usePropertyStore()
  const [propTaxRate, setPropTaxRate] = useState(1.1)
  const [insuranceAnnual, setInsuranceAnnual] = useState(1800)
  const [vacancyRate, setVacancyRate] = useState(8)
  const [maintenancePct, setMaintenancePct] = useState(1)

  if (!result) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-4xl mb-3">📊</p>
        <p>Run a valuation first to analyze investment returns</p>
      </div>
    )
  }

  const analysis = calculateInvestment(
    result.estimatedValue,
    monthlyRent,
    downPaymentPct,
    interestRate,
    {
      taxes: result.estimatedValue * propTaxRate / 100,
      insurance: insuranceAnnual,
      maintenance: maintenancePct,
      vacancy: vacancyRate,
    },
  )

  const downPayment = result.estimatedValue * downPaymentPct / 100
  const loanAmount = result.estimatedValue - downPayment

  // 5-year projection data
  const projectionData = Array.from({ length: 6 }, (_, yr) => {
    const value = result.estimatedValue * Math.pow(1.04, yr)
    const equity = downPayment + (analysis.monthlyCashFlow * 12 * yr)
    return { year: `Yr ${yr}`, value: Math.round(value / 1000), equity: Math.round((value - loanAmount * Math.pow(0.99, yr)) / 1000) }
  })

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Investment Analysis</h3>
        <p className="text-xs text-slate-500">Model rental income, financing, and returns</p>
      </div>

      {/* Inputs */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-4">
        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Assumptions</p>
        <Slider
          label="Monthly Rent"
          value={monthlyRent}
          min={500} max={15000} step={50}
          format={v => fmt(v) + '/mo'}
          onChange={setMonthlyRent}
        />
        <Slider
          label="Down Payment"
          value={downPaymentPct}
          min={3} max={100} step={1}
          format={v => `${v}% (${fmt(result.estimatedValue * v / 100)})`}
          onChange={setDownPaymentPct}
        />
        <Slider
          label="Interest Rate"
          value={interestRate}
          min={3} max={12} step={0.25}
          format={v => `${v}%`}
          onChange={setInterestRate}
        />
        <Slider
          label="Property Tax Rate"
          value={propTaxRate}
          min={0.3} max={3} step={0.1}
          format={v => `${v}% (${fmt(result.estimatedValue * v / 100)}/yr)`}
          onChange={setPropTaxRate}
        />
        <Slider
          label="Vacancy Rate"
          value={vacancyRate}
          min={0} max={20} step={1}
          format={v => `${v}%`}
          onChange={setVacancyRate}
        />
        <Slider
          label="Maintenance"
          value={maintenancePct}
          min={0.5} max={3} step={0.5}
          format={v => `${v}% of value/yr`}
          onChange={setMaintenancePct}
        />
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Monthly Cash Flow" value={fmt(analysis.monthlyCashFlow)}
          note={analysis.monthlyCashFlow >= 0 ? 'Cash flowing' : 'Negative cash flow'} highlight />
        <MetricCard label="Cap Rate" value={`${analysis.capRate.toFixed(2)}%`}
          note={analysis.capRate >= 6 ? 'Strong' : analysis.capRate >= 4 ? 'Moderate' : 'Weak'} />
        <MetricCard label="Cash-on-Cash" value={`${analysis.cashOnCash.toFixed(1)}%`}
          note="Annual return on down payment" />
        <MetricCard label="Gross Yield" value={`${analysis.grossYield.toFixed(2)}%`}
          note="Annual rent / property value" />
        <MetricCard label="Net Yield" value={`${analysis.netYield.toFixed(2)}%`}
          note="After tax, insurance, vacancy" />
        <MetricCard label="Break-even" value={analysis.breakEvenYears < 100 ? `${analysis.breakEvenYears} yrs` : 'N/A'}
          note="Years to recoup down payment" />
      </div>

      {/* 5-yr total return */}
      <div className={`rounded-xl p-4 border text-center ${
        analysis.totalReturn5yr >= 0 ? 'bg-green-900/20 border-green-700/50' : 'bg-red-900/20 border-red-700/50'
      }`}>
        <p className="text-xs text-slate-400 mb-1">Projected 5-Year Total Return</p>
        <p className={`text-3xl font-black ${analysis.totalReturn5yr >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {analysis.totalReturn5yr >= 0 ? '+' : ''}{analysis.totalReturn5yr}%
        </p>
        <p className="text-xs text-slate-500 mt-1">Cash flow + 4% annual appreciation on {fmt(result.estimatedValue)}</p>
      </div>

      {/* Equity buildup chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Equity Buildup (5 yr, $K)</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={projectionData} margin={{ top: 5, right: 10, left: 5, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}K`} width={55} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v: number) => [`$${v}K`, '']}
            />
            <Bar dataKey="value" fill="#1e40af" name="Property Value" radius={[4, 4, 0, 0]} />
            <Bar dataKey="equity" fill="#3b82f6" name="Equity" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Financing summary */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-2">
        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-3">Financing Summary</p>
        {[
          ['Purchase Price', fmt(result.estimatedValue)],
          ['Down Payment', `${fmt(downPayment)} (${downPaymentPct}%)`],
          ['Loan Amount', fmt(loanAmount)],
          ['Monthly Payment (P&I)', fmt((loanAmount * (interestRate / 100 / 12) * Math.pow(1 + interestRate / 100 / 12, 360)) / (Math.pow(1 + interestRate / 100 / 12, 360) - 1))],
          ['Monthly Gross Rent', fmt(monthlyRent)],
          ['Monthly Net (after expenses)', fmt(analysis.monthlyCashFlow)],
        ].map(([l, v]) => (
          <div key={l} className="flex justify-between text-sm">
            <span className="text-slate-400">{l}</span>
            <span className="text-slate-200 font-semibold">{v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
