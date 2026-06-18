import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

type ConstructionType = 'frame' | 'masonry' | 'steel'
type OccupancyType    = 'primary' | 'rental' | 'vacation'
type FloodZone        = 'X' | 'AE' | 'A' | 'V' | 'VE'

const BASE_RATES: Record<ConstructionType, number> = {
  frame:   0.40,   // % of dwelling coverage / year
  masonry: 0.30,
  steel:   0.25,
}

const FLOOD_NFIP: Record<FloodZone, number> = {
  X:  500,
  AE: 1800,
  A:  2500,
  V:  3500,
  VE: 4200,
}

const FLOOD_PRIVATE: Record<FloodZone, number> = {
  X:  350,
  AE: 1400,
  A:  2000,
  V:  2800,
  VE: 3200,
}

const ZONE_RISK: Record<FloodZone, string> = {
  X:  'Minimal risk — outside 500-yr flood plain',
  AE: 'High risk — 1% annual chance, mapped with base flood elevation',
  A:  'High risk — 1% annual chance, no base flood elevation data',
  V:  'Very high risk — coastal with wave action',
  VE: 'Very high risk — coastal with base flood elevation',
}

export default function PropertyInsurance() {
  const [homeValue,      setHomeValue]      = useState(400000)
  const [personalProp,   setPersonalProp]   = useState(80000)   // contents
  const [construction,   setConstruction]   = useState<ConstructionType>('frame')
  const [homeAge,        setHomeAge]        = useState(20)       // years
  const [occupancy,      setOccupancy]      = useState<OccupancyType>('primary')
  const [deductible,     setDeductible]     = useState(2500)
  const [liabCoverage,   setLiabCoverage]   = useState(300000)
  const [umbrella,       setUmbrella]       = useState(0)        // $ umbrella
  const [hasPool,        setHasPool]        = useState(false)
  const [hasTrampo,      setHasTrmanpo]     = useState(false)
  const [hasDog,         setHasDog]         = useState(false)
  const [floodZone,      setFloodZone]      = useState<FloodZone>('X')
  const [hasEarthquake,  setHasEarthquake]  = useState(false)
  const [roofAge,        setRoofAge]        = useState(10)
  const [claimsLast5yr,  setClaimsLast5yr]  = useState(0)
  const [state,          setState]          = useState('TX')
  const [rcvVsAcv,       setRcvVsAcv]       = useState<'rcv' | 'acv'>('rcv')
  const [buildersRisk,   setBuildersRisk]   = useState(false)
  const [buildersValue,  setBuildersValue]  = useState(200000)

  const calc = useMemo(() => {
    // Replacement cost (dwelling) — typically 20-40% above market
    const replacementCost = homeValue * 1.25

    // Base premium from construction type and RC value
    let basePremium = replacementCost * BASE_RATES[construction] / 100

    // Age adjustments
    if (homeAge > 30)   basePremium *= 1.20
    else if (homeAge > 20) basePremium *= 1.10

    if (roofAge > 20)   basePremium *= 1.25
    else if (roofAge > 15) basePremium *= 1.15

    // Deductible discount — higher deductible = lower premium
    const deductibleDiscount = deductible >= 5000 ? 0.15 : deductible >= 2500 ? 0.07 : 0
    basePremium *= (1 - deductibleDiscount)

    // Occupancy surcharge
    if (occupancy === 'rental')   basePremium *= 1.25
    if (occupancy === 'vacation') basePremium *= 1.15

    // Liability premium
    const liabPremium = (liabCoverage / 100000) * 80  // ~$80 per $100K of liability

    // High-risk surcharges
    if (hasPool)     basePremium += 200
    if (hasTrampo)   basePremium += 150
    if (hasDog)      basePremium += 100

    // Claims surcharge
    if (claimsLast5yr >= 3)      basePremium *= 1.40
    else if (claimsLast5yr === 2) basePremium *= 1.25
    else if (claimsLast5yr === 1) basePremium *= 1.12

    // ACV vs RCV
    const acvDiscount = rcvVsAcv === 'acv' ? 0.15 : 0
    basePremium *= (1 - acvDiscount)

    // Personal property premium (~$50 per $10K of coverage)
    const contentsPremium = personalProp / 10000 * 50

    // Umbrella
    const umbrellaPremium = umbrella > 0 ? (umbrella / 1000000) * 200 + 150 : 0

    // Earthquake premium (rough estimate)
    const earthquakePremium = hasEarthquake ? replacementCost * 0.002 : 0  // ~0.2% of RC

    // Builder's risk
    const buildersRiskPremium = buildersRisk ? buildersValue * 0.015 : 0  // ~1.5%/yr

    // Flood premiums
    const nfipPremium    = FLOOD_NFIP[floodZone]
    const privatePremium = FLOOD_PRIVATE[floodZone]

    const totalBase    = basePremium + liabPremium + contentsPremium
    const withFlood    = totalBase + Math.min(nfipPremium, privatePremium)
    const totalAll     = withFlood + umbrellaPremium + earthquakePremium + buildersRiskPremium

    // Coverage adequacy checks
    const checks = [
      { item: 'Dwelling Coverage',     status: rcvVsAcv === 'rcv' ? 'ok' : 'warn', note: rcvVsAcv === 'rcv' ? 'RCV — recommended' : 'ACV — you pay depreciation after claim' },
      { item: 'Liability Coverage',    status: liabCoverage >= 300000 ? 'ok' : 'warn', note: liabCoverage >= 300000 ? 'Adequate' : 'Low — consider $300K minimum' },
      { item: 'Umbrella Policy',       status: umbrella > 0 ? 'ok' : 'info', note: umbrella > 0 ? `${fmt(umbrella)} coverage` : 'Consider umbrella if net worth > $300K' },
      { item: 'Flood Coverage',        status: floodZone === 'X' ? 'info' : 'warn', note: floodZone === 'X' ? 'Zone X — optional but still recommended' : `Required for zone ${floodZone} with a mortgage` },
      { item: 'Pool / Trampoline',     status: (hasPool || hasTrampo) ? 'warn' : 'ok', note: (hasPool || hasTrampo) ? 'Requires explicit coverage / higher liability' : 'No high-risk amenities' },
      { item: 'Claims History',        status: claimsLast5yr >= 2 ? 'warn' : 'ok', note: claimsLast5yr === 0 ? 'Clean record — possible discount' : `${claimsLast5yr} claim(s) — rate impact up to +40%` },
      { item: 'Roof Age',             status: roofAge > 20 ? 'warn' : 'ok', note: roofAge > 20 ? `${roofAge}-yr old roof — insurer may require replacement` : `${roofAge} years — acceptable` },
    ]

    // Deductible scenarios
    const dedScenarios = [500, 1000, 2500, 5000, 10000].map(d => {
      const disc = d >= 5000 ? 0.15 : d >= 2500 ? 0.07 : 0
      const prem = (basePremium / (1 - deductibleDiscount)) * (1 - disc)
      return { deductible: `$${d.toLocaleString()}`, premium: Math.round(prem), savings: 0 }
    })
    const baseDedPrem = dedScenarios[0].premium
    dedScenarios.forEach(d => { d.savings = baseDedPrem - d.premium })

    // Pie data
    const pieData = [
      { name: 'Dwelling', value: Math.round(basePremium) },
      { name: 'Contents', value: Math.round(contentsPremium) },
      { name: 'Liability', value: Math.round(liabPremium) },
      ...(umbrella > 0 ? [{ name: 'Umbrella', value: Math.round(umbrellaPremium) }] : []),
      ...(earthquakePremium > 0 ? [{ name: 'Earthquake', value: Math.round(earthquakePremium) }] : []),
      ...(buildersRisk ? [{ name: "Builder's Risk", value: Math.round(buildersRiskPremium) }] : []),
    ].filter(p => p.value > 0)

    return { replacementCost, basePremium, contentsPremium, liabPremium, umbrellaPremium, earthquakePremium, buildersRiskPremium,
      totalBase, nfipPremium, privatePremium, withFlood, totalAll, checks, dedScenarios, pieData }
  }, [homeValue, personalProp, construction, homeAge, occupancy, deductible, liabCoverage, umbrella,
      hasPool, hasTrampo, hasDog, floodZone, hasEarthquake, roofAge, claimsLast5yr, rcvVsAcv, buildersRisk, buildersValue])

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444']

  const Slider = ({ label, value, min, max, step, onChange, prefix = '', suffix = '' }: {
    label: string; value: number; min: number; max: number; step: number;
    onChange: (v: number) => void; prefix?: string; suffix?: string
  }) => (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-xs text-slate-400">{label}</label>
        <span className="text-xs font-bold text-blue-400">{prefix}{value.toLocaleString()}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
    </div>
  )

  const statusIcon = { ok: '✅', warn: '⚠️', info: 'ℹ️' }
  const statusColor = { ok: 'text-green-400', warn: 'text-yellow-400', info: 'text-blue-400' }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Property Insurance Analyzer</h3>
        <p className="text-xs text-slate-500">
          Estimate homeowner, landlord, and rental property insurance costs. Optimize deductibles,
          coverage limits, and understand what add-ons you actually need.
        </p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Property Details</p>
          <Slider label="Home Market Value" value={homeValue} min={50000} max={3000000} step={10000} onChange={setHomeValue} prefix="$" />
          <div className="bg-slate-900/60 rounded-lg p-2 text-xs text-center">
            Replacement Cost (Dwelling): <span className="font-black text-blue-400">{fmt(calc.replacementCost)}</span>
          </div>
          <div>
            <label className="text-xs text-slate-400">Construction Type</label>
            <div className="grid grid-cols-3 gap-1 mt-1">
              {(['frame', 'masonry', 'steel'] as ConstructionType[]).map(c => (
                <button key={c} onClick={() => setConstruction(c)}
                  className={`py-1.5 rounded-lg text-xs font-bold capitalize transition ${construction === c ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400">Occupancy</label>
            <select value={occupancy} onChange={e => setOccupancy(e.target.value as OccupancyType)}
              className="mt-1 w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200">
              <option value="primary">Primary Residence</option>
              <option value="rental">Rental Property (DP-1/DP-3)</option>
              <option value="vacation">Vacation / Secondary</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">Coverage Type</label>
            <div className="grid grid-cols-2 gap-1 mt-1">
              {[['rcv', 'Replacement Cost (RCV)'], ['acv', 'Actual Cash Value (ACV)']] .map(([v, l]) => (
                <button key={v} onClick={() => setRcvVsAcv(v as 'rcv' | 'acv')}
                  className={`py-1.5 rounded-lg text-xs font-bold transition ${rcvVsAcv === v ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <Slider label="Home Age (years)" value={homeAge} min={0} max={100} step={5} onChange={setHomeAge} suffix=" yrs" />
          <Slider label="Roof Age (years)" value={roofAge} min={0} max={40} step={1} onChange={setRoofAge} suffix=" yrs" />
          <Slider label="Claims in Last 5 Years" value={claimsLast5yr} min={0} max={5} step={1} onChange={setClaimsLast5yr} />
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Coverage Amounts</p>
          <Slider label="Personal Property / Contents" value={personalProp} min={0} max={500000} step={5000} onChange={setPersonalProp} prefix="$" />
          <Slider label="Liability Coverage" value={liabCoverage} min={100000} max={1000000} step={50000} onChange={setLiabCoverage} prefix="$" />
          <Slider label="Umbrella Policy Amount" value={umbrella} min={0} max={5000000} step={500000} onChange={setUmbrella} prefix="$" />
          <Slider label="Deductible" value={deductible} min={500} max={25000} step={500} onChange={setDeductible} prefix="$" />

          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest pt-1">Flood & Extras</p>
          <div>
            <label className="text-xs text-slate-400">Flood Zone</label>
            <select value={floodZone} onChange={e => setFloodZone(e.target.value as FloodZone)}
              className="mt-1 w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200">
              {(Object.entries(ZONE_RISK) as [FloodZone, string][]).map(([z, desc]) => (
                <option key={z} value={z}>Zone {z} — {desc.split('—')[0].trim()}</option>
              ))}
            </select>
            <p className="text-xs text-slate-600 mt-1">{ZONE_RISK[floodZone]}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'pool', label: 'Pool', val: hasPool, set: setHasPool },
              { id: 'trampo', label: 'Trampoline', val: hasTrampo, set: setHasTrmanpo },
              { id: 'dog', label: 'Dog', val: hasDog, set: setHasDog },
              { id: 'quake', label: 'Earthquake', val: hasEarthquake, set: setHasEarthquake },
              { id: 'builders', label: "Builder's Risk", val: buildersRisk, set: setBuildersRisk },
            ].map(o => (
              <div key={o.id} className="flex items-center gap-2">
                <input type="checkbox" id={o.id} checked={o.val} onChange={e => o.set(e.target.checked)} className="w-4 h-4 accent-blue-500" />
                <label htmlFor={o.id} className="text-xs text-slate-400">{o.label}</label>
              </div>
            ))}
          </div>
          {buildersRisk && (
            <Slider label="Construction Value" value={buildersValue} min={50000} max={2000000} step={10000} onChange={setBuildersValue} prefix="$" />
          )}
        </div>
      </div>

      {/* Total premium summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'HO Policy (base)',     val: fmt(calc.totalBase) + '/yr', color: 'text-blue-400' },
          { label: 'Flood Insurance (NFIP)', val: fmt(calc.nfipPremium) + '/yr', color: 'text-yellow-400' },
          { label: 'Private Flood Alt.', val: fmt(calc.privatePremium) + '/yr', color: 'text-green-400' },
          { label: 'All Coverage Total',   val: fmt(calc.totalAll) + '/yr',  color: 'text-white' },
          { label: 'Monthly (all-in)',     val: fmt(calc.totalAll / 12) + '/mo', color: 'text-white' },
          { label: 'Replacement Cost',     val: fmt(calc.replacementCost),    color: 'text-slate-300' },
          { label: 'Umbrella Premium',     val: umbrella > 0 ? fmt(calc.umbrellaPremium) + '/yr' : 'Not added', color: 'text-purple-400' },
          { label: 'Earthquake Premium',   val: hasEarthquake ? fmt(calc.earthquakePremium) + '/yr' : 'Not added', color: 'text-orange-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-base font-black ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Coverage breakdown pie */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">Premium Breakdown</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={calc.pieData} dataKey="value" cx="50%" cy="50%" outerRadius={60} paddingAngle={3}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {calc.pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(v: number) => [fmt(v) + '/yr']} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Deductible optimization */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">Deductible vs Premium</p>
          <div className="space-y-2">
            {calc.dedScenarios.map(d => (
              <div key={d.deductible} className={`flex items-center gap-3 rounded-lg px-3 py-2 ${deductible === Number(d.deductible.replace(/\D/g, '')) ? 'bg-blue-900/30 border border-blue-700/50' : 'bg-slate-900/40'}`}>
                <span className="text-xs text-slate-400 w-16">{d.deductible}</span>
                <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                  <div className="h-1.5 bg-blue-500 rounded-full"
                    style={{ width: `${Math.min((d.premium / calc.dedScenarios[0].premium) * 100, 100)}%` }} />
                </div>
                <span className="text-xs font-bold text-slate-300 w-20 text-right">{fmt(d.premium)}/yr</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-600 mt-2">Rule of thumb: choose the highest deductible you can afford out of pocket after a claim.</p>
        </div>
      </div>

      {/* Coverage adequacy checklist */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-4 py-2 bg-slate-800/80 border-b border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Coverage Adequacy Review</p>
        </div>
        <div className="divide-y divide-slate-700/50">
          {calc.checks.map(c => (
            <div key={c.item} className="flex items-center gap-3 px-4 py-2.5">
              <span className="text-sm flex-shrink-0">{statusIcon[c.status as keyof typeof statusIcon]}</span>
              <span className="text-xs text-slate-300 font-semibold w-32 flex-shrink-0">{c.item}</span>
              <span className={`text-xs ${statusColor[c.status as keyof typeof statusColor]}`}>{c.note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Key insights */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Insurance Essentials</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-400">
          {[
            '🏠 RCV vs ACV: RCV pays to rebuild new — ACV pays depreciated value. RCV premium is worth it for most.',
            '🌊 Your HO policy does NOT cover flood — ever. Buy separately (NFIP or private) if in any flood-risk zone.',
            '📋 Document your possessions with video walkthrough — store off-site. Claims without proof get denied.',
            '🐕 Dog bites = $1B+ in homeowner claims annually. Disclose all dogs — some breeds may void liability coverage.',
            '🏊 Pool & trampoline require additional liability or may need separate riders. Failure to disclose can void claims.',
            '🔑 Rental property needs DP-3 (Dwelling Policy), not HO-3 — different form, covers different losses.',
            '💧 Water backup endorsement ($50-100/yr) covers sewer backup — a common gap in standard HO policies.',
            '⛽ Earthquake coverage: standard HO excludes earthquakes. Separate rider required even in low-risk zones.',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        All premiums are illustrative estimates. Actual quotes depend on insurer, underwriting, claims history, and local factors.
        Shop 3+ insurers annually — rates vary 40-60% for identical coverage.
      </p>
    </div>
  )
}
