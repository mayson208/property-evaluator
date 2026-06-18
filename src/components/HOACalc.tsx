import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line, Legend } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function monthlyPmt(principal: number, annualRate: number, termYears: number) {
  const r = annualRate / 100 / 12
  const n = termYears * 12
  if (r === 0 || n === 0) return 0
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

const HOA_TYPES = [
  { label: 'Condo (high-rise)',      monthlyRange: [400, 1200], includes: ['Water/sewer', 'Exterior', 'Roof', 'Insurance', 'Gym', 'Concierge'] },
  { label: 'Condo (low-rise)',       monthlyRange: [200, 600],  includes: ['Water/sewer', 'Exterior', 'Roof', 'Insurance', 'Pool'] },
  { label: 'Townhome',               monthlyRange: [150, 450],  includes: ['Exterior paint', 'Landscaping', 'Roof', 'Insurance (common)'] },
  { label: 'Single-family (gated)', monthlyRange: [100, 400],  includes: ['Gate/security', 'Landscaping (common)', 'Clubhouse', 'Pool'] },
  { label: 'Single-family (basic)', monthlyRange: [30, 150],   includes: ['Landscaping (common)', 'CC&R enforcement'] },
]

export default function HOACalc() {
  const { result, input, interestRate } = usePropertyStore()

  const homeVal  = result?.estimatedValue ?? 400000
  const downPct  = input.downPaymentPct ?? 20

  const [purchasePrice,      setPurchasePrice]      = useState(homeVal)
  const [hoaMonthly,         setHoaMonthly]         = useState(350)
  const [hoaAnnualIncrease,  setHoaAnnualIncrease]  = useState(3.5)
  const [specialAssessRisk,  setSpecialAssessRisk]  = useState(15)  // % chance per year
  const [avgSpecialAssess,   setAvgSpecialAssess]   = useState(5000) // avg amount if triggered
  const [reserveFundPct,     setReserveFundPct]     = useState(50)  // % funded (ideal ≥ 70%)
  const [rate,               setRate]               = useState(interestRate)
  const [termYrs,            setTermYrs]            = useState(30)
  const [selectedType,       setSelectedType]       = useState(0)
  const [hoaType,            setHoaType]            = useState('Condo (low-rise)')
  const [yearsToLookAhead,   setYearsToLookAhead]   = useState(10)

  const analysis = useMemo(() => {
    const loanAmount    = purchasePrice * (1 - downPct / 100)
    const baseMonthly   = monthlyPmt(loanAmount, rate, termYrs)
    const totalWithHoa  = baseMonthly + hoaMonthly

    // Effective price premium (what price without HOA gives same monthly?)
    // Solve: pmt(P, r, n) = baseMonthly - hoaMonthly  →  P = hoaMonthly / (r * ...)
    const hoaAsLoanEquiv = hoaMonthly > 0 && baseMonthly > hoaMonthly
      ? (() => {
          const r = rate / 100 / 12
          const n = termYrs * 12
          return hoaMonthly / ((r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)) / (1 - downPct / 100)
        })()
      : 0

    // HOA growth over years
    const yearData = Array.from({ length: yearsToLookAhead + 1 }, (_, yr) => {
      const monthlyAtYr = hoaMonthly * Math.pow(1 + hoaAnnualIncrease / 100, yr)
      const annualAtYr  = monthlyAtYr * 12
      const cumHoa      = Array.from({ length: yr }, (_, i) =>
        hoaMonthly * Math.pow(1 + hoaAnnualIncrease / 100, i) * 12
      ).reduce((s, v) => s + v, 0)
      const specialAssessExpected = avgSpecialAssess * (specialAssessRisk / 100) * yr
      return { yr, monthlyAtYr: Math.round(monthlyAtYr), annualAtYr: Math.round(annualAtYr), cumHoa: Math.round(cumHoa), specialAssessExpected: Math.round(specialAssessExpected) }
    })

    const totalHoaCost10yr = yearData[yearsToLookAhead]?.cumHoa ?? 0
    const totalWithSpecial = totalHoaCost10yr + (yearData[yearsToLookAhead]?.specialAssessExpected ?? 0)
    const hoaAtYear10      = yearData[yearsToLookAhead]?.monthlyAtYr ?? hoaMonthly

    // Reserve fund health
    const reserveHealth =
      reserveFundPct >= 70 ? { label: 'Healthy', color: '#22c55e', risk: 'Low risk of special assessments' } :
      reserveFundPct >= 50 ? { label: 'Adequate', color: '#84cc16', risk: 'Moderate risk — ask for reserve study' } :
      reserveFundPct >= 30 ? { label: 'Underfunded', color: '#f59e0b', risk: 'High risk of special assessments' } :
                              { label: 'Critical', color: '#ef4444', risk: 'Very high risk — special assessments likely' }

    return { loanAmount, baseMonthly, totalWithHoa, hoaAsLoanEquiv, yearData, totalHoaCost10yr, totalWithSpecial, hoaAtYear10, reserveHealth }
  }, [purchasePrice, downPct, rate, termYrs, hoaMonthly, hoaAnnualIncrease, specialAssessRisk, avgSpecialAssess, reserveFundPct, yearsToLookAhead])

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">HOA Impact Calculator</h3>
        <p className="text-xs text-slate-500">
          Model the true cost of HOA fees over time, assess special assessment risk, evaluate
          reserve fund health, and see the equivalent purchase price reduction.
        </p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Base Mortgage',       value: fmt(analysis.baseMonthly),      color: 'text-slate-300', sub: '/month' },
          { label: 'Mortgage + HOA',      value: fmt(analysis.totalWithHoa),     color: 'text-white',     sub: '/month total' },
          { label: `HOA at Yr ${yearsToLookAhead}`,   value: fmt(analysis.hoaAtYear10),      color: 'text-yellow-400', sub: '/month' },
          { label: `Total HOA (${yearsToLookAhead}yr)`, value: fmt(analysis.totalWithSpecial), color: 'text-red-400', sub: 'incl. assessments' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-600 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Equivalent price premium */}
      <div className="bg-blue-900/20 border border-blue-700/40 rounded-xl p-4">
        <p className="text-sm font-bold text-blue-400 mb-1">HOA Payment Equivalent</p>
        <p className="text-xs text-slate-400">
          Your {fmt(hoaMonthly)}/mo HOA is equivalent to borrowing an extra{' '}
          <strong className="text-white">{fmt(analysis.hoaAsLoanEquiv)}</strong> on your mortgage at {rate}% over {termYrs} years.
          A similar non-HOA home at <strong className="text-white">{fmt(purchasePrice - analysis.hoaAsLoanEquiv)}</strong> would cost the same monthly.
        </p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">HOA Details</p>

          <div>
            <label className="text-xs text-slate-400 uppercase tracking-widest block mb-1.5">HOA Type</label>
            <div className="grid grid-cols-1 gap-1">
              {HOA_TYPES.map((t, i) => (
                <button key={t.label} onClick={() => { setSelectedType(i); setHoaType(t.label); setHoaMonthly(Math.round((t.monthlyRange[0] + t.monthlyRange[1]) / 2)) }}
                  className={`text-left px-3 py-1.5 rounded-lg text-xs transition ${selectedType === i ? 'bg-blue-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'}`}>
                  <span className="font-semibold">{t.label}</span>
                  <span className="text-slate-400 ml-1">({fmt(t.monthlyRange[0])}–{fmt(t.monthlyRange[1])}/mo)</span>
                </button>
              ))}
            </div>
          </div>

          {[
            { label: 'Monthly HOA Fee',      value: hoaMonthly,        min: 0,    max: 2000, step: 25,  set: setHoaMonthly,        fmt: (v: number) => `${fmt(v)}/mo (${fmt(v * 12)}/yr)` },
            { label: 'Annual Fee Increase',  value: hoaAnnualIncrease, min: 0,    max: 10,   step: 0.5, set: setHoaAnnualIncrease, fmt: (v: number) => `${v.toFixed(1)}%/yr` },
            { label: 'Look-ahead Period',    value: yearsToLookAhead,  min: 5,    max: 30,   step: 5,   set: setYearsToLookAhead,  fmt: (v: number) => `${v} years` },
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
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Risk Factors</p>

          {[
            { label: 'Reserve Fund Funded %', value: reserveFundPct,       min: 0,  max: 100, step: 5,    set: setReserveFundPct,      fmt: (v: number) => `${v}%` },
            { label: 'Special Assess. Risk %', value: specialAssessRisk,   min: 0,  max: 50,  step: 5,    set: setSpecialAssessRisk,   fmt: (v: number) => `${v}% chance/yr` },
            { label: 'Avg Special Assessment', value: avgSpecialAssess,    min: 500, max: 50000, step: 500, set: setAvgSpecialAssess,  fmt: fmt },
          ].map(s => (
            <div key={s.label}>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-slate-400 uppercase tracking-widest">{s.label}</label>
                <span className="text-xs font-bold text-purple-400">{s.fmt(s.value)}</span>
              </div>
              <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                onChange={e => s.set(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-purple-500" />
            </div>
          ))}

          {/* Reserve fund health indicator */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-xs text-slate-400 uppercase tracking-widest">Reserve Fund Health</span>
              <span className="text-xs font-bold" style={{ color: analysis.reserveHealth.color }}>{analysis.reserveHealth.label}</span>
            </div>
            <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${reserveFundPct}%`, background: analysis.reserveHealth.color }} />
            </div>
            <p className="text-xs mt-1" style={{ color: analysis.reserveHealth.color }}>{analysis.reserveHealth.risk}</p>
          </div>

          {/* What's included */}
          {HOA_TYPES[selectedType] && (
            <div className="bg-slate-900/60 rounded-lg p-3">
              <p className="text-xs text-slate-400 uppercase tracking-widest mb-1.5">Typically Included</p>
              <div className="flex flex-wrap gap-1">
                {HOA_TYPES[selectedType].includes.map(item => (
                  <span key={item} className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{item}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Growth chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">HOA Cost Growth Over {yearsToLookAhead} Years</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={analysis.yearData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="yr" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false}
              label={{ value: 'Year', position: 'insideBottom', offset: -3, fill: '#64748b', fontSize: 10 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} width={55} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number, name: string) => [fmt(v), name === 'cumHoa' ? 'Cumulative HOA Paid' : name === 'specialAssessExpected' ? 'Expected Assessments' : 'Monthly HOA']} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
            <Line type="monotone" dataKey="cumHoa"             stroke="#3b82f6" dot={false} strokeWidth={2} name="cumHoa" />
            <Line type="monotone" dataKey="specialAssessExpected" stroke="#ef4444" dot={false} strokeWidth={2} strokeDasharray="5 3" name="specialAssessExpected" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">HOA Due Diligence Checklist</p>
        <div className="space-y-1.5 text-xs text-slate-400">
          {[
            '📋 Request the CC&Rs, bylaws, and board meeting minutes for the past 2 years before making an offer.',
            '💰 Ask for the reserve fund study — look for ≥ 70% funded. Below 50% means likely special assessments.',
            '📞 Talk to current residents about the board, management company, and quality of maintenance.',
            '⚖️ Review pending litigation — lawsuits against the HOA can block financing and tank property values.',
            '📈 Track fee increases over the past 5 years — steady increases are normal; jumps signal reserve deficits.',
            '🏦 FHA/VA loans have stricter condo HOA requirements — verify eligibility if using government financing.',
            '🔍 Check if any units are delinquent on dues — high delinquency means the remaining owners subsidize them.',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Special assessment probabilities are estimates based on reserve fund health.
        Always review the official reserve fund study before purchasing in an HOA community.
      </p>
    </div>
  )
}
