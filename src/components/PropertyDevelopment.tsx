import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts'

interface Inputs {
  landCost: number
  landClosingCosts: number
  projectType: 'singleFamily' | 'multiFamily' | 'mixedUse' | 'condo' | 'townhome'
  units: number
  avgUnitSize: number
  hardCostPerSqft: number
  contingencyPct: number
  architectFees: number
  engineeringFees: number
  permittingFees: number
  marketingPct: number
  constructionLoanRate: number
  constructionMonths: number
  constructionLoanLTC: number
  exitCapRate: number
  avgUnitSalePrice: number
  avgMonthlyRent: number
  absorptionMonths: number
  developerFeeMode: 'pct' | 'fixed'
  developerFeePct: number
  developerFeeFixed: number
}

const TYPES: Record<string, string> = {
  singleFamily: 'Single-Family', multiFamily: 'Multi-Family',
  mixedUse: 'Mixed-Use', condo: 'Condo', townhome: 'Townhome',
}

const DEF: Inputs = {
  landCost: 300000, landClosingCosts: 15000,
  projectType: 'multiFamily', units: 8, avgUnitSize: 900,
  hardCostPerSqft: 145, contingencyPct: 10,
  architectFees: 45000, engineeringFees: 18000, permittingFees: 22000,
  marketingPct: 1.5, constructionLoanRate: 10.5,
  constructionMonths: 14, constructionLoanLTC: 75,
  exitCapRate: 6.5, avgUnitSalePrice: 350000, avgMonthlyRent: 1800,
  absorptionMonths: 6,
  developerFeeMode: 'pct', developerFeePct: 3, developerFeeFixed: 60000,
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const pct = (n: number) => `${n.toFixed(1)}%`
const N = (v: string) => parseFloat(v) || 0
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4']

export default function PropertyDevelopment() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const [exitMode, setExitMode] = useState<'sell' | 'hold'>('sell')

  const set = (k: keyof Inputs, v: string | 'singleFamily' | 'multiFamily' | 'mixedUse' | 'condo' | 'townhome' | 'pct' | 'fixed') =>
    setInp(p => ({ ...p, [k]: typeof DEF[k] === 'number' ? N(v as string) : v }))

  const calc = useMemo(() => {
    const { landCost, landClosingCosts, units, avgUnitSize, hardCostPerSqft,
            contingencyPct, architectFees, engineeringFees, permittingFees,
            marketingPct, constructionLoanRate, constructionMonths,
            constructionLoanLTC, exitCapRate, avgUnitSalePrice, avgMonthlyRent,
            absorptionMonths, developerFeeMode, developerFeePct, developerFeeFixed } = inp

    // Costs
    const totalSqft = units * avgUnitSize
    const hardCosts = totalSqft * hardCostPerSqft
    const contingency = hardCosts * contingencyPct / 100
    const softCosts = architectFees + engineeringFees + permittingFees + contingency
    const totalBuildCost = landCost + landClosingCosts + hardCosts + softCosts

    // Developer fee
    const developerFee = developerFeeMode === 'pct' ? totalBuildCost * developerFeePct / 100 : developerFeeFixed

    // Marketing / sales
    const grossSaleRevenue = units * avgUnitSalePrice
    const marketingCost = grossSaleRevenue * marketingPct / 100

    // Construction loan
    const constructionLoan = totalBuildCost * constructionLoanLTC / 100
    const constructionInterest = constructionLoan * (constructionLoanRate / 100) * (constructionMonths / 12) * 0.6 // avg drawdown 60%

    // Total project cost
    const totalProjectCost = totalBuildCost + developerFee + constructionInterest + marketingCost

    // Equity required
    const equityRequired = totalProjectCost - constructionLoan

    // Exit: Sell
    const closingCostsSell = grossSaleRevenue * 0.02
    const agentComm = grossSaleRevenue * 0.03 // 3% builder agent
    const netSaleProceeds = grossSaleRevenue - closingCostsSell - agentComm
    const sellProfit = netSaleProceeds - totalProjectCost
    const sellROI = sellProfit / equityRequired * 100

    // Exit: Hold as rental
    const grossRent = units * avgMonthlyRent * 12
    const opexHold = grossRent * 0.38
    const noiHold = grossRent - opexHold
    const holdValue = noiHold / (exitCapRate / 100)
    const holdEquity = holdValue - constructionLoan
    const holdProfit = holdEquity - equityRequired
    const holdROI = holdProfit / equityRequired * 100
    const holdCapRate = noiHold / totalProjectCost * 100
    const holdCoCReturn = (noiHold - constructionLoan * (constructionLoanRate / 100)) / equityRequired * 100

    // Margin
    const profitMarginSell = sellProfit / grossSaleRevenue * 100

    // Cost breakdown for pie
    const costPie = [
      { name: 'Land', value: landCost + landClosingCosts },
      { name: 'Hard Costs', value: hardCosts },
      { name: 'Soft Costs', value: softCosts },
      { name: 'Construction Interest', value: constructionInterest },
      { name: 'Developer Fee', value: developerFee },
      { name: 'Marketing', value: marketingCost },
    ]

    // Phase timeline
    const phases = [
      { phase: 'Land Acquisition', months: 2, cost: landCost + landClosingCosts },
      { phase: 'Entitlement / Permits', months: 4, cost: permittingFees + engineeringFees },
      { phase: 'Design / Architecture', months: 3, cost: architectFees },
      { phase: 'Construction', months: constructionMonths, cost: hardCosts + contingency },
      { phase: 'Absorption / Sales', months: absorptionMonths, cost: marketingCost },
    ]
    const totalMonths = phases.reduce((a, b) => a + b.months, 0)

    // Scenario analysis: hard cost sensitivity
    const sensitivityData = [-20, -10, 0, 10, 20].map(delta => {
      const hc = hardCosts * (1 + delta / 100)
      const tc = landCost + landClosingCosts + hc + softCosts + developerFee + constructionInterest + marketingCost
      const sp = grossSaleRevenue - closingCostsSell - agentComm - tc
      return {
        change: `${delta > 0 ? '+' : ''}${delta}%`,
        profit: sp,
        margin: sp / grossSaleRevenue * 100,
      }
    })

    return {
      totalSqft, hardCosts, contingency, softCosts, totalBuildCost, developerFee,
      grossSaleRevenue, marketingCost, constructionLoan, constructionInterest,
      totalProjectCost, equityRequired, closingCostsSell, agentComm,
      netSaleProceeds, sellProfit, sellROI, profitMarginSell,
      grossRent, noiHold, holdValue, holdEquity, holdProfit, holdROI,
      holdCapRate, holdCoCReturn,
      costPie, phases, totalMonths, sensitivityData,
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
        <h2 className="text-lg font-bold text-white">Property Development Pro Forma</h2>
        <p className="text-slate-400 text-xs mt-1">Full development financial model — land, hard/soft costs, construction financing, exit via sale or hold</p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Land & Project */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Land &amp; Project</p>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Project Type</label>
            <select value={inp.projectType} onChange={e => set('projectType', e.target.value as Inputs['projectType'])}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
              {Object.entries(TYPES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {field('Land Cost', 'landCost', '$')}
          {field('Land Closing Costs', 'landClosingCosts', '$')}
          {field('Number of Units', 'units')}
          {field('Avg Unit Size', 'avgUnitSize', '', 'sqft')}
        </div>

        {/* Construction Costs */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Construction Costs</p>
          {field('Hard Cost / SqFt', 'hardCostPerSqft', '$', '/sqft')}
          {field('Contingency', 'contingencyPct', '', '%')}
          {field('Architect Fees', 'architectFees', '$')}
          {field('Engineering Fees', 'engineeringFees', '$')}
          {field('Permitting Fees', 'permittingFees', '$')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Total Sqft</span><span className="text-slate-200">{calc.totalSqft.toLocaleString()} sqft</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Hard Costs</span><span className="text-slate-200">{fmt(calc.hardCosts)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Total Build Cost</span><span className="text-yellow-400 font-bold">{fmt(calc.totalBuildCost)}</span></div>
          </div>
        </div>

        {/* Financing & Exit */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Financing &amp; Exit</p>
          {field('Construction Loan Rate', 'constructionLoanRate', '', '%', '0.25')}
          {field('Construction Period', 'constructionMonths', '', 'months')}
          {field('Loan-to-Cost', 'constructionLoanLTC', '', '%')}
          {field('Marketing Cost', 'marketingPct', '', '% of revenue', '0.1')}
          {field('Absorption Period', 'absorptionMonths', '', 'months')}
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
            {inp.developerFeeMode === 'pct' ? field('Developer Fee %', 'developerFeePct', '', '%', '0.5') : field('Developer Fee', 'developerFeeFixed', '$')}
          </div>
        </div>
      </div>

      {/* Exit toggle */}
      <div className="flex gap-2">
        {(['sell', 'hold'] as const).map(m => (
          <button key={m} onClick={() => setExitMode(m)}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${exitMode === m ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
            {m === 'sell' ? '🏷 Sell Units' : '🏠 Hold as Rental'}
          </button>
        ))}
        {exitMode === 'sell' && (
          <div className="flex items-center gap-2 ml-2">
            <label className="text-xs text-slate-400">Avg Unit Sale Price</label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
              <input type="number" value={inp.avgUnitSalePrice} onChange={e => set('avgUnitSalePrice', e.target.value)}
                className="w-32 bg-slate-800 border border-slate-700 rounded-lg pl-5 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
          </div>
        )}
        {exitMode === 'hold' && (
          <div className="flex items-center gap-2 ml-2">
            <label className="text-xs text-slate-400">Monthly Rent / Unit</label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
              <input type="number" value={inp.avgMonthlyRent} onChange={e => set('avgMonthlyRent', e.target.value)}
                className="w-28 bg-slate-800 border border-slate-700 rounded-lg pl-5 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
            <label className="text-xs text-slate-400">Exit Cap</label>
            <div className="relative">
              <input type="number" step="0.25" value={inp.exitCapRate} onChange={e => set('exitCapRate', e.target.value)}
                className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500" />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">%</span>
            </div>
          </div>
        )}
      </div>

      {/* Key Results */}
      <div className={`rounded-xl p-5 border ${exitMode === 'sell' ? (calc.sellProfit > 0 ? 'bg-green-900/20 border-green-700/40' : 'bg-red-900/20 border-red-700/40') : (calc.holdProfit > 0 ? 'bg-blue-900/20 border-blue-700/40' : 'bg-red-900/20 border-red-700/40')}`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {exitMode === 'sell' ? <>
            <div><p className="text-2xl font-black text-white">{fmt(calc.totalProjectCost)}</p><p className="text-xs text-slate-400">Total Project Cost</p></div>
            <div><p className="text-2xl font-black text-green-400">{fmt(calc.sellProfit)}</p><p className="text-xs text-slate-400">Developer Profit</p></div>
            <div><p className="text-2xl font-black text-blue-400">{pct(calc.profitMarginSell)}</p><p className="text-xs text-slate-400">Profit Margin</p></div>
            <div><p className="text-2xl font-black text-purple-400">{pct(calc.sellROI)}</p><p className="text-xs text-slate-400">Return on Equity</p></div>
          </> : <>
            <div><p className="text-2xl font-black text-white">{fmt(calc.noiHold)}</p><p className="text-xs text-slate-400">Annual NOI</p></div>
            <div><p className="text-2xl font-black text-blue-400">{fmt(calc.holdValue)}</p><p className="text-xs text-slate-400">Stabilized Value</p></div>
            <div><p className="text-2xl font-black text-green-400">{pct(calc.holdCapRate)}</p><p className="text-xs text-slate-400">Yield on Cost</p></div>
            <div><p className="text-2xl font-black text-purple-400">{pct(calc.holdCoCReturn)}</p><p className="text-xs text-slate-400">CoC Return</p></div>
          </>}
        </div>
        <div className="mt-3 pt-3 border-t border-slate-700/40 flex gap-4 text-xs text-slate-400 justify-center flex-wrap">
          <span>Equity Required: <span className="text-white font-bold">{fmt(calc.equityRequired)}</span></span>
          <span>Construction Loan: <span className="text-white font-bold">{fmt(calc.constructionLoan)}</span></span>
          <span>Timeline: <span className="text-white font-bold">{calc.totalMonths} months</span></span>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Cost Pie */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Cost Breakdown</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={calc.costPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {calc.costPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Sensitivity */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Hard Cost Sensitivity (Sell Exit)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={calc.sensitivityData}>
              <XAxis dataKey="change" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip formatter={(v: number, name: string) => name === 'profit' ? fmt(v) : `${(v as number).toFixed(1)}%`} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="profit" name="Profit" radius={[4, 4, 0, 0]}
                fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Phase Timeline */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Development Timeline &amp; Cost Phases</p>
        <div className="space-y-2">
          {calc.phases.map((ph, i) => {
            const widthPct = ph.months / calc.totalMonths * 100
            return (
              <div key={ph.phase} className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-44 shrink-0">{ph.phase}</span>
                <div className="flex-1 bg-slate-700 rounded-full h-3 relative">
                  <div className="h-3 rounded-full" style={{ width: `${widthPct}%`, background: COLORS[i % COLORS.length] }} />
                </div>
                <span className="text-xs text-slate-400 w-14 text-right shrink-0">{ph.months} mo</span>
                <span className="text-xs text-slate-300 w-24 text-right shrink-0 font-semibold">{fmt(ph.cost)}</span>
              </div>
            )
          })}
          <div className="flex justify-between text-xs text-slate-400 pt-1 border-t border-slate-700">
            <span>Total Timeline</span>
            <span className="font-bold text-white">{calc.totalMonths} months</span>
          </div>
        </div>
      </div>

      {/* Development Tips */}
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Developer Benchmarks</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-400">
          {[
            { icon: '📊', text: 'Profit margin target: 15-20% on gross revenue for residential; 20-25% for commercial' },
            { icon: '💰', text: 'Yield on cost (hold): target ≥150 bps above exit cap rate to justify development risk' },
            { icon: '🏗', text: 'Hard costs typically 60-65% of total development budget; soft costs 10-15%; land 20-30%' },
            { icon: '📅', text: 'Entitlement risk is the #1 cause of development project failures — lock up land with contingencies' },
            { icon: '🏦', text: 'Construction lenders typically require 20-30% equity + pre-sales/pre-leasing commitments' },
            { icon: '⚡', text: 'Contingency: 10% for ground-up, 15-20% for adaptive reuse or historic renovation' },
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
