import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function pmt(principal: number, annualRate: number, termYears: number) {
  const r = annualRate / 100 / 12
  const n = termYears * 12
  if (r === 0) return principal / n
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

interface Unit {
  id: string
  label: string
  rent: number
  occupancy: number
  ownerOccupied: boolean
}

export default function MultiFamilyCalc() {
  const { result, downPaymentPct, interestRate } = usePropertyStore()

  const purchasePrice = result?.estimatedValue ?? 500000

  const [unitCount,    setUnitCount]    = useState(2)
  const [houseHacking, setHouseHacking] = useState(true)
  const [units,        setUnits]        = useState<Unit[]>([
    { id: 'u1', label: 'Unit 1 (Yours)', rent: 0,    occupancy: 100, ownerOccupied: true  },
    { id: 'u2', label: 'Unit 2',         rent: 1800, occupancy: 90,  ownerOccupied: false },
    { id: 'u3', label: 'Unit 3',         rent: 1700, occupancy: 90,  ownerOccupied: false },
    { id: 'u4', label: 'Unit 4',         rent: 1600, occupancy: 90,  ownerOccupied: false },
  ].slice(0, 4))
  const [annualTaxPct,    setAnnualTaxPct]    = useState(1.1)
  const [annualInsPct,    setAnnualInsPct]    = useState(0.6)
  const [annualVacancy,   setAnnualVacancy]   = useState(8)
  const [maintenancePct,  setMaintenancePct]  = useState(8)
  const [propMgmtPct,     setPropMgmtPct]     = useState(0)
  const [utilShared,      setUtilShared]       = useState(200)

  const activeUnits = units.slice(0, unitCount)

  const updateUnit = (id: string, patch: Partial<Unit>) => {
    setUnits(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u))
  }

  const toggleUnitCount = (n: number) => {
    setUnitCount(n)
    setUnits(prev => {
      const updated = [...prev]
      if (houseHacking) updated[0] = { ...updated[0], ownerOccupied: true, label: 'Unit 1 (Yours)', rent: 0 }
      return updated
    })
  }

  const analysis = useMemo(() => {
    const loanAmt      = purchasePrice * (1 - downPaymentPct / 100)
    const monthlyDebt  = pmt(loanAmt, interestRate, 30)
    const monthlyTax   = purchasePrice * annualTaxPct / 100 / 12
    const monthlyIns   = purchasePrice * annualInsPct / 100 / 12

    const rentalUnits  = activeUnits.filter(u => !u.ownerOccupied)
    const totalGross   = rentalUnits.reduce((s, u) => s + u.rent, 0)
    const vacancyLoss  = totalGross * annualVacancy / 100
    const effectiveGross = totalGross - vacancyLoss
    const mgmtCost     = effectiveGross * propMgmtPct / 100
    const maintCost    = (purchasePrice * maintenancePct / 100) / 12
    const totalExp     = monthlyTax + monthlyIns + maintCost + utilShared + mgmtCost
    const netOpIncome  = effectiveGross - totalExp
    const cashFlow     = netOpIncome - monthlyDebt

    // House hacking: owner's "housing cost" = mortgage + expenses - rental income
    const ownerMonthlyCost = monthlyDebt + totalExp - effectiveGross
    const capRate  = (netOpIncome * 12) / purchasePrice * 100
    const dscr     = monthlyDebt > 0 ? netOpIncome / monthlyDebt : 0
    const grm      = totalGross > 0 ? purchasePrice / (totalGross * 12) : 0

    // Without house hacking (conventional rental — no owner unit)
    const fullRentalGross = activeUnits.reduce((s, u) => s + (u.ownerOccupied ? u.rent || 1800 : u.rent), 0)
    const fullNetOp       = fullRentalGross * (1 - annualVacancy / 100) - totalExp
    const fullCashFlow    = fullNetOp - monthlyDebt

    return {
      loanAmt, monthlyDebt, monthlyTax, monthlyIns,
      totalGross, vacancyLoss, effectiveGross, mgmtCost, maintCost, totalExp,
      netOpIncome, cashFlow, ownerMonthlyCost,
      capRate, dscr, grm,
      fullRentalGross, fullCashFlow,
    }
  }, [purchasePrice, downPaymentPct, interestRate, activeUnits, annualTaxPct, annualInsPct, annualVacancy, maintenancePct, propMgmtPct, utilShared])

  const chartData = [
    { label: 'Gross Rent',   value: analysis.totalGross,     color: '#22c55e' },
    { label: 'Vacancy',      value: -analysis.vacancyLoss,    color: '#ef4444' },
    { label: 'Operating Exp', value: -analysis.totalExp,      color: '#f59e0b' },
    { label: 'Mortgage',     value: -analysis.monthlyDebt,    color: '#ef4444' },
    { label: 'Net Cash Flow', value: analysis.cashFlow,       color: analysis.cashFlow >= 0 ? '#22c55e' : '#ef4444' },
  ]

  if (!result) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-4xl mb-3">🏘</p>
        <p>Run a valuation first to analyze multi-family potential</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Multi-Family &amp; House Hacking Analyzer</h3>
        <p className="text-xs text-slate-500">
          Analyze duplex, triplex, and fourplex investments. Model house hacking where you live in one unit and rent the others.
        </p>
      </div>

      {/* Unit count + house hacking toggle */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Property Type</p>
            <div className="flex gap-2">
              {[
                { n: 2, label: 'Duplex' },
                { n: 3, label: 'Triplex' },
                { n: 4, label: 'Fourplex' },
              ].map(opt => (
                <button key={opt.n}
                  onClick={() => toggleUnitCount(opt.n)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition ${unitCount === opt.n ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setHouseHacking(!houseHacking)}
              className={`w-10 h-5 rounded-full transition-all relative ${houseHacking ? 'bg-blue-600' : 'bg-slate-600'}`}>
              <span className={`absolute w-4 h-4 bg-white rounded-full top-0.5 transition-all ${houseHacking ? 'left-5' : 'left-0.5'}`} />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-300">House Hacking Mode</span>
              <p className="text-xs text-slate-500">You live in Unit 1</p>
            </div>
          </label>
        </div>

        {/* Unit inputs */}
        <div className="space-y-2">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Unit Rents</p>
          {activeUnits.map((u, i) => (
            <div key={u.id} className="flex items-center gap-3 flex-wrap">
              <span className={`text-xs font-semibold w-20 flex-shrink-0 ${u.ownerOccupied ? 'text-blue-400' : 'text-slate-300'}`}>
                {u.ownerOccupied ? '🏠 Yours' : `Unit ${i + 1}`}
              </span>
              {u.ownerOccupied ? (
                <span className="text-xs text-slate-500 italic">Owner-occupied — no rent income</span>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="number"
                      value={u.rent}
                      onChange={e => updateUnit(u.id, { rent: Number(e.target.value) })}
                      className="w-28 bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded px-2 py-1"
                      placeholder="Monthly rent"
                    />
                    <span className="text-xs text-slate-500">/mo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Occupancy:</span>
                    <input type="range" min={50} max={100} step={5} value={u.occupancy}
                      onChange={e => updateUnit(u.id, { occupancy: Number(e.target.value) })}
                      className="w-20 h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
                    <span className="text-xs font-bold text-blue-400 w-8">{u.occupancy}%</span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Expense assumptions */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Expense Assumptions</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Property Tax Rate', value: annualTaxPct,   min: 0.3, max: 3,    step: 0.05, set: setAnnualTaxPct,   fmt: (v: number) => `${v.toFixed(2)}%` },
            { label: 'Insurance Rate',    value: annualInsPct,   min: 0.3, max: 2,    step: 0.05, set: setAnnualInsPct,   fmt: (v: number) => `${v.toFixed(2)}%` },
            { label: 'Annual Vacancy %',  value: annualVacancy,  min: 0,   max: 25,   step: 1,    set: setAnnualVacancy,  fmt: (v: number) => `${v}%` },
            { label: 'Maintenance %',     value: maintenancePct, min: 1,   max: 20,   step: 1,    set: setMaintenancePct, fmt: (v: number) => `${v}%/yr of value` },
            { label: 'Property Mgmt %',  value: propMgmtPct,    min: 0,   max: 15,   step: 1,    set: setPropMgmtPct,   fmt: (v: number) => `${v}%${v === 0 ? ' (self)' : ''}` },
            { label: 'Shared Utilities',  value: utilShared,     min: 0,   max: 1000, step: 25,   set: setUtilShared,    fmt: (v: number) => `${fmt(v)}/mo` },
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

      {/* Results */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Monthly Rental Income', value: fmt(analysis.totalGross), sub: 'gross from rented units', color: 'text-green-400' },
          { label: 'Monthly Cash Flow',     value: fmt(analysis.cashFlow), sub: 'after all costs', color: analysis.cashFlow >= 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'Cap Rate',              value: `${analysis.capRate.toFixed(1)}%`, sub: 'NOI / purchase price', color: analysis.capRate >= 6 ? 'text-green-400' : 'text-blue-400' },
          { label: 'DSCR',                  value: analysis.dscr.toFixed(2), sub: 'debt service coverage', color: analysis.dscr >= 1.25 ? 'text-green-400' : analysis.dscr >= 1.0 ? 'text-yellow-400' : 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-600 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {houseHacking && (
        <div className="bg-blue-900/20 border border-blue-700/40 rounded-xl p-5">
          <p className="text-xs text-blue-400 uppercase tracking-widest font-bold mb-3">House Hacking Benefit</p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-slate-500 mb-1">Your Monthly Housing Cost</p>
              <p className={`text-2xl font-black ${analysis.ownerMonthlyCost <= 0 ? 'text-green-400' : 'text-blue-400'}`}>
                {analysis.ownerMonthlyCost <= 0 ? 'FREE + ' : ''}{fmt(Math.abs(analysis.ownerMonthlyCost))}/mo
                {analysis.ownerMonthlyCost < 0 ? ' profit' : ''}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">vs full mortgage {fmt(analysis.monthlyDebt)}/mo</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Monthly Savings vs Renting</p>
              <p className="text-2xl font-black text-green-400">
                +{fmt(Math.max(0, analysis.monthlyDebt - Math.max(0, analysis.ownerMonthlyCost)))}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">compared to full mortgage</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Annual Savings</p>
              <p className="text-2xl font-black text-green-400">
                {fmt(Math.max(0, analysis.monthlyDebt - Math.max(0, analysis.ownerMonthlyCost)) * 12)}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">housing subsidy per year</p>
            </div>
          </div>
        </div>
      )}

      {/* Waterfall chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Monthly Cash Flow Breakdown</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => v >= 0 ? `$${(v / 1000).toFixed(1)}K` : `-$${(Math.abs(v) / 1000).toFixed(1)}K`} width={55} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v: number) => [fmt(v), 'Amount']} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed P&L */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Monthly P&L</p>
        <div className="space-y-1.5 text-xs">
          {[
            { label: 'Gross Rental Income',    value: fmt(analysis.totalGross),       color: 'text-green-400' },
            { label: `Vacancy Loss (${annualVacancy}%)`, value: `-${fmt(analysis.vacancyLoss)}`, color: 'text-red-400' },
            { label: 'Effective Gross Income', value: fmt(analysis.effectiveGross),    color: 'text-green-400 font-bold', border: true },
            { label: 'Property Tax',           value: `-${fmt(analysis.monthlyTax)}`,  color: 'text-red-400' },
            { label: 'Insurance',              value: `-${fmt(analysis.monthlyIns)}`,  color: 'text-red-400' },
            { label: 'Maintenance Reserve',    value: `-${fmt(analysis.maintCost)}`,   color: 'text-red-400' },
            { label: 'Shared Utilities',       value: `-${fmt(utilShared)}`,           color: 'text-red-400' },
            { label: 'Property Management',    value: `-${fmt(analysis.mgmtCost)}`,    color: 'text-red-400' },
            { label: 'Net Operating Income',   value: fmt(analysis.netOpIncome),       color: 'text-blue-400 font-bold', border: true },
            { label: 'Mortgage P&I',           value: `-${fmt(analysis.monthlyDebt)}`, color: 'text-red-400' },
            { label: 'Net Cash Flow',          value: fmt(analysis.cashFlow),          color: analysis.cashFlow >= 0 ? 'text-green-400 font-black' : 'text-red-400 font-black', border: true },
          ].map(r => (
            <div key={r.label} className={`flex justify-between ${r.border ? 'border-t border-slate-700 pt-1.5 mt-1.5' : ''}`}>
              <span className={r.border ? 'text-slate-300 font-semibold' : 'text-slate-500'}>{r.label}</span>
              <span className={r.color}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Multi-family properties (2–4 units) typically qualify for residential financing with as little as 3.5% down (FHA) or 5–25% down (conventional),
        even as investment properties. House hacking can be a powerful wealth-building strategy for first-time buyers.
      </p>
    </div>
  )
}
