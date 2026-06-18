import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts'

type SaleType = 'courthouse' | 'online' | 'reo' | 'shortsale'
type PropertyCondition = 'unknown' | 'poor' | 'fair' | 'good' | 'excellent'
type ExitStrategy = 'flip' | 'rental' | 'assign'

interface LienItem {
  id: string
  type: string
  amount: number
  senior: boolean
  survives: boolean
}

interface Inputs {
  saleType: SaleType
  arv: number
  openingBid: number
  propertyCondition: PropertyCondition
  rehabCost: number
  auctionFeesPct: number
  transferTaxPct: number
  titleInsurance: number
  evictionCost: number
  carryMonths: number
  carryMonthlyHOA: number
  carryTaxMonthly: number
  carryInsuranceMonthly: number
  exitStrategy: ExitStrategy
  flipSellingCostPct: number
  flipHoldMonths: number
  rentalMonthlyRent: number
  rentalExpenseRatio: number
  rentalCapRate: number
  assignFee: number
  targetProfitPct: number
  lienItems: LienItem[]
}

const DEF_LIENS: LienItem[] = [
  { id: '1', type: '1st Mortgage (foreclosing)', amount: 185000, senior: true,  survives: false },
  { id: '2', type: 'Property Tax Arrears',       amount: 4200,  senior: true,  survives: true  },
  { id: '3', type: 'HOA Lien',                   amount: 3800,  senior: false, survives: false },
  { id: '4', type: '2nd Mortgage / HELOC',        amount: 45000, senior: false, survives: false },
]

