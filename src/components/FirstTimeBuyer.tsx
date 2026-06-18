import { useState } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

interface LoanProgram {
  id: string
  name: string
  icon: string
  tag: string
  minDown: number
  minCreditScore: number
  maxDTI: number
  maxLoanLimit: number
  pmi: string
  pros: string[]
  cons: string[]
  eligibility: string
  color: string
}

const PROGRAMS: LoanProgram[] = [
  {
    id: 'conventional',
    name: 'Conventional (Fannie/Freddie)',
    icon: '🏦',
    tag: 'Most Common',
    minDown: 3,
    minCreditScore: 620,
    maxDTI: 45,
    maxLoanLimit: 766550,
    pmi: 'Required below 20% down; cancellable at 20% equity',
    pros: ['No upfront mortgage insurance', 'PMI cancellable', 'Available for investment properties', 'Widest lender choice'],
    cons: ['Stricter credit requirements than FHA', 'Higher rates with lower credit', 'PMI required < 20% down'],
    eligibility: 'Any primary/second home or investment. Credit score 620+.',
    color: '#3b82f6',
  },
  {
    id: 'fha',
    name: 'FHA Loan',
    icon: '🏛',
    tag: 'Low Credit OK',
    minDown: 3.5,
    minCreditScore: 580,
    maxDTI: 57,
    maxLoanLimit: 498257,
    pmi: 'Upfront MIP (1.75%) + annual MIP for life of loan (if down < 10%)',
    pros: ['Low credit score accepted (580+)', 'High DTI allowed', 'Gift funds OK for down payment', '3.5% minimum down'],
    cons: ['Lifetime mortgage insurance (if < 10% down)', '1.75% upfront MIP', 'Must be primary residence', 'Loan limits may restrict high-cost areas'],
    eligibility: 'Primary residence only. Must meet income and property condition standards.',
    color: '#22c55e',
  },
  {
    id: 'va',
    name: 'VA Loan',
    icon: '🎖️',
    tag: 'Veterans Only',
    minDown: 0,
    minCreditScore: 580,
    maxDTI: 60,
    maxLoanLimit: 0,
    pmi: 'No PMI. Funding fee (1.4–3.6%) waived for disabled veterans.',
    pros: ['0% down payment', 'No PMI ever', 'Competitive rates', 'Lenient credit standards', 'No loan limit (full entitlement)'],
    cons: ['VA funding fee required (unless exempt)', 'Primary residence only', 'Eligible veterans/active duty only', 'VA appraisal required'],
    eligibility: 'Active duty, veterans, surviving spouses. Service minimums apply.',
    color: '#a855f7',
  },
  {
    id: 'usda',
    name: 'USDA Rural Development',
    icon: '🌾',
    tag: 'Rural Areas',
    minDown: 0,
    minCreditScore: 640,
    maxDTI: 41,
    maxLoanLimit: 0,
    pmi: '1% upfront guarantee fee + 0.35% annual fee (much lower than FHA)',
    pros: ['0% down payment', 'Low mortgage insurance', 'No loan limits', 'Competitive rates'],
    cons: ['Geographic restrictions (rural/suburban areas)', 'Income limits apply', 'Primary residence only', 'Longer processing times'],
    eligibility: 'Property must be in eligible rural/suburban area. Household income limits apply (typically 115% of area median).',
    color: '#10b981',
  },
  {
    id: 'heloc_bridge',
    name: 'Jumbo Loan',
    icon: '🏰',
    tag: 'High Value',
    minDown: 10,
    minCreditScore: 700,
    maxDTI: 43,
    maxLoanLimit: 99999999,
    pmi: 'Varies; many jumbos offer no-PMI options at 20%+ down',
    pros: ['Finance high-value properties', 'Flexible terms', 'No loan limits', 'Competitive rates for strong borrowers'],
    cons: ['Strict credit/income requirements', 'Larger down payment required', 'Held in lender portfolio — stricter guidelines', 'Harder to qualify'],
    eligibility: 'Loan amounts exceeding conforming limit ($766,550 in 2024 for most areas). Strong financial profile required.',
    color: '#f59e0b',
  },
]

const DOWN_ASSISTANCE = [
  { name: 'HUD First-Time Homebuyer Assistance', desc: 'Federal programs including HUD-approved housing counseling. Visit hud.gov/buying for state-specific programs.', type: 'federal' },
  { name: 'State Housing Finance Agency (HFA)', desc: 'Every state has an HFA offering below-market rates, down payment grants, and first-time buyer programs. Income limits often apply.', type: 'state' },
  { name: 'Fannie Mae HomeReady®', desc: '3% down for income-qualified buyers. Counts roommate rent as income. Requires homebuyer education.', type: 'program' },
  { name: 'Freddie Mac Home Possible®', desc: '3% down for income-qualified buyers. Lower PMI rates. No minimum contribution required from borrower.', type: 'program' },
  { name: 'Bank of America Community Homeownership Commitment', desc: 'Up to $17,500 in down payment and closing cost grants in eligible markets. No repayment required.', type: 'grant' },
  { name: 'Employer Assistance Programs', desc: 'Many employers (hospitals, universities, cities) offer down payment assistance to employees. Check your HR department.', type: 'employer' },
  { name: 'IRA First-Time Buyer Exception', desc: 'Withdraw up to $10,000 from IRA without 10% early withdrawal penalty for first home purchase. Taxes still due on traditional IRA.', type: 'ira' },
  { name: 'Gift Funds', desc: 'Family gifts can often cover down payment + closing costs. FHA requires gift letter. Conventional allows 100% gift for 20%+ down.', type: 'gift' },
]

