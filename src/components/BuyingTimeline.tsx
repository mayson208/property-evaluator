import { useState } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

interface Step {
  id: string
  phase: string
  title: string
  duration: string
  daysMin: number
  daysMax: number
  description: string
  costs: { label: string; low: number; high: number }[]
  tips: string[]
  color: string
}

const STEPS: Step[] = [
  {
    id: 'finances',
    phase: 'Prepare',
    title: 'Get Finances in Order',
    duration: '1–3 months',
    daysMin: 30, daysMax: 90,
    description: 'Check credit score, pay down debts, gather financial documents, build emergency fund.',
    costs: [
      { label: 'Credit monitoring', low: 0, high: 25 },
      { label: 'Financial advisor (optional)', low: 0, high: 300 },
    ],
    tips: ['Target 620+ credit score for conventional loans, 580+ for FHA', 'Avoid new credit or large purchases during this phase'],
    color: '#6366f1',
  },
  {
    id: 'preapproval',
    phase: 'Prepare',
    title: 'Get Pre-Approved',
    duration: '3–10 days',
    daysMin: 3, daysMax: 10,
    description: 'Submit loan application, provide income and asset docs. Lender issues pre-approval letter.',
    costs: [
      { label: 'Credit pull fee', low: 0, high: 50 },
    ],
    tips: ['Get pre-approved from 2–3 lenders to compare rates', 'Pre-approval letter is typically good for 60–90 days'],
    color: '#8b5cf6',
  },
  {
    id: 'search',
    phase: 'Search',
    title: 'House Hunt',
    duration: '1–6 months',
    daysMin: 30, daysMax: 180,
    description: 'Work with a buyer\'s agent to tour properties, compare against your criteria, and find your home.',
    costs: [
      { label: 'Buyer\'s agent (often free)', low: 0, high: 0 },
      { label: 'Gas / travel to tours', low: 50, high: 500 },
    ],
    tips: ['Use a buyer\'s agent — typically paid by the seller', 'Create a "must-have" vs "nice-to-have" list before touring'],
    color: '#3b82f6',
  },
  {
    id: 'offer',
    phase: 'Offer',
    title: 'Make an Offer',
    duration: '1–7 days',
    daysMin: 1, daysMax: 7,
    description: 'Submit written offer with purchase price, contingencies (inspection, financing, appraisal), and earnest money.',
    costs: [
      { label: 'Earnest money deposit (credited at close)', low: 1000, high: 10000 },
    ],
    tips: ['Earnest money is 1–2% of purchase price in most markets', 'Include an escalation clause in competitive markets'],
    color: '#0ea5e9',
  },
  {
    id: 'inspection',
    phase: 'Due Diligence',
    title: 'Home Inspection',
    duration: '3–7 days',
    daysMin: 3, daysMax: 7,
    description: 'Hire a licensed inspector to evaluate the property condition. Negotiate repairs or credits based on findings.',
    costs: [
      { label: 'General home inspection', low: 300, high: 600 },
      { label: 'Radon test', low: 100, high: 200 },
      { label: 'Sewer scope (optional)', low: 150, high: 350 },
      { label: 'Pest inspection', low: 75, high: 150 },
    ],
    tips: ['Always get an inspection — even on new construction', 'Attend the inspection in person to ask questions'],
    color: '#14b8a6',
  },
  {
    id: 'appraisal',
    phase: 'Due Diligence',
    title: 'Appraisal',
    duration: '1–3 weeks',
    daysMin: 7, daysMax: 21,
    description: 'Lender orders an appraisal to confirm the home\'s value. Required for all financed purchases.',
    costs: [
      { label: 'Appraisal fee', low: 350, high: 700 },
    ],
    tips: ['If appraisal comes in low, renegotiate price or challenge with comps', 'Appraisal is ordered by the lender but paid by the buyer'],
    color: '#10b981',
  },
  {
    id: 'underwriting',
    phase: 'Financing',
    title: 'Underwriting & Final Loan Approval',
    duration: '2–4 weeks',
    daysMin: 14, daysMax: 28,
    description: 'Underwriter reviews all documentation. May request additional docs (conditions). Loan is approved, denied, or suspended.',
    costs: [
      { label: 'Nothing due — wait period', low: 0, high: 0 },
    ],
    tips: ['Do NOT change jobs, open new credit, or make large purchases during underwriting', 'Respond to document requests within 24 hours to avoid delays'],
    color: '#f59e0b',
  },
  {
    id: 'closing_disclosure',
    phase: 'Closing',
    title: 'Closing Disclosure Review',
    duration: '3 days (mandatory)',
    daysMin: 3, daysMax: 3,
    description: 'Lender sends final Closing Disclosure at least 3 business days before closing. Review all line items carefully.',
    costs: [
      { label: 'Review only — no payment yet', low: 0, high: 0 },
    ],
    tips: ['Compare CD to your Loan Estimate — flag any unexpected changes', 'RESPA requires 3 business days minimum before closing'],
    color: '#ef4444',
  },
  {
    id: 'final_walkthrough',
    phase: 'Closing',
    title: 'Final Walk-Through',
    duration: '1 day',
    daysMin: 1, daysMax: 1,
    description: 'Verify property condition hasn\'t changed since inspection. Confirm agreed repairs were completed.',
    costs: [
      { label: 'No cost', low: 0, high: 0 },
    ],
    tips: ['Check all appliances, HVAC, plumbing', 'Bring your inspection report and list of agreed repairs'],
    color: '#f97316',
  },
  {
    id: 'closing',
    phase: 'Closing',
    title: 'Closing Day',
    duration: '2–4 hours',
    daysMin: 0, daysMax: 0,
    description: 'Sign loan documents, pay closing costs and down payment, receive keys. Title transfers to you.',
    costs: [
      { label: 'Down payment (20% example)', low: 40000, high: 200000 },
      { label: 'Closing costs (2–5%)', low: 4000, high: 25000 },
      { label: 'Prepaid interest (varies)', low: 500, high: 3000 },
      { label: 'Homeowner\'s insurance (first year)', low: 800, high: 3000 },
      { label: 'Property tax escrow', low: 1000, high: 5000 },
    ],
    tips: ['Wire funds 24–48 hours before closing — avoid wire fraud scams', 'Bring government-issued ID'],
    color: '#22c55e',
  },
]

