import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Seasonal multipliers — indices relative to avg nightly rate
const SEASONALITY: Record<string, number[]> = {
  beach:    [0.55, 0.55, 0.70, 0.85, 1.10, 1.35, 1.50, 1.45, 1.20, 0.85, 0.65, 0.70],
  ski:      [1.40, 1.35, 1.10, 0.75, 0.60, 0.60, 0.65, 0.65, 0.70, 0.90, 1.10, 1.30],
  urban:    [0.85, 0.85, 0.95, 1.05, 1.10, 1.15, 1.10, 1.10, 1.10, 1.05, 0.90, 0.85],
  suburban: [0.85, 0.85, 0.90, 0.95, 1.05, 1.10, 1.20, 1.20, 1.05, 0.95, 0.90, 0.90],
  rural:    [0.80, 0.80, 0.90, 1.00, 1.10, 1.15, 1.25, 1.20, 1.05, 0.95, 0.85, 0.90],
}

export default function ShortTermRental() {
  const { result, monthlyRent, downPaymentPct, interestRate } = usePropertyStore()

  const homeValue = result?.estimatedValue ?? 400000
  const ltrMonthly = monthlyRent > 0 ? monthlyRent : Math.round(homeValue * 0.007)

  const [nightlyRate,    setNightlyRate]    = useState(Math.round(ltrMonthly / 20))
  const [occupancyPct,   setOccupancyPct]   = useState(60)
  const [cleaningFee,    setCleaningFee]    = useState(80)
  const [platformFee,    setPlatformFee]    = useState(3)
  const [hostFee,        setHostFee]        = useState(3)
  const [cleaningsMonth, setCleaningsMonth] = useState(6)
  const [propMgmtPct,   setPropMgmtPct]   = useState(0)
  const [location,       setLocation]       = useState<keyof typeof SEASONALITY>('urban')
  const [annualTaxPct,   setAnnualTaxPct]   = useState(1.1)
  const [annualInsurance, setAnnualInsurance] = useState(Math.round(homeValue * 0.006))
  const [monthlyUtil,    setMonthlyUtil]    = useState(200)
  const [suppliesMo,     setSuppliesMo]     = useState(100)
  const [loanBalance,    setLoanBalance]    = useState(Math.round(homeValue * (1 - downPaymentPct / 100)))

  const monthlyData = useMemo(() => {
    const mults = SEASONALITY[location]
    return MONTHS.map((mo, i) => {
      const adjRate     = nightlyRate * mults[i]
      const daysBooked  = Math.round(30 * (occupancyPct / 100) * mults[i])
      const grossRent   = adjRate * daysBooked
      const cleaningRev = cleaningFee * daysBooked / cleaningsMonth * Math.max(1, cleaningsMonth * mults[i] / 12)
      const platformCut = grossRent * (platformFee / 100)
      const hostCut     = grossRent * (hostFee / 100)
      const cleanCost   = cleaningFee * Math.max(1, cleaningsMonth * mults[i] / 12)
      const mgmtCost    = (grossRent + cleaningRev) * (propMgmtPct / 100)
      const propTax     = homeValue * annualTaxPct / 100 / 12
      const ins         = annualInsurance / 12
      const mortgage    = loanBalance > 0 ? loanBalance * (interestRate / 100 / 12) * (1 + interestRate / 100 / 12) ** (30 * 12) / ((1 + interestRate / 100 / 12) ** (30 * 12) - 1) : 0

      const revenue     = grossRent + cleaningRev
      const expenses    = platformCut + hostCut + cleanCost + mgmtCost + propTax + ins + monthlyUtil + suppliesMo
      const netIncome   = revenue - expenses - mortgage

      return {
        mo,
        adjRate:    Math.round(adjRate),
        daysBooked,
        revenue:    Math.round(revenue),
        expenses:   Math.round(expenses),
        netIncome:  Math.round(netIncome),
        occupancy:  Math.round((occupancyPct / 100) * mults[i] * 100),
      }
    })
  }, [nightlyRate, occupancyPct, cleaningFee, platformFee, hostFee, cleaningsMonth, propMgmtPct, location, annualTaxPct, annualInsurance, monthlyUtil, suppliesMo, loanBalance, interestRate, homeValue])

  const annualRevenue   = monthlyData.reduce((s, m) => s + m.revenue, 0)
  const annualExpenses  = monthlyData.reduce((s, m) => s + m.expenses, 0)
  const annualNet       = monthlyData.reduce((s, m) => s + m.netIncome, 0)
  const avgOccupancy    = Math.round(monthlyData.reduce((s, m) => s + m.occupancy, 0) / 12)
  const ltrAnnual       = ltrMonthly * 12
  const strAdvantage    = annualNet - ltrAnnual

  const downAmt  = homeValue - loanBalance
  const capRate  = (annualNet / homeValue) * 100
  const cashOnCash = downAmt > 0 ? (annualNet / downAmt) * 100 : 0

  if (!result) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-4xl mb-3">🏡</p>
        <p>Run a valuation first to analyze short-term rental potential</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Short-Term Rental (Airbnb/VRBO) Analyzer</h3>
        <p className="text-xs text-slate-500">
          Model STR income with seasonal occupancy curves, platform fees, and compare vs long-term rental.
        </p>
      </div>

      {/* Location & settings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Revenue Settings</p>
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Property Location Type</p>
            <div className="grid grid-cols-5 gap-1">
              {(Object.keys(SEASONALITY) as (keyof typeof SEASONALITY)[]).map(loc => (
                <button key={loc}
                  onClick={() => setLocation(loc)}
                  className={`px-2 py-1.5 rounded-lg text-xs font-bold transition capitalize ${location === loc ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                  {loc}
                </button>
              ))}
            </div>
          </div>
          {[
            { label: 'Base Nightly Rate',   value: nightlyRate,    min: 30,  max: 1000, step: 5,   set: setNightlyRate,    fmt: (v: number) => `${fmt(v)}/night` },
            { label: 'Base Occupancy',      value: occupancyPct,   min: 10,  max: 95,   step: 1,   set: setOccupancyPct,   fmt: (v: number) => `${v}%` },
            { label: 'Cleaning Fee',        value: cleaningFee,    min: 20,  max: 400,  step: 10,  set: setCleaningFee,    fmt: (v: number) => fmt(v) },
            { label: 'Cleanings per Month', value: cleaningsMonth, min: 1,   max: 20,   step: 1,   set: setCleaningsMonth, fmt: (v: number) => `${v}` },
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

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Expenses</p>
          {[
            { label: 'Airbnb Platform Fee',  value: platformFee,    min: 0, max: 5,    step: 0.25, set: setPlatformFee,    fmt: (v: number) => `${v}%` },
            { label: 'Host Service Fee',     value: hostFee,        min: 0, max: 5,    step: 0.25, set: setHostFee,        fmt: (v: number) => `${v}%` },
            { label: 'Property Mgmt %',     value: propMgmtPct,    min: 0, max: 30,   step: 1,    set: setPropMgmtPct,   fmt: (v: number) => `${v}%${v === 0 ? ' (self-manage)' : ''}` },
            { label: 'Monthly Utilities',    value: monthlyUtil,    min: 0, max: 1000, step: 25,   set: setMonthlyUtil,    fmt: fmt },
            { label: 'Monthly Supplies',     value: suppliesMo,     min: 0, max: 500,  step: 25,   set: setSuppliesMo,     fmt: fmt },
            { label: 'Property Tax Rate',    value: annualTaxPct,   min: 0.3, max: 3, step: 0.05,  set: setAnnualTaxPct,   fmt: (v: number) => `${v.toFixed(2)}%` },
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
      </div>

      {/* Annual summary */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Annual STR Summary</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            { label: 'Gross Revenue',  value: fmt(annualRevenue), color: 'text-green-400' },
            { label: 'Total Expenses', value: fmt(annualExpenses), color: 'text-red-400' },
            { label: 'Net Income',     value: fmt(annualNet), color: annualNet >= 0 ? 'text-green-400' : 'text-red-400' },
            { label: 'Cap Rate',       value: `${capRate.toFixed(1)}%`, color: capRate >= 6 ? 'text-green-400' : capRate >= 4 ? 'text-blue-400' : 'text-yellow-400' },
          ].map(s => (
            <div key={s.label}>
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* STR vs LTR */}
        <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-slate-500 mb-1">STR Net/yr</p>
            <p className={`text-lg font-black ${annualNet >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(annualNet)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">LTR Net/yr (est.)</p>
            <p className="text-lg font-black text-blue-400">{fmt(ltrAnnual)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">STR Advantage</p>
            <p className={`text-lg font-black ${strAdvantage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {strAdvantage >= 0 ? '+' : ''}{fmt(strAdvantage)}/yr
            </p>
          </div>
        </div>
      </div>

      {/* Monthly chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Monthly Revenue vs Expenses</p>
        <p className="text-xs text-slate-600 mb-4">
          Seasonal pattern: <span className="capitalize">{location}</span>. Avg occupancy: {avgOccupancy}%.
          {ltrMonthly > 0 && ` LTR: ${fmt(ltrMonthly)}/mo dashed line.`}
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={monthlyData.map(m => ({ ...m, name: m.mo }))} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} width={45} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v: number, name: string) => [fmt(v), name]} />
            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
            {ltrMonthly > 0 && (
              <ReferenceLine y={ltrMonthly} stroke="#3b82f6" strokeDasharray="4 4"
                label={{ value: 'LTR', fill: '#3b82f6', fontSize: 10, position: 'right' }} />
            )}
            <Bar dataKey="revenue" name="Gross Revenue" fill="#22c55e" radius={[3, 3, 0, 0]} />
            <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Net income by month */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Net Cash Flow by Month</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={monthlyData.map(m => ({ ...m, name: m.mo }))} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => v >= 0 ? `$${(v / 1000).toFixed(0)}K` : `-$${(Math.abs(v) / 1000).toFixed(0)}K`} width={45} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v: number) => [fmt(v), 'Net Cash Flow']} />
            <ReferenceLine y={0} stroke="#64748b" strokeDasharray="3 3" />
            <Bar dataKey="netIncome" name="Net Cash Flow" radius={[3, 3, 0, 0]}>
              {monthlyData.map((d, i) => <Cell key={i} fill={d.netIncome >= 0 ? '#22c55e' : '#ef4444'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly detail table */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Monthly Detail</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700">
                <th className="text-left pb-2">Month</th>
                <th className="text-right pb-2">Avg Rate</th>
                <th className="text-right pb-2">Days Booked</th>
                <th className="text-right pb-2">Occupancy</th>
                <th className="text-right pb-2">Revenue</th>
                <th className="text-right pb-2">Expenses</th>
                <th className="text-right pb-2 text-slate-400">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {monthlyData.map(m => (
                <tr key={m.mo}>
                  <td className="py-1.5 text-slate-400 font-semibold">{m.mo}</td>
                  <td className="text-right py-1.5 text-slate-300">{fmt(m.adjRate)}</td>
                  <td className="text-right py-1.5 text-slate-300">{m.daysBooked}</td>
                  <td className="text-right py-1.5 text-slate-400">{m.occupancy}%</td>
                  <td className="text-right py-1.5 text-green-400">{fmt(m.revenue)}</td>
                  <td className="text-right py-1.5 text-red-400">{fmt(m.expenses)}</td>
                  <td className={`text-right py-1.5 font-bold ${m.netIncome >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {m.netIncome >= 0 ? '+' : ''}{fmt(m.netIncome)}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-slate-600 font-bold">
                <td className="py-2 text-slate-300">Annual</td>
                <td className="text-right py-2 text-slate-300">—</td>
                <td className="text-right py-2 text-slate-300">{monthlyData.reduce((s, m) => s + m.daysBooked, 0)}</td>
                <td className="text-right py-2 text-slate-400">{avgOccupancy}%</td>
                <td className="text-right py-2 text-green-400">{fmt(annualRevenue)}</td>
                <td className="text-right py-2 text-red-400">{fmt(annualExpenses)}</td>
                <td className={`text-right py-2 font-black ${annualNet >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(annualNet)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-4">
        <p className="text-xs text-yellow-400 font-semibold mb-1">Important Considerations</p>
        <ul className="space-y-1 text-xs text-slate-400">
          <li>• Check local STR regulations — many cities require permits or limit nights per year</li>
          <li>• HOAs may prohibit or restrict short-term rentals</li>
          <li>• STR income is typically taxable; consult a tax professional about depreciation and Schedule E</li>
          <li>• Airbnb/VRBO collect and remit occupancy taxes in most jurisdictions</li>
          <li>• Short-term rental insurance is different from standard homeowner's insurance</li>
        </ul>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Revenue projections are estimates using seasonal multipliers. Actual occupancy depends heavily on reviews, listing quality, and local competition.
      </p>
    </div>
  )
}
