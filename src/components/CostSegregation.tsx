import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell } from 'recharts'

type PropertyType = 'residential' | 'commercial' | 'industrial' | 'hotel' | 'retail'
type BonusDeprecPct = 0 | 20 | 40 | 60 | 80 | 100

interface Inputs {
  propertyType: PropertyType
  purchasePrice: number
  landValue: number
  buildingAge: number
  annualRentIncome: number
  marginalTaxRate: number
  isRealEstatePro: boolean
  bonusDeprecPct: BonusDeprecPct
  studyCost: number
  filingStatus: 'single' | 'mfj'
  agi: number
  reclassify5yr: number
  reclassify7yr: number
  reclassify15yr: number
}

const PROPERTY_PROFILES: Record<PropertyType, { name: string; pct5: number; pct7: number; pct15: number; life: number }> = {
  residential: { name: 'Residential Rental', pct5: 12, pct7: 3, pct15: 8, life: 27.5 },
  commercial:  { name: 'Commercial Office',  pct5: 9,  pct7: 4, pct15: 12, life: 39 },
  industrial:  { name: 'Industrial/Warehouse', pct5: 8, pct7: 2, pct15: 10, life: 39 },
  hotel:       { name: 'Hotel/Hospitality',   pct5: 22, pct7: 5, pct15: 7, life: 39 },
  retail:      { name: 'Retail',              pct5: 10, pct7: 4, pct15: 9, life: 39 },
}

const DEF: Inputs = {
  propertyType: 'residential',
  purchasePrice: 1200000,
  landValue: 200000,
  buildingAge: 3,
  annualRentIncome: 95000,
  marginalTaxRate: 37,
  isRealEstatePro: false,
  bonusDeprecPct: 60,
  studyCost: 8500,
  filingStatus: 'mfj',
  agi: 300000,
  reclassify5yr: 0,
  reclassify7yr: 0,
  reclassify15yr: 0,
}

const BONUS_YEARS: Record<number, number> = { 2025: 40, 2026: 20, 2027: 0 }

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const pct = (n: number) => `${n.toFixed(1)}%`
const N = (v: string) => parseFloat(v) || 0
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444']

function macrsDepr(cost: number, life: number, bonusPct: number, year: number): number {
  // Half-year convention MACRS rates (simplified)
  const rates: Record<number, number[]> = {
    5: [0.20, 0.32, 0.192, 0.1152, 0.1152, 0.0576],
    7: [0.1429, 0.2449, 0.1749, 0.1249, 0.0893, 0.0892, 0.0893, 0.0446],
    15: [0.05, 0.095, 0.0855, 0.077, 0.0693, 0.0623, 0.059, 0.059, 0.059, 0.059, 0.059, 0.059, 0.059, 0.059, 0.059, 0.0295],
    27.5: Array(28).fill(1 / 27.5),
    39: Array(40).fill(1 / 39),
  }
  const rateArr = rates[life] ?? rates[39]
  const bonus = cost * bonusPct / 100
  const remaining = cost - bonus
  const regularRate = rateArr[year - 1] ?? 0
  return year === 1 ? bonus + remaining * regularRate : remaining * regularRate
}

