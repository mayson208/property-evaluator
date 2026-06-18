import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, LineChart, Line } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function monthlyPmt(principal: number, annualRate: number, termYears: number) {
  const r = annualRate / 100 / 12
  const n = termYears * 12
  if (r === 0 || n === 0) return 0
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

// Approximate cost per sqft by region and build quality
const BUILD_QUALITY = [
  { label: 'Basic / Production',    lowCost: 120, highCost: 180 },
  { label: 'Mid-Grade',             lowCost: 180, highCost: 250 },
  { label: 'Custom / High-End',     lowCost: 250, highCost: 400 },
  { label: 'Luxury',                lowCost: 400, highCost: 700 },
]

export default function NewConstruction() {
  const { result, input, interestRate } = usePropertyStore()

  const resaleVal = result?.estimatedValue ?? 400000
  const sqft      = input.sqft ?? 2000

  // Resale
  const [resalePrice,     setResalePrice]     = useState(resaleVal)
  const [resaleRepairs,   setResaleRepairs]   = useState(Math.round(resaleVal * 0.02))
  const [resaleAge,       setResaleAge]       = useState(input.yearBuilt ? new Date().getFullYear() - input.yearBuilt : 20)

  // New construction
  const [landCost,        setLandCost]        = useState(Math.round(resaleVal * 0.20))
  const [buildSqft,       setBuildSqft]       = useState(sqft)
  const [qualityIdx,      setQualityIdx]      = useState(1)  // mid-grade default
  const [costPerSqft,     setCostPerSqft]     = useState(210)
  const [softCostsPct,    setSoftCostsPct]    = useState(12)  // permits, arch, engineering, fees
  const [contingencyPct,  setContingencyPct]  = useState(10)
  const [buildMonths,     setBuildMonths]     = useState(10)
  const [rentDuringBuild, setRentDuringBuild] = useState(2000)

  // Financing
  const [rate,            setRate]            = useState(interestRate)
  const [downPct,         setDownPct]         = useState(20)
  const [constructionRate, setConstructionRate] = useState(interestRate + 1)  // construction loans typically higher

  // Appreciation
  const [resaleAppreciation, setResaleAppreciation] = useState(3.0)
  const [newAppreciation,    setNewAppreciation]    = useState(3.5)  // new homes appreciate faster initially

  const analysis = useMemo(() => {
    // New construction total cost
    const hardCosts     = buildSqft * costPerSqft
    const softCosts     = hardCosts * softCostsPct / 100
    const contingency   = (hardCosts + softCosts) * contingencyPct / 100
    const totalBuildCost = hardCosts + softCosts + contingency
    const totalNewCost  = landCost + totalBuildCost
    const perSqftAll    = buildSqft > 0 ? totalNewCost / buildSqft : 0

    // Construction loan interest (interest-only during build on avg 50% drawn)
    const avgDrawn      = totalBuildCost * 0.5
    const constructionInterest = avgDrawn * (constructionRate / 100 / 12) * buildMonths
    const rentDuringBuildTotal = rentDuringBuild * buildMonths

    // Total out-of-pocket: new build
    const newDownDollar = totalNewCost * downPct / 100
    const newLoan       = totalNewCost - newDownDollar
    const newMonthly    = monthlyPmt(newLoan, rate, 30)
    const newTotalUpfront = newDownDollar + constructionInterest + rentDuringBuildTotal

    // Total out-of-pocket: resale
    const resaleDownDollar = (resalePrice + resaleRepairs) * downPct / 100
    const resaleLoan       = (resalePrice + resaleRepairs) - resaleDownDollar
    const resaleMonthly    = monthlyPmt(resaleLoan, rate, 30)
    const resaleTotalUpfront = resaleDownDollar + resaleRepairs

    // Monthly delta
    const monthlyDiff   = newMonthly - resaleMonthly
    const upfrontDiff   = newTotalUpfront - resaleTotalUpfront

    // 10yr comparison
    const yearData = Array.from({ length: 11 }, (_, yr) => {
      const newValue     = totalNewCost * Math.pow(1 + newAppreciation / 100, yr)
      const resaleValue  = resalePrice * Math.pow(1 + resaleAppreciation / 100, yr)
      const newEquity    = newValue - newLoan
      const resaleEquity = resaleValue - resaleLoan
      return { yr, newValue: Math.round(newValue), resaleValue: Math.round(resaleValue), newEquity: Math.round(newEquity), resaleEquity: Math.round(resaleEquity) }
    })

    // Pros/cons scoring
    const newScore = [
      totalNewCost < resalePrice * 0.95,   // cheaper per sqft
      newAppreciation > resaleAppreciation,  // faster appreciation
      true,                                  // customization
      true,                                  // warranty
      buildMonths <= 8,                      // quick build
      contingency < totalBuildCost * 0.15,  // low contingency risk
    ].filter(Boolean).length

    return {
      hardCosts, softCosts, contingency, totalBuildCost, totalNewCost, perSqftAll,
      constructionInterest, rentDuringBuildTotal,
      newDownDollar, newLoan, newMonthly, newTotalUpfront,
      resaleDownDollar, resaleLoan, resaleMonthly, resaleTotalUpfront,
      monthlyDiff, upfrontDiff, yearData, newScore,
    }
  }, [resalePrice, resaleRepairs, landCost, buildSqft, costPerSqft, softCostsPct, contingencyPct, buildMonths, rentDuringBuild, rate, downPct, constructionRate, resaleAppreciation, newAppreciation])

  const compData = [
    { name: 'Resale', upfront: Math.round(analysis.resaleTotalUpfront), monthly: Math.round(analysis.resaleMonthly), total: Math.round(analysis.resalePrice ?? resalePrice), color: '#3b82f6' },
    { name: 'New Build', upfront: Math.round(analysis.newTotalUpfront), monthly: Math.round(analysis.newMonthly), total: Math.round(analysis.totalNewCost), color: '#22c55e' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">New Construction vs Resale</h3>
        <p className="text-xs text-slate-500">
          Compare the true cost of building new vs buying an existing home — including construction loan interest,
          rent during build, soft costs, and 10-year appreciation trajectory.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-900/20 border border-blue-700/40 rounded-xl p-4">
          <p className="text-xs text-blue-400 uppercase tracking-widest mb-2">Resale Home</p>
          <p className="text-2xl font-black text-white">{fmt(resalePrice + resaleRepairs)}</p>
          <p className="text-xs text-slate-500 mb-3">all-in (price + repairs)</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-slate-500">Upfront cash</span><span className="text-white">{fmt(analysis.resaleTotalUpfront)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Monthly P&I</span><span className="text-white">{fmt(analysis.resaleMonthly)}</span></div>
          </div>
        </div>
        <div className="bg-green-900/20 border border-green-700/40 rounded-xl p-4">
          <p className="text-xs text-green-400 uppercase tracking-widest mb-2">New Build</p>
          <p className="text-2xl font-black text-white">{fmt(analysis.totalNewCost)}</p>
          <p className="text-xs text-slate-500 mb-3">land + build + soft costs</p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-slate-500">Upfront cash</span><span className="text-white">{fmt(analysis.newTotalUpfront)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Monthly P&I</span><span className="text-white">{fmt(analysis.newMonthly)}</span></div>
          </div>
        </div>
      </div>

      <div className={`rounded-xl p-3 border text-center text-xs ${analysis.monthlyDiff > 0 ? 'bg-red-900/20 border-red-800/40' : 'bg-green-900/20 border-green-800/40'}`}>
        {analysis.monthlyDiff > 0
          ? <span className="text-red-400">New build costs <strong>{fmt(analysis.monthlyDiff)}/mo more</strong> and <strong>{fmt(analysis.upfrontDiff)} more upfront</strong></span>
          : <span className="text-green-400">New build saves <strong>{fmt(Math.abs(analysis.monthlyDiff))}/mo</strong> and <strong>{fmt(Math.abs(analysis.upfrontDiff))} upfront</strong></span>
        }
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs text-blue-400 uppercase tracking-widest font-bold">Resale Details</p>
          {[
            { label: 'Resale Price',         value: resalePrice,   min: 50000, max: 5000000, step: 5000, set: setResalePrice,   fmt: fmt },
            { label: 'Initial Repairs',      value: resaleRepairs, min: 0,     max: 200000,  step: 2500, set: setResaleRepairs, fmt: fmt },
            { label: 'Down Payment %',       value: downPct,       min: 3,     max: 40,      step: 1,    set: setDownPct,       fmt: (v: number) => `${v}%` },
            { label: 'Rate',                 value: rate,          min: 3,     max: 12,      step: 0.125, set: setRate,         fmt: (v: number) => `${v.toFixed(3)}%` },
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
          <p className="text-xs text-green-400 uppercase tracking-widest font-bold">New Build Details</p>

          <div>
            <label className="text-xs text-slate-400 uppercase tracking-widest block mb-1.5">Build Quality</label>
            <div className="grid grid-cols-2 gap-1">
              {BUILD_QUALITY.map((q, i) => (
                <button key={q.label} onClick={() => { setQualityIdx(i); setCostPerSqft(Math.round((q.lowCost + q.highCost) / 2)) }}
                  className={`text-left px-2 py-1.5 rounded-lg text-xs transition ${qualityIdx === i ? 'bg-green-700 text-white' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'}`}>
                  <div className="font-semibold">{q.label}</div>
                  <div className="text-xs opacity-70">${q.lowCost}–${q.highCost}/sqft</div>
                </button>
              ))}
            </div>
          </div>

          {[
            { label: 'Land Cost',            value: landCost,         min: 0,     max: 1000000, step: 5000,  set: setLandCost,         fmt: fmt },
            { label: 'Build Size (sqft)',     value: buildSqft,        min: 500,   max: 8000,    step: 100,   set: setBuildSqft,        fmt: (v: number) => `${v.toLocaleString()} sqft` },
            { label: '$/sqft (hard costs)',   value: costPerSqft,      min: 80,    max: 700,     step: 10,    set: setCostPerSqft,      fmt: (v: number) => `$${v}/sqft = ${fmt(v * buildSqft)}` },
            { label: 'Soft Costs %',          value: softCostsPct,     min: 5,     max: 20,      step: 1,     set: setSoftCostsPct,     fmt: (v: number) => `${v}% (permits, arch, fees)` },
            { label: 'Contingency %',         value: contingencyPct,   min: 5,     max: 25,      step: 5,     set: setContingencyPct,   fmt: (v: number) => `${v}%` },
            { label: 'Build Duration',        value: buildMonths,      min: 3,     max: 24,      step: 1,     set: setBuildMonths,      fmt: (v: number) => `${v} mo` },
            { label: 'Rent During Build',     value: rentDuringBuild,  min: 0,     max: 5000,    step: 100,   set: setRentDuringBuild,  fmt: fmt },
            { label: 'Construction Loan Rate',value: constructionRate, min: 4,     max: 14,      step: 0.25,  set: setConstructionRate, fmt: (v: number) => `${v.toFixed(2)}%` },
          ].map(s => (
            <div key={s.label}>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-slate-400 uppercase tracking-widest">{s.label}</label>
                <span className="text-xs font-bold text-green-400">{s.fmt(s.value)}</span>
              </div>
              <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                onChange={e => s.set(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-green-500" />
            </div>
          ))}
        </div>
      </div>

      {/* Cost breakdown */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">New Build Cost Breakdown</p>
        <div className="space-y-1.5 text-xs">
          {[
            { label: 'Land',                        value: fmt(landCost),                            color: 'text-slate-300' },
            { label: `Hard costs (${buildSqft.toLocaleString()} sqft × $${costPerSqft})`, value: fmt(analysis.hardCosts), color: 'text-slate-300' },
            { label: `Soft costs (${softCostsPct}% — permits, arch, engineering)`, value: fmt(analysis.softCosts), color: 'text-slate-300' },
            { label: `Contingency (${contingencyPct}%)`, value: fmt(analysis.contingency),           color: 'text-yellow-400' },
            { label: 'Construction loan interest',  value: fmt(analysis.constructionInterest),        color: 'text-red-400' },
            { label: `Rent during build (${buildMonths} mo)`, value: fmt(analysis.rentDuringBuildTotal), color: 'text-red-400' },
            { label: 'TOTAL ALL-IN',                value: fmt(analysis.totalNewCost + analysis.constructionInterest + analysis.rentDuringBuildTotal), color: 'text-white font-black', border: true },
            { label: 'Per sqft (all costs)',        value: `$${Math.round(analysis.perSqftAll)}/sqft`,color: 'text-slate-400' },
          ].map(r => (
            <div key={r.label} className={`flex justify-between ${r.border ? 'border-t border-slate-700 pt-1.5 mt-1' : ''}`}>
              <span className={r.border ? 'text-slate-300 font-semibold' : 'text-slate-500'}>{r.label}</span>
              <span className={r.color}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 10yr value chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <div className="flex items-center gap-4 mb-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">10-Year Value Trajectory</p>
          <div className="flex items-center gap-2 ml-auto text-xs">
            <span className="text-slate-500">Resale:</span>
            <input type="number" value={resaleAppreciation} onChange={e => setResaleAppreciation(Number(e.target.value))}
              min={0} max={10} step={0.5} className="w-14 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-slate-200 text-xs" />
            <span className="text-slate-500">%  New:</span>
            <input type="number" value={newAppreciation} onChange={e => setNewAppreciation(Number(e.target.value))}
              min={0} max={10} step={0.5} className="w-14 bg-slate-700 border border-slate-600 rounded px-1.5 py-0.5 text-slate-200 text-xs" />
            <span className="text-slate-500">%</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={analysis.yearData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="yr" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} width={55} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number) => [fmt(v)]} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
            <Line type="monotone" dataKey="resaleValue" stroke="#3b82f6" dot={false} strokeWidth={2} name="Resale Value" />
            <Line type="monotone" dataKey="newValue"    stroke="#22c55e" dot={false} strokeWidth={2} name="New Build Value" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-green-900/20 border border-green-700/40 rounded-xl p-4">
          <p className="text-xs text-green-400 uppercase tracking-widest mb-2 font-bold">New Build Advantages</p>
          <div className="space-y-1.5 text-xs text-slate-400">
            {['Full customization (layout, finishes, features)', 'Builder warranty (typically 1-2-10 years)', 'Lower maintenance for first 10+ years', 'Energy-efficient systems save on utilities', 'No competing with other buyers on existing inventory'].map((t, i) => <p key={i}>✓ {t}</p>)}
          </div>
        </div>
        <div className="bg-blue-900/20 border border-blue-700/40 rounded-xl p-4">
          <p className="text-xs text-blue-400 uppercase tracking-widest mb-2 font-bold">Resale Advantages</p>
          <div className="space-y-1.5 text-xs text-slate-400">
            {['Move in immediately — no waiting {buildMonths} months', 'Established neighborhood with mature trees, comps', 'Lower all-in cost in most markets', 'No construction loan risk or cost overruns', 'Can negotiate price, repairs, or credits'].map((t, i) => <p key={i}>✓ {t}</p>)}
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Construction costs vary significantly by region, lot conditions, and contractor availability.
        Always get 3+ contractor bids and add 15–20% contingency for custom builds.
      </p>
    </div>
  )
}
