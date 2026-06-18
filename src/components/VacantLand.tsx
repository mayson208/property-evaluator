import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
function fmtPct(n: number) { return `${n.toFixed(2)}%` }

function monthlyPmt(principal: number, annualRate: number, termYears: number) {
  const r = annualRate / 100 / 12
  const n = termYears * 12
  if (r === 0 || n === 0) return 0
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

type LandUse = 'residential_lot' | 'subdivide' | 'farming' | 'commercial' | 'timber' | 'hold'

const LAND_USES: { id: LandUse; label: string; desc: string }[] = [
  { id: 'residential_lot', label: 'Build a Home',           desc: 'Buy land now, build later' },
  { id: 'subdivide',       label: 'Subdivide & Sell',       desc: 'Split into multiple lots and sell' },
  { id: 'farming',         label: 'Agricultural / Lease',   desc: 'Farm or lease to tenant farmer' },
  { id: 'commercial',      label: 'Commercial Development', desc: 'Develop for commercial/retail use' },
  { id: 'timber',          label: 'Timber / Natural Res.',  desc: 'Harvest timber or natural resources' },
  { id: 'hold',            label: 'Hold for Appreciation',  desc: 'Buy and hold for long-term gain' },
]

export default function VacantLand() {
  const [landPrice,       setLandPrice]       = useState(150000)
  const [acreage,         setAcreage]         = useState(5)
  const [downPct,         setDownPct]         = useState(30)   // land loans need more down
  const [rate,            setRate]            = useState(7.5)  // land loans have higher rates
  const [termYrs,         setTermYrs]         = useState(15)   // shorter terms typical
  const [annualTaxRate,   setAnnualTaxRate]   = useState(0.8)  // % of value
  const [annualHoldCost,  setAnnualHoldCost]  = useState(500)  // weed control, insurance, etc.
  const [appreciationPct, setAppreciationPct] = useState(4.0)
  const [landUse,         setLandUse]         = useState<LandUse>('hold')

  // Subdivision
  const [numLots,         setNumLots]         = useState(4)
  const [devCostPerLot,   setDevCostPerLot]   = useState(25000)  // roads, utilities, permits
  const [lotSalePrice,    setLotSalePrice]    = useState(80000)
  const [saleCostPct,     setSaleCostPct]     = useState(8)    // agent + closing

  // Build scenario
  const [buildCost,       setBuildCost]       = useState(350000)
  const [builtHomeValue,  setBuiltHomeValue]  = useState(550000)

  // Farm lease
  const [annualLeasePer, setAnnualLeasePer]  = useState(100)  // $ per acre per year

  // Timber
  const [timberValue,    setTimberValue]     = useState(500)   // $ per acre
  const [yearsToHarvest, setYearsToHarvest]  = useState(20)

  const analysis = useMemo(() => {
    const downDollar    = landPrice * downPct / 100
    const loanAmount    = landPrice - downDollar
    const monthly       = monthlyPmt(loanAmount, rate, termYrs)
    const annualDebt    = monthly * 12
    const annualTax     = landPrice * annualTaxRate / 100
    const annualCarry   = annualDebt + annualTax + annualHoldCost
    const pricePerAcre  = acreage > 0 ? landPrice / acreage : 0

    // Hold for appreciation
    const yr10Value    = landPrice * Math.pow(1 + appreciationPct / 100, 10)
    const yr10TotalCarry = annualCarry * 10
    const yr10Profit   = yr10Value - landPrice - yr10TotalCarry
    const holdROI10    = ((yr10Value - landPrice) / (downDollar + yr10TotalCarry)) * 100

    // Subdivision
    const subTotalDev  = numLots * devCostPerLot
    const subRevenue   = numLots * lotSalePrice * (1 - saleCostPct / 100)
    const subProfit    = subRevenue - landPrice - subTotalDev
    const subROI       = (downDollar + subTotalDev) > 0 ? (subProfit / (downDollar + subTotalDev)) * 100 : 0

    // Build
    const buildProfit  = builtHomeValue - landPrice - buildCost
    const buildROI     = (downDollar + buildCost) > 0 ? (buildProfit / (downDollar + buildCost)) * 100 : 0

    // Farm lease
    const farmAnnualIncome = acreage * annualLeasePer
    const farmNetAnnual    = farmAnnualIncome - annualTax - annualHoldCost
    const farmCapRate      = (farmNetAnnual / landPrice) * 100

    // Timber
    const timberRevenue    = acreage * timberValue
    const timberROI        = (timberRevenue - landPrice) / landPrice * 100

    const yr10Chart = Array.from({ length: 11 }, (_, yr) => ({
      yr,
      value: Math.round(landPrice * Math.pow(1 + appreciationPct / 100, yr)),
      cumulativeCarry: Math.round(annualCarry * yr),
    }))

    return {
      downDollar, loanAmount, monthly, annualDebt, annualTax, annualCarry, pricePerAcre,
      yr10Value, yr10TotalCarry, yr10Profit, holdROI10,
      subTotalDev, subRevenue, subProfit, subROI,
      buildProfit, buildROI,
      farmAnnualIncome, farmNetAnnual, farmCapRate,
      timberRevenue, timberROI,
      yr10Chart,
    }
  }, [landPrice, acreage, downPct, rate, termYrs, annualTaxRate, annualHoldCost, appreciationPct, numLots, devCostPerLot, lotSalePrice, saleCostPct, buildCost, builtHomeValue, annualLeasePer, timberValue, yearsToHarvest])

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Vacant Land Calculator</h3>
        <p className="text-xs text-slate-500">
          Analyze raw land purchases — carrying costs, appreciation potential, and return on
          multiple strategies: hold, subdivide, build, farm, or timber.
        </p>
      </div>

      {/* Per-acre callout */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Price Per Acre',    value: fmt(analysis.pricePerAcre),   color: 'text-white' },
          { label: 'Monthly Carry Cost',value: fmt(analysis.monthly + analysis.annualTax / 12 + annualHoldCost / 12), color: 'text-red-400' },
          { label: 'Annual Carry',      value: fmt(analysis.annualCarry),    color: 'text-yellow-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Land use selector */}
      <div>
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Intended Use</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {LAND_USES.map(u => (
            <button key={u.id} onClick={() => setLandUse(u.id)}
              className={`text-left px-3 py-2 rounded-xl border text-xs transition ${landUse === u.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
              <div className="font-semibold">{u.label}</div>
              <div className="text-xs opacity-70 mt-0.5">{u.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Land Details</p>
          {[
            { label: 'Purchase Price',    value: landPrice,       min: 5000,   max: 5000000, step: 5000,  set: setLandPrice,       fmt: fmt },
            { label: 'Acreage',           value: acreage,         min: 0.1,    max: 500,     step: 0.5,   set: setAcreage,         fmt: (v: number) => `${v} acres` },
            { label: 'Down Payment %',    value: downPct,         min: 20,     max: 50,      step: 5,     set: setDownPct,         fmt: (v: number) => `${v}% = ${fmt(landPrice * v / 100)}` },
            { label: 'Land Loan Rate',    value: rate,            min: 5,      max: 14,      step: 0.25,  set: setRate,            fmt: (v: number) => `${v.toFixed(2)}%` },
            { label: 'Loan Term',         value: termYrs,         min: 5,      max: 20,      step: 5,     set: setTermYrs,         fmt: (v: number) => `${v} yr` },
            { label: 'Annual Tax Rate',   value: annualTaxRate,   min: 0.1,    max: 3,       step: 0.1,   set: setAnnualTaxRate,   fmt: (v: number) => `${v.toFixed(1)}% = ${fmt(landPrice * v / 100)}/yr` },
            { label: 'Annual Hold Costs', value: annualHoldCost,  min: 0,      max: 5000,    step: 100,   set: setAnnualHoldCost,  fmt: fmt },
            { label: 'Expected Apprec.',  value: appreciationPct, min: 0,      max: 12,      step: 0.5,   set: setAppreciationPct, fmt: (v: number) => `${v}%/yr` },
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

        {/* Strategy-specific inputs */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          {landUse === 'subdivide' && <>
            <p className="text-xs text-yellow-400 uppercase tracking-widest font-bold">Subdivision Details</p>
            {[
              { label: '# of Lots',          value: numLots,       min: 2, max: 50, step: 1, set: setNumLots,       fmt: (v: number) => `${v} lots` },
              { label: 'Dev Cost / Lot',     value: devCostPerLot, min: 0, max: 100000, step: 2500, set: setDevCostPerLot, fmt: fmt },
              { label: 'Sale Price / Lot',   value: lotSalePrice,  min: 5000, max: 500000, step: 5000, set: setLotSalePrice, fmt: fmt },
              { label: 'Sale Costs %',       value: saleCostPct,   min: 3, max: 12, step: 1, set: setSaleCostPct, fmt: (v: number) => `${v}%` },
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
            <div className="bg-slate-900/60 rounded-lg p-3 space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Total development cost</span><span className="text-white">{fmt(analysis.subTotalDev)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Net sale proceeds</span><span className="text-green-400">{fmt(analysis.subRevenue)}</span></div>
              <div className="flex justify-between font-black border-t border-slate-700 pt-1"><span className="text-slate-300">Profit</span><span className={analysis.subProfit > 0 ? 'text-green-400' : 'text-red-400'}>{fmt(analysis.subProfit)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">ROI on equity</span><span className="text-blue-400">{fmtPct(analysis.subROI)}</span></div>
            </div>
          </>}

          {landUse === 'residential_lot' && <>
            <p className="text-xs text-green-400 uppercase tracking-widest font-bold">Build Scenario</p>
            {[
              { label: 'Build Cost',        value: buildCost,      min: 100000, max: 3000000, step: 10000, set: setBuildCost,      fmt: fmt },
              { label: 'Finished Home Value',value: builtHomeValue, min: 100000, max: 5000000, step: 10000, set: setBuiltHomeValue, fmt: fmt },
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
            <div className="bg-slate-900/60 rounded-lg p-3 space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Land cost</span><span className="text-white">{fmt(landPrice)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Build cost</span><span className="text-white">{fmt(buildCost)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Total all-in</span><span className="text-white">{fmt(landPrice + buildCost)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Finished value</span><span className="text-green-400">{fmt(builtHomeValue)}</span></div>
              <div className="flex justify-between font-black border-t border-slate-700 pt-1"><span className="text-slate-300">Equity created</span><span className={analysis.buildProfit > 0 ? 'text-green-400' : 'text-red-400'}>{fmt(analysis.buildProfit)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">ROI on equity</span><span className="text-blue-400">{fmtPct(analysis.buildROI)}</span></div>
            </div>
          </>}

          {landUse === 'farming' && <>
            <p className="text-xs text-yellow-400 uppercase tracking-widest font-bold">Agricultural Lease</p>
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-slate-400 uppercase tracking-widest">Annual Lease Rate (per acre)</label>
                <span className="text-xs font-bold text-yellow-400">${annualLeasePer}/acre</span>
              </div>
              <input type="range" min={10} max={500} step={10} value={annualLeasePer}
                onChange={e => setAnnualLeasePer(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-yellow-400" />
            </div>
            <div className="bg-slate-900/60 rounded-lg p-3 space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Gross annual lease</span><span className="text-white">{fmt(analysis.farmAnnualIncome)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Tax + hold costs</span><span className="text-red-400">-{fmt(analysis.annualTax + annualHoldCost)}</span></div>
              <div className="flex justify-between font-bold border-t border-slate-700 pt-1"><span className="text-slate-300">Net income/yr</span><span className={analysis.farmNetAnnual > 0 ? 'text-green-400' : 'text-red-400'}>{fmt(analysis.farmNetAnnual)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Cap rate</span><span className="text-blue-400">{fmtPct(analysis.farmCapRate)}</span></div>
            </div>
          </>}

          {(landUse === 'hold' || landUse === 'commercial' || landUse === 'timber') && (
            <div className="bg-slate-900/60 rounded-lg p-4 space-y-2 text-xs h-full flex flex-col justify-center">
              <p className="text-slate-400 font-bold uppercase tracking-widest mb-3">10-Year Hold Analysis</p>
              <div className="flex justify-between"><span className="text-slate-500">Land value (yr 10)</span><span className="text-blue-400">{fmt(analysis.yr10Value)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Total carry costs</span><span className="text-red-400">-{fmt(analysis.yr10TotalCarry)}</span></div>
              <div className="flex justify-between font-black border-t border-slate-700 pt-2"><span className="text-slate-300">Net profit at yr 10</span><span className={analysis.yr10Profit > 0 ? 'text-green-400' : 'text-red-400'}>{fmt(analysis.yr10Profit)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">ROI on equity</span><span className="text-blue-400">{fmtPct(analysis.holdROI10)}</span></div>
            </div>
          )}
        </div>
      </div>

      {/* Value vs carry chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Land Value vs Cumulative Carry Cost (10yr)</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={analysis.yr10Chart} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="yr" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} width={55} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number, n: string) => [fmt(v), n === 'value' ? 'Land Value' : 'Cumul. Carry']} />
            <Line type="monotone" dataKey="value"            stroke="#3b82f6" dot={false} strokeWidth={2} name="value" />
            <Line type="monotone" dataKey="cumulativeCarry"  stroke="#ef4444" dot={false} strokeWidth={2} strokeDasharray="4 4" name="cumulativeCarry" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Land Buying Tips</p>
        <div className="space-y-1.5 text-xs text-slate-400">
          {[
            '🗺️ Always get a survey — know exact boundaries, easements, and encroachments before buying.',
            '🏗️ Verify utilities: water, sewer/septic, electricity, gas, and broadband availability and connection costs.',
            '📋 Check zoning, deed restrictions, and HOA rules before assuming your intended use is allowed.',
            '💧 Soil percolation test (perc test) is essential if the lot needs a septic system.',
            '🏦 Land loans require 20–50% down, higher rates, and shorter terms than traditional mortgages.',
            '🌊 Check FEMA flood maps — flood zones can make land unbuildable or insurance prohibitively expensive.',
            '📞 Talk to the local planning department about development potential before making an offer.',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Land investments are highly illiquid and carry-cost-intensive. Subdivision and commercial development
        require significant expertise, capital, and entitlement timelines of 1–5+ years.
      </p>
    </div>
  )
}
