import { useState, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, ReferenceLine } from 'recharts'

interface Inputs {
  currentValue: number
  originalCost: number
  depreciationTaken: number
  mortgageBalance: number
  sellingCostsPct: number
  ltcgRate: number
  use1031: boolean
  annualNOI: number
  annualAppreciation: number
  capRateChange: number
  alternativeYield: number
  holdYears: number
  marginalRate: number
}

const DEF: Inputs = {
  currentValue: 850000,
  originalCost: 420000,
  depreciationTaken: 95000,
  mortgageBalance: 310000,
  sellingCostsPct: 6,
  ltcgRate: 20,
  use1031: false,
  annualNOI: 52000,
  annualAppreciation: 4,
  capRateChange: 0,
  alternativeYield: 7,
  holdYears: 10,
  marginalRate: 37,
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const N = (v: string) => parseFloat(v) || 0

export default function HoldVsSell() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = (k: keyof Inputs, v: string | boolean) =>
    setInp(p => ({ ...p, [k]: typeof DEF[k] === 'boolean' ? v : N(v as string) }))

  const calc = useMemo(() => {
    const {
      currentValue, originalCost, depreciationTaken, mortgageBalance,
      sellingCostsPct, ltcgRate, use1031, annualNOI, annualAppreciation,
      capRateChange, alternativeYield, holdYears, marginalRate,
    } = inp

    const sellingCosts = currentValue * sellingCostsPct / 100
    const grossProceeds = currentValue - sellingCosts - mortgageBalance

    // Tax on sale
    const depreciationRecapture = depreciationTaken * 0.25
    const ltcgGain = Math.max(0, currentValue - sellingCosts - originalCost)
    const ltcgTax = ltcgGain * ltcgRate / 100
    const niitTax = ltcgGain * 0.038  // simplified (not means-tested here)
    const totalTax = depreciationRecapture + ltcgTax + niitTax
    const netSaleProceeds = grossProceeds - (use1031 ? depreciationRecapture : totalTax)

    // Alternative investment from net proceeds
    const altFV = netSaleProceeds * Math.pow(1 + alternativeYield / 100, holdYears)
    const altGain = altFV - netSaleProceeds
    const altTax = altGain * ltcgRate / 100
    const altNetFV = altFV - altTax

    // Hold scenario
    const currentCapRate = annualNOI / currentValue * 100
    const exitCapRate = currentCapRate + capRateChange

    const holdYearlyData = Array.from({ length: holdYears }, (_, i) => {
      const y = i + 1
      const propValue = currentValue * Math.pow(1 + annualAppreciation / 100, y)
      // NOI grows with appreciation
      const noi = annualNOI * Math.pow(1 + annualAppreciation / 100, y)
      // Exit value based on potentially different cap rate
      const exitVal = exitCapRate > 0 ? noi / (exitCapRate / 100) : propValue
      const exitSellingCosts = exitVal * sellingCostsPct / 100
      const exitGrossProceeds = exitVal - exitSellingCosts - mortgageBalance * 0.92 ** y
      const additionalDepr = (originalCost - depreciationTaken) / 27.5 * y
      const totalDepr = depreciationTaken + additionalDepr
      const exitDeprRecapture = totalDepr * 0.25
      const exitLTCGGain = Math.max(0, exitVal - exitSellingCosts - originalCost + totalDepr)
      const exitTax = exitDeprRecapture + exitLTCGGain * ltcgRate / 100 + exitLTCGGain * 0.038
      const exitNetProceeds = exitGrossProceeds - (use1031 ? exitDeprRecapture : exitTax)
      const cumNOI = annualNOI * y // simplified
      const holdTotal = exitNetProceeds + cumNOI

      // Alt investment compounded
      const altFVy = netSaleProceeds * Math.pow(1 + alternativeYield / 100, y)
      const altNetFVy = altFVy - Math.max(0, altFVy - netSaleProceeds) * ltcgRate / 100

      return {
        year: y,
        propValue: Math.round(propValue),
        holdTotal: Math.round(holdTotal),
        altNetFV: Math.round(altNetFVy),
        advantage: Math.round(holdTotal - altNetFVy),
      }
    })

    // Find crossover year
    const crossoverYear = holdYearlyData.find(r => r.holdTotal > r.altNetFV)?.year ?? null
    const finalRow = holdYearlyData[holdYearlyData.length - 1]

    // Current cap rate and yield metrics
    const cashOnCash = grossProceeds > 0 ? annualNOI / grossProceeds * 100 : 0
    const grossEquity = currentValue - mortgageBalance
    const equityYield = grossEquity > 0 ? annualNOI / grossEquity * 100 : 0

    // Decision signals
    const signals = {
      capRateExpanding: capRateChange > 0,
      equityYieldBelowAlt: equityYield < alternativeYield,
      highTaxCost: totalTax / grossProceeds > 0.2,
      holdWinsFinal: finalRow ? finalRow.advantage > 0 : false,
      quickCrossover: crossoverYear !== null && crossoverYear <= 3,
    }

    return {
      sellingCosts, grossProceeds, depreciationRecapture, ltcgGain, ltcgTax, niitTax,
      totalTax, netSaleProceeds, altFV, altNetFV,
      currentCapRate, exitCapRate, holdYearlyData, crossoverYear, finalRow,
      cashOnCash, equityYield, grossEquity, signals,
    }
  }, [inp])

  const field = (label: string, key: keyof Inputs, suffix = '', prefix = '') => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{prefix}</span>}
        <input type="number" step="any" value={inp[key] as number} onChange={e => set(key, e.target.value)}
          className={`w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 ${prefix ? 'pl-5 pr-3' : suffix ? 'pl-3 pr-8' : 'px-3'}`} />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{suffix}</span>}
      </div>
    </div>
  )

  const sellSignals = [
    calc.signals.capRateExpanding && 'Cap rates rising → property values falling',
    calc.signals.equityYieldBelowAlt && `Equity yield (${calc.equityYield.toFixed(1)}%) < alt yield (${inp.alternativeYield}%)`,
    !calc.signals.holdWinsFinal && `Hold doesn't beat alternative over ${inp.holdYears} years`,
    calc.signals.quickCrossover && `Hold outperforms within ${calc.crossoverYear} year(s) — short crossover favors sell-and-reinvest`,
  ].filter(Boolean)

  const holdSignals = [
    !calc.signals.capRateExpanding && 'Cap rates stable or compressing → values appreciating',
    !calc.signals.equityYieldBelowAlt && `Equity yield (${calc.equityYield.toFixed(1)}%) exceeds alt yield (${inp.alternativeYield}%)`,
    calc.signals.highTaxCost && `High tax cost on sale (${((calc.totalTax / calc.grossProceeds) * 100).toFixed(0)}% of gross proceeds)`,
    calc.signals.holdWinsFinal && `Hold wins by ${fmt(calc.finalRow?.advantage ?? 0)} over ${inp.holdYears} years`,
    inp.use1031 && 'Planning a 1031 exchange — defers most taxes, hold redeployment advantage',
  ].filter(Boolean)

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-lg font-bold text-white">Hold vs Sell Analyzer</h2>
        <p className="text-slate-400 text-xs mt-1">Model the true after-tax cost of selling now vs holding and compare against redeploying capital into an alternative investment</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Property */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Current Property</p>
          {field('Current Market Value', 'currentValue', '', '$')}
          {field('Original Cost Basis', 'originalCost', '', '$')}
          {field('Depreciation Taken to Date', 'depreciationTaken', '', '$')}
          {field('Mortgage Balance', 'mortgageBalance', '', '$')}
          {field('Selling Costs', 'sellingCostsPct', '% of SP')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Gross Equity</span><span className="text-white font-bold">{fmt(calc.grossEquity)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Selling Costs</span><span className="text-red-400">{fmt(calc.sellingCosts)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Gross Proceeds</span><span className="text-blue-400 font-bold">{fmt(calc.grossProceeds)}</span></div>
          </div>
        </div>

        {/* Tax & Sale */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Tax on Sale</p>
          {field('LTCG Rate (federal)', 'ltcgRate', '%')}
          {field('Marginal Income Tax Rate', 'marginalRate', '%')}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Using 1031 Exchange?</span>
            <button onClick={() => set('use1031', !inp.use1031)}
              className={`w-11 h-6 rounded-full transition-colors ${inp.use1031 ? 'bg-green-500' : 'bg-slate-700'}`}>
              <div className={`w-4 h-4 bg-white rounded-full mx-1 transition-transform ${inp.use1031 ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          <div className="p-3 bg-slate-900/50 rounded-lg text-xs space-y-1.5">
            <div className="flex justify-between"><span className="text-slate-400">LTCG Gain</span><span className="text-slate-300">{fmt(calc.ltcgGain)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">LTCG Tax ({inp.ltcgRate}%)</span><span className="text-red-400">{fmt(calc.ltcgTax)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Depr Recapture (25%)</span><span className="text-red-400">{fmt(calc.depreciationRecapture)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">NIIT (3.8%)</span><span className="text-red-400">{fmt(calc.niitTax)}</span></div>
            <div className="flex justify-between border-t border-slate-700 pt-1.5">
              <span className="text-slate-300 font-bold">Total Tax {inp.use1031 ? '(1031 — depr only)' : ''}</span>
              <span className="text-red-400 font-bold">{fmt(inp.use1031 ? calc.depreciationRecapture : calc.totalTax)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-400 font-bold">Net Proceeds</span>
              <span className="text-green-400 font-bold">{fmt(calc.netSaleProceeds)}</span>
            </div>
          </div>
        </div>

        {/* Hold & Alt */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Hold & Alt Investment</p>
          {field('Annual NOI (current)', 'annualNOI', '', '$')}
          {field('Annual Appreciation', 'annualAppreciation', '%')}
          {field('Cap Rate Change/yr (+ = rising)', 'capRateChange', '%')}
          {field('Alternative Yield (if you sell)', 'alternativeYield', '%')}
          {field('Analysis Period', 'holdYears', 'yr')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Current Cap Rate</span><span className="text-blue-400">{calc.currentCapRate.toFixed(2)}%</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Equity Yield on Hold</span><span className={calc.equityYield >= inp.alternativeYield ? 'text-green-400' : 'text-orange-400'}>{calc.equityYield.toFixed(2)}%</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Alt Net at Yr {inp.holdYears}</span><span className="text-slate-300">{fmt(calc.altNetFV)}</span></div>
          </div>
        </div>
      </div>

      {/* Hold vs Sell Outcome */}
      <div className={`rounded-xl p-5 border ${calc.signals.holdWinsFinal ? 'bg-green-900/15 border-green-700/40' : 'bg-orange-900/15 border-orange-700/40'}`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-black text-white">{fmt(calc.netSaleProceeds)}</p>
            <p className="text-xs text-slate-400">Net if Sold Today</p>
          </div>
          <div>
            <p className="text-2xl font-black text-blue-400">{fmt(calc.altNetFV)}</p>
            <p className="text-xs text-slate-400">Alt Investment at Yr {inp.holdYears}</p>
          </div>
          <div>
            <p className="text-2xl font-black text-purple-400">{fmt(calc.finalRow?.holdTotal ?? 0)}</p>
            <p className="text-xs text-slate-400">Hold Value at Yr {inp.holdYears}</p>
          </div>
          <div>
            <p className={`text-2xl font-black ${(calc.finalRow?.advantage ?? 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {(calc.finalRow?.advantage ?? 0) > 0 ? '+' : ''}{fmt(calc.finalRow?.advantage ?? 0)}
            </p>
            <p className="text-xs text-slate-400">Hold Advantage</p>
            <p className="text-xs text-slate-500">{calc.crossoverYear ? `Hold wins from Yr ${calc.crossoverYear}` : 'Sell wins entire hold period'}</p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Hold Total vs Alternative Investment (Net After Tax)</p>
        <ResponsiveContainer width="100%" height={230}>
          <AreaChart data={calc.holdYearlyData}>
            <defs>
              <linearGradient id="holdGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="altGrad2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => `Yr ${v}`} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="holdTotal" stroke="#3b82f6" fill="url(#holdGrad)" strokeWidth={2} dot={false} name="Hold (proceeds + NOI)" />
            <Area type="monotone" dataKey="altNetFV" stroke="#94a3b8" fill="url(#altGrad2)" strokeWidth={2} dot={false} name="Alt Investment (net)" />
            {calc.crossoverYear && (
              <ReferenceLine x={calc.crossoverYear} stroke="#22c55e66" strokeDasharray="4 2"
                label={{ value: `Crossover`, fill: '#22c55e', fontSize: 9 }} />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Hold Advantage by Year */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Hold Advantage Over Selling ($)</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={calc.holdYearlyData}>
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => `Yr ${v}`} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <ReferenceLine y={0} stroke="#475569" />
            <Bar dataKey="advantage" name="Hold Advantage" radius={[4, 4, 0, 0]}
              fill="#3b82f6"
              // color each bar conditionally not directly supported in recharts without Cell
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Decision Signals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-orange-900/10 border border-orange-700/30 rounded-xl p-4">
          <p className="text-xs font-bold text-orange-400 mb-2">⬆ Signals to Sell</p>
          {sellSignals.length > 0
            ? <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">{sellSignals.map((s, i) => <li key={i}>{s}</li>)}</ul>
            : <p className="text-xs text-slate-500 italic">No strong sell signals based on current inputs</p>}
        </div>
        <div className="bg-blue-900/10 border border-blue-700/30 rounded-xl p-4">
          <p className="text-xs font-bold text-blue-400 mb-2">⬇ Signals to Hold</p>
          {holdSignals.length > 0
            ? <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">{holdSignals.map((s, i) => <li key={i}>{s}</li>)}</ul>
            : <p className="text-xs text-slate-500 italic">No strong hold signals based on current inputs</p>}
        </div>
      </div>

      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Key Considerations</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
          {[
            '💡 Depreciation recapture is always owed at 25% on §1250 property — a 1031 defers but doesn\'t eliminate it',
            '💡 Equity yield = NOI / equity; if this is below your alternative return, capital may be better redeployed',
            '⚠️ Cap rate expansion (rising rates) compresses property values — holding in a rising-rate environment may destroy equity',
            '🔄 A 1031 exchange defers LTCG and NIIT but not depreciation recapture — and requires reinvestment within 180 days',
            '📊 The "hold advantage" includes both the NOI you\'d collect AND the exit proceeds — don\'t ignore operating income',
            '🏦 Refinancing to extract equity (cash-out refi) may be a third option — access capital without triggering a taxable event',
            '📋 Section 121 primary-home exclusion: $250K/$500K MFJ on personal residence — doesn\'t apply to rental property',
            '💰 Installment sale can spread LTCG over multiple years if the buyer has the credit to support seller financing',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