const DEF: Inputs = {
  saleType: 'courthouse',
  arv: 295000,
  openingBid: 168000,
  propertyCondition: 'fair',
  rehabCost: 32000,
  auctionFeesPct: 5,
  transferTaxPct: 0.5,
  titleInsurance: 1800,
  evictionCost: 3500,
  carryMonths: 4,
  carryMonthlyHOA: 280,
  carryTaxMonthly: 310,
  carryInsuranceMonthly: 120,
  exitStrategy: 'flip',
  flipSellingCostPct: 6,
  flipHoldMonths: 5,
  rentalMonthlyRent: 1800,
  rentalExpenseRatio: 38,
  rentalCapRate: 6.5,
  assignFee: 12000,
  targetProfitPct: 20,
  lienItems: DEF_LIENS,
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const N = (v: string) => parseFloat(v) || 0
let nextLienId = 5

const CONDITION_NOTES: Record<PropertyCondition, string> = {
  unknown: 'Unknown — cannot inspect before auction; add 15-20% extra contingency',
  poor: 'Poor — major systems failed, structural issues; highest rehab risk',
  fair: 'Fair — deferred maintenance, dated systems; typical foreclosure condition',
  good: 'Good — cosmetic updates only; minimal rehab risk',
  excellent: 'Excellent — move-in ready; rare for foreclosure; verify condition is accurate',
}

export default function ForeclosureAuction() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = <K extends keyof Inputs>(k: K, v: Inputs[K]) => setInp(p => ({ ...p, [k]: v }))
  const setN = (k: keyof Inputs, v: string) => setInp(p => ({ ...p, [k]: N(v) }))
  const updateLien = (id: string, k: keyof LienItem, v: string | boolean) =>
    setInp(p => ({ ...p, lienItems: p.lienItems.map(l => l.id === id ? { ...l, [k]: typeof v === 'boolean' ? v : (typeof l[k] === 'number' ? N(v as string) : v) } : l) }))

  const calc = useMemo(() => {
    const {
      arv, openingBid, rehabCost, auctionFeesPct, transferTaxPct, titleInsurance,
      evictionCost, carryMonths, carryMonthlyHOA, carryTaxMonthly, carryInsuranceMonthly,
      exitStrategy, flipSellingCostPct, rentalMonthlyRent, rentalExpenseRatio, rentalCapRate,
      assignFee, targetProfitPct, lienItems,
    } = inp

    // Liens that survive auction
    const survivingLiens = lienItems.filter(l => l.survives).reduce((s, l) => s + l.amount, 0)
    const totalLiensKnown = lienItems.reduce((s, l) => s + l.amount, 0)

    // Acquisition costs (on top of winning bid)
    const auctionFees = openingBid * auctionFeesPct / 100
    const transferTax = arv * transferTaxPct / 100
    const monthlyCary = carryMonthlyHOA + carryTaxMonthly + carryInsuranceMonthly
    const totalCarry = monthlyCary * carryMonths
    const acquisitionCosts = auctionFees + transferTax + titleInsurance + evictionCost + totalCarry + survivingLiens

    const allInAtOpeningBid = openingBid + rehabCost + acquisitionCosts

    // Exit scenarios
    let exitRevenue = 0, exitCosts = 0, exitLabel = ''
    if (exitStrategy === 'flip') {
      exitRevenue = arv
      exitCosts = arv * flipSellingCostPct / 100
      exitLabel = 'Flip'
    } else if (exitStrategy === 'rental') {
      const annualNOI = rentalMonthlyRent * 12 * (1 - rentalExpenseRatio / 100)
      exitRevenue = rentalCapRate > 0 ? annualNOI / (rentalCapRate / 100) : arv
      exitCosts = exitRevenue * 0.02 // minimal closing costs on refinance
      exitLabel = 'Rental Hold'
    } else {
      exitRevenue = openingBid + assignFee
      exitCosts = 0
      exitLabel = 'Assignment'
    }

    const netExitRevenue = exitRevenue - exitCosts
    const profitAtOpeningBid = netExitRevenue - allInAtOpeningBid
    const profitPctAtOpening = allInAtOpeningBid > 0 ? profitAtOpeningBid / allInAtOpeningBid * 100 : 0

    // Max bid for target profit
    const targetProfitAmt = netExitRevenue * targetProfitPct / 100
    const maxBid = netExitRevenue - targetProfitAmt - rehabCost - acquisitionCosts
    const maxBidSafe = Math.max(0, maxBid)

    // MAO (Maximum Allowable Offer) = 70% ARV - repairs (standard wholesaler formula)
    const mao70 = arv * 0.70 - rehabCost
    const mao65 = arv * 0.65 - rehabCost

    // Bid scenarios
    const bidScenarios = [
      openingBid,
      openingBid * 1.05,
      openingBid * 1.10,
      openingBid * 1.15,
      maxBidSafe,
      mao70,
    ].map(bid => {
      const allIn = bid + rehabCost + acquisitionCosts
      const profit = netExitRevenue - allIn
      const profitPct = allIn > 0 ? profit / allIn * 100 : 0
      return {
        bid: Math.round(bid),
        label: bid === openingBid ? 'Opening Bid' : bid === maxBidSafe ? 'Max Bid' : bid === mao70 ? '70% ARV-Repairs' : `+${Math.round((bid / openingBid - 1) * 100)}%`,
        allIn: Math.round(allIn),
        profit: Math.round(profit),
        profitPct: parseFloat(profitPct.toFixed(1)),
      }
    }).filter((s, i, arr) => i === 0 || Math.abs(s.bid - arr[i - 1].bid) > 500)

    // Risk flags
    const risks = [
      { flag: inp.propertyCondition === 'unknown', text: 'Cannot inspect — true rehab cost unknown; add 15-25% contingency to rehab estimate' },
      { flag: survivingLiens > 5000, text: `Surviving liens: ${fmt(survivingLiens)} — must be paid at/after closing, increases true cost` },
      { flag: inp.saleType === 'courthouse', text: 'Courthouse sale: cash-only, same-day funds required, no financing contingency' },
      { flag: openingBid > arv * 0.85, text: `Opening bid (${fmt(openingBid)}) is >85% of ARV — limited upside; very tight margin` },
      { flag: allInAtOpeningBid > netExitRevenue, text: 'All-in cost at opening bid EXCEEDS exit value — deal is underwater at any bid' },
      { flag: evictionCost === 0 && inp.propertyCondition !== 'excellent', text: 'No eviction cost budgeted — occupied properties are common at auction; add $3-8k buffer' },
    ].filter(r => r.flag)

    const annualNOI = rentalMonthlyRent * 12 * (1 - rentalExpenseRatio / 100)

    return {
      survivingLiens, acquisitionCosts, allInAtOpeningBid,
      exitRevenue, exitCosts, netExitRevenue, exitLabel,
      profitAtOpeningBid, profitPctAtOpening,
      maxBidSafe, mao70, mao65,
      bidScenarios, risks, annualNOI, transferTax, auctionFees, totalCarry,
    }
  }, [inp])

  const field = (label: string, key: keyof Inputs, suffix = '', prefix = '') => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{prefix}</span>}
        <input type="number" value={inp[key] as number} onChange={e => setN(key, e.target.value)}
          className={`w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 ${prefix ? 'pl-5 pr-3' : suffix ? 'pl-3 pr-8' : 'px-3'}`} />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{suffix}</span>}
      </div>
    </div>
  )

  const profitable = calc.profitAtOpeningBid > 0

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-lg font-bold text-white">Foreclosure Auction Analyzer</h2>
        <p className="text-slate-400 text-xs mt-1">Courthouse steps / online auction — max bid, surviving liens, all-in cost, flip/rental/assign profit at each bid level</p>
      </div>

      {calc.risks.length > 0 && (
        <div className="bg-red-900/20 rounded-xl p-3 border border-red-700/40">
          <p className="text-xs font-bold text-red-300 mb-2">⚠️ Risk Flags ({calc.risks.length})</p>
          <ul className="space-y-1">{calc.risks.map((r, i) => <li key={i} className="text-xs text-red-200">• {r.text}</li>)}</ul>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Max Bid (target profit)', value: fmt(calc.maxBidSafe), color: 'text-blue-400' },
          { label: '70% ARV − Repairs (MAO)', value: fmt(calc.mao70), color: 'text-purple-400' },
          { label: 'Profit at Opening Bid', value: fmt(calc.profitAtOpeningBid), color: profitable ? 'text-green-400' : 'text-red-400' },
          { label: 'All-In at Opening Bid', value: fmt(calc.allInAtOpeningBid), color: 'text-orange-400' },
        ].map(m => (
          <div key={m.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
            <p className={`text-2xl font-black ${m.color}`}>{m.value}</p>
            <p className="text-xs text-slate-400 mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Property & Bid */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Property & Auction</p>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Sale Type</label>
            <select value={inp.saleType} onChange={e => set('saleType', e.target.value as SaleType)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
              <option value="courthouse">Courthouse Steps (cash, same-day)</option>
              <option value="online">Online Auction (Hubzu, Auction.com)</option>
              <option value="reo">Bank REO (traditional offer)</option>
              <option value="shortsale">Short Sale (lender approval needed)</option>
            </select>
          </div>
          {field('After-Repair Value (ARV)', 'arv', '', '$')}
          {field('Opening / Minimum Bid', 'openingBid', '', '$')}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Property Condition</label>
            <select value={inp.propertyCondition} onChange={e => set('propertyCondition', e.target.value as PropertyCondition)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
              {(Object.keys(CONDITION_NOTES) as PropertyCondition[]).map(k => <option key={k} value={k} className="capitalize">{k.charAt(0).toUpperCase() + k.slice(1)}</option>)}
            </select>
            <p className="text-xs text-slate-500 mt-1">{CONDITION_NOTES[inp.propertyCondition]}</p>
          </div>
          {field('Estimated Rehab Cost', 'rehabCost', '', '$')}
          {field('Auction Buyer Premium', 'auctionFeesPct', '%')}
          {field('Transfer Tax', 'transferTaxPct', '% of ARV')}
          {field('Title Insurance', 'titleInsurance', '', '$')}
          {field('Eviction / Occupant Removal', 'evictionCost', '', '$')}
        </div>

        {/* Carry & Exit */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Carry Costs & Exit</p>
          {field('Carry Period', 'carryMonths', 'mo')}
          {field('Monthly HOA', 'carryMonthlyHOA', '', '$')}
          {field('Monthly Property Tax', 'carryTaxMonthly', '', '$')}
          {field('Monthly Insurance', 'carryInsuranceMonthly', '', '$')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Monthly Carry</span><span className="text-orange-400">{fmt(inp.carryMonthlyHOA + inp.carryTaxMonthly + inp.carryInsuranceMonthly)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Total Carry ({inp.carryMonths}mo)</span><span className="text-orange-400">{fmt(calc.totalCarry)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Surviving Liens</span><span className="text-red-400">{fmt(calc.survivingLiens)}</span></div>
            <div className="flex justify-between border-t border-slate-700 pt-1"><span className="text-white font-bold">Total Acquisition Add-Ons</span><span className="text-red-400 font-bold">{fmt(calc.acquisitionCosts)}</span></div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-2">Exit Strategy</label>
            <div className="space-y-1">
              {([['flip', '🔨 Flip — renovate and sell'], ['rental', '🏠 Rental — buy and hold'], ['assign', '📋 Assign — wholesale the contract']] as const).map(([v, label]) => (
                <label key={v} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs transition ${inp.exitStrategy === v ? 'border-blue-500 bg-blue-900/20' : 'border-slate-700'}`}>
                  <input type="radio" name="exit" value={v} checked={inp.exitStrategy === v} onChange={() => set('exitStrategy', v)} />
                  <span className="text-slate-200">{label}</span>
                </label>
              ))}
            </div>
          </div>
          {inp.exitStrategy === 'flip' && field('Selling Costs (agent + closing)', 'flipSellingCostPct', '% of ARV')}
          {inp.exitStrategy === 'rental' && (
            <>
              {field('Monthly Rent', 'rentalMonthlyRent', '', '$')}
              {field('Expense Ratio', 'rentalExpenseRatio', '%')}
              {field('Cap Rate (for valuation)', 'rentalCapRate', '%')}
            </>
          )}
          {inp.exitStrategy === 'assign' && field('Assignment Fee', 'assignFee', '', '$')}
          {field('Target Profit %', 'targetProfitPct', '% of exit value')}
          <div className="p-2 bg-blue-900/20 border border-blue-700/30 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-blue-300">Exit Revenue ({calc.exitLabel})</span><span className="text-white">{fmt(calc.exitRevenue)}</span></div>
            <div className="flex justify-between"><span className="text-blue-300">Net Exit Proceeds</span><span className="text-green-400 font-bold">{fmt(calc.netExitRevenue)}</span></div>
          </div>
        </div>

        {/* Liens */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Known Liens</p>
            <button onClick={() => setInp(p => ({ ...p, lienItems: [...p.lienItems, { id: String(nextLienId++), type: 'Unknown Lien', amount: 0, senior: false, survives: false }] }))}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded">+ Add</button>
          </div>
          <div className="space-y-2">
            {inp.lienItems.map(l => (
              <div key={l.id} className={`p-2 rounded-lg border ${l.survives ? 'border-red-700/40 bg-red-900/10' : 'border-slate-700 bg-slate-900/30'} text-xs`}>
                <div className="flex items-center gap-2 mb-1">
                  <input value={l.type} onChange={e => updateLien(l.id, 'type', e.target.value)}
                    className="bg-transparent flex-1 outline-none text-slate-200 border-b border-slate-700 focus:border-blue-500" />
                  <button onClick={() => setInp(p => ({ ...p, lienItems: p.lienItems.filter(x => x.id !== l.id) }))} className="text-slate-600 hover:text-red-400">✕</button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-500">$</span>
                    <input type="number" value={l.amount} onChange={e => updateLien(l.id, 'amount', e.target.value)}
                      className="bg-transparent text-slate-300 w-20 outline-none border-b border-slate-700 focus:border-blue-500" />
                  </div>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={l.survives} onChange={e => updateLien(l.id, 'survives', e.target.checked)} className="w-3 h-3" />
                    <span className={l.survives ? 'text-red-400' : 'text-slate-500'}>Survives auction</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Surviving Liens</span><span className="text-red-400 font-bold">{fmt(calc.survivingLiens)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Wiped at Auction</span><span className="text-green-400">{fmt(inp.lienItems.reduce((s, l) => s + (!l.survives ? l.amount : 0), 0))}</span></div>
          </div>
          <p className="text-xs text-slate-500">⚠️ IRS liens: survive foreclosure for 120 days; USDA/SBA liens: complex — always run title search before bidding</p>
        </div>
      </div>

      {/* Bid Scenario Table */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-3 border-b border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Bid Scenario Analysis — {calc.exitLabel} Exit</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-slate-500 border-b border-slate-700 bg-slate-900/30">
              <th className="text-left py-2 px-3">Scenario</th>
              <th className="text-right py-2 px-3">Winning Bid</th>
              <th className="text-right py-2 px-3">All-In Cost</th>
              <th className="text-right py-2 px-3">Profit</th>
              <th className="text-right py-2 px-3">Profit %</th>
              <th className="text-right py-2 px-3">% of ARV</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-700/50">
              {calc.bidScenarios.map(s => (
                <tr key={s.bid} className={`${s.bid === calc.maxBidSafe ? 'bg-blue-900/10' : 'hover:bg-slate-700/20'}`}>
                  <td className="py-2 px-3 text-slate-300 font-semibold">{s.label}</td>
                  <td className="text-right py-2 px-3 text-white">{fmt(s.bid)}</td>
                  <td className="text-right py-2 px-3 text-orange-400">{fmt(s.allIn)}</td>
                  <td className={`text-right py-2 px-3 font-bold ${s.profit > 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(s.profit)}</td>
                  <td className={`text-right py-2 px-3 ${s.profitPct >= inp.targetProfitPct ? 'text-green-400' : s.profitPct > 0 ? 'text-yellow-400' : 'text-red-400'}`}>{s.profitPct.toFixed(1)}%</td>
                  <td className="text-right py-2 px-3 text-slate-400">{inp.arv > 0 ? (s.bid / inp.arv * 100).toFixed(1) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Profit by Bid Level</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={calc.bidScenarios}>
            <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 9 }} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number, n: string) => n === 'Profit %' ? `${v.toFixed(1)}%` : fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
            <Bar dataKey="profit" name="Net Profit" radius={[4, 4, 0, 0]} fill="#22c55e" />
            <Bar dataKey="allIn" name="All-In Cost" radius={[4, 4, 0, 0]} fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Foreclosure Auction — Investor Guide</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
          {[
            '💵 Cash-only: courthouse sales typically require full payment within 24-48hrs; have certified funds ready',
            '🔍 Title search: run before bidding; look for IRS liens (120-day right of redemption), HOA superpriority liens, environmental',
            '🏚 No inspections: you bid sight-unseen on interior condition — always assume unknown and budget accordingly',
            '⚖️ Lien priority: senior liens are wiped; junior liens (2nd mortgage, mechanic\'s liens) may survive based on state law',
            '📋 Redemption rights: some states give the borrower 6-12 months to redeem after sale — you can\'t move in immediately',
            '🏦 Online auctions (Hubzu, Auction.com): allow more research time but add 5-10% buyer premium to all bids',
            '70% Rule: investors typically bid max 70% ARV minus repairs — protects profit even if holding costs run over',
            '🎯 REO alternative: bank-owned (post-foreclosure) properties allow inspections and traditional financing — less risk, less discount',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
