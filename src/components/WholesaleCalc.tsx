import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function WholesaleCalc() {
  const { result } = usePropertyStore()

  const arv = result?.estimatedValue ?? 350000

  const [rehabCost,       setRehabCost]       = useState(Math.round(arv * 0.10))
  const [discountPct,     setDiscountPct]      = useState(70)   // 70% rule
  const [assignmentFee,   setAssignmentFee]    = useState(10000)
  const [closingCostsPct, setClosingCostsPct]  = useState(2)    // % of MAO
  const [carryMonths,     setCarryMonths]      = useState(3)
  const [carryRate,       setCarryRate]        = useState(10)   // hard money rate
  const [sellingCostsPct, setSellingCostsPct]  = useState(8)    // agent + closing

  const calc = useMemo(() => {
    // Standard rule: MAO = ARV × discountPct% − repairs
    const maoRule        = arv * discountPct / 100 - rehabCost
    // More precise: buyer needs to make money after all costs
    const sellingCosts   = arv * sellingCostsPct / 100
    const closingCosts   = maoRule * closingCostsPct / 100
    const carryLoan      = maoRule * 0.75  // 75% hard money
    const carryInterest  = carryLoan * (carryRate / 100 / 12) * carryMonths
    const totalCosts     = rehabCost + sellingCosts + closingCosts + carryInterest + assignmentFee
    const endBuyerProfit = arv - maoRule - totalCosts
    const endBuyerROI    = maoRule > 0 ? (endBuyerProfit / maoRule) * 100 : 0

    // Your max offer (to hit target assignment fee)
    const yourMao        = maoRule - assignmentFee

    // Spread scenarios
    const scenarios = [60, 65, 70, 75, 80].map(pct => ({
      pct,
      mao: arv * pct / 100 - rehabCost,
      yourMao: arv * pct / 100 - rehabCost - assignmentFee,
      endBuyerProfit: arv - (arv * pct / 100 - rehabCost) - (rehabCost + sellingCosts + closingCosts + carryInterest),
    }))

    return { maoRule, yourMao, endBuyerProfit, endBuyerROI, sellingCosts, closingCosts, carryInterest, totalCosts }
  }, [arv, rehabCost, discountPct, assignmentFee, closingCostsPct, carryMonths, carryRate, sellingCostsPct])

  const maoScenarios = [60, 65, 70, 75, 80].map(pct => ({
    label: `${pct}% Rule`,
    mao: Math.max(0, arv * pct / 100 - rehabCost),
    yourOffer: Math.max(0, arv * pct / 100 - rehabCost - assignmentFee),
    endBuyerProfit: arv - Math.max(0, arv * pct / 100 - rehabCost) - calc.totalCosts + assignmentFee,
    highlight: pct === discountPct,
  }))

  if (!result) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-4xl mb-3">🤝</p>
        <p>Run a valuation first to calculate wholesale deals</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Wholesale Deal Calculator</h3>
        <p className="text-xs text-slate-500">
          Calculate your Maximum Allowable Offer (MAO) using the % rule, model your assignment fee,
          and verify end-buyer profitability.
        </p>
      </div>

      {/* ARV / MAO highlight */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center">
          <p className="text-xs text-slate-500 mb-1">ARV</p>
          <p className="text-xl font-black text-white">{fmt(arv)}</p>
        </div>
        <div className="bg-blue-900/20 border border-blue-700/40 rounded-xl p-3 text-center">
          <p className="text-xs text-blue-400 mb-1">Your Max Offer</p>
          <p className="text-xl font-black text-blue-300">{fmt(Math.max(0, calc.yourMao))}</p>
        </div>
        <div className={`rounded-xl p-3 border text-center ${calc.endBuyerProfit > 0 ? 'bg-green-900/20 border-green-700/40' : 'bg-red-900/20 border-red-700/40'}`}>
          <p className={`text-xs mb-1 ${calc.endBuyerProfit > 0 ? 'text-green-400' : 'text-red-400'}`}>End Buyer Profit</p>
          <p className={`text-xl font-black ${calc.endBuyerProfit > 0 ? 'text-green-300' : 'text-red-400'}`}>{fmt(calc.endBuyerProfit)}</p>
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Deal Parameters</p>
          {[
            { label: 'ARV % Rule (discount)',  value: discountPct,     min: 55,   max: 85,   step: 1,    set: setDiscountPct,     fmt: (v: number) => `${v}% of ARV` },
            { label: 'Estimated Rehab',         value: rehabCost,       min: 0,    max: arv * 0.5, step: 1000, set: setRehabCost,  fmt: fmt },
            { label: 'Assignment Fee (yours)',   value: assignmentFee,   min: 2000, max: 50000, step: 500, set: setAssignmentFee,   fmt: fmt },
            { label: 'Closing Costs (buyer)',    value: closingCostsPct, min: 1,   max: 5,    step: 0.25, set: setClosingCostsPct, fmt: (v: number) => `${v}%` },
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
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">End Buyer Hold Costs</p>
          {[
            { label: 'Carry Period (months)',  value: carryMonths,     min: 1,  max: 12, step: 1,    set: setCarryMonths,    fmt: (v: number) => `${v} mo` },
            { label: 'Hard Money Rate',        value: carryRate,       min: 6,  max: 18, step: 0.25, set: setCarryRate,      fmt: (v: number) => `${v.toFixed(2)}%` },
            { label: 'Selling Costs (agent+)', value: sellingCostsPct, min: 4,  max: 12, step: 0.5,  set: setSellingCostsPct, fmt: (v: number) => `${v}% of ARV` },
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

          <div className="bg-slate-900/60 rounded-lg p-3 space-y-1 text-xs mt-2">
            <div className="flex justify-between"><span className="text-slate-500">MAO (end buyer)</span><span className="font-bold text-white">{fmt(Math.max(0, calc.maoRule))}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Assignment fee</span><span className="font-bold text-yellow-400">−{fmt(assignmentFee)}</span></div>
            <div className="flex justify-between border-t border-slate-700 pt-1 mt-1"><span className="text-slate-300 font-bold">Your offer price</span><span className="font-black text-blue-400">{fmt(Math.max(0, calc.yourMao))}</span></div>
          </div>
        </div>
      </div>

      {/* Rule comparison chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">MAO by % Rule</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={maoScenarios} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} width={50} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number, name: string) => [fmt(v), name === 'mao' ? 'End Buyer MAO' : 'Your Offer']} />
            <ReferenceLine y={0} stroke="#64748b" />
            <Bar dataKey="mao" name="End Buyer MAO" radius={[4, 4, 0, 0]}>
              {maoScenarios.map((s, i) => <Cell key={i} fill={s.highlight ? '#3b82f6' : '#1e3a5f'} />)}
            </Bar>
            <Bar dataKey="yourOffer" name="Your Offer" radius={[4, 4, 0, 0]}>
              {maoScenarios.map((s, i) => <Cell key={i} fill={s.highlight ? '#22c55e' : '#14532d'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Full breakdown */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">End Buyer P&L Breakdown</p>
        <div className="space-y-1.5 text-xs">
          {[
            { label: 'ARV (after repair value)',        value: fmt(arv),                     color: 'text-green-400' },
            { label: `End buyer purchase (${discountPct}% rule − repairs)`, value: `-${fmt(Math.max(0, calc.maoRule))}`, color: 'text-red-400' },
            { label: 'Rehab budget',                    value: `-${fmt(rehabCost)}`,          color: 'text-red-400' },
            { label: `Selling costs (${sellingCostsPct}%)`, value: `-${fmt(calc.sellingCosts)}`, color: 'text-red-400' },
            { label: 'Closing costs (buy side)',        value: `-${fmt(calc.closingCosts)}`,  color: 'text-red-400' },
            { label: `Carry interest (${carryMonths} mo @ ${carryRate}%)`, value: `-${fmt(calc.carryInterest)}`, color: 'text-red-400' },
            { label: 'End buyer profit',                value: fmt(Math.max(0, calc.endBuyerProfit)), color: calc.endBuyerProfit > 0 ? 'text-green-400 font-black' : 'text-red-400 font-black', border: true },
          ].map(r => (
            <div key={r.label} className={`flex justify-between ${r.border ? 'border-t border-slate-700 pt-1.5 mt-1' : ''}`}>
              <span className={r.border ? 'text-slate-300 font-semibold' : 'text-slate-500'}>{r.label}</span>
              <span className={r.color}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Wholesaling Tips</p>
        <div className="space-y-2 text-xs text-slate-400">
          {[
            '📊 The 70% rule is a quick filter — always verify with a full end-buyer P&L before submitting.',
            '📋 Build your cash buyer list before marketing deals — assignment fees are negotiated, not fixed.',
            '⚖️ In most states, wholesalers need a real estate license or must disclose their principal/equitable interest.',
            '🔍 MAO should leave the end buyer ≥15% profit margin to make deals attractive to experienced investors.',
            '📞 Double-closing (A→B then B→C same day) avoids assignment; some lenders won\'t fund back-to-back same-day closes.',
            '🏃 Speed is your product — experienced investors will pay a premium for deals that close fast with clean contracts.',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Wholesale real estate laws vary by state. Consult a real estate attorney before entering contracts as a principal.
        ARV estimate is from PropValue's model — get an independent appraisal before finalizing deals.
      </p>
    </div>
  )
}