export default function CostSegregation() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = (k: keyof Inputs, v: string | PropertyType | BonusDeprecPct | boolean | 'single' | 'mfj') =>
    setInp(p => ({ ...p, [k]: typeof DEF[k] === 'number' ? N(v as string) : v }))

  const calc = useMemo(() => {
    const { propertyType, purchasePrice, landValue, marginalTaxRate,
            isRealEstatePro, bonusDeprecPct, studyCost, agi, filingStatus,
            reclassify5yr, reclassify7yr, reclassify15yr } = inp

    const profile = PROPERTY_PROFILES[propertyType]
    const buildingValue = purchasePrice - landValue

    // Default reclassification (use manual overrides if set)
    const use5yr = reclassify5yr > 0 ? reclassify5yr : buildingValue * profile.pct5 / 100
    const use7yr = reclassify7yr > 0 ? reclassify7yr : buildingValue * profile.pct7 / 100
    const use15yr = reclassify15yr > 0 ? reclassify15yr : buildingValue * profile.pct15 / 100
    const remaining39yr = buildingValue - use5yr - use7yr - use15yr

    // Standard depreciation (no cost seg)
    const standardAnnual = buildingValue / profile.life
    const stdYr1 = standardAnnual * 0.5 // mid-month first year

    // Cost seg Year 1 depreciation
    const yr1_5 = macrsDepr(use5yr, 5, bonusDeprecPct, 1)
    const yr1_7 = macrsDepr(use7yr, 7, bonusDeprecPct, 1)
    const yr1_15 = macrsDepr(use15yr, 15, bonusDeprecPct, 1)
    const yr1_39 = remaining39yr / profile.life * 0.5
    const costSegYr1Total = yr1_5 + yr1_7 + yr1_15 + yr1_39

    const yr1Acceleration = costSegYr1Total - stdYr1
    const yr1TaxSavings = yr1Acceleration * marginalTaxRate / 100

    // PAL limitation check
    const niitApplies = agi > (filingStatus === 'mfj' ? 250000 : 200000)
    const palActive = !isRealEstatePro && agi > 150000
    const usableDeduction = palActive ? 0 : yr1Acceleration
    const usableTaxSavings = palActive ? 0 : yr1TaxSavings
    const carryforward = palActive ? yr1Acceleration : 0

    // Study ROI
    const netBenefit = yr1TaxSavings - studyCost
    const roiPct = studyCost > 0 ? netBenefit / studyCost * 100 : 0

    // 10-year cumulative comparison
    const years = Array.from({ length: 15 }, (_, i) => i + 1)
    let cumStd = 0, cumCostSeg = 0
    const yearlyData = years.map(y => {
      const stdDepr = y === 1 ? stdYr1 : standardAnnual
      const cs5 = macrsDepr(use5yr, 5, bonusDeprecPct, y)
      const cs7 = macrsDepr(use7yr, 7, bonusDeprecPct, y)
      const cs15 = macrsDepr(use15yr, 15, bonusDeprecPct, y)
      const cs39 = y === 1 ? remaining39yr / profile.life * 0.5 : remaining39yr / profile.life
      const csTotal = cs5 + cs7 + cs15 + cs39
      cumStd += stdDepr
      cumCostSeg += csTotal
      return {
        year: y,
        standard: stdDepr,
        costSeg: csTotal,
        cumStd,
        cumCostSeg,
        acceleration: cumCostSeg - cumStd,
        taxAdvantage: (cumCostSeg - cumStd) * marginalTaxRate / 100,
      }
    })

    // Category breakdown
    const categoryBreakdown = [
      { name: '5-Year Property', value: use5yr, rate: '5-yr MACRS', examples: 'Carpet, appliances, decorative fixtures, land improvements' },
      { name: '7-Year Property', value: use7yr, rate: '7-yr MACRS', examples: 'Office furniture, equipment, fixtures' },
      { name: '15-Year Property', value: use15yr, rate: '15-yr MACRS', examples: 'Parking lots, sidewalks, landscaping, fencing' },
      { name: '39-Year (Remainder)', value: remaining39yr, rate: `${profile.life}-yr SL`, examples: 'Structural components, roof (non-bonus), HVAC if structural' },
    ]

    // NPV of tax savings (7% discount)
    let npv = -studyCost
    yearlyData.forEach((row, i) => {
      const annualTaxSavings = (row.costSeg - row.standard) * marginalTaxRate / 100
      npv += annualTaxSavings / Math.pow(1.07, i + 1)
    })

    return {
      profile, buildingValue, use5yr, use7yr, use15yr, remaining39yr,
      stdYr1, costSegYr1Total, yr1Acceleration, yr1TaxSavings,
      palActive, usableDeduction, usableTaxSavings, carryforward,
      netBenefit, roiPct, yearlyData, categoryBreakdown, npv, niitApplies,
    }
  }, [inp])

  const field = (label: string, key: keyof Inputs, prefix = '', suffix = '', step = '1') => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{prefix}</span>}
        <input type="number" step={step} value={inp[key] as number} onChange={e => set(key, e.target.value)}
          className={`w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 ${prefix ? 'pl-5 pr-3' : suffix ? 'pl-3 pr-7' : 'px-3'}`} />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{suffix}</span>}
      </div>
    </div>
  )

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-lg font-bold text-white">Cost Segregation Study Calculator</h2>
        <p className="text-slate-400 text-xs mt-1">Accelerate depreciation by reclassifying building components into 5, 7, and 15-year property — maximize Year 1 tax savings with bonus depreciation</p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Property</p>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Property Type</label>
            <select value={inp.propertyType} onChange={e => set('propertyType', e.target.value as PropertyType)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
              {Object.entries(PROPERTY_PROFILES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
            </select>
          </div>
          {field('Purchase Price', 'purchasePrice', '$')}
          {field('Land Value (exclude)', 'landValue', '$')}
          {field('Building Age (yrs)', 'buildingAge')}
          {field('Cost Segregation Study Fee', 'studyCost', '$')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Depreciable Basis</span><span className="text-blue-400 font-bold">{fmt(calc.buildingValue)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">MACRS Life</span><span className="text-slate-300">{calc.profile.life} years</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Std Annual Depr</span><span className="text-slate-300">{fmt(calc.buildingValue / calc.profile.life)}</span></div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Reclassification (Override)</p>
          <p className="text-xs text-slate-500">Leave at 0 to use property-type defaults</p>
          {field(`5-Year Property (est. ${calc.profile.pct5}%)`, 'reclassify5yr', '$')}
          {field(`7-Year Property (est. ${calc.profile.pct7}%)`, 'reclassify7yr', '$')}
          {field(`15-Year Property (est. ${calc.profile.pct15}%)`, 'reclassify15yr', '$')}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Bonus Depreciation %</label>
            <select value={inp.bonusDeprecPct} onChange={e => setInp(p => ({ ...p, bonusDeprecPct: Number(e.target.value) as BonusDeprecPct }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
              <option value={100}>100% (pre-2023)</option>
              <option value={80}>80% (2023)</option>
              <option value={60}>60% (2024)</option>
              <option value={40}>40% (2025)</option>
              <option value={20}>20% (2026)</option>
              <option value={0}>0% (2027+)</option>
            </select>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Tax Profile</p>
          {field('Marginal Tax Rate', 'marginalTaxRate', '', '%')}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Filing Status</label>
            <div className="flex gap-2">
              {(['single', 'mfj'] as const).map(s => (
                <button key={s} onClick={() => set('filingStatus', s)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition ${inp.filingStatus === s ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                  {s === 'single' ? 'Single' : 'Married'}
                </button>
              ))}
            </div>
          </div>
          {field('AGI (excl. rental)', 'agi', '$')}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Real Estate Pro Status</span>
            <button onClick={() => set('isRealEstatePro', !inp.isRealEstatePro)}
              className={`w-11 h-6 rounded-full transition-colors ${inp.isRealEstatePro ? 'bg-green-500' : 'bg-slate-700'}`}>
              <div className={`w-4 h-4 bg-white rounded-full mx-1 transition-transform ${inp.isRealEstatePro ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          {calc.palActive && (
            <div className="p-3 bg-orange-900/20 border border-orange-700/40 rounded-lg">
              <p className="text-xs text-orange-300 font-semibold">⚠️ PAL Limitation</p>
              <p className="text-xs text-orange-200/70 mt-1">AGI {'>'} $150K and no REP status — losses carry forward. Elect REP status or reduce AGI to unlock deductions.</p>
            </div>
          )}
        </div>
      </div>

      {/* Key Results */}
      <div className={`rounded-xl p-5 border ${calc.netBenefit > 0 ? 'bg-green-900/20 border-green-700/40' : 'bg-red-900/20 border-red-700/40'}`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-3xl font-black text-white">{fmt(calc.costSegYr1Total)}</p>
            <p className="text-xs text-slate-400">Year 1 Cost Seg Deduction</p>
            <p className="text-xs text-slate-500">vs {fmt(calc.stdYr1)} standard</p>
          </div>
          <div>
            <p className="text-3xl font-black text-blue-400">{fmt(calc.yr1Acceleration)}</p>
            <p className="text-xs text-slate-400">Year 1 Acceleration</p>
          </div>
          <div>
            <p className="text-3xl font-black text-green-400">{fmt(calc.yr1TaxSavings)}</p>
            <p className="text-xs text-slate-400">Year 1 Tax Savings</p>
            <p className="text-xs text-slate-500">At {inp.marginalTaxRate}% rate</p>
          </div>
          <div>
            <p className="text-3xl font-black text-purple-400">{fmt(calc.npv)}</p>
            <p className="text-xs text-slate-400">NPV of All Tax Savings</p>
            <p className="text-xs text-slate-500">Study ROI: {calc.roiPct.toFixed(0)}x</p>
          </div>
        </div>
        {calc.palActive && (
          <p className="text-center text-xs text-orange-300 mt-3">⚠️ PAL limitation active — {fmt(calc.carryforward)} deduction carried forward until property disposed or income offsets</p>
        )}
      </div>

      {/* Category Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Reclassification Breakdown</p>
          <div className="space-y-3">
            {calc.categoryBreakdown.map((cat, i) => (
              <div key={cat.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-300 font-semibold">{cat.name}</span>
                  <span style={{ color: COLORS[i] }} className="font-bold">{fmt(cat.value)}</span>
                </div>
                <div className="bg-slate-700 rounded-full h-2">
                  <div className="h-2 rounded-full" style={{ width: `${Math.min(100, cat.value / calc.buildingValue * 100)}%`, background: COLORS[i] }} />
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{cat.rate} · {cat.examples}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Cost Breakdown Pie</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={calc.categoryBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}
                label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {calc.categoryBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 15-Year Depreciation Comparison */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Annual Depreciation: Standard vs Cost Seg (15 Years)</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={calc.yearlyData}>
            <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={v => `Yr ${v}`} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="standard" name="Standard Depr" fill="#475569" radius={[4, 4, 0, 0]} />
            <Bar dataKey="costSeg" name="Cost Seg Depr" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Cumulative Tax Advantage */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Cumulative Tax Advantage Over Time</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={calc.yearlyData}>
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => `Yr ${v}`} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="taxAdvantage" stroke="#22c55e" strokeWidth={2} dot={false} name="Cumulative Tax Advantage" />
            <Line type="monotone" dataKey="acceleration" stroke="#3b82f6" strokeWidth={2} dot={false} strokeDasharray="5 3" name="Cumulative Depr Acceleration" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Tips */}
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Cost Segregation Strategy Notes</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
          {[
            '✓ Most cost-effective for properties $750K+ — study cost is typically 0.5-1% of property value',
            '✓ Look-back studies: can be done on properties placed in service years ago via a §481(a) catch-up deduction',
            '✓ Bonus depreciation applies to 5, 7, and 15-year property only — not structural 39-year components',
            '⚠️ Depreciation recapture at 25% on §1250 property when sold — factor this into hold/sell analysis',
            '💡 Pair with a 1031 exchange or DST to defer recapture indefinitely upon sale',
            '💡 "Qualified Improvement Property" (QIP) added to 15-year class in CARES Act — covers interior improvements',
            '📋 IRS requires a study by a qualified engineer — self-reported allocations will not withstand audit',
            '🏦 REITs and low-income housing tax credit properties have special depreciation rules — consult a specialist',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