const CHECKLIST = [
  { category: 'Credit', items: ['Check credit score at all 3 bureaus (Equifax, Experian, TransUnion)', 'Dispute any errors on credit reports', 'Pay down credit card balances below 30% utilization', 'Avoid opening new credit accounts'] },
  { category: 'Savings', items: ['Build 3–5% for down payment + 2–5% for closing costs', 'Keep funds in verifiable accounts (2+ month history)', 'Build 3–6 month emergency fund separate from home fund', 'Document any large deposits (gift letters, sale proceeds)'] },
  { category: 'Income & Employment', items: ['Maintain stable employment (2+ years preferred)', 'Avoid job changes during the loan process', 'Gather W-2s, tax returns (2yr), pay stubs, bank statements', 'Document self-employment income carefully'] },
  { category: 'Pre-Approval', items: ['Shop 2–3 lenders to compare rates and fees', 'Get pre-approved (not just pre-qualified)', 'Understand your PITI and true monthly cost', 'Know your max loan amount vs comfortable payment'] },
  { category: 'Home Search', items: ['Define must-haves vs nice-to-haves', 'Research school districts even if no kids (affects resale)', 'Check walkability and commute', 'Attend open houses to calibrate expectations'] },
  { category: 'Offer & Close', items: ['Budget for inspection ($300–$600), appraisal ($350–$700)', 'Negotiate seller concessions if market allows', 'Get homeowner\'s insurance quotes before closing', 'Wire funds only after verbal + email confirmation from title company'] },
]

