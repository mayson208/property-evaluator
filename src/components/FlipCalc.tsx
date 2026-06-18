import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function fmtPct(n: number) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

function StatCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  const color = positive === undefined ? 'text-white' : positive ? 'text-green-400' : 'text-red-400'
  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
      <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function FlipCalc() {
  const { result } = usePropertyStore()

  const [purchasePrice, setPurchasePrice]   = useState(result ? Math.round(result.estimatedValue * 0.72 / 1000) * 1000 : 280000)
  const [rehabBudget, setRehabBudget]       = useState(45000)
  const [holdingMonths, setHoldingMonths]   = useState(6)
  const [monthlyCarrying, setMonthlyCarrying] = useState(2200)
  const [arvOverride, setArvOverride]       = useState(result ? result.estimatedValue : 420000)
  const [agentFeesPct, setAgentFeesPct]     = useState(6)
  const [closingCostsPct, setClosingCostsPct] = useState(1.5)

  const arv = arvOverride

  const results = useMemo(() => {
    const totalInvestment  = purchasePrice + rehabBudget
    const holdingCosts     = holdingMonths * monthlyCarrying
    const sellingCosts     = arv * ((agentFeesPct + closingCostsPct) / 100)
    const totalCosts       = totalInvestment + holdingCosts + sellingCosts
    const netProfit        = arv - totalCosts
    const roi              = (netProfit / totalInvestment) * 100
    const annualizedRoi    = holdingMonths > 0 ? (roi / holdingMonths) * 12 : roi
    // Maximum allowable offer (MAO): ARV × 70% - rehab
    const mao70            = arv * 0.70 - rehabBudget
    const profitMargin     = (netProfit / arv) * 100

    return { totalInvestment, holdingCosts, sellingCosts, totalCosts, netProfit, roi, annualizedRoi, mao70, profitMargin }
  }, [purchasePrice, rehabBudget, holdingMonths, monthlyCarrying, arv, agentFeesPct, closingCostsPct])

  const isProfitable = results.netProfit > 0

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Flip Analyzer</h3>
        <p className="text-xs text-slate-500">House flipping profit, ROI, and maximum allowable offer</p>
      </div>

      {/* ARV warning */}
      {result && (
        <div className="bg-blue-900/30 border border-blue-800/50 rounded-xl p-3 text-xs text-blue-300">
          Your valuation estimated <strong>{fmt(result.estimatedValue)}</strong> — used as the default ARV below.
          Adjust if the post-rehab value will differ.
        </div>
      )}

      {/* Inputs */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-4">
        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Deal Parameters</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-widest block mb-1">Purchase Price</label>
            <input type="number" value={purchasePrice}
              onChange={e => setPurchasePrice(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-widest block mb-1">After-Repair Value (ARV)</label>
            <input type="number" value={arvOverride}
              onChange={e => setArvOverride(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs text-slate-400 uppercase tracking-widest">Rehab Budget</label>
            <span className="text-xs font-bold text-orange-400">{fmt(rehabBudget)}</span>
          </div>
          <input type="range" min={0} max={200000} step={2500} value={rehabBudget}
            onChange={e => setRehabBudget(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-orange-500" />
          <div className="flex justify-between text-xs text-slate-600 mt-1">
            <span>$0</span><span>$100K</span><span>$200K</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-slate-400 uppercase tracking-widest">Hold (months)</label>
              <span className="text-xs font-bold text-blue-400">{holdingMonths} mo</span>
            </div>
            <input type="range" min={1} max={24} step={1} value={holdingMonths}
              onChange={e => setHoldingMonths(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
          </div>
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-widest block mb-1">Monthly Carrying Cost</label>
            <input type="number" value={monthlyCarrying}
              onChange={e => setMonthlyCarrying(Number(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-slate-400 uppercase tracking-widest">Agent Fees</label>
              <span className="text-xs font-bold text-slate-300">{agentFeesPct}%</span>
            </div>
            <input type="range" min={0} max={10} step={0.5} value={agentFeesPct}
              onChange={e => setAgentFeesPct(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-slate-400" />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-slate-400 uppercase tracking-widest">Closing Costs</label>
              <span className="text-xs font-bold text-slate-300">{closingCostsPct}%</span>
            </div>
            <input type="range" min={0} max={5} step={0.25} value={closingCostsPct}
              onChange={e => setClosingCostsPct(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-slate-400" />
          </div>
        </div>
      </div>

      {/* Hero result */}
      <div className={`rounded-xl p-5 border ${isProfitable ? 'bg-green-900/20 border-green-700/50' : 'bg-red-900/20 border-red-700/50'}`}>
        <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">Estimated Net Profit</p>
        <p className={`text-4xl font-black ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
          {fmt(results.netProfit)}
        </p>
        <p className="text-sm text-slate-400 mt-1">
          {fmtPct(results.roi)} ROI · {fmtPct(results.annualizedRoi)} annualized · {fmtPct(results.profitMargin)} profit margin
        </p>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total Investment"  value={fmt(results.totalInvestment)} sub="Purchase + rehab" />
        <StatCard label="Selling Costs"     value={fmt(results.sellingCosts)}    sub={`Agent + closing fees`} />
        <StatCard label="Holding Costs"     value={fmt(results.holdingCosts)}    sub={`${holdingMonths} mo × ${fmt(monthlyCarrying)}`} />
        <StatCard label="Total All-In Cost" value={fmt(results.totalCosts)}      sub="Everything combined" />
      </div>

      {/* MAO box */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Maximum Allowable Offer (70% Rule)</p>
        <p className="text-3xl font-black text-yellow-400">{fmt(results.mao70)}</p>
        <p className="text-xs text-slate-500 mt-1">
          ARV × 70% − Rehab = {fmt(arv)} × 70% − {fmt(rehabBudget)}
        </p>
        <p className={`text-xs mt-2 font-semibold ${purchasePrice <= results.mao70 ? 'text-green-400' : 'text-red-400'}`}>
          {purchasePrice <= results.mao70
            ? `✓ Your purchase price (${fmt(purchasePrice)}) is below the MAO — deal looks viable`
            : `✗ Purchase price (${fmt(purchasePrice)}) exceeds MAO by ${fmt(purchasePrice - results.mao70)}`}
        </p>
      </div>

      {/* Cost breakdown table */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Cost Waterfall</p>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {[
              { label: 'Purchase price',    amount: purchasePrice },
              { label: 'Rehab budget',      amount: rehabBudget },
              { label: `Holding costs (${holdingMonths} mo)`, amount: results.holdingCosts },
              { label: `Selling costs (${(agentFeesPct + closingCostsPct).toFixed(1)}%)`, amount: results.sellingCosts },
            ].map(row => (
              <tr key={row.label} className="border-t border-slate-700/50">
                <td className="py-2 px-4 text-slate-400">{row.label}</td>
                <td className="py-2 px-4 text-right font-mono text-slate-300">{fmt(row.amount)}</td>
              </tr>
            ))}
            <tr className="border-t border-slate-600 bg-slate-800/50">
              <td className="py-2 px-4 font-bold text-slate-200">Total Costs</td>
              <td className="py-2 px-4 text-right font-mono font-bold text-slate-200">{fmt(results.totalCosts)}</td>
            </tr>
            <tr className="border-t border-slate-600">
              <td className="py-2 px-4 font-bold text-slate-200">Sale Price (ARV)</td>
              <td className="py-2 px-4 text-right font-mono font-bold text-slate-200">{fmt(arv)}</td>
            </tr>
            <tr className={`border-t-2 ${isProfitable ? 'border-green-600' : 'border-red-600'}`}>
              <td className="py-2.5 px-4 font-black text-white">Net Profit</td>
              <td className={`py-2.5 px-4 text-right font-mono font-black ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
                {fmt(results.netProfit)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Estimates only. Actual rehab costs and ARV should be verified with licensed contractors and a certified appraiser.
      </p>
    </div>
  )
}
