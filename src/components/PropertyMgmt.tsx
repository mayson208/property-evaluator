import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899']

export default function PropertyMgmt() {
  const { result, monthlyRent: storeRent } = usePropertyStore()

  const defaultRent = storeRent > 0 ? storeRent : result ? Math.round(result.estimatedValue * 0.007) : 1800

  const [monthlyRent,      setMonthlyRent]      = useState(defaultRent)
  const [vacancyPct,       setVacancyPct]       = useState(8)
  const [unitsCount,       setUnitsCount]       = useState(1)

  // Self-manage costs
  const [selfTimeHrsMonth, setSelfTimeHrsMonth] = useState(8)
  const [selfHourlyWage,   setSelfHourlyWage]   = useState(50)
  const [selfRepairMarkup, setSelfRepairMarkup] = useState(0)   // DIY saves markup
  const [selfMileage,      setSelfMileage]      = useState(30)  // miles/month

  // PM costs
  const [pmMgmtPct,        setPmMgmtPct]        = useState(10)   // % of collected rent
  const [pmLeaseupFee,     setPmLeaseupFee]     = useState(100)  // % of 1 month's rent per vacancy
  const [pmMaintenanceMark, setPmMaintenanceMark] = useState(15) // markup on repairs
  const [avgRepairMonth,   setAvgRepairMonth]   = useState(200)

  const analysis = useMemo(() => {
    const grossRent   = monthlyRent * unitsCount
    const vacancyLoss = grossRent * vacancyPct / 100
    const effectiveGross = grossRent - vacancyLoss

    // Self-manage annual costs
    const selfTimeCost   = selfTimeHrsMonth * selfHourlyWage * 12
    const selfMileageCost = selfMileage * 0.67 * 12   // IRS rate
    const selfRepairCost  = avgRepairMonth * unitsCount * 12 * (1 + selfRepairMarkup / 100)
    const selfVacancyFillCost = 0  // self fills vacancy
    const selfTotalCost   = selfTimeCost + selfMileageCost + selfRepairCost

    // Property manager annual costs
    const pmMgmtFee      = effectiveGross * pmMgmtPct / 100 * 12
    const pmLeaseupCost  = (vacancyPct / 100) * unitsCount * monthlyRent * pmLeaseupFee / 100
    const pmRepairCost   = avgRepairMonth * unitsCount * 12 * (1 + pmMaintenanceMark / 100)
    const pmTotalCost    = pmMgmtFee + pmLeaseupCost + pmRepairCost

    const annualEffectiveGross = effectiveGross * 12
    const selfNetIncome  = annualEffectiveGross - selfTotalCost
    const pmNetIncome    = annualEffectiveGross - pmTotalCost

    const pmCostPremium  = pmTotalCost - selfTotalCost
    const selfHrsPerYear = selfTimeHrsMonth * 12

    return {
      grossRent, vacancyLoss, effectiveGross, annualEffectiveGross,
      selfTimeCost, selfMileageCost, selfRepairCost, selfTotalCost, selfNetIncome, selfHrsPerYear,
      pmMgmtFee, pmLeaseupCost, pmRepairCost, pmTotalCost, pmNetIncome,
      pmCostPremium,
    }
  }, [monthlyRent, vacancyPct, unitsCount, selfTimeHrsMonth, selfHourlyWage, selfRepairMarkup, selfMileage, avgRepairMonth, pmMgmtPct, pmLeaseupFee, pmMaintenanceMark])

  const compData = [
    { name: 'Self-Manage', value: analysis.selfTotalCost, color: '#3b82f6' },
    { name: 'Property Mgr', value: analysis.pmTotalCost,   color: '#f59e0b' },
  ]

  const breakdownData = [
    { category: 'Time / Opportunity', self: analysis.selfTimeCost, pm: 0 },
    { category: 'Mileage',            self: analysis.selfMileageCost, pm: 0 },
    { category: 'Repairs',            self: analysis.selfRepairCost, pm: analysis.pmRepairCost },
    { category: 'Mgmt Fee',           self: 0, pm: analysis.pmMgmtFee },
    { category: 'Lease-up Fee',       self: 0, pm: analysis.pmLeaseupCost },
  ]

  const selfPieData = [
    { name: 'Time cost',    value: Math.round(analysis.selfTimeCost) },
    { name: 'Mileage',      value: Math.round(analysis.selfMileageCost) },
    { name: 'Repairs',      value: Math.round(analysis.selfRepairCost) },
  ]

  const pmPieData = [
    { name: 'Mgmt fee',     value: Math.round(analysis.pmMgmtFee) },
    { name: 'Lease-up',     value: Math.round(analysis.pmLeaseupCost) },
    { name: 'Repairs',      value: Math.round(analysis.pmRepairCost) },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Self-Manage vs Property Manager</h3>
        <p className="text-xs text-slate-500">
          Compare the true cost of self-managing your rental vs hiring a property management company,
          including your time, mileage, and maintenance markup differences.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-900/20 border border-blue-700/40 rounded-xl p-4">
          <p className="text-xs text-blue-400 uppercase tracking-widest mb-2">Self-Manage</p>
          <p className="text-2xl font-black text-white">{fmt(analysis.selfNetIncome)}</p>
          <p className="text-xs text-slate-500">annual net income</p>
          <div className="mt-3 space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-slate-500">Annual costs</span><span className="text-white">{fmt(analysis.selfTotalCost)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Your time</span><span className="text-yellow-400">{analysis.selfHrsPerYear} hrs/yr</span></div>
          </div>
        </div>
        <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-4">
          <p className="text-xs text-yellow-400 uppercase tracking-widest mb-2">Property Manager</p>
          <p className="text-2xl font-black text-white">{fmt(analysis.pmNetIncome)}</p>
          <p className="text-xs text-slate-500">annual net income</p>
          <div className="mt-3 space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-slate-500">Annual costs</span><span className="text-white">{fmt(analysis.pmTotalCost)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Your time</span><span className="text-green-400">~0 hrs/yr</span></div>
          </div>
        </div>
      </div>

      {analysis.pmCostPremium > 0 ? (
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center text-xs">
          <span className="text-slate-400">PM costs you an extra </span>
          <span className="text-yellow-400 font-bold">{fmt(analysis.pmCostPremium)}/yr</span>
          <span className="text-slate-400"> but saves you </span>
          <span className="text-blue-400 font-bold">{analysis.selfHrsPerYear} hours</span>
          <span className="text-slate-400"> — that's </span>
          <span className="text-white font-bold">{fmt(analysis.pmCostPremium / analysis.selfHrsPerYear)}/hr</span>
          <span className="text-slate-400"> effective rate for your time</span>
        </div>
      ) : (
        <div className="bg-green-900/20 rounded-xl p-3 border border-green-700/40 text-center text-xs text-green-400 font-bold">
          PM actually saves money vs self-managing (at your hourly wage) — consider hiring one!
        </div>
      )}

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Property Details</p>
          {[
            { label: 'Monthly Rent (per unit)',  value: monthlyRent,   min: 300,   max: 10000, step: 50,   set: setMonthlyRent,   fmt: fmt },
            { label: 'Number of Units',          value: unitsCount,    min: 1,     max: 20,    step: 1,    set: setUnitsCount,    fmt: (v: number) => `${v} unit${v > 1 ? 's' : ''}` },
            { label: 'Vacancy Rate',             value: vacancyPct,    min: 0,     max: 20,    step: 1,    set: setVacancyPct,    fmt: (v: number) => `${v}%` },
            { label: 'Avg Repair / Month',       value: avgRepairMonth, min: 0,    max: 1000,  step: 25,   set: setAvgRepairMonth, fmt: fmt },
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

        <div className="space-y-3">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
            <p className="text-xs text-blue-400 uppercase tracking-widest font-bold">Self-Manage Inputs</p>
            {[
              { label: 'Time Per Month',    value: selfTimeHrsMonth, min: 1,  max: 40,  step: 1,    set: setSelfTimeHrsMonth, fmt: (v: number) => `${v} hrs` },
              { label: 'Your Hourly Wage',  value: selfHourlyWage,   min: 10, max: 200, step: 5,    set: setSelfHourlyWage,   fmt: (v: number) => `${fmt(v)}/hr` },
              { label: 'Miles Driven/Mo',   value: selfMileage,      min: 0,  max: 300, step: 10,   set: setSelfMileage,      fmt: (v: number) => `${v} mi` },
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
            <p className="text-xs text-yellow-400 uppercase tracking-widest font-bold">PM Company Inputs</p>
            {[
              { label: 'Mgmt Fee',       value: pmMgmtPct,         min: 6,  max: 15,  step: 0.5, set: setPmMgmtPct,         fmt: (v: number) => `${v}% of rent` },
              { label: 'Lease-up Fee',   value: pmLeaseupFee,      min: 50, max: 150, step: 10,  set: setPmLeaseupFee,      fmt: (v: number) => `${v}% 1st month` },
              { label: 'Repair Markup',  value: pmMaintenanceMark, min: 0,  max: 30,  step: 5,   set: setPmMaintenanceMark, fmt: (v: number) => `${v}%` },
            ].map(s => (
              <div key={s.label}>
                <div className="flex justify-between mb-1">
                  <label className="text-xs text-slate-400 uppercase tracking-widest">{s.label}</label>
                  <span className="text-xs font-bold text-yellow-400">{s.fmt(s.value)}</span>
                </div>
                <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                  onChange={e => s.set(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-yellow-400" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cost breakdown chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Cost Breakdown by Category</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={breakdownData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="category" tick={{ fill: '#94a3b8', fontSize: 9 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} width={50} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number) => [fmt(v)]} />
            <Legend />
            <Bar dataKey="self" name="Self-Manage" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="pm"   name="Property Mgr" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pie charts side by side */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { title: 'Self-Manage Costs', data: selfPieData },
          { title: 'PM Costs',          data: pmPieData },
        ].map(p => (
          <div key={p.title} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-2 text-center">{p.title}</p>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={p.data} cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                  dataKey="value" nameKey="name" paddingAngle={3}>
                  {p.data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                  formatter={(v: number) => [fmt(v)]} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 9, color: '#94a3b8' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>

      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">When to Hire a PM</p>
        <div className="space-y-1.5 text-xs text-slate-400">
          {[
            `✅ You own 3+ units — PM economies of scale kick in`,
            `✅ Your property is ${'>'}1 hour from your primary residence`,
            `✅ You have a high hourly wage (>${fmt(Math.round(analysis.pmCostPremium / analysis.selfHrsPerYear))}/hr effective) — let PM handle it`,
            `✅ You're scaling a portfolio and need to protect your time`,
            `❌ Avoid PM if self-managing 1-2 local units — math rarely pencils out`,
            `❌ Interview at least 3 PMs, check Google reviews, and ask for a sample monthly statement`,
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        PM fees typically range from 6–12% of collected rent. Always read the full management agreement —
        watch for maintenance minimums, lease renewal fees, and early termination clauses.
      </p>
    </div>
  )
}
