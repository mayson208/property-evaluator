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

function calcBalance(loan: number, rate: number, term: number, monthsPaid: number): number {
  const r = rate / 100 / 12
  const n = term * 12
  if (r === 0) return Math.max(0, loan - (loan / n) * monthsPaid)
  const pmt = loan * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  return loan * Math.pow(1 + r, monthsPaid) - pmt * (Math.pow(1 + r, monthsPaid) - 1) / r
}

export default function MoveUpBuyer() {
  const { result, interestRate, input } = usePropertyStore()

  // Current home
  const [currentValue,     setCurrentValue]     = useState(result?.estimatedValue ?? 350000)
  const [currentMortgage,  setCurrentMortgage]  = useState(200000)
  const [currentRate,      setCurrentRate]      = useState(interestRate - 1)
  const [currentTermYrs,   setCurrentTermYrs]   = useState(30)
  const [monthsPaidCurrent,setMonthsPaidCurrent]= useState(48)
  const [sellerAgentPct,   setSellerAgentPct]   = useState(5.5)
  const [sellerClosingPct, setSellerClosingPct] = useState(1.0)

  // New home
  const [newPrice,         setNewPrice]         = useState(550000)
  const [newRate,          setNewRate]          = useState(interestRate)
  const [newTermYrs,       setNewTermYrs]       = useState(30)
  const [buyerClosingPct,  setBuyerClosingPct]  = useState(2.5)
  const [moveInCost,       setMoveInCost]       = useState(5000)

  // Timeline
  const [sellFirst,        setSellFirst]        = useState(true)
  const [bridgeLoanRate,   setBridgeLoanRate]   = useState(9.0)
  const [bridgeMonths,     setBridgeMonths]     = useState(3)
  const [appreciation,     setAppreciation]     = useState(3.5)

  const analysis = useMemo(() => {
    // Current home net proceeds
    const currentBalance   = calcBalance(currentMortgage, currentRate, currentTermYrs, monthsPaidCurrent)
    const sellerCosts      = currentValue * (sellerAgentPct + sellerClosingPct) / 100
    const currentEquity    = currentValue - currentBalance
    const netProceeds      = currentValue - currentBalance - sellerCosts

    // New home
    const buyerClosing     = newPrice * buyerClosingPct / 100
    const downFromProceeds = netProceeds  // use all proceeds as down payment
    const downPct          = newPrice > 0 ? (downFromProceeds / newPrice) * 100 : 0
    const newLoan          = newPrice - downFromProceeds
    const newMonthly       = monthlyPmt(Math.max(0, newLoan), newRate, newTermYrs)
    const remainingCash    = netProceeds - downFromProceeds - buyerClosing - moveInCost
    const totalCashNeeded  = buyerClosing + moveInCost + (sellFirst ? 0 : 0)

    // If buy before sell: bridge loan
    const bridgeLoanAmt    = !sellFirst ? currentValue * 0.8 - currentBalance : 0
    const bridgeInterest   = bridgeLoanAmt * (bridgeLoanRate / 100 / 12) * bridgeMonths
    const bridgeCost       = bridgeInterest + bridgeLoanAmt * 0.02  // 2% origination

    // Old monthly vs new monthly
    const currentMonthly   = monthlyPmt(currentBalance, currentRate, currentTermYrs - monthsPaidCurrent / 12)
    const monthlyIncrease  = newMonthly - currentMonthly

    // Capital gains exclusion ($250K single, $500K MFJ)
    const totalGain        = currentValue - (input.purchasePrice > 0 ? input.purchasePrice : currentValue * 0.6)
    const excludableGain   = 500000  // MFJ — user might be single
    const taxableGain      = Math.max(0, totalGain - excludableGain)
    const gainsTax         = taxableGain * 0.20  // assume 20% LTCG

    // 10yr comparison: stay vs move up
    const yr10NewValue     = newPrice * Math.pow(1 + appreciation / 100, 10)
    const yr10CurrentValue = currentValue * Math.pow(1 + appreciation / 100, 10)
    const yr10Equity       = yr10NewValue - newLoan
    const yr10CurrentEquity = yr10CurrentValue - currentBalance

    const yearData = Array.from({ length: 11 }, (_, yr) => ({
      yr,
      newValue: Math.round(newPrice * Math.pow(1 + appreciation / 100, yr)),
      currentValue: Math.round(currentValue * Math.pow(1 + appreciation / 100, yr)),
    }))

    return {
      currentBalance, sellerCosts, currentEquity, netProceeds,
      buyerClosing, downFromProceeds, downPct, newLoan, newMonthly,
      remainingCash, totalCashNeeded,
      bridgeLoanAmt, bridgeInterest, bridgeCost,
      currentMonthly, monthlyIncrease,
      totalGain, taxableGain, gainsTax,
      yr10NewValue, yr10CurrentValue, yr10Equity, yr10CurrentEquity, yearData,
    }
  }, [currentValue, currentMortgage, currentRate, currentTermYrs, monthsPaidCurrent, sellerAgentPct, sellerClosingPct, newPrice, newRate, newTermYrs, buyerClosingPct, moveInCost, sellFirst, bridgeLoanRate, bridgeMonths, appreciation, input.purchasePrice])

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Move-Up Buyer Analyzer</h3>
        <p className="text-xs text-slate-500">
          Model the full financial picture of selling your current home and buying a larger one —
          equity extraction, new payment increase, bridge financing, and capital gains.
        </p>
      </div>

      {/* Equity flow */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Current Equity',    value: fmt(analysis.currentEquity),  color: 'text-blue-400' },
          { label: 'Net Sale Proceeds', value: fmt(analysis.netProceeds),    color: 'text-green-400' },
          { label: 'Down Payment %',    value: `${analysis.downPct.toFixed(1)}%`, color: 'text-white' },
          { label: 'Monthly Increase',  value: `+${fmt(analysis.monthlyIncrease)}/mo`, color: analysis.monthlyIncrease > 500 ? 'text-red-400' : 'text-yellow-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Inputs grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Current home */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs text-blue-400 uppercase tracking-widest font-bold">Current Home</p>
          {[
            { label: 'Current Market Value',  value: currentValue,      min: 50000,  max: 5000000, step: 5000, set: setCurrentValue,      fmt: fmt },
            { label: 'Mortgage Balance',      value: currentMortgage,   min: 0,      max: 2000000, step: 5000, set: setCurrentMortgage,   fmt: fmt },
            { label: 'Current Rate',          value: currentRate,       min: 2,      max: 12,      step: 0.125, set: setCurrentRate,      fmt: (v: number) => `${v.toFixed(3)}%` },
            { label: 'Months Already Paid',   value: monthsPaidCurrent, min: 0,      max: 360,     step: 12,   set: setMonthsPaidCurrent, fmt: (v: number) => `${v} mo (${(v/12).toFixed(0)} yr)` },
            { label: 'Agent Commission',      value: sellerAgentPct,    min: 0,      max: 7,       step: 0.25, set: setSellerAgentPct,    fmt: (v: number) => `${v}%` },
            { label: 'Seller Closing Costs',  value: sellerClosingPct,  min: 0.5,    max: 3,       step: 0.25, set: setSellerClosingPct,  fmt: (v: number) => `${v}%` },
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
          <div className="bg-slate-900/60 rounded-lg p-3 space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-slate-500">Remaining balance</span><span className="text-white">{fmt(analysis.currentBalance)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Sale costs</span><span className="text-red-400">-{fmt(analysis.sellerCosts)}</span></div>
            <div className="flex justify-between font-black border-t border-slate-700 pt-1"><span className="text-slate-300">Net proceeds</span><span className="text-green-400">{fmt(analysis.netProceeds)}</span></div>
          </div>
        </div>

        {/* New home */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs text-green-400 uppercase tracking-widest font-bold">New Home</p>
          {[
            { label: 'New Home Price',        value: newPrice,          min: 100000, max: 5000000, step: 10000, set: setNewPrice,         fmt: fmt },
            { label: 'New Rate',              value: newRate,           min: 3,      max: 12,      step: 0.125, set: setNewRate,          fmt: (v: number) => `${v.toFixed(3)}%` },
            { label: 'Buyer Closing Costs %', value: buyerClosingPct,   min: 1,      max: 5,       step: 0.25,  set: setBuyerClosingPct,  fmt: (v: number) => `${v}% = ${fmt(newPrice * v / 100)}` },
            { label: 'Moving / Setup Costs',  value: moveInCost,        min: 0,      max: 50000,   step: 500,   set: setMoveInCost,       fmt: fmt },
            { label: 'Appreciation (both)',   value: appreciation,      min: 0,      max: 8,       step: 0.5,   set: setAppreciation,     fmt: (v: number) => `${v}%/yr` },
          ].map(s => (
            <div key={s.label}>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-slate-400 uppercase tracking-widest">{s.label}</label>
                <span className="text-xs font-bold text-green-400">{s.fmt(s.value)}</span>
              </div>
              <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                onChange={e => s.set(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-green-500" />
            </div>
          ))}
          <div className="bg-slate-900/60 rounded-lg p-3 space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-slate-500">Down payment (from proceeds)</span><span className="text-white">{fmt(analysis.downFromProceeds)} ({analysis.downPct.toFixed(1)}%)</span></div>
            <div className="flex justify-between"><span className="text-slate-500">New loan</span><span className="text-white">{fmt(analysis.newLoan)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">New monthly P&I</span><span className="text-white">{fmt(analysis.newMonthly)}</span></div>
            <div className={`flex justify-between font-black border-t border-slate-700 pt-1`}>
              <span className="text-slate-300">Monthly change</span>
              <span className={analysis.monthlyIncrease > 0 ? 'text-red-400' : 'text-green-400'}>
                {analysis.monthlyIncrease > 0 ? '+' : ''}{fmt(analysis.monthlyIncrease)}/mo
              </span>
            </div>
          </div>

          {/* Sell first vs buy first */}
          <div className="pt-1">
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Transaction Sequence</p>
            <div className="flex gap-2">
              {[{ val: true, label: 'Sell First (safer)' }, { val: false, label: 'Buy First (bridge loan)' }].map(o => (
                <button key={String(o.val)} onClick={() => setSellFirst(o.val)}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${sellFirst === o.val ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                  {o.label}
                </button>
              ))}
            </div>
            {!sellFirst && (
              <div className="mt-2 space-y-2">
                {[
                  { label: 'Bridge Loan Rate', value: bridgeLoanRate, min: 6, max: 14, step: 0.5, set: setBridgeLoanRate, fmt: (v: number) => `${v}%` },
                  { label: 'Bridge Duration',  value: bridgeMonths,   min: 1, max: 12, step: 1,   set: setBridgeMonths,   fmt: (v: number) => `${v} mo` },
                ].map(s => (
                  <div key={s.label}>
                    <div className="flex justify-between mb-1">
                      <label className="text-xs text-slate-400 uppercase tracking-widest">{s.label}</label>
                      <span className="text-xs font-bold text-yellow-400">{s.fmt(s.value)}</span>
                    </div>
                    <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                      onChange={e => s.set(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-yellow-400" />
                  </div>
                ))}
                <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-lg p-2 text-xs text-yellow-400">
                  Bridge loan cost: <strong>{fmt(analysis.bridgeCost)}</strong>
                  {' '}(includes {fmt(analysis.bridgeInterest)} interest + ~2% origination)
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Capital gains */}
      {analysis.totalGain > 250000 && (
        <div className={`rounded-xl p-4 border ${analysis.taxableGain > 0 ? 'bg-yellow-900/20 border-yellow-700/40' : 'bg-green-900/20 border-green-700/40'}`}>
          <p className="text-sm font-bold text-yellow-400 mb-1">Capital Gains Consideration</p>
          <p className="text-xs text-slate-400">
            Estimated gain: <strong className="text-white">{fmt(analysis.totalGain)}</strong>.
            Section 121 excludes up to <strong className="text-white">$500K (MFJ)</strong> or $250K (single) if primary residence ≥ 2 of last 5 years.
            {analysis.taxableGain > 0
              ? <span className="text-yellow-300"> Taxable gain: {fmt(analysis.taxableGain)} → approx. {fmt(analysis.gainsTax)} in federal LTCG tax.</span>
              : <span className="text-green-400"> You're fully excluded — no capital gains tax due.</span>
            }
          </p>
        </div>
      )}

      {/* Value projection */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">10-Year Value Projection</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={analysis.yearData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="yr" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} width={55} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number) => [fmt(v)]} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
            <Line type="monotone" dataKey="newValue"     stroke="#22c55e" dot={false} strokeWidth={2} name="New Home" />
            <Line type="monotone" dataKey="currentValue" stroke="#3b82f6" dot={false} strokeWidth={2} strokeDasharray="4 3" name="Current Home" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Equity projections assume constant appreciation and exclude selling costs on the new home.
        Verify capital gains exclusion eligibility with a CPA — partial exclusion rules apply if you
        haven't met the 2-of-5-year primary residence test.
      </p>
    </div>
  )
}