export default function FirstTimeBuyer() {
  const { result } = usePropertyStore()
  const [selectedProgram, setSelectedProgram] = useState('fha')
  const [creditScore, setCreditScore] = useState(680)
  const [downSaved, setDownSaved] = useState(25000)
  const [annualIncome, setAnnualIncome] = useState(75000)
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())

  const targetPrice = result?.estimatedValue ?? 350000

  const eligible = PROGRAMS.filter(p => {
    const qualifiesCredit = creditScore >= p.minCreditScore
    const qualifiesDTI   = true
    return qualifiesCredit && qualifiesDTI
  })

  const activeProgram = PROGRAMS.find(p => p.id === selectedProgram) ?? PROGRAMS[0]
  const minDownNeeded = targetPrice * activeProgram.minDown / 100
  const downGap       = Math.max(0, minDownNeeded - downSaved)

  const typeColors: Record<string, string> = {
    federal: 'bg-blue-900/30 text-blue-400 border-blue-700/40',
    state:   'bg-green-900/30 text-green-400 border-green-700/40',
    program: 'bg-purple-900/30 text-purple-400 border-purple-700/40',
    grant:   'bg-yellow-900/30 text-yellow-400 border-yellow-700/40',
    employer:'bg-orange-900/30 text-orange-400 border-orange-700/40',
    ira:     'bg-teal-900/30 text-teal-400 border-teal-700/40',
    gift:    'bg-pink-900/30 text-pink-400 border-pink-700/40',
  }

  const totalChecked = checkedItems.size
  const totalItems   = CHECKLIST.flatMap(c => c.items).length

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">First-Time Buyer Guide</h3>
        <p className="text-xs text-slate-500">
          Compare loan programs, find down payment assistance, and track your readiness checklist.
        </p>
      </div>

      {/* Profile inputs */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Your Profile</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Credit Score',      value: creditScore,  min: 500, max: 850, step: 5,    set: setCreditScore,  fmt: (v: number) => `${v}` },
            { label: 'Down Payment Saved', value: downSaved,   min: 0,   max: 200000, step: 1000, set: setDownSaved, fmt: (v: number) => fmt(v) },
            { label: 'Annual Income',     value: annualIncome, min: 25000, max: 500000, step: 5000, set: setAnnualIncome, fmt: (v: number) => fmt(v) },
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
        <p className="text-xs text-slate-500">
          Based on your profile, you qualify for:{' '}
          {eligible.map(p => (
            <span key={p.id} className="mr-2 font-semibold" style={{ color: p.color }}>{p.icon} {p.name.split(' ')[0]}</span>
          ))}
        </p>
      </div>

      {/* Loan program tabs */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Loan Program Comparison</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {PROGRAMS.map(p => {
            const isEligible = creditScore >= p.minCreditScore
            return (
              <button key={p.id}
                onClick={() => setSelectedProgram(p.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  selectedProgram === p.id ? 'text-white' : isEligible ? 'text-slate-400 hover:text-slate-200 bg-slate-700 hover:bg-slate-600' : 'text-slate-600 bg-slate-800 opacity-50'
                }`}
                style={selectedProgram === p.id ? { backgroundColor: p.color } : {}}>
                {p.icon} {p.name.split(' ')[0]}
                {!isEligible && <span className="text-red-400 ml-1">✗</span>}
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{activeProgram.icon}</span>
              <div>
                <p className="text-sm font-bold text-white">{activeProgram.name}</p>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: activeProgram.color + '33', color: activeProgram.color }}>{activeProgram.tag}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { label: 'Min Down',    value: `${activeProgram.minDown}%${activeProgram.minDown > 0 ? ` (${fmt(targetPrice * activeProgram.minDown / 100)})` : ''}` },
                { label: 'Min Credit', value: `${activeProgram.minCreditScore}${creditScore >= activeProgram.minCreditScore ? ' ✓' : ' ✗'}` },
                { label: 'Max DTI',    value: `${activeProgram.maxDTI}%` },
                { label: 'Loan Limit', value: activeProgram.maxLoanLimit > 0 ? fmt(activeProgram.maxLoanLimit) : 'None' },
              ].map(s => (
                <div key={s.label} className="bg-slate-900/60 rounded-lg p-2 text-center">
                  <p className="text-slate-500 mb-0.5">{s.label}</p>
                  <p className="font-bold text-slate-200">{s.value}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Mortgage Insurance</p>
              <p className="text-xs text-slate-400">{activeProgram.pmi}</p>
            </div>

            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Eligibility</p>
              <p className="text-xs text-slate-400">{activeProgram.eligibility}</p>
            </div>

            {downGap > 0 && (
              <div className="bg-orange-900/20 border border-orange-700/30 rounded-lg p-3">
                <p className="text-xs text-orange-400 font-semibold">
                  You need {fmt(downGap)} more for {activeProgram.minDown}% down on this property.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-green-400 uppercase tracking-widest mb-2 font-bold">Pros</p>
              <ul className="space-y-1">
                {activeProgram.pros.map(p => (
                  <li key={p} className="text-xs text-slate-400 flex gap-2">
                    <span className="text-green-400 flex-shrink-0">✓</span>{p}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs text-red-400 uppercase tracking-widest mb-2 font-bold">Cons</p>
              <ul className="space-y-1">
                {activeProgram.cons.map(c => (
                  <li key={c} className="text-xs text-slate-400 flex gap-2">
                    <span className="text-red-400 flex-shrink-0">✗</span>{c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Down payment assistance */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Down Payment Assistance Programs</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DOWN_ASSISTANCE.map(da => (
            <div key={da.name} className={`rounded-lg p-3 border ${typeColors[da.type] ?? 'bg-slate-700/30 text-slate-400 border-slate-600'}`}>
              <p className="text-xs font-semibold mb-1">{da.name}</p>
              <p className="text-xs opacity-80">{da.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Readiness checklist */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <div className="flex justify-between items-center mb-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">First-Time Buyer Checklist</p>
          <span className="text-xs font-bold text-blue-400">{totalChecked}/{totalItems} complete</span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full mb-4 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-600 to-green-500 rounded-full transition-all"
            style={{ width: `${totalChecked / totalItems * 100}%` }} />
        </div>
        <div className="space-y-4">
          {CHECKLIST.map(cat => (
            <div key={cat.category}>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-2">{cat.category}</p>
              <div className="space-y-1.5">
                {cat.items.map(item => {
                  const key     = `${cat.category}:${item}`
                  const isDone  = checkedItems.has(key)
                  return (
                    <label key={item} className="flex items-start gap-2.5 cursor-pointer group">
                      <div
                        onClick={() => setCheckedItems(prev => {
                          const next = new Set(prev)
                          next.has(key) ? next.delete(key) : next.add(key)
                          return next
                        })}
                        className={`w-4 h-4 rounded flex-shrink-0 mt-0.5 border-2 flex items-center justify-center transition ${
                          isDone ? 'bg-green-500 border-green-500' : 'border-slate-600 group-hover:border-blue-400'}`}>
                        {isDone && <span className="text-white text-xs font-black">✓</span>}
                      </div>
                      <span className={`text-xs ${isDone ? 'text-slate-500 line-through' : 'text-slate-400'}`}>{item}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Loan limits and program requirements change annually. Verify current limits at fanniemae.com, FHA.gov, va.gov, and usda.gov.
        Work with a HUD-approved housing counselor (free) to navigate first-time buyer programs in your area.
      </p>
    </div>
  )
}
