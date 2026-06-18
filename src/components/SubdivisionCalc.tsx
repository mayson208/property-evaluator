import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, Legend, PieChart, Pie, Cell } from 'recharts'

interface Inputs {
  totalAcres: number
  landCostPerAcre: number
  entitlementCost: number
  entitlementMonths: number
  grossLotYieldPct: number
  avgLotSizeSqft: number
  offSiteInfraPerLot: number
  onSiteInfraPerLot: number
  engineeringPerLot: number
  legalPerLot: number
  marketingPct: number
  constructionLoanRate: number
  constructionLtc: number
  absorptionLotsPerMonth: number
  avgLotSalePrice: number
  contingencyPct: number
  developerFeeMode: 'pct' | 'fixed'
  developerFeePct: number
  developerFeeFixed: number
  phaseCount: number
}

const DEF: Inputs = {
  totalAcres: 40,
  landCostPerAcre: 35000,
  entitlementCost: 120000,
  entitlementMonths: 18,
  grossLotYieldPct: 65,
  avgLotSizeSqft: 8500,
  offSiteInfraPerLot: 18000,
  onSiteInfraPerLot: 22000,
  engineeringPerLot: 5500,
  legalPerLot: 2000,
  marketingPct: 3,
  constructionLoanRate: 10,
  constructionLtc: 70,
  absorptionLotsPerMonth: 4,
  avgLotSalePrice: 95000,
  contingencyPct: 12,
  developerFeeMode: 'pct',
  developerFeePct: 5,
  developerFeeFixed: 200000,
  phaseCount: 2,
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const pct = (n: number) => `${n.toFixed(1)}%`
const N = (v: string) => parseFloat(v) || 0
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#f97316']

export default function SubdivisionCalc() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = (k: keyof Inputs, v: string | 'pct' | 'fixed') =>
    setInp(p => ({ ...p, [k]: typeof DEF[k] === 'number' ? N(v as string) : v }))

  const calc = useMemo(() => {
    const { totalAcres, landCostPerAcre, entitlementCost, entitlementMonths,
            grossLotYieldPct, avgLotSizeSqft, offSiteInfraPerLot, onSiteInfraPerLot,
            engineeringPerLot, legalPerLot, marketingPct, constructionLoanRate,
            constructionLtc, absorptionLotsPerMonth, avgLotSalePrice,
            contingencyPct, developerFeeMode, developerFeePct, developerFeeFixed, phaseCount } = inp

    // Lot yield
    const totalSqft = totalAcres * 43560
    const netDevelopableAcres = totalAcres * grossLotYieldPct / 100
    const totalLots = Math.floor((netDevelopableAcres * 43560) / avgLotSizeSqft)
    const lotsPerPhase = Math.ceil(totalLots / phaseCount)

    // Land cost
    const landCost = totalAcres * landCostPerAcre

    // Infrastructure & soft costs
    const infraPerLot = offSiteInfraPerLot + onSiteInfraPerLot + engineeringPerLot + legalPerLot
    const totalInfra = infraPerLot * totalLots
    const contingency = totalInfra * contingencyPct / 100
    const totalDevCosts = landCost + entitlementCost + totalInfra + contingency

    // Revenue
    const grossRevenue = totalLots * avgLotSalePrice
    const marketingCost = grossRevenue * marketingPct / 100

    // Developer fee
    const developerFee = developerFeeMode === 'pct' ? totalDevCosts * developerFeePct / 100 : developerFeeFixed

    // Construction loan interest
    const loanAmount = totalDevCosts * constructionLtc / 100
    const absorptionMonths = totalLots / absorptionLotsPerMonth
    const constructionAndEntitlement = entitlementMonths + absorptionMonths
    const constructionInterest = loanAmount * (constructionLoanRate / 100) * (constructionAndEntitlement / 12) * 0.55

    // Total project cost
    const totalProjectCost = totalDevCosts + developerFee + constructionInterest + marketingCost

    // Profit
    const equityRequired = totalProjectCost * (1 - constructionLtc / 100)
    const grossProfit = grossRevenue - totalProjectCost
    const profitMargin = grossProfit / grossRevenue * 100
    const roi = grossProfit / equityRequired * 100

    // Per lot economics
    const costPerLot = totalProjectCost / totalLots
    const profitPerLot = avgLotSalePrice - costPerLot
    const costPerSqft = costPerLot / avgLotSizeSqft

    // Break-even lot price
    const breakEvenLotPrice = totalProjectCost / totalLots

    // Phased absorption schedule
    const monthlyData: Array<{ month: number; lotsRemaining: number; cumRevenue: number; cumCashflow: number }> = []
    let lotsRemaining = totalLots
    let cumRevenue = 0
    let cumCost = -equityRequired - loanAmount
    const revenuePerLot = avgLotSalePrice - infraPerLot * (1 - constructionLtc / 100)
    for (let m = 1; m <= Math.ceil(absorptionMonths) + 6; m++) {
      const sold = Math.min(absorptionLotsPerMonth, lotsRemaining)
      lotsRemaining = Math.max(0, lotsRemaining - sold)
      cumRevenue += sold * avgLotSalePrice
      const monthlyInterest = loanAmount * (constructionLoanRate / 100) / 12
      cumCost += sold * revenuePerLot - monthlyInterest
      monthlyData.push({ month: m, lotsRemaining, cumRevenue, cumCashflow: cumCost })
    }

    // Cost breakdown
    const costPie = [
      { name: 'Land', value: landCost },
      { name: 'Entitlement', value: entitlementCost },
      { name: 'Off-Site Infra', value: offSiteInfraPerLot * totalLots },
      { name: 'On-Site Infra', value: onSiteInfraPerLot * totalLots },
      { name: 'Engineering/Legal', value: (engineeringPerLot + legalPerLot) * totalLots },
      { name: 'Contingency', value: contingency },
      { name: 'Dev Fee + Interest', value: developerFee + constructionInterest + marketingCost },
    ]

    // Scenario: lot price sensitivity
    const sensitivity = [-20, -10, 0, 10, 20].map(d => {
      const sp = avgLotSalePrice * (1 + d / 100)
      const gp = sp * totalLots - totalProjectCost
      return { change: `${d > 0 ? '+' : ''}${d}%`, profit: gp, margin: gp / (sp * totalLots) * 100 }
    })

    return {
      totalLots, lotsPerPhase, netDevelopableAcres,
      landCost, totalInfra, contingency, totalDevCosts,
      grossRevenue, marketingCost, developerFee, constructionInterest,
      totalProjectCost, equityRequired, grossProfit, profitMargin, roi,
      costPerLot, profitPerLot, costPerSqft, breakEvenLotPrice,
      absorptionMonths, monthlyData, costPie, sensitivity, infraPerLot,
    }
  }, [inp])

  const field = (label: string, key: keyof Inputs, prefix = '', suffix = '', step = '1') => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{prefix}</span>}
        <input type="number" step={step} value={inp[key] as number} onChange={e => set(key, e.target.value)}
          className={`w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 ${prefix ? 'pl-5 pr-3' : suffix ? 'pl-3 pr-7' : 'px-3'}`} />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{suffix}</span>}
      </div>
    </div>
  )

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-lg font-bold text-white">Land Subdivision Pro Forma</h2>
        <p className="text-slate-400 text-xs mt-1">Analyze raw land subdivision — lot yield, infrastructure costs, absorption, construction financing, and developer profit</p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Land &amp; Entitlement</p>
          {field('Total Acres', 'totalAcres', '', 'ac', '0.5')}
          {field('Land Cost / Acre', 'landCostPerAcre', '$', '/ac')}
          {field('Entitlement Cost (total)', 'entitlementCost', '$')}
          {field('Entitlement Period', 'entitlementMonths', '', 'months')}
          {field('Gross Lot Yield', 'grossLotYieldPct', '', '%', '1')}
          {field('Avg Lot Size', 'avgLotSizeSqft', '', 'sqft')}
          {field('Phases', 'phaseCount', '', 'phases')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Total Lots</span><span className="text-blue-400 font-bold">{calc.totalLots}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Lots / Phase</span><span className="text-slate-300">{calc.lotsPerPhase}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Net Dev. Acres</span><span className="text-slate-300">{calc.netDevelopableAcres.toFixed(1)} ac</span></div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Infrastructure Costs (Per Lot)</p>
          {field('Off-Site Infrastructure', 'offSiteInfraPerLot', '$', '/lot')}
          {field('On-Site Infrastructure', 'onSiteInfraPerLot', '$', '/lot')}
          {field('Engineering / Surveying', 'engineeringPerLot', '$', '/lot')}
          {field('Legal / Platting', 'legalPerLot', '$', '/lot')}
          {field('Contingency', 'contingencyPct', '', '%')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Total Infra / Lot</span><span className="text-orange-400 font-bold">{fmt(calc.infraPerLot)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Total Infra</span><span className="text-slate-300">{fmt(calc.totalInfra)}</span></div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Sales &amp; Financing</p>
          {field('Avg Lot Sale Price', 'avgLotSalePrice', '$', '/lot')}
          {field('Absorption Rate', 'absorptionLotsPerMonth', '', 'lots/mo', '0.5')}
          {field('Marketing', 'marketingPct', '', '%', '0.5')}
          {field('Construction Loan Rate', 'constructionLoanRate', '', '%', '0.25')}
          {field('Loan-to-Cost', 'constructionLtc', '', '%')}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Developer Fee</label>
            <div className="flex gap-2 mb-2">
              {(['pct', 'fixed'] as const).map(m => (
                <button key={m} onClick={() => setInp(p => ({ ...p, developerFeeMode: m }))}
                  className={`flex-1 py-1 rounded text-xs font-bold border transition ${inp.developerFeeMode === m ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                  {m === 'pct' ? '% of Cost' : 'Fixed $'}
                </button>
              ))}
            </div>
            {inp.developerFeeMode === 'pct' ? field('Fee %', 'developerFeePct', '', '%', '0.5') : field('Fixed Fee', 'developerFeeFixed', '$')}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className={`rounded-xl p-5 border ${calc.grossProfit > 0 ? 'bg-green-900/20 border-green-700/40' : 'bg-red-900/20 border-red-700/40'}`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-black text-white">{fmt(calc.grossRevenue)}</p>
            <p className="text-xs text-slate-400">Gross Revenue ({calc.totalLots} lots)</p>
          </div>
          <div>
            <p className={`text-2xl font-black ${calc.grossProfit > 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(calc.grossProfit)}</p>
            <p className="text-xs text-slate-400">Developer Profit</p>
          </div>
          <div>
            <p className={`text-2xl font-black ${calc.profitMargin > 15 ? 'text-green-400' : calc.profitMargin > 8 ? 'text-yellow-400' : 'text-red-400'}`}>{pct(calc.profitMargin)}</p>
            <p className="text-xs text-slate-400">Profit Margin</p>
          </div>
          <div>
            <p className="text-2xl font-black text-purple-400">{pct(calc.roi)}</p>
            <p className="text-xs text-slate-400">ROE</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center border-t border-slate-700/40 pt-3">
          {[
            { label: 'Cost / Lot', value: fmt(calc.costPerLot) },
            { label: 'Profit / Lot', value: fmt(calc.profitPerLot) },
            { label: 'Cost / SqFt', value: `$${calc.costPerSqft.toFixed(2)}` },
            { label: 'Break-Even Lot Price', value: fmt(calc.breakEvenLotPrice) },
          ].map(c => (
            <div key={c.label}>
              <p className="text-sm font-bold text-white">{c.value}</p>
              <p className="text-xs text-slate-500">{c.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Cost Breakdown</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={calc.costPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {calc.costPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Lot Price Sensitivity</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={calc.sensitivity}>
              <XAxis dataKey="change" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip formatter={(v: number, name: string) => name === 'profit' ? fmt(v) : `${(v as number).toFixed(1)}%`} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="profit" name="Profit" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Absorption */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Cumulative Revenue During Absorption ({calc.absorptionMonths.toFixed(0)} months)</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={calc.monthlyData}>
            <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} label={{ value: 'Month', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 10 }} />
            <YAxis tickFormatter={v => `$${(v / 1000000).toFixed(1)}M`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="cumRevenue" stroke="#22c55e" strokeWidth={2} dot={false} name="Cumulative Revenue" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Entitlement & Infrastructure Tips */}
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Subdivision Development Notes</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
          {[
            { icon: '🗺️', text: 'Off-site infrastructure (roads, utilities to site boundary) is often 40-50% of total infra cost' },
            { icon: '📋', text: 'Entitlement risk: zoning, EIA, traffic studies, HOA formation can add 12-36 months' },
            { icon: '🌊', text: 'Wetland delineation and stormwater management can significantly reduce net lot yield' },
            { icon: '💧', text: 'Water/sewer capacity commitments from municipalities are often the longest lead-time item' },
            { icon: '📊', text: 'Target profit margin: 15-20% on smaller projects, 20-25%+ on large-scale communities' },
            { icon: '🏦', text: 'Land acquisition + entitlement financed with equity; construction loan drawn during development' },
            { icon: '🔢', text: 'Rule of thumb: land cost should be ≤ 25% of sellout revenue for residential lots' },
            { icon: '📅', text: 'Absorb in phases to manage cash flow and adjust pricing based on market velocity' },
          ].map(t => (
            <div key={t.icon} className="flex gap-2">
              <span>{t.icon}</span>
              <span>{t.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
