import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line, ReferenceLine } from 'recharts'

type CurrentZone = 'agricultural' | 'rural_residential' | 'sfr' | 'commercial_retail' | 'industrial'
type TargetUse = 'multifamily' | 'mixed_use' | 'commercial_office' | 'commercial_retail' | 'industrial' | 'sfr_subdivision'

interface EntitlementCost {
  id: string
  name: string
  amount: number
  required: boolean
}

interface Inputs {
  landAcres: number
  purchasePrice: number
  currentZone: CurrentZone
  targetUse: TargetUse
  // Entitlement
  entitlementMonths: number
  approvalProbability: number
  // Buildable product
  densityUnitsPerAcre: number
  avgUnitSizeSqft: number
  avgUnitSellPrice: number
  // Post-entitlement land value
  landValuePerUnit: number
  landValuePerSqft: number
  useUnitBasis: boolean
  // Carry during entitlement
  annualPropertyTax: number
  monthlyCarry: number
  // Already-entitled comparison
  entitledLandPricePerUnit: number
  costs: EntitlementCost[]
}

const DEF_COSTS: EntitlementCost[] = [
  { id: '1', name: 'Land Use Attorney',           amount: 85000,  required: true  },
  { id: '2', name: 'Planning Consultant',          amount: 45000,  required: true  },
  { id: '3', name: 'Environmental Impact Report',  amount: 120000, required: true  },
  { id: '4', name: 'Traffic Impact Study',         amount: 28000,  required: true  },
  { id: '5', name: 'Civil Engineering / Survey',   amount: 55000,  required: true  },
  { id: '6', name: 'Market Study',                 amount: 18000,  required: false },
  { id: '7', name: 'Architecture / Site Plan',     amount: 35000,  required: true  },
  { id: '8', name: 'Community Outreach / Lobbyist',amount: 25000,  required: false },
  { id: '9', name: 'Government Fees / Permits',    amount: 42000,  required: true  },
]

