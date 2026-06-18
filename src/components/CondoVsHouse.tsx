import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis } from 'recharts'

interface CondoInputs {
  price: number
  hoaMonthly: number
  hoaSpecialAssessmentRisk: number
  sqft: number
  appreciation: number
  insuranceMonthly: number
  taxRate: number
  downPct: number
  rate: number
  termYears: number
  petPolicy: boolean
  rentalAllowed: boolean
  fhaApproved: boolean
}

interface HouseInputs {
  price: number
  sqft: number
  appreciation: number
  maintenancePct: number
  insuranceMonthly: number
  taxRate: number
  downPct: number
  rate: number
  termYears: number
  hasPool: boolean
  landValue: number
}

const DEF_CONDO: CondoInputs = {
  price: 350000, hoaMonthly: 650, hoaSpecialAssessmentRisk: 3000,
  sqft: 1100, appreciation: 3.5, insuranceMonthly: 85,
  taxRate: 1.1, downPct: 10, rate: 7.0, termYears: 30,
  petPolicy: true, rentalAllowed: true, fhaApproved: false,
}

const DEF_HOUSE: HouseInputs = {
  price: 425000, sqft: 1800,
  appreciation: 4.2, maintenancePct: 1.2,
  insuranceMonthly: 175, taxRate: 1.1,
  downPct: 10, rate: 7.0, termYears: 30,
  hasPool: false, landValue: 80000,
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const N = (v: string) => parseFloat(v) || 0

export default function CondoVsHouse() {
  const [condo, setCondo] = useState<CondoInputs>(DEF_CONDO)
  const [house, setHouse] = useState<HouseInputs>(DEF_HOUSE)
  const [years, setYears] = useState(10)

  const setC = (k: keyof CondoInputs, v: string | boolean) =>
    setCondo(p => ({ ...p, [k]: typeof DEF_CONDO[k] === 'number' ? N(v as string) : v }))
  const setH = (k: keyof HouseInputs, v: string | boolean) =>
    setHouse(p => ({ ...p, [k]: typeof DEF_HOUSE[k] === 'number' ? N(v as string) : v }))

  const calc = useMemo(() => {
    const condoR = condo.rate / 100 / 12
    const condoN = condo.termYears * 12
    const condoLoan = condo.price * (1 - condo.downPct / 100)
    const condoPmt = condoLoan * condoR / (1 - Math.pow(1 + condoR, -condoN))
    const condoTax = condo.price * condo.taxRate / 100 / 12
    const condoPMI = condo.downPct < 20 ? condoLoan * 0.0085 / 12 : 0
    const condoMonthly = condoPmt + condo.hoaMonthly + condoTax + condo.insuranceMonthly + condoPMI
    const condoDownPayment = condo.price * condo.downPct / 100

    const houseR = house.rate / 100 / 12
    const houseN = house.termYears * 12
    const houseLoan = house.price * (1 - house.downPct / 100)
    const housePmt = houseLoan * houseR / (1 - Math.pow(1 + houseR, -houseN))
    const houseTax = house.price * house.taxRate / 100 / 12
    const housePMI = house.downPct < 20 ? houseLoan * 0.0085 / 12 : 0
    const houseMaint = house.price * house.maintenancePct / 100 / 12
    const houseMonthly = housePmt + houseTax + house.insuranceMonthly + housePMI + houseMaint
    const houseDownPayment = house.price * house.downPct / 100

    // $/sqft
    const condoPricePerSqft = condo.price / condo.sqft
    const housePricePerSqft = house.price / house.sqft

    // 10-year trajectory
    const trajectory = Array.from({ length: years + 1 }, (_, y) => {
      const condoVal = condo.price * Math.pow(1 + condo.appreciation / 100, y)
      const houseVal = house.price * Math.pow(1 + house.appreciation / 100, y)

      let condoBal = condoLoan
      let houseBal = houseLoan
      for (let m = 0; m < y * 12; m++) {
        const ci = condoBal * condoR
        condoBal = Math.max(0, condoBal - (condoPmt - ci))
        const hi = houseBal * houseR
        houseBal = Math.max(0, houseBal - (housePmt - hi))
      }

      // Total spent
      const condoSpent = condoMonthly * y * 12 + condoDownPayment + condo.hoaSpecialAssessmentRisk * Math.floor(y / 5)
      const houseSpent = houseMonthly * y * 12 + houseDownPayment

      return {
        year: y,
        condoEquity: condoVal - condoBal,
        houseEquity: houseVal - houseBal,
        condoNetWealth: condoVal - condoBal - condoSpent + condoDownPayment,
        houseNetWealth: houseVal - houseBal - houseSpent + houseDownPayment,
        condoValue: condoVal,
        houseValue: houseVal,
      }
    })

    // Monthly cost comparison
    const monthlyComparison = [
      { name: 'P&I', condo: condoPmt, house: housePmt },
      { name: 'Tax', condo: condoTax, house: houseTax },
      { name: 'Insurance', condo: condo.insuranceMonthly, house: house.insuranceMonthly },
      { name: 'HOA/Maint', condo: condo.hoaMonthly, house: houseMaint },
      { name: 'PMI', condo: condoPMI, house: housePMI },
    ]

    // Radar scores (0-100)
    const condoScores = {
      Affordability: Math.min(100, Math.max(0, 100 - (condoMonthly / 50))),
      Maintenance: 85,
      Appreciation: Math.min(100, condo.appreciation * 18),
      Privacy: 30,
      Flexibility: condo.rentalAllowed ? 60 : 20,
      Space: Math.min(100, condo.sqft / 25),
    }
    const houseScores = {
      Affordability: Math.min(100, Math.max(0, 100 - (houseMonthly / 50))),
      Maintenance: 40,
      Appreciation: Math.min(100, house.appreciation * 18),
      Privacy: 90,
      Flexibility: 85,
      Space: Math.min(100, house.sqft / 25),
    }

    const radarData = Object.keys(condoScores).map(k => ({
      metric: k,
      Condo: condoScores[k as keyof typeof condoScores],
      House: houseScores[k as keyof typeof houseScores],
    }))

    const condoWins = Object.values(condoScores).filter((v, i) => v > Object.values(houseScores)[i]).length
    const houseWins = Object.values(houseScores).filter((v, i) => v > Object.values(condoScores)[i]).length
    const winner = condoWins > houseWins ? 'condo' : 'house'

    return {
      condoMonthly, houseMonthly, condoDownPayment, houseDownPayment,
      condoPricePerSqft, housePricePerSqft, condoPMI, housePMI,
      trajectory, monthlyComparison, radarData, condoWins, houseWins, winner,
      condoPmt, housePmt, condoTax, houseTax, houseMaint,
    }
  }, [condo, house, years])

  const fieldC = (label: string, key: keyof CondoInputs, prefix = '', suffix = '', step = '1') => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{prefix}</span>}
        <input type="number" step={step} value={condo[key] as number} onChange={e => setC(key, e.target.value)}
          className={`w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 ${prefix ? 'pl-5 pr-3' : suffix ? 'pl-3 pr-7' : 'px-3'}`} />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{suffix}</span>}
      </div>
    </div>
  )

  const fieldH = (label: string, key: keyof HouseInputs, prefix = '', suffix = '', step = '1') => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{prefix}</span>}
        <input type="number" step={step} value={house[key] as number} onChange={e => setH(key, e.target.value)}
          className={`w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 ${prefix ? 'pl-5 pr-3' : suffix ? 'pl-3 pr-7' : 'px-3'}`} />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{suffix}</span>}
      </div>
    </div>
  )

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-lg font-bold text-white">Condo vs Single-Family Home</h2>
        <p className="text-slate-400 text-xs mt-1">Side-by-side financial comparison including HOA impact, appreciation differential, $/sqft, and long-term wealth building</p>
      </div>

      {/* Projection Years */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-slate-400">Projection Period</label>
        {[5, 10, 15, 20].map(y => (
          <button key={y} onClick={() => setYears(y)}
            className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${years === y ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
            {y} yr
          </button>
        ))}
      </div>

      {/* Input columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Condo */}
        <div className="bg-blue-900/20 rounded-xl p-4 border border-blue-700/40 space-y-3">
          <p className="text-sm font-bold text-blue-300 flex items-center gap-2">🏙 Condo / Townhouse</p>
          {fieldC('Purchase Price', 'price', '$')}
          {fieldC('Square Footage', 'sqft', '', 'sqft')}
          {fieldC('Monthly HOA', 'hoaMonthly', '$')}
          {fieldC('Special Assessment Risk (per 5yr)', 'hoaSpecialAssessmentRisk', '$')}
          {fieldC('Annual Appreciation', 'appreciation', '', '%', '0.5')}
          {fieldC('Insurance (monthly)', 'insuranceMonthly', '$')}
          {fieldC('Property Tax Rate', 'taxRate', '', '%/yr', '0.1')}
          {fieldC('Down Payment', 'downPct', '', '%')}
          {fieldC('Mortgage Rate', 'rate', '', '%', '0.125')}
          <div className="flex gap-4 pt-1">
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input type="checkbox" checked={condo.fhaApproved} onChange={e => setC('fhaApproved', e.target.checked)} className="accent-blue-500" />
              FHA Approved
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input type="checkbox" checked={condo.rentalAllowed} onChange={e => setC('rentalAllowed', e.target.checked)} className="accent-blue-500" />
              Rentals Allowed
            </label>
          </div>
        </div>

        {/* House */}
        <div className="bg-green-900/20 rounded-xl p-4 border border-green-700/40 space-y-3">
          <p className="text-sm font-bold text-green-300 flex items-center gap-2">🏡 Single-Family Home</p>
          {fieldH('Purchase Price', 'price', '$')}
          {fieldH('Square Footage', 'sqft', '', 'sqft')}
          {fieldH('Annual Maintenance', 'maintenancePct', '', '% of value', '0.1')}
          {fieldH('Annual Appreciation', 'appreciation', '', '%', '0.5')}
          {fieldH('Insurance (monthly)', 'insuranceMonthly', '$')}
          {fieldH('Property Tax Rate', 'taxRate', '', '%/yr', '0.1')}
          {fieldH('Down Payment', 'downPct', '', '%')}
          {fieldH('Mortgage Rate', 'rate', '', '%', '0.125')}
          {fieldH('Land Value', 'landValue', '$')}
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer pt-1">
            <input type="checkbox" checked={house.hasPool} onChange={e => setH('hasPool', e.target.checked)} className="accent-green-500" />
            Has Pool (+$300/mo maint)
          </label>
        </div>
      </div>

      {/* Summary Comparison */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '$/sqft', condo: `$${calc.condoPricePerSqft.toFixed(0)}`, house: `$${calc.housePricePerSqft.toFixed(0)}`, winner: calc.condoPricePerSqft < calc.housePricePerSqft ? 'condo' : 'house' },
          { label: 'Monthly PITI + Fees', condo: fmt(calc.condoMonthly), house: fmt(calc.houseMonthly), winner: calc.condoMonthly < calc.houseMonthly ? 'condo' : 'house' },
          { label: 'Down Payment', condo: fmt(calc.condoDownPayment), house: fmt(calc.houseDownPayment), winner: calc.condoDownPayment < calc.houseDownPayment ? 'condo' : 'house' },
          { label: `${years}-Yr Equity`, condo: fmt(calc.trajectory[years]?.condoEquity ?? 0), house: fmt(calc.trajectory[years]?.houseEquity ?? 0), winner: (calc.trajectory[years]?.condoEquity ?? 0) > (calc.trajectory[years]?.houseEquity ?? 0) ? 'condo' : 'house' },
        ].map(r => (
          <div key={r.label} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700">
            <p className="text-xs text-slate-500 mb-2">{r.label}</p>
            <div className="flex justify-between items-center">
              <div className="text-center">
                <p className={`text-sm font-bold ${r.winner === 'condo' ? 'text-blue-400' : 'text-slate-300'}`}>{r.condo}</p>
                <p className="text-xs text-slate-500">Condo</p>
              </div>
              <span className="text-slate-600 text-xs">vs</span>
              <div className="text-center">
                <p className={`text-sm font-bold ${r.winner === 'house' ? 'text-green-400' : 'text-slate-300'}`}>{r.house}</p>
                <p className="text-xs text-slate-500">House</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Monthly Cost Breakdown */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Monthly Cost Breakdown</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={calc.monthlyComparison}>
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tickFormatter={v => `$${v}`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="condo" name="Condo" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="house" name="House" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Equity Growth */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Equity Growth Comparison</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={calc.trajectory}>
              <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} label={{ value: 'Year', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 10 }} />
              <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="condoEquity" stroke="#3b82f6" strokeWidth={2} dot={false} name="Condo Equity" />
              <Line type="monotone" dataKey="houseEquity" stroke="#22c55e" strokeWidth={2} dot={false} name="House Equity" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Radar */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Lifestyle &amp; Financial Score</p>
        <ResponsiveContainer width="100%" height={250}>
          <RadarChart data={calc.radarData}>
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 11 }} />
            <Radar name="Condo" dataKey="Condo" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
            <Radar name="House" dataKey="House" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* HOA Risk Factors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Condo / HOA Considerations</p>
          <div className="space-y-1.5 text-xs text-slate-400">
            {[
              condo.fhaApproved ? '✓ FHA-approved — easier buyer pool when you sell' : '⚠️ Not FHA-approved — limits buyer pool and some conventional loans',
              condo.rentalAllowed ? '✓ Rentals allowed — good investment flexibility' : '⚠️ Rentals restricted — may impact resale to investors',
              '📋 Review HOA reserve study — underfunded reserves = special assessments',
              '🏊 Check amenity fees are included in the HOA — some charge separately',
              '⚖️ Condo docs: review rules on pets, parking, AirBnb before buying',
              '🔍 FNMA warrantability: some condos fail agency guidelines → higher rates',
            ].map((t, i) => <p key={i}>{t}</p>)}
          </div>
        </div>
        <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">House Advantages / Risks</p>
          <div className="space-y-1.5 text-xs text-slate-400">
            {[
              '✓ Full control over modifications, renovations, and additions',
              '✓ Land appreciation — especially in land-constrained markets',
              '✓ No HOA approval needed for renting, pets, or AirBnb (check local ordinances)',
              `⚠️ Maintenance at ${house.maintenancePct}%/yr = ${fmt(house.price * house.maintenancePct / 100)}/yr avg — budget carefully`,
              house.hasPool ? '⚠️ Pool adds $300+/mo in maintenance, $2K/yr in insurance, liability risk' : '🏊 No pool — lower insurance and maintenance burden',
              `💡 Land value (${fmt(house.landValue)}) does not depreciate — provides a floor on long-term value`,
            ].map((t, i) => <p key={i}>{t}</p>)}
          </div>
        </div>
      </div>
    </div>
  )
}
