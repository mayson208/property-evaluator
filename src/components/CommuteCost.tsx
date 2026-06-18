import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

type TransportMode = 'drive' | 'transit' | 'carpool' | 'bike' | 'walk'

interface Scenario {
  id: TransportMode
  label: string
  icon: string
  costPerMile: number
  speedMph: number
  daysPerWeek: number
  monthlyFixed: number
  color: string
}

const SCENARIOS: Scenario[] = [
  { id: 'drive',   label: 'Drive Alone',  icon: '🚗', costPerMile: 0.67, speedMph: 28, daysPerWeek: 5, monthlyFixed: 150, color: '#ef4444' },
  { id: 'carpool', label: 'Carpool (2)',  icon: '🚘', costPerMile: 0.335, speedMph: 28, daysPerWeek: 5, monthlyFixed: 75, color: '#f59e0b' },
  { id: 'transit', label: 'Public Transit', icon: '🚌', costPerMile: 0.10, speedMph: 18, daysPerWeek: 5, monthlyFixed: 100, color: '#3b82f6' },
  { id: 'bike',    label: 'Bike',         icon: '🚲', costPerMile: 0.02, speedMph: 12, daysPerWeek: 5, monthlyFixed: 15, color: '#22c55e' },
  { id: 'walk',    label: 'Walk',         icon: '🚶', costPerMile: 0.00, speedMph: 3.5, daysPerWeek: 5, monthlyFixed: 0, color: '#a855f7' },
]