const DEF: Inputs = {
  landAcres: 5.5,
  purchasePrice: 1200000,
  currentZone: 'sfr',
  targetUse: 'multifamily',
  entitlementMonths: 24,
  approvalProbability: 65,
  densityUnitsPerAcre: 28,
  avgUnitSizeSqft: 950,
  avgUnitSellPrice: 420000,
  landValuePerUnit: 28000,
  landValuePerSqft: 0,
  useUnitBasis: true,
  annualPropertyTax: 15000,
  monthlyCarry: 3200,
  entitledLandPricePerUnit: 45000,
  costs: DEF_COSTS,
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const fmtM = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : fmt(n)
const N = (v: string) => parseFloat(v) || 0
let nextCostId = 10

const TARGET_USE_NOTES: Record<TargetUse, string> = {
  multifamily: 'Multifamily — apartment/condo; highest density; strongest demand in most markets',
  mixed_use: 'Mixed-Use — ground-floor retail + upper residential; complex approval; premium land value',
  commercial_office: 'Commercial Office — suburban office entitlement; harder in post-COVID market; niche demand',
  commercial_retail: 'Commercial Retail — strip center, anchored; faster approval in pro-growth areas',
  industrial: 'Industrial / Logistics — fastest approvals; strong demand; limited supply in most metros',
  sfr_subdivision: 'SFR Subdivision — traditional subdivision plat; well-understood process; lower risk/reward',
}

const CURRENT_ZONE_MULT: Record<CurrentZone, string> = {
  agricultural: 'Agricultural → any urban use: massive value jump but lengthy EIR, often requires GP amendment',
  rural_residential: 'Rural Res → urban: requires annexation or sphere-of-influence expansion in many jurisdictions',
  sfr: 'SFR → multifamily/commercial: most common upzone; opposition from neighbors is primary risk',
  commercial_retail: 'Commercial → office/industrial: usually same entitlement tier; relatively straightforward',
  industrial: 'Industrial → residential/mixed: possible but faces NIMBYism and compatibility concerns',
}

export default function LandEntitlement() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = <K extends keyof Inputs>(k: K, v: string) => setInp(p => ({ ...p, [k]: N(v) }))
  const updateCost = (id: string, k: keyof EntitlementCost, v: string | boolean) =>
    setInp(p => ({ ...p, costs: p.costs.map(c => c.id === id ? { ...c, [k]: typeof v === 'boolean' ? v : (typeof c[k] === 'number' ? N(v as string) : v) } : c) }))

  const calc = useMemo(() => {
    const {
      landAcres, purchasePrice, entitlementMonths, approvalProbability,
      densityUnitsPerAcre, avgUnitSizeSqft, avgUnitSellPrice,
      landValuePerUnit, useUnitBasis,
      annualPropertyTax, monthlyCarry,
      entitledLandPricePerUnit, costs,
    } = inp

    const totalUnits = Math.round(landAcres * densityUnitsPerAcre)
    const totalBuildableSqft = totalUnits * avgUnitSizeSqft
    const grossSellout = totalUnits * avgUnitSellPrice

    // Entitlement costs
    const totalEntitlementCost = costs.filter(c => c.required).reduce((s, c) => s + c.amount, 0)
    const totalAllCosts = costs.reduce((s, c) => s + c.amount, 0)

    // Carry during entitlement
    const taxDuringEntitlement = annualPropertyTax * entitlementMonths / 12
    const carryDuringEntitlement = monthlyCarry * entitlementMonths
    const totalCarry = taxDuringEntitlement + carryDuringEntitlement

    // Total investment in entitlement
    const totalInvested = purchasePrice + totalAllCosts + totalCarry

    // Post-entitlement land value
    const postEntitlementValue = useUnitBasis ? totalUnits * landValuePerUnit : totalBuildableSqft * inp.landValuePerSqft

    // Value creation
    const grossValueCreation = postEntitlementValue - purchasePrice
    const netValueCreation = postEntitlementValue - totalInvested
    const roi = totalInvested > 0 ? netValueCreation / totalInvested * 100 : 0
    const annualizedROI = entitlementMonths > 0 ? (Math.pow(1 + roi / 100, 12 / entitlementMonths) - 1) * 100 : 0

    // Expected value (probability-adjusted)
    const pApproval = approvalProbability / 100
    const pDenial = 1 - pApproval
    // On denial: land value reverts toward purchase price minus costs sunk; assume 70% recovery
    const denialRecovery = purchasePrice * 0.70 - totalAllCosts - totalCarry
    const expectedValue = pApproval * postEntitlementValue + pDenial * Math.max(0, denialRecovery)
    const expectedProfit = expectedValue - totalInvested
    const expectedROI = totalInvested > 0 ? expectedProfit / totalInvested * 100 : 0

    // Land as % of sellout (residential benchmark: land should be 15-25% of sellout)
    const landPctSellout = grossSellout > 0 ? purchasePrice / grossSellout * 100 : 0
    const postEntitlementPctSellout = grossSellout > 0 ? postEntitlementValue / grossSellout * 100 : 0

    // Entitled land alternative
    const entitledLandCost = totalUnits * entitledLandPricePerUnit
    const entitlementPremium = entitledLandCost - purchasePrice
    const entitlementBreakeven = entitlementPremium - totalAllCosts - totalCarry // positive = entitlement cheaper
    const entitleSaves = entitlementBreakeven > 0

    // Probability sensitivity
    const probSensitivity = [0.30, 0.40, 0.50, 0.60, 0.65, 0.70, 0.80, 0.90].map(p => ({
      prob: `${(p * 100).toFixed(0)}%`,
      ev: Math.round(p * postEntitlementValue + (1 - p) * Math.max(0, denialRecovery) - totalInvested),
    }))

    // Cost waterfall
    const costWaterfall = [
      { name: 'Purchase Price', value: purchasePrice },
      { name: 'Entitlement Costs', value: totalAllCosts },
      { name: 'Carry During Entitlement', value: Math.round(totalCarry) },
      { name: 'Post-Entitlement Value', value: Math.round(postEntitlementValue) },
    ]

    const risks = [
      { flag: approvalProbability < 50, text: `Low approval probability (${approvalProbability}%) — consider pre-application meeting with planning dept before purchasing land` },
      { flag: entitlementMonths > 30, text: `Long entitlement timeline (${entitlementMonths}mo) — carry costs and capital lock-up are substantial; verify political/regulatory environment` },
      { flag: landPctSellout > 25, text: `Land is ${landPctSellout.toFixed(0)}% of sellout — above 25% threshold; builder may not pencil, limiting post-entitlement buyers` },
      { flag: netValueCreation < 0, text: 'Net value creation is negative — entitlement costs + carry exceed value uplift; reconsider density or purchase price' },
      { flag: totalAllCosts > purchasePrice * 0.25, text: `Entitlement costs (${fmtM(totalAllCosts)}) are >25% of land purchase — very high cost entitlement; validate scope` },
    ].filter(r => r.flag)

    return {
      totalUnits, totalBuildableSqft, grossSellout,
      totalEntitlementCost, totalAllCosts, taxDuringEntitlement, carryDuringEntitlement, totalCarry,
      totalInvested, postEntitlementValue, grossValueCreation, netValueCreation, roi, annualizedROI,
      pApproval, pDenial, denialRecovery, expectedValue, expectedProfit, expectedROI,
      landPctSellout, postEntitlementPctSellout, entitledLandCost, entitlementPremium,
      entitlementBreakeven, entitleSaves, probSensitivity, costWaterfall, risks,
    }
  }, [inp])

  const field = (label: string, key: keyof Inputs, suffix = '', prefix = '') => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{prefix}</span>}
        <input type="number" value={inp[key] as number} onChange={e => set(key, e.target.value)}
          className={`w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 ${prefix ? 'pl-5 pr-3' : suffix ? 'pl-3 pr-8' : 'px-3'}`} />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{suffix}</span>}
      </div>
    </div>
  )

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-lg font-bold text-white">Land Entitlement Analyzer</h2>
        <p className="text-slate-400 text-xs mt-1">Rezoning / entitlement value creation — upzone costs, approval probability, expected value, raw vs pre-entitled land comparison</p>
      </div>

      {calc.risks.length > 0 && (
        <div className="bg-red-900/20 rounded-xl p-3 border border-red-700/40">
          <p className="text-xs font-bold text-red-300 mb-2">⚠️ Risk Flags</p>
          <ul className="space-y-1">{calc.risks.map((r, i) => <li key={i} className="text-xs text-red-200">• {r.text}</li>)}</ul>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Buildable Units', value: calc.totalUnits.toLocaleString(), color: 'text-blue-400' },
          { label: 'Net Value Creation', value: fmtM(calc.netValueCreation), color: calc.netValueCreation > 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'Expected Profit (risk-adj)', value: fmtM(calc.expectedProfit), color: calc.expectedProfit > 0 ? 'text-purple-400' : 'text-red-400' },
          { label: 'Annualized ROI', value: `${calc.annualizedROI.toFixed(1)}%`, color: calc.annualizedROI >= 20 ? 'text-green-400' : calc.annualizedROI >= 10 ? 'text-yellow-400' : 'text-red-400' },
        ].map(m => (
          <div key={m.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
            <p className={`text-2xl font-black ${m.color}`}>{m.value}</p>
            <p className="text-xs text-slate-400 mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Land & Project */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Land & Project</p>
          {field('Land Area', 'landAcres', 'acres')}
          {field('Purchase Price', 'purchasePrice', '', '$')}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Current Zoning</label>
            <select value={inp.currentZone} onChange={e => setInp(p => ({ ...p, currentZone: e.target.value as CurrentZone }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
              <option value="agricultural">Agricultural</option>
              <option value="rural_residential">Rural Residential</option>
              <option value="sfr">Single-Family Residential</option>
              <option value="commercial_retail">Commercial Retail</option>
              <option value="industrial">Industrial</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">{CURRENT_ZONE_MULT[inp.currentZone]}</p>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Target Use After Entitlement</label>
            <select value={inp.targetUse} onChange={e => setInp(p => ({ ...p, targetUse: e.target.value as TargetUse }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
              <option value="multifamily">Multifamily</option>
              <option value="mixed_use">Mixed-Use</option>
              <option value="commercial_office">Commercial Office</option>
              <option value="commercial_retail">Commercial Retail</option>
              <option value="industrial">Industrial</option>
              <option value="sfr_subdivision">SFR Subdivision</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">{TARGET_USE_NOTES[inp.targetUse]}</p>
          </div>
          {field('Density (units/acre)', 'densityUnitsPerAcre', 'du/ac')}
          {field('Avg Unit Size', 'avgUnitSizeSqft', 'sqft')}
          {field('Avg Unit Sell Price', 'avgUnitSellPrice', '', '$')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Total Units</span><span className="text-blue-400 font-bold">{calc.totalUnits}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Total Buildable SF</span><span className="text-slate-300">{calc.totalBuildableSqft.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Gross Sellout</span><span className="text-green-400">{fmtM(calc.grossSellout)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Land % of Sellout</span><span className={calc.landPctSellout <= 25 ? 'text-green-400' : 'text-red-400'}>{calc.landPctSellout.toFixed(1)}%</span></div>
          </div>
        </div>

        {/* Entitlement Process */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Entitlement Process</p>
          {field('Timeline', 'entitlementMonths', 'months')}
          {field('Approval Probability', 'approvalProbability', '%')}
          {field('Annual Property Tax', 'annualPropertyTax', '/yr', '$')}
          {field('Monthly Other Carry', 'monthlyCarry', '/mo', '$')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Tax During Entitlement</span><span className="text-orange-400">{fmt(calc.taxDuringEntitlement)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Other Carry</span><span className="text-orange-400">{fmt(calc.carryDuringEntitlement)}</span></div>
            <div className="flex justify-between border-t border-slate-700 pt-1"><span className="text-white">Total Carry</span><span className="text-orange-400 font-bold">{fmt(calc.totalCarry)}</span></div>
          </div>

          {/* Post-entitlement value */}
          <div className="border-t border-slate-700 pt-3">
            <p className="text-xs font-bold text-slate-400 mb-2">Post-Entitlement Land Value</p>
            <div className="flex gap-2 mb-2">
              {([true, false] as const).map(v => (
                <button key={String(v)} onClick={() => setInp(p => ({ ...p, useUnitBasis: v }))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${inp.useUnitBasis === v ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                  {v ? '$/unit' : '$/sqft'}
                </button>
              ))}
            </div>
            {inp.useUnitBasis ? field('Land Value per Unit', 'landValuePerUnit', '/unit', '$') : field('Land Value per Sqft', 'landValuePerSqft', '/sqft', '$')}
            <div className="p-2 bg-green-900/20 border border-green-700/30 rounded-lg text-xs space-y-1 mt-2">
              <div className="flex justify-between"><span className="text-green-300">Post-Entitlement Value</span><span className="text-white font-bold">{fmtM(calc.postEntitlementValue)}</span></div>
              <div className="flex justify-between"><span className="text-green-300">% of Sellout</span><span className={calc.postEntitlementPctSellout <= 30 ? 'text-green-400' : 'text-yellow-400'}>{calc.postEntitlementPctSellout.toFixed(1)}%</span></div>
            </div>
          </div>
        </div>

        {/* Returns */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Returns & Comparison</p>
          <div className="space-y-2">
            {[
              { label: 'Purchase Price', value: fmt(inp.purchasePrice), color: 'text-slate-300' },
              { label: 'Total Entitlement Costs', value: `(${fmt(calc.totalAllCosts)})`, color: 'text-orange-400' },
              { label: 'Carry During Entitlement', value: `(${fmt(calc.totalCarry)})`, color: 'text-orange-400' },
              { label: 'Total Invested', value: fmt(calc.totalInvested), color: 'text-white', bold: true },
              { label: 'Post-Entitlement Value', value: fmtM(calc.postEntitlementValue), color: 'text-green-400' },
              { label: 'Net Value Creation', value: fmtM(calc.netValueCreation), color: calc.netValueCreation > 0 ? 'text-green-400' : 'text-red-400', bold: true },
              { label: 'ROI (if approved)', value: `${calc.roi.toFixed(1)}%`, color: calc.roi >= 20 ? 'text-green-400' : 'text-yellow-400' },
              { label: 'Annualized ROI', value: `${calc.annualizedROI.toFixed(1)}%`, color: calc.annualizedROI >= 20 ? 'text-green-400' : 'text-yellow-400' },
            ].map(m => (
              <div key={m.label} className={`flex justify-between p-1.5 rounded ${(m as {bold?: boolean}).bold ? 'bg-slate-700/30' : ''}`}>
                <span className="text-xs text-slate-400">{m.label}</span>
                <span className={`text-xs font-bold ${m.color}`}>{m.value}</span>
              </div>
            ))}
          </div>
          <div className="p-3 bg-purple-900/20 border border-purple-700/30 rounded-lg text-xs space-y-1">
            <p className="font-bold text-purple-300">Risk-Adjusted (Expected Value)</p>
            <div className="flex justify-between"><span className="text-slate-400">P(approval)</span><span>{inp.approvalProbability}%</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Denial recovery est.</span><span className="text-red-400">{fmt(Math.max(0, calc.denialRecovery))}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Expected Value</span><span className="text-white">{fmtM(calc.expectedValue)}</span></div>
            <div className="flex justify-between border-t border-slate-700 pt-1"><span className="text-purple-300 font-bold">Expected Profit</span><span className={`font-bold ${calc.expectedProfit > 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtM(calc.expectedProfit)}</span></div>
          </div>

          {/* Buy entitled land comparison */}
          <div className="border-t border-slate-700 pt-3">
            <p className="text-xs font-bold text-slate-400 mb-2">vs Buying Entitled Land</p>
            {field('Entitled Land Price/Unit', 'entitledLandPricePerUnit', '/unit', '$')}
            <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1 mt-2">
              <div className="flex justify-between"><span className="text-slate-400">Entitled Land Cost</span><span className="text-white">{fmtM(calc.entitledLandCost)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Premium over Raw</span><span className="text-orange-400">{fmtM(calc.entitlementPremium)}</span></div>
              <div className="flex justify-between border-t border-slate-700 pt-1">
                <span className="font-bold text-slate-300">Net Savings Entitling</span>
                <span className={`font-bold ${calc.entitleSaves ? 'text-green-400' : 'text-red-400'}`}>{calc.entitleSaves ? '+' : ''}{fmtM(calc.entitlementBreakeven)}</span>
              </div>
              <p className="text-slate-500">{calc.entitleSaves ? '✅ Entitling is cheaper than buying entitled land' : '⚠️ Buying entitled land costs less after entitlement risk'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Entitlement Costs Table */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Entitlement Cost Breakdown</p>
          <button onClick={() => setInp(p => ({ ...p, costs: [...p.costs, { id: String(nextCostId++), name: 'Additional Cost', amount: 10000, required: true }] }))}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg">+ Add</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-slate-500 border-b border-slate-700 bg-slate-900/30">
              <th className="text-left py-2 px-3">Line Item</th>
              <th className="text-right py-2 px-3">Amount</th>
              <th className="text-center py-2 px-3">Required</th>
              <th className="py-2 px-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-slate-700/50">
              {inp.costs.map(c => (
                <tr key={c.id} className={c.required ? '' : 'opacity-70'}>
                  <td className="py-2 px-3">
                    <input value={c.name} onChange={e => updateCost(c.id, 'name', e.target.value)}
                      className="bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none text-slate-200 w-full" />
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-slate-500">$</span>
                      <input type="number" value={c.amount} onChange={e => updateCost(c.id, 'amount', e.target.value)}
                        className="bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none text-right text-slate-300 w-24" />
                    </div>
                  </td>
                  <td className="text-center py-2 px-3">
                    <input type="checkbox" checked={c.required} onChange={e => updateCost(c.id, 'required', e.target.checked)} className="w-3.5 h-3.5" />
                  </td>
                  <td className="py-2 px-3">
                    <button onClick={() => setInp(p => ({ ...p, costs: p.costs.filter(x => x.id !== c.id) }))} className="text-slate-600 hover:text-red-400">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="border-t border-slate-600 bg-slate-900/30">
              <td className="py-2 px-3 text-xs font-bold text-white">Total (Required)</td>
              <td className="text-right py-2 px-3 text-xs font-bold text-orange-400">{fmt(calc.totalEntitlementCost)}</td>
              <td /><td />
            </tr></tfoot>
          </table>
        </div>
      </div>

      {/* Probability Sensitivity */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Expected Profit by Approval Probability</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={calc.probSensitivity}>
            <XAxis dataKey="prob" tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
            <Bar dataKey="ev" name="Expected Profit" radius={[4, 4, 0, 0]} fill="#a855f7" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Value Waterfall */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Cost vs Value Waterfall</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={calc.costWaterfall}>
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 9 }} />
            <YAxis tickFormatter={v => fmtM(v)} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmtM(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Bar dataKey="value" name="Value / Cost" radius={[4, 4, 0, 0]} fill="#3b82f6">
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Land Entitlement — Investor Guide</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
          {[
            '🏛 Pre-application meeting: always meet informally with planning staff before buying — learn if the use is even conceptually supportable',
            '📋 General Plan conformance: entitlement is much faster if target use is already in the General Plan; GP amendments add 12-24+ months',
            '🤝 Community support: organize early outreach; opposition groups can trigger ballot referendums (NIMBY risk); budget for community relations',
            '⚖️ CEQA/NEPA: California/federal projects need Environmental Review — mitigated negative declaration vs full EIR = $40k vs $200k+, 6 vs 18+ months',
            '💰 Land value benchmarks: multifamily land typically 15-20% of total project cost; industrial 10-15%; retail/office 15-25%',
            '📐 Density bonus: in California (AB 2345) and many states, include affordable units to unlock 50-100% density bonus — dramatically improves land value',
            '🔄 Entitlement types: by-right (fastest, lowest risk), discretionary (planning commission, political risk), GP amendment (slowest, most valuable if approved)',
            '📊 Exit timing: can sell entitled land to a builder, or take to permit and sell for higher premium — permits add 6-12 months but 10-20% value uplift',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