export default function BuyingTimeline() {
  const { result } = usePropertyStore()
  const [expanded, setExpanded] = useState<string | null>('finances')
  const [checked,  setChecked]  = useState<Set<string>>(new Set())

  const purchasePrice = result?.estimatedValue ?? 400000

  const totalDaysMin = STEPS.reduce((s, st) => s + st.daysMin, 0)
  const totalDaysMax = STEPS.reduce((s, st) => s + st.daysMax, 0)

  const totalCostLow  = STEPS.flatMap(st => st.costs).reduce((s, c) => s + c.low, 0)
  const totalCostHigh = STEPS.flatMap(st => st.costs).reduce((s, c) => s + c.high, 0)

  const phases = ['Prepare', 'Search', 'Offer', 'Due Diligence', 'Financing', 'Closing']
  const phaseColors: Record<string, string> = {
    Prepare: 'bg-indigo-500', Search: 'bg-blue-500', Offer: 'bg-sky-500',
    'Due Diligence': 'bg-teal-500', Financing: 'bg-amber-500', Closing: 'bg-green-500',
  }

  const phaseDots: Record<string, string> = {
    Prepare: 'bg-indigo-400', Search: 'bg-blue-400', Offer: 'bg-sky-400',
    'Due Diligence': 'bg-teal-400', Financing: 'bg-amber-400', Closing: 'bg-green-400',
  }

  const completedSteps = STEPS.filter(s => checked.has(s.id)).length

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Home Buying Timeline</h3>
        <p className="text-xs text-slate-500">
          Step-by-step guide from prep to keys in hand. Typical process: {Math.round(totalDaysMin / 7)}–{Math.round(totalDaysMax / 7)} weeks.
        </p>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Timeline', value: `${Math.round(totalDaysMin / 7)}–${Math.round(totalDaysMax / 7)} weeks`, color: 'text-blue-400' },
          { label: 'Upfront Costs', value: `${fmt(totalCostLow + (purchasePrice * 0.05))}+`, color: 'text-orange-400' },
          { label: 'Steps Completed', value: `${completedSteps} / ${STEPS.length}`, color: completedSteps === STEPS.length ? 'text-green-400' : 'text-slate-300' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Phase legend */}
      <div className="flex flex-wrap gap-2">
        {phases.map(p => (
          <span key={p} className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className={`w-2 h-2 rounded-full ${phaseDots[p]}`} />
            {p}
          </span>
        ))}
      </div>

      {/* Progress bar */}
      <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-slate-500">Your progress</span>
          <span className="text-blue-400 font-bold">{Math.round(completedSteps / STEPS.length * 100)}%</span>
        </div>
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 via-blue-500 to-green-500 rounded-full transition-all duration-500"
            style={{ width: `${completedSteps / STEPS.length * 100}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {STEPS.map((step, idx) => {
          const isExpanded = expanded === step.id
          const isDone     = checked.has(step.id)
          return (
            <div key={step.id}
              className={`rounded-xl border transition-all ${isDone ? 'border-green-700/30 bg-green-900/10' : 'border-slate-700 bg-slate-800/50'}`}>
              <div
                className="flex items-center gap-3 p-4 cursor-pointer"
                onClick={() => setExpanded(isExpanded ? null : step.id)}>
                <button
                  onClick={e => {
                    e.stopPropagation()
                    setChecked(prev => {
                      const next = new Set(prev)
                      next.has(step.id) ? next.delete(step.id) : next.add(step.id)
                      return next
                    })
                  }}
                  className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition ${
                    isDone ? 'bg-green-500 border-green-500 text-white' : 'border-slate-600 hover:border-blue-400'}`}>
                  {isDone && <span className="text-xs font-bold">✓</span>}
                </button>

                <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-black text-white"
                  style={{ backgroundColor: step.color }}>
                  {idx + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${phaseColors[step.phase]}/20 text-slate-300`}>
                      {step.phase}
                    </span>
                    <p className={`text-sm font-semibold ${isDone ? 'text-slate-400 line-through' : 'text-slate-200'}`}>
                      {step.title}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{step.duration}</p>
                </div>

                <span className="text-slate-600 text-xs">{isExpanded ? '▲' : '▼'}</span>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-3">
                  <p className="text-xs text-slate-400 leading-relaxed">{step.description}</p>

                  {step.costs.some(c => c.high > 0) && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-widest mb-1.5">Typical Costs</p>
                      <div className="space-y-1">
                        {step.costs.map(c => (
                          <div key={c.label} className="flex justify-between text-xs">
                            <span className="text-slate-500">{c.label}</span>
                            <span className="text-orange-400 font-semibold">
                              {c.high === 0 ? 'Free' : c.low === c.high ? fmt(c.low) : `${fmt(c.low)} – ${fmt(c.high)}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-widest mb-1.5">Tips</p>
                    <ul className="space-y-1">
                      {step.tips.map(tip => (
                        <li key={tip} className="text-xs text-slate-400 flex gap-2">
                          <span className="text-blue-400 flex-shrink-0">→</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Estimated Out-of-Pocket Before Keys</p>
        <div className="space-y-1.5 text-xs">
          {[
            { label: 'Down Payment (using 20%)',      value: fmt(purchasePrice * 0.20), note: 'Depends on your down %' },
            { label: 'Closing Costs (2–5%)',          value: `${fmt(purchasePrice * 0.02)} – ${fmt(purchasePrice * 0.05)}`, note: '' },
            { label: 'Inspections & Due Diligence',   value: '$625 – $1,300',   note: '' },
            { label: 'Moving Costs',                  value: '$1,000 – $5,000', note: '' },
            { label: 'First-Year Insurance',          value: '$800 – $3,000',   note: '' },
            { label: 'Initial Repairs / Furnishings', value: 'Varies',          note: 'Budget 1–3% of purchase price' },
          ].map(r => (
            <div key={r.label} className="flex justify-between">
              <span className="text-slate-500">{r.label}</span>
              <span className="text-white font-semibold">{r.value}</span>
            </div>
          ))}
          <div className="border-t border-slate-700 pt-1.5 mt-1.5 flex justify-between font-bold">
            <span className="text-slate-300">Estimated Total (20% down on {fmt(purchasePrice)})</span>
            <span className="text-orange-400">{fmt(purchasePrice * 0.25)}</span>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Timelines vary by market, season, and transaction complexity. Cash purchases skip steps 2, 6, 7, and 8.
        FHA and VA loans have additional requirements.
      </p>
    </div>
  )
}