export default function CommuteCost() {
  const [distanceMiles,  setDistanceMiles]  = useState(15)
  const [workDaysWeek,   setWorkDaysWeek]   = useState(5)
  const [gasPrice,       setGasPrice]       = useState(3.50)
  const [mpg,            setMpg]            = useState(30)
  const [hourlyWage,     setHourlyWage]     = useState(35)
  const [parkingMonthly, setParkingMonthly] = useState(100)
  const [tollsMonthly,   setTollsMonthly]   = useState(0)
  const [weeksPerYear,   setWeeksPerYear]   = useState(50)
  const [primaryMode,    setPrimaryMode]    = useState<TransportMode>('drive')

  const analysis = useMemo(() => {
    const weeksPerMonth = weeksPerYear / 12

    return SCENARIOS.map(s => {
      const daysPerMonth   = s.daysPerWeek === 5 ? workDaysWeek * weeksPerMonth : workDaysWeek * weeksPerMonth
      const milesPerMonth  = distanceMiles * 2 * daysPerMonth
      const milesPerYear   = milesPerMonth * 12

      let variableCost: number
      if (s.id === 'drive' || s.id === 'carpool') {
        const gasCost      = (milesPerMonth / mpg) * gasPrice
        const irs          = milesPerMonth * s.costPerMile
        variableCost       = s.id === 'drive' ? irs + (parkingMonthly + tollsMonthly) : irs / 2 + (parkingMonthly / 2 + tollsMonthly / 2)
      } else {
        variableCost = milesPerMonth * s.costPerMile
      }

      const totalMonthlyCost = variableCost + s.monthlyFixed + (s.id === 'drive' ? 0 : 0)
      const totalAnnualCost  = totalMonthlyCost * 12

      const oneWayMins     = (distanceMiles / s.speedMph) * 60
      const roundTripMins  = oneWayMins * 2
      const hoursPerMonth  = (roundTripMins / 60) * daysPerMonth
      const timeValueMonth = hoursPerMonth * hourlyWage
      const totalTrueCost  = totalMonthlyCost + timeValueMonth

      return {
        ...s,
        daysPerMonth: Math.round(daysPerMonth),
        milesPerMonth: Math.round(milesPerMonth),
        milesPerYear: Math.round(milesPerYear),
        variableCost: Math.round(variableCost),
        totalMonthlyCost: Math.round(totalMonthlyCost),
        totalAnnualCost: Math.round(totalAnnualCost),
        oneWayMins: Math.round(oneWayMins),
        roundTripMins: Math.round(roundTripMins),
        hoursPerMonth: Math.round(hoursPerMonth * 10) / 10,
        timeValueMonth: Math.round(timeValueMonth),
        totalTrueCost: Math.round(totalTrueCost),
      }
    })
  }, [distanceMiles, workDaysWeek, gasPrice, mpg, hourlyWage, parkingMonthly, tollsMonthly, weeksPerYear])

  const primary = analysis.find(s => s.id === primaryMode) ?? analysis[0]

  const chartData = analysis.map(s => ({
    label: s.icon + ' ' + s.id.charAt(0).toUpperCase() + s.id.slice(1).replace(/([A-Z])/g, ' $1'),
    cash: s.totalMonthlyCost,
    time: s.timeValueMonth,
    color: s.color,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Commute Cost Calculator</h3>
        <p className="text-xs text-slate-500">
          Calculate the true cost of your commute including gas, time, parking, and tolls. Compare transport modes.
        </p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Commute Details</p>
          {[
            { label: 'One-Way Distance',   value: distanceMiles,  min: 0.5, max: 80,  step: 0.5, set: setDistanceMiles,  fmt: (v: number) => `${v} miles` },
            { label: 'Work Days/Week',     value: workDaysWeek,   min: 1,   max: 7,   step: 1,   set: setWorkDaysWeek,   fmt: (v: number) => `${v} days` },
            { label: 'Weeks Worked/Year',  value: weeksPerYear,   min: 40,  max: 52,  step: 1,   set: setWeeksPerYear,   fmt: (v: number) => `${v} weeks` },
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
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Cost Factors</p>
          {[
            { label: 'Gas Price ($/gallon)', value: gasPrice,       min: 2,   max: 7,    step: 0.05, set: setGasPrice,       fmt: (v: number) => `$${v.toFixed(2)}/gal` },
            { label: 'Vehicle MPG',          value: mpg,            min: 10,  max: 80,   step: 1,    set: setMpg,            fmt: (v: number) => `${v} mpg` },
            { label: 'Monthly Parking',      value: parkingMonthly, min: 0,   max: 500,  step: 10,   set: setParkingMonthly, fmt: fmt },
            { label: 'Monthly Tolls',        value: tollsMonthly,   min: 0,   max: 500,  step: 10,   set: setTollsMonthly,   fmt: fmt },
            { label: 'Your Hourly Wage (for time cost)', value: hourlyWage, min: 10, max: 250, step: 5, set: setHourlyWage, fmt: (v: number) => `${fmt(v)}/hr` },
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

      {/* Mode selector */}
      <div>
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Your Primary Mode</p>
        <div className="flex flex-wrap gap-2">
          {SCENARIOS.map(s => (
            <button key={s.id}
              onClick={() => setPrimaryMode(s.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition ${primaryMode === s.id ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
              <span>{s.icon}</span>{s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Primary mode summary */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">
          {primary.icon} {primary.label} — {distanceMiles} miles one way
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            { label: 'Monthly Cash Cost', value: fmt(primary.totalMonthlyCost), sub: 'direct costs only', color: 'text-red-400' },
            { label: 'Annual Cash Cost',  value: fmt(primary.totalAnnualCost),  sub: 'per year',           color: 'text-red-400' },
            { label: 'Time per Commute',  value: `${primary.oneWayMins} min`, sub: `${primary.roundTripMins} min round trip`, color: 'text-yellow-400' },
            { label: 'True Total Cost',   value: fmt(primary.totalTrueCost), sub: 'includes time value', color: 'text-orange-400' },
          ].map(s => (
            <div key={s.label}>
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-600 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 text-center mt-4">
          {primary.milesPerYear.toLocaleString()} miles/year · {primary.hoursPerMonth}hr/month commuting
          · time valued at {fmt(hourlyWage)}/hr
        </p>
      </div>

      {/* Stacked bar chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Monthly Cost Comparison (Cash + Time Value)</p>
        <p className="text-xs text-slate-600 mb-4">Dark bar = direct cash cost · Light bar = time opportunity cost</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(1)}K`} width={45} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v: number, name: string) => [fmt(v), name]} />
            <Bar dataKey="cash" name="Cash Cost" stackId="a" radius={[0, 0, 0, 0]}>
              {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
            <Bar dataKey="time" name="Time Value" stackId="a" radius={[4, 4, 0, 0]}>
              {chartData.map((d, i) => <Cell key={i} fill={d.color + '66'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Mode comparison table */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">All Modes Comparison</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700">
                <th className="text-left pb-2">Mode</th>
                <th className="text-right pb-2">Monthly Cash</th>
                <th className="text-right pb-2">Annual Cash</th>
                <th className="text-right pb-2">One-Way Min</th>
                <th className="text-right pb-2">Hrs/Month</th>
                <th className="text-right pb-2">Time Cost/Mo</th>
                <th className="text-right pb-2 font-bold text-slate-400">True Total/Mo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {analysis.map(s => (
                <tr key={s.id} className={s.id === primaryMode ? 'bg-blue-900/10' : ''}>
                  <td className="py-2">
                    <span className="font-semibold" style={{ color: s.color }}>{s.icon} {s.label}</span>
                    {s.id === primaryMode && <span className="ml-2 text-blue-400 text-xs">◀ yours</span>}
                  </td>
                  <td className="text-right py-2 text-red-400">{fmt(s.totalMonthlyCost)}</td>
                  <td className="text-right py-2 text-slate-400">{fmt(s.totalAnnualCost)}</td>
                  <td className="text-right py-2 text-yellow-400">{s.oneWayMins} min</td>
                  <td className="text-right py-2 text-slate-400">{s.hoursPerMonth}hr</td>
                  <td className="text-right py-2 text-orange-400">{fmt(s.timeValueMonth)}</td>
                  <td className="text-right py-2 font-bold text-white">{fmt(s.totalTrueCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Commute Distance Impact on Housing Budget</p>
        <p className="text-xs text-slate-500 leading-relaxed">
          Moving {distanceMiles} miles closer to work could save up to{' '}
          <span className="text-green-400 font-bold">{fmt((analysis.find(s => s.id === 'drive')?.totalTrueCost ?? 0))}/mo</span>{' '}
          in true commute costs for a solo driver. Divided into affordability: that budget
          supports ~<span className="text-blue-400 font-bold">{fmt((analysis.find(s => s.id === 'drive')?.totalTrueCost ?? 0) * 100)}</span>{' '}
          more in home price (at 28% front-end DTI, {fmt(hourlyWage * 160 * 0.28)}/mo housing allowance).
        </p>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Vehicle cost uses IRS mileage rate ({fmt(SCENARIOS.find(s => s.id === 'drive')?.costPerMile ?? 0.67)}/mile).
        Time cost = commute hours × hourly wage. Transit assumes monthly pass. Bike includes maintenance estimate.
      </p>
    </div>
  )
}
