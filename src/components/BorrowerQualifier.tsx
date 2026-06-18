import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
function fmtPct(n: number) { return `${n.toFixed(1)}%` }

function monthlyPmt(principal: number, annualRate: number, termYears: number) {
  const r = annualRate / 100 / 12
  const n = termYears * 12
  if (r === 0 || n === 0) return 0
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

// Binary search to find max home price at given DTI
function maxPriceAtDTI(grossMonthly: number, dtiLimit: number, otherDebts: number, rate: number, termYrs: number, downPct: number, taxInsMonthly: number, pmiRate: number) {
  let lo = 0, hi = 5000000
  for (let i = 0; i < 60; i++) {
    const mid     = (lo + hi) / 2
    const loan    = mid * (1 - downPct / 100)
    const pmi     = loan / mid > 0.80 ? loan * pmiRate / 100 / 12 : 0
    const piti    = monthlyPmt(loan, rate, termYrs) + taxInsMonthly + pmi
    const totalDebt = piti + otherDebts
    if (totalDebt / grossMonthly < dtiLimit / 100) lo = mid
    else hi = mid
  }
  return Math.floor((lo + hi) / 2)
}

interface LoanProgram {
  name: string
  minDown: number
  minScore: number
  maxDTI: number
  notes: string
  color: string
}

const PROGRAMS: LoanProgram[] = [
  { name: 'Conventional',   minDown: 3,   minScore: 620, maxDTI: 45, notes: 'Best rates w/ 20% down & 740+ score', color: '#3b82f6' },
  { name: 'FHA',            minDown: 3.5, minScore: 580, maxDTI: 57, notes: 'Easier qualify; MIP required regardless of down', color: '#8b5cf6' },
  { name: 'VA',             minDown: 0,   minScore: 580, maxDTI: 41, notes: 'Veterans/active duty; no PMI, no min down', color: '#22c55e' },
  { name: 'USDA',           minDown: 0,   minScore: 640, maxDTI: 41, notes: 'Rural/suburban eligible areas; income limits', color: '#f59e0b' },
]

export default function BorrowerQualifier() {
  const { result, interestRate } = usePropertyStore()

  const [annualIncome,    setAnnualIncome]    = useState(90000)
  const [coIncome,        setCoIncome]        = useState(0)
  const [carPayment,      setCarPayment]      = useState(400)
  const [studentLoan,     setStudentLoan]     = useState(200)
  const [creditCards,     setCreditCards]     = useState(150)
  const [otherDebt,       setOtherDebt]       = useState(0)
  const [creditScore,     setCreditScore]     = useState(720)
  const [downPayment,     setDownPayment]     = useState(40000)
  const [rate,            setRate]            = useState(interestRate)
  const [termYrs,         setTermYrs]         = useState(30)
  const [isVeteran,       setIsVeteran]       = useState(false)
  const [isRural,         setIsRural]         = useState(false)

  const analysis = useMemo(() => {
    const grossMonthly    = (annualIncome + coIncome) / 12
    const otherDebts      = carPayment + studentLoan + creditCards + otherDebt

    // Estimate property tax + insurance for a given price
    const taxInsForPrice  = (price: number) => price * 0.015 / 12  // ~1.5% combined
    const pmiRate         = 0.85

    // Max at 28% front-end (PITI only), 36%, 43%
    const maxAt28 = maxPriceAtDTI(grossMonthly, 28, 0, rate, termYrs, downPayment / 500000 * 100, taxInsForPrice(400000), pmiRate)
    const maxAt36 = maxPriceAtDTI(grossMonthly, 36, otherDebts, rate, termYrs, downPayment / 500000 * 100, taxInsForPrice(400000), pmiRate)
    const maxAt43 = maxPriceAtDTI(grossMonthly, 43, otherDebts, rate, termYrs, downPayment / 500000 * 100, taxInsForPrice(400000), pmiRate)

    // Subject property (from store)
    const targetPrice     = result?.estimatedValue ?? 400000
    const downPct         = targetPrice > 0 ? (downPayment / targetPrice) * 100 : 20
    const loanAmount      = Math.max(0, targetPrice - downPayment)
    const taxIns          = taxInsForPrice(targetPrice)
    const pmi             = (loanAmount / targetPrice) > 0.80 ? loanAmount * pmiRate / 100 / 12 : 0
    const pitiMonthly     = monthlyPmt(loanAmount, rate, termYrs) + taxIns + pmi
    const totalMonthlyDebt = pitiMonthly + otherDebts
    const frontEndDTI     = grossMonthly > 0 ? (pitiMonthly / grossMonthly) * 100 : 0
    const backEndDTI      = grossMonthly > 0 ? (totalMonthlyDebt / grossMonthly) * 100 : 0

    // Qualification status per program
    const qualifications = PROGRAMS.map(p => {
      if (p.name === 'VA' && !isVeteran)  return { ...p, eligible: false, reason: 'VA requires military service' }
      if (p.name === 'USDA' && !isRural)  return { ...p, eligible: false, reason: 'USDA requires rural location' }
      if (creditScore < p.minScore)        return { ...p, eligible: false, reason: `Score too low (need ${p.minScore}+)` }
      if (downPct < p.minDown)             return { ...p, eligible: false, reason: `Down too low (need ${p.minDown}% = ${fmt(targetPrice * p.minDown / 100)})` }
      if (backEndDTI > p.maxDTI)          return { ...p, eligible: false, reason: `DTI too high (${fmtPct(backEndDTI)} > ${p.maxDTI}%)` }
      return { ...p, eligible: true, reason: 'Qualifies' }
    })

    // Credit score tiers
    const scoreTier =
      creditScore >= 760 ? { label: 'Excellent', desc: 'Best rates available', color: '#22c55e' } :
      creditScore >= 720 ? { label: 'Very Good',  desc: 'Near-best rates',     color: '#84cc16' } :
      creditScore >= 680 ? { label: 'Good',        desc: 'Slightly higher rate', color: '#f59e0b' } :
      creditScore >= 620 ? { label: 'Fair',         desc: 'Higher rate, fewer options', color: '#f97316' } :
                            { label: 'Poor',         desc: 'Limited conventional options', color: '#ef4444' }

    const rateAdder =
      creditScore >= 760 ? 0 :
      creditScore >= 720 ? 0.25 :
      creditScore >= 680 ? 0.50 :
      creditScore >= 640 ? 0.875 : 1.5

    const debtIncomeData = [
      { name: 'Car',         value: carPayment,  color: '#f59e0b' },
      { name: 'Student',     value: studentLoan, color: '#8b5cf6' },
      { name: 'Credit Cards',value: creditCards, color: '#ef4444' },
      { name: 'Other',       value: otherDebt,   color: '#64748b' },
      { name: 'Housing',     value: Math.round(pitiMonthly), color: '#3b82f6' },
    ].filter(d => d.value > 0)

    return {
      grossMonthly, otherDebts, maxAt28, maxAt36, maxAt43,
      targetPrice, downPct, loanAmount, pitiMonthly, totalMonthlyDebt, frontEndDTI, backEndDTI,
      qualifications, scoreTier, rateAdder, debtIncomeData, pmi,
    }
  }, [annualIncome, coIncome, carPayment, studentLoan, creditCards, otherDebt, creditScore, downPayment, rate, termYrs, isVeteran, isRural, result])

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Mortgage Qualifier</h3>
        <p className="text-xs text-slate-500">
          See how much you can borrow, which loan programs you qualify for, and where you stand
          on front-end and back-end debt-to-income ratios.
        </p>
      </div>

      {/* Max price at DTI limits */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Max at 28% DTI', value: fmt(analysis.maxAt28), desc: 'Conservative', color: '#22c55e' },
          { label: 'Max at 36% DTI', value: fmt(analysis.maxAt36), desc: 'Standard',     color: '#3b82f6' },
          { label: 'Max at 43% DTI', value: fmt(analysis.maxAt43), desc: 'Stretched',    color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-slate-600 mt-0.5">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Income & Profile</p>
          {[
            { label: 'Annual Gross Income',    value: annualIncome, min: 20000, max: 1000000, step: 5000, set: setAnnualIncome, fmt: fmt },
            { label: 'Co-Borrower Income',     value: coIncome,     min: 0,     max: 500000,  step: 5000, set: setCoIncome,     fmt: fmt },
            { label: 'Down Payment ($)',        value: downPayment,  min: 0,     max: 500000,  step: 2500, set: setDownPayment,  fmt: fmt },
            { label: 'Interest Rate',           value: rate,         min: 3,     max: 12,      step: 0.125, set: setRate,        fmt: (v: number) => `${v.toFixed(3)}%` },
            { label: 'Credit Score',            value: creditScore,  min: 500,   max: 850,     step: 10,   set: setCreditScore,  fmt: (v: number) => `${v}` },
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

          {/* Credit score tier */}
          <div className="rounded-lg px-3 py-2 text-xs text-center font-bold" style={{ background: analysis.scoreTier.color + '22', color: analysis.scoreTier.color, border: `1px solid ${analysis.scoreTier.color}44` }}>
            {creditScore} — {analysis.scoreTier.label}: {analysis.scoreTier.desc}
            {analysis.rateAdder > 0 && <span className="ml-1 text-slate-400 font-normal">(+{analysis.rateAdder}% to rate estimate)</span>}
          </div>

          <div className="flex gap-4 pt-1">
            {[
              { label: 'Military / Veteran (VA)', val: isVeteran, set: setIsVeteran },
              { label: 'Rural / Suburban (USDA)', val: isRural,   set: setIsRural },
            ].map(c => (
              <label key={c.label} className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-400 hover:text-slate-200">
                <div className={`w-9 h-4.5 rounded-full transition-colors ${c.val ? 'bg-blue-600' : 'bg-slate-700'}`}
                  style={{ height: 18 }}
                  onClick={() => c.set(!c.val)}>
                  <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform mt-0.5 ${c.val ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                {c.label}
              </label>
            ))}
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Monthly Debts</p>
          {[
            { label: 'Car Payment(s)',    value: carPayment,  min: 0, max: 2000, step: 25,  set: setCarPayment,  color: '#f59e0b' },
            { label: 'Student Loans',     value: studentLoan, min: 0, max: 2000, step: 25,  set: setStudentLoan, color: '#8b5cf6' },
            { label: 'Min. Credit Cards', value: creditCards, min: 0, max: 1000, step: 25,  set: setCreditCards, color: '#ef4444' },
            { label: 'Other Debt',        value: otherDebt,   min: 0, max: 2000, step: 25,  set: setOtherDebt,   color: '#64748b' },
          ].map(s => (
            <div key={s.label}>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-slate-400 uppercase tracking-widest">{s.label}</label>
                <span className="text-xs font-bold" style={{ color: s.color }}>{fmt(s.value)}/mo</span>
              </div>
              <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                onChange={e => s.set(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: s.color }} />
            </div>
          ))}

          <div className="bg-slate-900/60 rounded-lg p-3 space-y-1.5 text-xs mt-2">
            <div className="flex justify-between"><span className="text-slate-500">Gross Monthly Income</span><span className="text-white">{fmt(analysis.grossMonthly)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Non-housing debts</span><span className="text-yellow-400">{fmt(analysis.otherDebts)}/mo</span></div>
            <div className="flex justify-between"><span className="text-slate-500">PITI (target property)</span><span className="text-blue-400">{fmt(analysis.pitiMonthly)}/mo</span></div>
            {analysis.pmi > 0 && <div className="flex justify-between"><span className="text-slate-500">PMI included</span><span className="text-slate-400">{fmt(analysis.pmi)}/mo</span></div>}
            <div className={`flex justify-between border-t border-slate-700 pt-1.5 font-bold ${analysis.frontEndDTI > 28 ? 'text-yellow-400' : 'text-green-400'}`}>
              <span>Front-end DTI</span><span>{fmtPct(analysis.frontEndDTI)} / 28% limit</span>
            </div>
            <div className={`flex justify-between font-bold ${analysis.backEndDTI > 43 ? 'text-red-400' : analysis.backEndDTI > 36 ? 'text-yellow-400' : 'text-green-400'}`}>
              <span>Back-end DTI</span><span>{fmtPct(analysis.backEndDTI)} / 43% limit</span>
            </div>
          </div>
        </div>
      </div>

      {/* Loan program eligibility */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Loan Program Eligibility</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {analysis.qualifications.map(q => (
            <div key={q.name} className={`rounded-xl p-3 border ${q.eligible ? 'bg-green-900/20 border-green-800/50' : 'bg-slate-900/40 border-slate-700'}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: q.color }} />
                <span className="text-xs font-bold text-slate-200">{q.name}</span>
                <span className={`ml-auto text-xs font-bold ${q.eligible ? 'text-green-400' : 'text-slate-500'}`}>
                  {q.eligible ? '✓ Eligible' : '✗ ' + q.reason}
                </span>
              </div>
              <p className="text-xs text-slate-500">{q.notes}</p>
              <div className="flex gap-3 mt-2 text-xs text-slate-500">
                <span>Min {q.minDown}% down</span>
                <span>Min {q.minScore} score</span>
                <span>Max {q.maxDTI}% DTI</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Debt breakdown chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Monthly Debt vs Income (back-end DTI)</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={analysis.debtIncomeData} layout="vertical" margin={{ top: 0, right: 40, left: 70, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
            <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false}
              tickFormatter={v => `$${v}`} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} width={65} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number) => [fmt(v), 'Monthly']} />
            <ReferenceLine x={analysis.grossMonthly * 0.43} stroke="#f59e0b" strokeDasharray="4 4"
              label={{ value: '43% DTI', fill: '#f59e0b', fontSize: 9, position: 'right' }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {analysis.debtIncomeData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Max loan amounts are estimates using simplified property tax/insurance assumptions.
        Actual qualification depends on full underwriting, employment history, assets, and lender overlays.
      </p>
    </div>
  )
}
