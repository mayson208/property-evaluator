import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
function pct(n: number) {
  return `${n.toFixed(2)}%`
}

export default function SellerNetSheet() {
  const { result, input } = usePropertyStore()

  const estimatedSalePrice = result?.estimatedValue ?? 400000
  const [salePrice,       setSalePrice]       = useState(estimatedSalePrice)
  const [loanBalance,     setLoanBalance]     = useState(Math.round(estimatedSalePrice * 0.6))
  const [agentRate,       setAgentRate]       = useState(5.5)
  const [transferTaxPct,  setTransferTaxPct]  = useState(0.5)
  const [titleEscrow,     setTitleEscrow]     = useState(1500)
  const [repairAllowance, setRepairAllowance] = useState(0)
  const [homeWarranty,    setHomeWarranty]    = useState(500)
  const [stagingCost,     setStagingCost]     = useState(0)
  const [movingCost,      setMovingCost]      = useState(3000)
  const [proRatedTax,     setProRatedTax]     = useState(1000)
  const [payoffFee,       setPayoffFee]       = useState(250)

  const lineItems = useMemo(() => {
    const agentComm    = salePrice * agentRate / 100
    const transferTax  = salePrice * transferTaxPct / 100
    const totalCosts   = agentComm + transferTax + titleEscrow + repairAllowance + homeWarranty + stagingCost + movingCost + proRatedTax + payoffFee
    const mortgagePay  = loanBalance + payoffFee
    const netProceeds  = salePrice - totalCosts - loanBalance

    return {
      agentComm, transferTax, titleEscrow, repairAllowance, homeWarranty,
      stagingCost, movingCost, proRatedTax, payoffFee, totalCosts,
      mortgagePay, netProceeds,
      effectiveCostPct: (totalCosts / salePrice) * 100,
    }
  }, [salePrice, loanBalance, agentRate, transferTaxPct, titleEscrow, repairAllowance, homeWarranty, stagingCost, movingCost, proRatedTax, payoffFee])

  const gain = input.purchasePrice > 0 ? salePrice - input.purchasePrice : null

  const pieData = [
    { name: 'Net Proceeds',       value: Math.max(0, lineItems.netProceeds), color: '#22c55e' },
    { name: 'Mortgage Payoff',    value: loanBalance,                        color: '#ef4444' },
    { name: 'Agent Commission',   value: lineItems.agentComm,                color: '#f59e0b' },
    { name: 'Transfer Tax',       value: lineItems.transferTax,              color: '#a855f7' },
    { name: 'Other Costs',        value: lineItems.titleEscrow + lineItems.repairAllowance + lineItems.homeWarranty + lineItems.stagingCost + lineItems.movingCost + lineItems.proRatedTax + lineItems.payoffFee, color: '#64748b' },
  ].filter(d => d.value > 0)

  if (!result) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-4xl mb-3">📄</p>
        <p>Run a valuation first to build your seller net sheet</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Seller Net Sheet</h3>
        <p className="text-xs text-slate-500">
          Estimate how much you'll walk away with after all selling costs and mortgage payoff.
        </p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Sale & Mortgage</p>
          {[
            { label: 'Estimated Sale Price', value: salePrice,     min: 50000, max: 5000000, step: 5000, set: setSalePrice,     fmt: (v: number) => fmt(v) },
            { label: 'Outstanding Mortgage', value: loanBalance,   min: 0,     max: 5000000, step: 5000, set: setLoanBalance,   fmt: (v: number) => fmt(v) },
            { label: 'Agent Commission',     value: agentRate,     min: 0,     max: 8,       step: 0.25, set: setAgentRate,     fmt: (v: number) => `${pct(v)} (${fmt(salePrice * agentRate / 100)})` },
            { label: 'Transfer Tax',         value: transferTaxPct,min: 0,     max: 3,       step: 0.05, set: setTransferTaxPct,fmt: (v: number) => `${pct(v)} (${fmt(salePrice * v / 100)})` },
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
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Other Costs</p>
          {[
            { label: 'Title & Escrow',    value: titleEscrow,     min: 0, max: 10000, step: 100, set: setTitleEscrow,     fmt: fmt },
            { label: 'Repair Allowance',  value: repairAllowance, min: 0, max: 50000, step: 500, set: setRepairAllowance, fmt: fmt },
            { label: 'Home Warranty',     value: homeWarranty,    min: 0, max: 2000,  step: 50,  set: setHomeWarranty,    fmt: fmt },
            { label: 'Staging / Prep',    value: stagingCost,     min: 0, max: 20000, step: 250, set: setStagingCost,     fmt: fmt },
            { label: 'Moving Costs',      value: movingCost,      min: 0, max: 20000, step: 250, set: setMovingCost,      fmt: fmt },
            { label: 'Pro-Rated Taxes',   value: proRatedTax,     min: 0, max: 10000, step: 100, set: setProRatedTax,     fmt: fmt },
            { label: 'Payoff & Wire Fee', value: payoffFee,       min: 0, max: 1000,  step: 50,  set: setPayoffFee,       fmt: fmt },
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

      {/* Net proceeds hero */}
      <div className={`rounded-xl p-6 border text-center ${lineItems.netProceeds >= 0 ? 'bg-green-900/20 border-green-700/40' : 'bg-red-900/20 border-red-700/40'}`}>
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Estimated Net Proceeds</p>
        <p className={`text-4xl font-black mb-1 ${lineItems.netProceeds >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {lineItems.netProceeds >= 0 ? '' : '-'}{fmt(Math.abs(lineItems.netProceeds))}
        </p>
        <p className="text-xs text-slate-500">
          after mortgage payoff ({fmt(loanBalance)}) + all selling costs ({fmt(lineItems.totalCosts)})
        </p>
        {lineItems.netProceeds < 0 && (
          <p className="text-xs text-red-400 font-semibold mt-2">
            Short sale situation — you owe more than you'd net. Consider lender negotiation or holding longer.
          </p>
        )}
        {gain !== null && (
          <p className={`text-xs mt-2 font-semibold ${gain >= 0 ? 'text-slate-400' : 'text-red-400'}`}>
            {gain >= 0 ? `Gain vs purchase price (${fmt(input.purchasePrice)}): +${fmt(gain)}` : `Loss vs purchase price: ${fmt(gain)}`}
          </p>
        )}
      </div>

      {/* Pie chart + itemized table side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-3">Where Your Sale Price Goes</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={85} innerRadius={45}>
                {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
                formatter={(v: number) => [fmt(v)]} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Itemized Costs</p>
          <div className="space-y-1.5 text-xs">
            {[
              { label: 'Sale Price',         value: fmt(salePrice),                color: 'text-green-400 font-bold', indent: false },
              { label: 'Agent Commission',   value: `−${fmt(lineItems.agentComm)}`,   color: 'text-red-400', indent: true },
              { label: 'Transfer Tax',       value: `−${fmt(lineItems.transferTax)}`,  color: 'text-red-400', indent: true },
              { label: 'Title & Escrow',     value: `−${fmt(titleEscrow)}`,         color: 'text-red-400', indent: true },
              { label: 'Repair Allowance',   value: `−${fmt(repairAllowance)}`,     color: 'text-red-400', indent: true },
              { label: 'Home Warranty',      value: `−${fmt(homeWarranty)}`,        color: 'text-red-400', indent: true },
              { label: 'Staging / Prep',     value: `−${fmt(stagingCost)}`,         color: 'text-red-400', indent: true },
              { label: 'Moving Costs',       value: `−${fmt(movingCost)}`,          color: 'text-red-400', indent: true },
              { label: 'Pro-Rated Taxes',    value: `−${fmt(proRatedTax)}`,         color: 'text-red-400', indent: true },
              { label: 'Payoff & Wire Fee',  value: `−${fmt(payoffFee)}`,           color: 'text-red-400', indent: true },
              { label: 'Gross Proceeds',     value: fmt(salePrice - lineItems.totalCosts), color: 'text-blue-400 font-bold', indent: false },
              { label: 'Mortgage Payoff',    value: `−${fmt(loanBalance)}`,         color: 'text-orange-400', indent: true },
              { label: 'Net to Seller',      value: fmt(lineItems.netProceeds),     color: lineItems.netProceeds >= 0 ? 'text-green-400 font-black' : 'text-red-400 font-black', indent: false },
            ].map(row => (
              <div key={row.label} className={`flex justify-between ${row.indent ? 'pl-3' : 'border-t border-slate-700 pt-1.5 mt-1.5'}`}>
                <span className={`text-slate-500 ${!row.indent ? 'font-semibold text-slate-400' : ''}`}>{row.label}</span>
                <span className={row.color}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cost breakdown summary */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Cost Summary</p>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { label: 'Total Selling Costs', value: fmt(lineItems.totalCosts), sub: `${lineItems.effectiveCostPct.toFixed(1)}% of sale price`, color: 'text-red-400' },
            { label: 'Biggest Cost',        value: fmt(lineItems.agentComm),  sub: `Agent commission (${agentRate}%)`,                    color: 'text-orange-400' },
            { label: 'Cost Excl. Agent',    value: fmt(lineItems.totalCosts - lineItems.agentComm), sub: `${((lineItems.totalCosts - lineItems.agentComm) / salePrice * 100).toFixed(1)}% of sale`, color: 'text-yellow-400' },
          ].map(s => (
            <div key={s.label}>
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-600 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-700">
          <p className="text-xs text-slate-500 mb-2">Ways to reduce selling costs:</p>
          <ul className="space-y-1 text-xs text-slate-400">
            {agentRate > 3.5 && <li>• Negotiate a lower commission — rates of 3–4.5% total are increasingly common</li>}
            {repairAllowance === 0 && <li>• Consider pricing below market and skipping repair allowances to attract as-is buyers</li>}
            {stagingCost === 0 && <li>• Virtual staging ($300–$600) can be more cost-effective than physical staging</li>}
            <li>• FSBO (For Sale by Owner) eliminates listing agent fees but requires more effort</li>
          </ul>
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        This is an estimate only. Actual proceeds vary by contract terms, proration dates, and negotiated costs.
        Consult a real estate attorney and your mortgage servicer for exact payoff figures.
      </p>
    </div>
  )
}
