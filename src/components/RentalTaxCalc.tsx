import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line, ReferenceLine } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function marginalRate(income: number, status: 'single' | 'mfj'): number {
  const brackets = status === 'mfj'
    ? [[0, 23200, 10], [23200, 94300, 12], [94300, 201050, 22], [201050, 383900, 24], [383900, 487450, 32], [487450, 731200, 35], [731200, Infinity, 37]]
    : [[0, 11600, 10], [11600, 47150, 12], [47150, 100525, 22], [100525, 191950, 24], [191950, 243725, 32], [243725, 609350, 35], [609350, Infinity, 37]]
  for (const [lo, hi, rate] of brackets) {
    if (income >= lo && income < hi) return rate as number
  }
  return 37
}

export default function RentalTaxCalc() {
  const [grossRent,      setGrossRent]      = useState(36000)
  const [vacancy,        setVacancy]        = useState(5)           // %
  const [propTax,        setPropTax]        = useState(4200)
  const [insurance,      setInsurance]      = useState(1800)
  const [repairs,        setRepairs]        = useState(2000)
  const [management,     setManagement]     = useState(2880)        // 8% of gross
  const [utilities,      setUtilities]      = useState(0)
  const [advertising,    setAdvertising]    = useState(300)
  const [mortgageInterest, setMortgageInterest] = useState(12000)
  const [homeValue,      setHomeValue]      = useState(350000)
  const [landValue,      setLandValue]      = useState(70000)       // 20%
  const [priorCarryover, setPriorCarryover] = useState(0)           // prior-year PAL carryover
  const [agi,            setAgi]            = useState(80000)        // other AGI
  const [filingStatus,   setFilingStatus]   = useState<'single' | 'mfj'>('mfj')
  const [isREP,          setIsREP]          = useState(false)        // Real Estate Professional
  const [activeParticipation, setActiveParticipation] = useState(true) // ≥10% interest + active involvement

  const calc = useMemo(() => {
    const effectiveRent  = grossRent * (1 - vacancy / 100)
    const depreciation   = (homeValue - landValue) / 27.5
    const totalExpenses  = propTax + insurance + repairs + management + utilities + advertising + mortgageInterest + depreciation
    const netIncomeLoss  = effectiveRent - totalExpenses

    // Schedule E net
    const isLoss = netIncomeLoss < 0
    const lossBefore = isLoss ? Math.abs(netIncomeLoss) : 0

    // Passive activity loss rules (§469)
    // Add prior carryover to current year loss
    const totalPAL = lossBefore + priorCarryover

    // Active participation exception: up to $25K if AGI ≤ $100K, phases out $100K–$150K
    // REP status: no passive limitation — all losses deductible
    let deductibleNow  = 0
    let carryforward   = 0
    let repBenefit     = 0

    if (!isLoss) {
      // Net income: fully taxable
      deductibleNow = 0
      carryforward  = priorCarryover  // prior carryover still carries forward
    } else if (isREP) {
      // REP: no passive limitations, fully deductible
      deductibleNow = totalPAL
      carryforward  = 0
      repBenefit    = totalPAL * marginalRate(agi, filingStatus) / 100
    } else if (activeParticipation) {
      // Active participation exception
      const maxAllowed    = 25000
      const phaseoutStart = 100000
      const phaseoutEnd   = 150000
      let allowedExc = maxAllowed
      if (agi > phaseoutEnd) allowedExc = 0
      else if (agi > phaseoutStart) allowedExc = maxAllowed * (1 - (agi - phaseoutStart) / (phaseoutEnd - phaseoutStart))

      deductibleNow = Math.min(totalPAL, allowedExc)
      carryforward  = Math.max(totalPAL - allowedExc, 0)
    } else {
      // Purely passive: all losses carry forward
      deductibleNow = 0
      carryforward  = totalPAL
    }

    // Tax impact
    const taxRate          = marginalRate(agi, filingStatus)
    const taxSavingsNow    = deductibleNow * taxRate / 100
    const taxOnRentalIncome = isLoss ? 0 : netIncomeLoss * taxRate / 100
    const niit = (agi + Math.max(netIncomeLoss, 0)) > (filingStatus === 'mfj' ? 250000 : 200000) ? Math.max(netIncomeLoss, 0) * 0.038 : 0
    const totalTaxImpact   = isLoss ? -taxSavingsNow : taxOnRentalIncome + niit

    // AGI sensitivity: how allowed deduction changes at different AGI levels
    const agiChart = [60000, 80000, 100000, 110000, 120000, 130000, 140000, 150000, 175000, 200000].map(a => {
      let allowed = 25000
      if (a > 150000) allowed = 0
      else if (a > 100000) allowed = 25000 * (1 - (a - 100000) / 50000)
      const ded = Math.min(lossBefore + priorCarryover, allowed)
      const rate = marginalRate(a, filingStatus)
      return { agi: `$${(a / 1000).toFixed(0)}K`, deductible: Math.round(ded), taxSavings: Math.round(ded * rate / 100) }
    })

    // Expense breakdown
    const expenseItems = [
      { name: 'Mortgage Interest', val: mortgageInterest },
      { name: 'Depreciation',      val: depreciation },
      { name: 'Property Tax',      val: propTax },
      { name: 'Management',        val: management },
      { name: 'Repairs',           val: repairs },
      { name: 'Insurance',         val: insurance },
      { name: 'Utilities',         val: utilities },
      { name: 'Advertising',       val: advertising },
    ].filter(e => e.val > 0).sort((a, b) => b.val - a.val)

    // REP status requirements
    const repHoursRequired = Math.max(750, agi * 0)  // always 750
    const moreTimeInRE     = true  // user assertion

    return {
      effectiveRent, depreciation, totalExpenses, netIncomeLoss, isLoss, lossBefore, totalPAL,
      deductibleNow, carryforward, taxSavingsNow, taxOnRentalIncome, niit, totalTaxImpact,
      taxRate, agiChart, expenseItems, repBenefit, allowedExc: isREP ? totalPAL : (activeParticipation ? Math.min(25000 * Math.max(0, 1 - Math.max(0, agi - 100000) / 50000), 25000) : 0)
    }
  }, [grossRent, vacancy, propTax, insurance, repairs, management, utilities, advertising,
      mortgageInterest, homeValue, landValue, priorCarryover, agi, filingStatus, isREP, activeParticipation])

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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Rental Tax Calculator</h3>
        <p className="text-xs text-slate-500">
          Calculate Schedule E rental income/loss, apply passive activity loss rules (§469),
          model the $25K active participation exception, and see your true tax impact.
        </p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Income & Depreciation</p>
          <Slider label="Gross Annual Rent" value={grossRent} min={0} max={200000} step={1000} onChange={setGrossRent} prefix="$" />
          <Slider label="Vacancy Rate" value={vacancy} min={0} max={30} step={1} onChange={setVacancy} suffix="%" />
          <Slider label="Property Value (for depreciation)" value={homeValue} min={50000} max={2000000} step={10000} onChange={setHomeValue} prefix="$" />
          <Slider label="Land Value (not depreciable)" value={landValue} min={0} max={500000} step={5000} onChange={setLandValue} prefix="$" />
          <div className="bg-slate-900/60 rounded-lg p-2 text-xs text-center">
            <span className="text-slate-500">Annual Depreciation: </span>
            <span className="font-black text-blue-400">{fmt(calc.depreciation)}</span>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Expenses</p>
          <Slider label="Mortgage Interest" value={mortgageInterest} min={0} max={60000} step={500} onChange={setMortgageInterest} prefix="$" />
          <Slider label="Property Taxes" value={propTax} min={0} max={30000} step={200} onChange={setPropTax} prefix="$" />
          <Slider label="Insurance" value={insurance} min={0} max={10000} step={100} onChange={setInsurance} prefix="$" />
          <Slider label="Repairs & Maintenance" value={repairs} min={0} max={30000} step={200} onChange={setRepairs} prefix="$" />
          <Slider label="Property Management" value={management} min={0} max={20000} step={100} onChange={setManagement} prefix="$" />
          <Slider label="Utilities" value={utilities} min={0} max={10000} step={100} onChange={setUtilities} prefix="$" />
          <Slider label="Advertising" value={advertising} min={0} max={2000} step={50} onChange={setAdvertising} prefix="$" />
        </div>
      </div>

      {/* Taxpayer profile */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Your Tax Profile</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-400">Filing Status</label>
              <select value={filingStatus} onChange={e => setFilingStatus(e.target.value as 'single' | 'mfj')}
                className="mt-1 w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200">
                <option value="mfj">Married Filing Jointly</option>
                <option value="single">Single</option>
              </select>
            </div>
            <Slider label="Other AGI (W-2, business, etc.)" value={agi} min={0} max={500000} step={5000} onChange={setAgi} prefix="$" />
            <Slider label="Prior-Year PAL Carryover" value={priorCarryover} min={0} max={100000} step={500} onChange={setPriorCarryover} prefix="$" />
          </div>
          <div className="sm:col-span-2 space-y-3">
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <input type="checkbox" id="active" checked={activeParticipation} onChange={e => setActiveParticipation(e.target.checked)} className="w-4 h-4 accent-blue-500 mt-0.5" />
                <label htmlFor="active" className="text-xs text-slate-400">
                  <strong className="text-slate-300">Active Participation</strong> — I own ≥10% and make management decisions
                  (approve tenants, set rents, authorize repairs). Enables up to $25K deduction if AGI ≤ $150K.
                </label>
              </div>
              <div className="flex items-start gap-2">
                <input type="checkbox" id="rep" checked={isREP} onChange={e => setIsREP(e.target.checked)} className="w-4 h-4 accent-blue-500 mt-0.5" />
                <label htmlFor="rep" className="text-xs text-slate-400">
                  <strong className="text-slate-300">Real Estate Professional (REP)</strong> — I spend 750+ hours/year in RE
                  AND more time in RE than any other profession. Eliminates all passive loss limits.
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule E summary */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Schedule E Summary</p>
        <div className="space-y-1.5 text-sm">
          {[
            { label: 'Gross Rental Income',          val: fmt(calc.effectiveRent),                  color: 'text-green-400' },
            { label: '  – Total Expenses + Depreciation', val: `-${fmt(calc.totalExpenses)}`,        color: 'text-red-400' },
            { label: 'Net Income / (Loss)',           val: fmt(calc.netIncomeLoss),                  color: calc.netIncomeLoss >= 0 ? 'text-white' : 'text-orange-400', bold: true },
            { label: '  + Prior-Year Carryover',     val: calc.isLoss ? `+${fmt(priorCarryover)}` : '—', color: 'text-slate-400' },
            { label: 'Total PAL Available',           val: fmt(calc.totalPAL),                       color: 'text-yellow-400' },
            { label: '  Active Participation Limit', val: fmt(calc.allowedExc),                     color: 'text-blue-400' },
            { label: 'Deductible This Year',          val: fmt(calc.deductibleNow),                  color: 'text-green-400', bold: true },
            { label: 'Carried Forward to Next Year',  val: fmt(calc.carryforward),                   color: 'text-slate-400' },
          ].filter(r => !(r.label.startsWith('  +') && priorCarryover === 0)).map(r => (
            <div key={r.label} className="flex justify-between py-1 border-b border-slate-700/30">
              <span className="text-xs text-slate-400">{r.label}</span>
              <span className={`text-xs font-${r.bold ? 'black' : 'semibold'} ${r.color}`}>{r.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tax impact */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Your Marginal Rate',      val: calc.taxRate + '%',                   color: 'text-white' },
          { label: 'Tax Savings This Year',   val: calc.isLoss ? fmt(calc.taxSavingsNow) : '—', color: 'text-green-400' },
          { label: 'Tax on Rental Income',    val: !calc.isLoss ? fmt(calc.taxOnRentalIncome) : '—', color: 'text-red-400' },
          { label: 'NIIT (3.8%)',             val: calc.niit > 0 ? fmt(calc.niit) : 'N/A', color: 'text-orange-400' },
          { label: 'Net Tax Impact',          val: fmt(Math.abs(calc.totalTaxImpact)), color: calc.totalTaxImpact < 0 ? 'text-green-400' : 'text-red-400', label2: calc.totalTaxImpact < 0 ? 'Saves' : 'Costs' },
          { label: 'REP Bonus (if qualified)',val: isREP ? '—' : fmt(calc.repBenefit),   color: 'text-purple-400' },
          { label: 'Effective Cash Yield',    val: ((calc.effectiveRent - calc.totalExpenses + calc.depreciation + calc.taxSavingsNow) / homeValue * 100).toFixed(1) + '%', color: 'text-blue-400' },
          { label: 'Carry to Next Year',      val: fmt(calc.carryforward),              color: calc.carryforward > 0 ? 'text-yellow-400' : 'text-slate-500' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-lg font-black ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* AGI phase-out chart */}
      {!isREP && calc.isLoss && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">$25K Exception Phase-Out by AGI</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={calc.agiChart} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="agi" tick={{ fill: '#64748b', fontSize: 9 }} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(v: number, name: string) => [fmt(v), name === 'deductible' ? 'Deductible Loss' : 'Tax Savings']} />
              <Bar dataKey="deductible" name="Deductible Loss" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="taxSavings" name="Tax Savings"     fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-600 text-center mt-2">
            Exception phases from $25K (at AGI ≤ $100K) to $0 (at AGI ≥ $150K)
          </p>
        </div>
      )}

      {/* Expense breakdown */}
      {calc.expenseItems.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">Expense Breakdown</p>
          <div className="space-y-2">
            {calc.expenseItems.map(e => (
              <div key={e.name} className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-36 flex-shrink-0">{e.name}</span>
                <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                  <div className="h-1.5 bg-blue-500 rounded-full"
                    style={{ width: `${Math.min((e.val / calc.totalExpenses) * 100, 100)}%` }} />
                </div>
                <span className="text-xs text-slate-300 font-semibold w-20 text-right">{fmt(e.val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REP info */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Tax Strategy Notes</p>
        <div className="space-y-1.5 text-xs text-slate-400">
          {[
            '📋 Schedule E losses from passive rental activity are limited by §469 — they can\'t offset W-2 wages without an exception.',
            '🏠 Active participation is the easy bar: manage your rental yourself, own ≥10%, and losses up to $25K offset ordinary income (phases out $100K–$150K AGI).',
            '⏰ Real Estate Professional status (REP) eliminates all passive limits — but requires 750+ hrs AND more RE hours than all other work combined. Married couples: only one spouse must qualify.',
            '📦 PAL carryforwards are released when the property is sold — so those "useless" losses do eventually save you money.',
            '💡 Cost segregation accelerates depreciation into 5/15-yr property — creates bigger losses in early years.',
            '🔢 Depreciation on residential rental = 27.5 years straight-line. Land is NOT depreciable — subtract it from the cost basis.',
            '📊 NIIT (3.8%) on net investment income applies if AGI > $200K single / $250K MFJ, and applies to rental income (not losses).',
            '🔄 Converting to REP mid-year: you can group all RE activities into one for the hours test — see IRS Reg 1.469-9.',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
