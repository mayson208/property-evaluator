import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine, LineChart, Line } from 'recharts'

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

export default function AppraisalGap() {
  const { result, input, interestRate } = usePropertyStore()

  const appraisedValue = result?.estimatedValue ?? 350000

  const [offerPrice,    setOfferPrice]    = useState(Math.round(appraisedValue * 1.05))
  const [downPct,       setDownPct]       = useState(input.downPaymentPct ?? 10)
  const [rate,          setRate]          = useState(interestRate)
  const [termYrs,       setTermYrs]       = useState(30)
  const [pmiRate,       setPmiRate]       = useState(0.85)  // % of loan annually
  const [sellerCredit,  setSellerCredit]  = useState(0)
  const [priceReduce,   setPriceReduce]   = useState(0)

  const analysis = useMemo(() => {
    const gap             = Math.max(0, offerPrice - appraisedValue)
    const negotiatedPrice = offerPrice - priceReduce
    const effectiveGap    = Math.max(0, negotiatedPrice - appraisedValue)

    // Lender bases loan on appraised value (not offer)
    const downDollar         = offerPrice * downPct / 100
    const loanAmount         = appraisedValue - downDollar     // lender caps at appraised
    const cashNeededBase     = downDollar + effectiveGap - sellerCredit
    const ltv                = loanAmount > 0 ? (loanAmount / appraisedValue) * 100 : 0
    const hasPmi             = ltv > 80
    const monthlyPmiCost     = hasPmi ? loanAmount * pmiRate / 100 / 12 : 0

    const piti = monthlyPmt(Math.max(0, loanAmount), rate, termYrs) + monthlyPmiCost

    // Scenario: cover full gap
    const fullGapCash        = downDollar + gap - sellerCredit
    const fullGapLtv         = appraisedValue > 0 ? ((appraisedValue - downDollar) / appraisedValue) * 100 : 0
    const fullGapPmi         = fullGapLtv > 80 ? (appraisedValue - downDollar) * pmiRate / 100 / 12 : 0
    const fullGapMonthly     = monthlyPmt(Math.max(0, appraisedValue - downDollar), rate, termYrs) + fullGapPmi

    // Scenario: split gap 50/50 with seller
    const splitGap           = gap / 2
    const splitCash          = downDollar + splitGap - sellerCredit
    const splitPriceAdj      = offerPrice - splitGap
    const splitLoan          = appraisedValue - downDollar
    const splitPmi           = splitLoan > 0 && (splitLoan / appraisedValue) * 100 > 80 ? splitLoan * pmiRate / 100 / 12 : 0
    const splitMonthly       = monthlyPmt(Math.max(0, splitLoan), rate, termYrs) + splitPmi

    // Scenario: walk away / renegotiate to appraised value
    const renegotiatedLoan   = appraisedValue * (1 - downPct / 100)
    const renegotiatedCash   = appraisedValue * downPct / 100 - sellerCredit
    const renegotiatedLtv    = 100 - downPct
    const renegotiatedPmi    = renegotiatedLtv > 80 ? renegotiatedLoan * pmiRate / 100 / 12 : 0
    const renegotiatedMonthly = monthlyPmt(Math.max(0, renegotiatedLoan), rate, termYrs) + renegotiatedPmi

    // Monthly savings vs full gap
    const savingsVsFullGap   = fullGapMonthly - renegotiatedMonthly
    const savingsVsSplit      = fullGapMonthly - splitMonthly

    // Gap as % of offer
    const gapPct             = offerPrice > 0 ? (gap / offerPrice) * 100 : 0

    // 5-yr equity comparison
    const equity5yrFull  = appraisedValue * 1.03**5 - (appraisedValue - downDollar)
    const equity5yrReneg = appraisedValue * 1.03**5 - renegotiatedLoan

    return {
      gap, effectiveGap, cashNeededBase, ltv, hasPmi, monthlyPmiCost, piti, loanAmount,
      fullGapCash, fullGapLtv, fullGapMonthly,
      splitGap, splitCash, splitPriceAdj, splitMonthly,
      renegotiatedLoan, renegotiatedCash, renegotiatedMonthly, renegotiatedLtv,
      savingsVsFullGap, savingsVsSplit,
      gapPct, downDollar, equity5yrFull, equity5yrReneg,
    }
  }, [offerPrice, appraisedValue, downPct, rate, termYrs, pmiRate, sellerCredit, priceReduce])

  // Sensitivity: monthly pmt vs various gap coverage amounts
  const sensitivityData = useMemo(() => {
    const pts = 11
    return Array.from({ length: pts }, (_, i) => {
      const coverFrac  = i / (pts - 1)
      const effectivePrice = offerPrice - (analysis.gap * (1 - coverFrac))
      const loan       = Math.max(0, appraisedValue - analysis.downDollar)
      const extraCash  = analysis.gap * coverFrac
      const ltvN       = loan > 0 && appraisedValue > 0 ? (loan / appraisedValue) * 100 : 0
      const pmi        = ltvN > 80 ? loan * pmiRate / 100 / 12 : 0
      const pmt        = monthlyPmt(loan, rate, termYrs) + pmi
      return {
        label: `${Math.round(coverFrac * 100)}%`,
        cashNeeded: Math.round(analysis.downDollar + extraCash),
        monthly: Math.round(pmt),
        effectivePrice: Math.round(effectivePrice),
      }
    })
  }, [offerPrice, appraisedValue, analysis.gap, analysis.downDollar, downPct, rate, termYrs, pmiRate])

  const scenarios = [
    {
      name: 'Cover Full Gap',
      cash: analysis.fullGapCash,
      monthly: analysis.fullGapMonthly,
      ltv: analysis.fullGapLtv,
      color: '#ef4444',
      note: 'Buyer bridges entire appraisal gap with extra cash',
    },
    {
      name: 'Split with Seller',
      cash: analysis.splitCash,
      monthly: analysis.splitMonthly,
      ltv: analysis.fullGapLtv,
      color: '#f59e0b',
      note: `Seller reduces price by ${fmt(analysis.splitGap)} · buyer covers ${fmt(analysis.splitGap)}`,
    },
    {
      name: 'Renegotiate to Appraised',
      cash: analysis.renegotiatedCash,
      monthly: analysis.renegotiatedMonthly,
      ltv: analysis.renegotiatedLtv,
      color: '#22c55e',
      note: `Seller drops to ${fmt(appraisedValue)} · standard financing applies`,
    },
  ]

  if (!result) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-4xl mb-3">📐</p>
        <p>Run a valuation first to analyze appraisal gap scenarios</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Appraisal Gap Coverage</h3>
        <p className="text-xs text-slate-500">
          When your offer exceeds the appraised value, the lender only funds based on appraised value.
          Model how much extra cash you need — and your options for negotiating.
        </p>
      </div>

      {/* Gap alert */}
      {analysis.gap > 0 ? (
        <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4 flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="text-sm font-bold text-red-400">Appraisal Gap: {fmt(analysis.gap)} ({fmtPct(analysis.gapPct)} of offer)</p>
            <p className="text-xs text-slate-400 mt-1">
              Lender will loan against <span className="text-white font-bold">{fmt(appraisedValue)}</span> (appraised), not your offer of <span className="text-white font-bold">{fmt(offerPrice)}</span>.
              You must cover the {fmt(analysis.gap)} difference in cash — or renegotiate.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-green-900/20 border border-green-700/40 rounded-xl p-3 text-center">
          <p className="text-sm text-green-400 font-bold">No Appraisal Gap — Offer is at or below appraised value</p>
        </div>
      )}

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Deal Terms</p>
          {[
            { label: 'Offer / Purchase Price',  value: offerPrice,   min: appraisedValue * 0.8,  max: appraisedValue * 1.4, step: 1000, set: setOfferPrice,   fmt: fmt },
            { label: 'Down Payment %',          value: downPct,      min: 3,   max: 40,  step: 1,     set: setDownPct,    fmt: (v: number) => `${v}% (${fmt(offerPrice * v / 100)})` },
            { label: 'Interest Rate',           value: rate,         min: 3,   max: 12,  step: 0.125, set: setRate,       fmt: (v: number) => `${v.toFixed(3)}%` },
            { label: 'Loan Term',               value: termYrs,      min: 10,  max: 30,  step: 5,     set: setTermYrs,    fmt: (v: number) => `${v} yr` },
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
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Negotiation Levers</p>
          {[
            { label: 'Seller Price Reduction',  value: priceReduce,  min: 0, max: Math.max(analysis.gap, 1), step: 500, set: setPriceReduce, fmt: fmt },
            { label: 'Seller Credit (closing)', value: sellerCredit, min: 0, max: 20000, step: 250, set: setSellerCredit, fmt: fmt },
            { label: 'PMI Rate (annual)',        value: pmiRate,      min: 0.3, max: 1.5, step: 0.05, set: setPmiRate, fmt: (v: number) => `${v.toFixed(2)}% of loan/yr` },
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

          <div className="bg-slate-900/60 rounded-lg p-3 space-y-1.5 text-xs mt-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Appraised Value</span>
              <span className="font-bold text-white">{fmt(appraisedValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Offer Price</span>
              <span className="font-bold text-white">{fmt(offerPrice)}</span>
            </div>
            <div className={`flex justify-between font-bold ${analysis.gap > 0 ? 'text-red-400' : 'text-green-400'}`}>
              <span>Gap to Cover</span>
              <span>{fmt(analysis.gap)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3 Scenario cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {scenarios.map((s) => (
          <div key={s.name} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-full" style={{ background: s.color }} />
              <p className="text-xs font-bold text-slate-200">{s.name}</p>
            </div>
            <p className="text-2xl font-black text-white mb-0.5">{fmt(s.cash)}</p>
            <p className="text-xs text-slate-500 mb-2">cash to close</p>
            <p className="text-lg font-bold text-slate-300">{fmt(s.monthly)}<span className="text-xs text-slate-500 font-normal">/mo</span></p>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">{s.note}</p>
            {s.ltv > 80 && <p className="text-xs text-yellow-400 mt-1">⚠ PMI required (LTV {s.ltv.toFixed(0)}%)</p>}
          </div>
        ))}
      </div>

      {/* Cash needed bar chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Cash to Close by Scenario</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={scenarios.map(s => ({ name: s.name.split(' ').slice(-1)[0], cash: s.cash, monthly: s.monthly, color: s.color }))}
            margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} width={50} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number) => [fmt(v), 'Cash to Close']} />
            <Bar dataKey="cash" radius={[4, 4, 0, 0]}>
              {scenarios.map((s, i) => <Cell key={i} fill={s.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Gap coverage sensitivity */}
      {analysis.gap > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Sensitivity — Gap Coverage % vs Cash Required</p>
          <p className="text-xs text-slate-600 mb-4">Slide from 0% (renegotiate price) to 100% (buyer covers all)</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={sensitivityData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} label={{ value: 'Gap Coverage', position: 'insideBottom', offset: -3, fill: '#64748b', fontSize: 10 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} width={50} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(v: number, name: string) => [fmt(v), name === 'cashNeeded' ? 'Cash to Close' : 'Monthly Pmt']} />
              <Line type="monotone" dataKey="cashNeeded" stroke="#3b82f6" dot={false} strokeWidth={2} name="cashNeeded" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Key metrics table */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Detailed Comparison</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 text-left">
                <th className="pb-2 pr-4">Metric</th>
                {scenarios.map(s => <th key={s.name} className="pb-2 pr-4" style={{ color: s.color }}>{s.name}</th>)}
              </tr>
            </thead>
            <tbody className="space-y-1">
              {[
                { label: 'Purchase Price',    vals: [offerPrice, offerPrice - analysis.splitGap, appraisedValue] },
                { label: 'Loan Amount',       vals: [appraisedValue - analysis.downDollar, appraisedValue - analysis.downDollar, analysis.renegotiatedLoan] },
                { label: 'Cash to Close',     vals: [analysis.fullGapCash, analysis.splitCash, analysis.renegotiatedCash] },
                { label: 'Monthly Pmt',       vals: [analysis.fullGapMonthly, analysis.splitMonthly, analysis.renegotiatedMonthly] },
                { label: 'LTV',              vals: [analysis.fullGapLtv, analysis.fullGapLtv, analysis.renegotiatedLtv], pct: true },
                { label: 'PMI Monthly',       vals: [analysis.fullGapLtv > 80 ? (appraisedValue - analysis.downDollar) * pmiRate / 100 / 12 : 0, analysis.fullGapLtv > 80 ? (appraisedValue - analysis.downDollar) * pmiRate / 100 / 12 : 0, analysis.renegotiatedLtv > 80 ? analysis.renegotiatedLoan * pmiRate / 100 / 12 : 0] },
              ].map(row => (
                <tr key={row.label} className="border-t border-slate-700/50">
                  <td className="py-1.5 pr-4 text-slate-500">{row.label}</td>
                  {row.vals.map((v, i) => (
                    <td key={i} className="py-1.5 pr-4 font-semibold text-slate-300">
                      {row.pct ? fmtPct(v) : fmt(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Strategy tips */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Negotiation Strategies</p>
        <div className="space-y-2 text-xs text-slate-400">
          {[
            { icon: '📉', tip: 'Request a price reduction to appraised value — sellers in a slow market often agree rather than lose the buyer.' },
            { icon: '✂️', tip: 'Ask the seller to cover part of the gap (split-gap clause) — meets in the middle and keeps the deal alive.' },
            { icon: '📝', tip: 'Include an appraisal contingency in your offer — lets you walk away or renegotiate without losing earnest money.' },
            { icon: '🏦', tip: 'Ask your lender if they can use a second appraisal or challenge the value with comparable data.' },
            { icon: '💵', tip: `Bringing ${fmt(analysis.gap)} extra cash is legitimate but only if the home is worth it — evaluate your max walk-away price first.` },
            { icon: '🔄', tip: 'Waiving appraisal contingency is risky in a competitive market — you're on the hook for the full gap no matter what.' },
          ].map((s, i) => (
            <div key={i} className="flex gap-2">
              <span className="flex-shrink-0">{s.icon}</span>
              <span>{s.tip}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Appraisal gap strategies depend on local market conditions, contract contingencies, and lender guidelines.
        Consult your real estate agent and attorney before waiving appraisal contingencies.
      </p>
    </div>
  )
}
