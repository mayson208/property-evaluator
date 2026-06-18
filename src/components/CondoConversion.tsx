import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line, ReferenceLine } from 'recharts'

interface UnitType {
  id: string
  label: string
  count: number
  sqft: number
  renoPerUnit: number
  sellPricePSF: number
}

interface Inputs {
  purchasePrice: number
  closingCostPct: number
  legalDocCost: number
  hoaSetupCost: number
  marketingPct: number
  sellingCostPct: number
  carryMonths: number
  bridgeLoanRate: number
  bridgeLoanLTV: number
  holdCapRate: number
  holdExpenseRatio: number
  monthlyRentPerSqft: number
  appreciationRate: number
  holdYears: number
  unitTypes: UnitType[]
}

const DEF_UNITS: UnitType[] = [
  { id: '1', label: 'Studio',    count: 4,  sqft: 520,  renoPerUnit: 28000, sellPricePSF: 420 },
  { id: '2', label: '1 Bedroom', count: 8,  sqft: 780,  renoPerUnit: 35000, sellPricePSF: 390 },
  { id: '3', label: '2 Bedroom', count: 6,  sqft: 1100, renoPerUnit: 45000, sellPricePSF: 365 },
  { id: '4', label: '3 Bedroom', count: 2,  sqft: 1450, renoPerUnit: 58000, sellPricePSF: 345 },
]

const DEF: Inputs = {
  purchasePrice: 3200000,
  closingCostPct: 1.5,
  legalDocCost: 25000,
  hoaSetupCost: 15000,
  marketingPct: 1.5,
  sellingCostPct: 5,
  carryMonths: 18,
  bridgeLoanRate: 9,
  bridgeLoanLTV: 65,
  holdCapRate: 6,
  holdExpenseRatio: 38,
  monthlyRentPerSqft: 1.65,
  appreciationRate: 4,
  holdYears: 10,
  unitTypes: DEF_UNITS,
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const fmtM = (n: number) => n >= 1000000 ? `$${(n / 1e6).toFixed(2)}M` : fmt(n)
const N = (v: string) => parseFloat(v) || 0

function calcIRR(cashflows: number[]): number {
  let rate = 0.2
  for (let i = 0; i < 100; i++) {
    let npv = 0, dnpv = 0
    cashflows.forEach((cf, t) => {
      const d = Math.pow(1 + rate, t)
      npv += cf / d
      dnpv -= t * cf / (d * (1 + rate))
    })
    const newRate = rate - npv / dnpv
    if (Math.abs(newRate - rate) < 1e-7) return newRate * 100
    rate = newRate
  }
  return rate * 100
}

let nextUnitId = 5

export default function CondoConversion() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = (k: keyof Inputs, v: string) => setInp(p => ({ ...p, [k]: N(v) }))
  const setUnit = (id: string, k: keyof UnitType, v: string) =>
    setInp(p => ({ ...p, unitTypes: p.unitTypes.map(u => u.id === id ? { ...u, [k]: typeof u[k] === 'number' ? N(v) : v } : u) }))

  const calc = useMemo(() => {
    const { purchasePrice, closingCostPct, legalDocCost, hoaSetupCost, marketingPct, sellingCostPct, carryMonths, bridgeLoanRate, bridgeLoanLTV, holdCapRate, holdExpenseRatio, monthlyRentPerSqft, appreciationRate, holdYears, unitTypes } = inp

    const totalUnits = unitTypes.reduce((s, u) => s + u.count, 0)
    const totalSqft = unitTypes.reduce((s, u) => s + u.sqft * u.count, 0)

    // Conversion costs
    const totalRenoCost = unitTypes.reduce((s, u) => s + u.renoPerUnit * u.count, 0)
    const purchaseClosing = purchasePrice * closingCostPct / 100
    const conversionSoftCosts = legalDocCost + hoaSetupCost
    const loanAmount = purchasePrice * bridgeLoanLTV / 100
    const totalCarryCost = loanAmount * bridgeLoanRate / 100 / 12 * carryMonths

    // Sell-out revenue
    const unitRevenue = unitTypes.map(u => {
      const grossSalePrice = u.sqft * u.sellPricePSF
      const sellingCosts = grossSalePrice * sellingCostPct / 100
      const marketing = grossSalePrice * marketingPct / 100
      const netProceeds = grossSalePrice - sellingCosts - marketing
      return { ...u, grossSalePrice, sellingCosts, marketing, netProceeds, totalGross: grossSalePrice * u.count, totalNet: netProceeds * u.count }
    })
    const grossSellout = unitRevenue.reduce((s, u) => s + u.totalGross, 0)
    const totalSellingCosts = unitRevenue.reduce((s, u) => s + (u.sellingCosts + u.marketing) * u.count, 0)
    const netSellout = grossSellout - totalSellingCosts

    const totalProjectCost = purchasePrice + purchaseClosing + totalRenoCost + conversionSoftCosts + totalCarryCost
    const grossProfit = grossSellout - totalProjectCost
    const netProfit = netSellout - totalProjectCost
    const grossMarginPct = grossSellout > 0 ? grossProfit / grossSellout * 100 : 0
    const netMarginPct = grossSellout > 0 ? netProfit / grossSellout * 100 : 0
    const roi = totalProjectCost > 0 ? netProfit / totalProjectCost * 100 : 0
    const equityIn = totalProjectCost - loanAmount
    const equityROI = equityIn > 0 ? netProfit / equityIn * 100 : 0

    const avgPricePSF = totalSqft > 0 ? grossSellout / totalSqft : 0
    const avgPricePerUnit = totalUnits > 0 ? grossSellout / totalUnits : 0

    // IRR: equity out at end, months as fractional years
    const irrCashflows = [-equityIn, ...Array(Math.floor(carryMonths / 12) - 1).fill(0), netProfit + equityIn]
    const irr = calcIRR(irrCashflows)

    // Hold comparison
    const monthlyGrossRent = totalSqft * monthlyRentPerSqft
    const annualGrossRent = monthlyGrossRent * 12
    const holdNOI = annualGrossRent * (1 - holdExpenseRatio / 100)
    const holdImpliedValue = holdCapRate > 0 ? holdNOI / (holdCapRate / 100) : 0
    const holdValueVsPurchase = holdImpliedValue - purchasePrice

    const holdYearlyData = Array.from({ length: holdYears }, (_, i) => {
      const y = i + 1
      const projValue = holdImpliedValue * Math.pow(1 + appreciationRate / 100, y)
      const projNOI = holdNOI * Math.pow(1.03, y)
      const projEquity = projValue - loanAmount * Math.pow(0.97, y)
      return { year: `Yr ${y}`, value: Math.round(projValue), equity: Math.round(projEquity), noi: Math.round(projNOI) }
    })

    // Cost waterfall for chart
    const costWaterfall = [
      { name: 'Purchase', value: purchasePrice },
      { name: 'Closing', value: Math.round(purchaseClosing) },
      { name: 'Renovation', value: totalRenoCost },
      { name: 'Soft Costs', value: Math.round(conversionSoftCosts) },
      { name: 'Carry Cost', value: Math.round(totalCarryCost) },
    ]

    // Revenue vs cost by unit type
    const unitSummary = unitRevenue.map(u => ({
      name: u.label,
      cost: Math.round((u.renoPerUnit + purchasePrice / totalUnits) * u.count),
      grossRev: u.totalGross,
      netRev: u.totalNet,
    }))

    return {
      totalUnits, totalSqft, totalRenoCost, purchaseClosing, conversionSoftCosts, loanAmount, totalCarryCost,
      unitRevenue, grossSellout, totalSellingCosts, netSellout,
      totalProjectCost, grossProfit, netProfit, grossMarginPct, netMarginPct, roi, equityIn, equityROI, irr,
      avgPricePSF, avgPricePerUnit,
      holdNOI, holdImpliedValue, holdValueVsPurchase, holdYearlyData,
      costWaterfall, unitSummary,
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

  const profitable = calc.netProfit > 0
  const conversionBetter = calc.netProfit > calc.holdImpliedValue - inp.purchasePrice

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-lg font-bold text-white">Condo Conversion Analyzer</h2>
        <p className="text-slate-400 text-xs mt-1">Apartment-to-condo sell-out pro forma — gross/net margin, IRR, equity ROI, vs hold-as-rental comparison</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Gross Sellout',     value: fmtM(calc.grossSellout),    color: 'text-white' },
          { label: 'Net Profit',        value: fmtM(calc.netProfit),        color: calc.netProfit > 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'Net Margin',        value: `${calc.netMarginPct.toFixed(1)}%`, color: calc.netMarginPct >= 15 ? 'text-green-400' : calc.netMarginPct >= 8 ? 'text-yellow-400' : 'text-red-400' },
          { label: 'Project IRR',       value: `${calc.irr.toFixed(1)}%`,   color: calc.irr >= 20 ? 'text-green-400' : calc.irr >= 12 ? 'text-yellow-400' : 'text-red-400' },
        ].map(m => (
          <div key={m.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
            <p className={`text-2xl font-black ${m.color}`}>{m.value}</p>
            <p className="text-xs text-slate-400 mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      <div className={`rounded-xl p-4 border ${profitable ? (conversionBetter ? 'bg-green-900/20 border-green-700/40' : 'bg-yellow-900/20 border-yellow-700/40') : 'bg-red-900/20 border-red-700/40'}`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{profitable ? (conversionBetter ? '🏗' : '⚠️') : '❌'}</span>
          <div>
            <p className={`font-bold ${profitable ? (conversionBetter ? 'text-green-300' : 'text-yellow-300') : 'text-red-300'}`}>
              {!profitable ? 'Conversion is unprofitable at these numbers — review pricing or renovation costs'
                : conversionBetter ? `Conversion wins — ${fmtM(calc.netProfit)} profit vs ${fmtM(calc.holdValueVsPurchase)} hold upside`
                : `Holding may outperform — conversion nets ${fmtM(calc.netProfit)}, hold has ${fmtM(calc.holdValueVsPurchase)} upside at cap rate`}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Avg sale price {fmt(calc.avgPricePerUnit)}/unit · ${calc.avgPricePSF.toFixed(0)}/sqft · {calc.totalUnits} units · Equity ROI {calc.equityROI.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Acquisition & Costs */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Acquisition & Soft Costs</p>
          {field('Purchase Price', 'purchasePrice', '', '$')}
          {field('Closing Costs', 'closingCostPct', '%')}
          {field('Condo Docs / Legal', 'legalDocCost', '', '$')}
          {field('HOA Setup / Reserve', 'hoaSetupCost', '', '$')}
          {field('Bridge Loan LTV', 'bridgeLoanLTV', '%')}
          {field('Bridge Loan Rate', 'bridgeLoanRate', '%')}
          {field('Construction / Carry Period', 'carryMonths', 'mo')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Purchase + Closing</span><span className="text-slate-300">{fmt(inp.purchasePrice + calc.purchaseClosing)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Renovation Total</span><span className="text-slate-300">{fmt(calc.totalRenoCost)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Soft Costs</span><span className="text-slate-300">{fmt(calc.conversionSoftCosts)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Bridge Carry Cost</span><span className="text-orange-400">{fmt(calc.totalCarryCost)}</span></div>
            <div className="flex justify-between border-t border-slate-700 pt-1"><span className="text-white font-bold">Total Project Cost</span><span className="text-white font-bold">{fmtM(calc.totalProjectCost)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Equity In</span><span className="text-orange-400">{fmtM(calc.equityIn)}</span></div>
          </div>
        </div>

        {/* Sell-Out */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Sell-Out Revenue</p>
          {field('Marketing (% of sale)', 'marketingPct', '%')}
          {field('Selling Costs (commission, etc.)', 'sellingCostPct', '%')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Gross Sellout</span><span className="text-white">{fmtM(calc.grossSellout)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Selling + Marketing Costs</span><span className="text-red-400">({fmt(calc.totalSellingCosts)})</span></div>
            <div className="flex justify-between border-t border-slate-700 pt-1"><span className="text-white font-bold">Net Sellout Proceeds</span><span className="text-green-400 font-bold">{fmtM(calc.netSellout)}</span></div>
          </div>
          <div className="space-y-1.5 text-xs">
            {[
              { label: 'Gross Profit', value: fmtM(calc.grossProfit), color: calc.grossProfit > 0 ? 'text-green-400' : 'text-red-400' },
              { label: 'Net Profit', value: fmtM(calc.netProfit), color: calc.netProfit > 0 ? 'text-green-400' : 'text-red-400' },
              { label: 'Gross Margin', value: `${calc.grossMarginPct.toFixed(1)}%`, color: 'text-blue-400' },
              { label: 'Net Margin', value: `${calc.netMarginPct.toFixed(1)}%`, color: calc.netMarginPct >= 15 ? 'text-green-400' : 'text-yellow-400' },
              { label: 'Equity ROI', value: `${calc.equityROI.toFixed(1)}%`, color: calc.equityROI >= 25 ? 'text-green-400' : 'text-yellow-400' },
              { label: 'Project IRR', value: `${calc.irr.toFixed(1)}%`, color: calc.irr >= 20 ? 'text-green-400' : 'text-yellow-400' },
            ].map(m => (
              <div key={m.label} className="flex justify-between items-center p-2 bg-slate-900/50 rounded-lg">
                <span className="text-slate-400">{m.label}</span>
                <span className={`font-bold ${m.color}`}>{m.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hold Comparison */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Hold as Rental (Alternative)</p>
          {field('Monthly Rent / sqft', 'monthlyRentPerSqft', '/sqft', '$')}
          {field('Operating Expense Ratio', 'holdExpenseRatio', '%')}
          {field('Market Cap Rate', 'holdCapRate', '%')}
          {field('Appreciation Rate', 'appreciationRate', '%')}
          {field('Hold Period', 'holdYears', 'yr')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Annual Gross Rent</span><span className="text-slate-300">{fmt(calc.holdNOI / (1 - inp.holdExpenseRatio / 100))}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Stabilized NOI</span><span className="text-blue-400">{fmt(calc.holdNOI)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Implied Value</span><span className="text-white">{fmtM(calc.holdImpliedValue)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Value Upside vs Purchase</span><span className={calc.holdValueVsPurchase > 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>{calc.holdValueVsPurchase > 0 ? '+' : ''}{fmtM(calc.holdValueVsPurchase)}</span></div>
          </div>
        </div>
      </div>

      {/* Unit Type Table */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Unit Mix & Pricing ({calc.totalUnits} total units · {calc.totalSqft.toLocaleString()} sqft)</p>
          <button onClick={() => setInp(p => ({ ...p, unitTypes: [...p.unitTypes, { id: String(nextUnitId++), label: 'New Type', count: 2, sqft: 850, renoPerUnit: 35000, sellPricePSF: 380 }] }))}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg">+ Add Type</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-slate-500 border-b border-slate-700 bg-slate-900/30">
              <th className="text-left py-2 px-3">Type</th>
              <th className="text-right py-2 px-3">Count</th>
              <th className="text-right py-2 px-3">Sqft/Unit</th>
              <th className="text-right py-2 px-3">Reno/Unit</th>
              <th className="text-right py-2 px-3">Sale $/sqft</th>
              <th className="text-right py-2 px-3">Gross/Unit</th>
              <th className="text-right py-2 px-3">Net/Unit</th>
              <th className="text-right py-2 px-3">Type Total</th>
              <th className="py-2 px-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-slate-700/50">
              {calc.unitRevenue.map((u, idx) => (
                <tr key={u.id} className="hover:bg-slate-700/20">
                  <td className="py-2 px-3">
                    <input value={u.label} onChange={e => setUnit(u.id, 'label', e.target.value)}
                      className="bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none text-slate-200 w-24" />
                  </td>
                  <td className="py-2 px-3">
                    <input type="number" value={u.count} onChange={e => setUnit(u.id, 'count', e.target.value)}
                      className="bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none text-right text-slate-300 w-12" />
                  </td>
                  <td className="py-2 px-3">
                    <input type="number" value={u.sqft} onChange={e => setUnit(u.id, 'sqft', e.target.value)}
                      className="bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none text-right text-slate-300 w-16" />
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-slate-500">$</span>
                      <input type="number" value={u.renoPerUnit} onChange={e => setUnit(u.id, 'renoPerUnit', e.target.value)}
                        className="bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none text-right text-slate-300 w-16" />
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-slate-500">$</span>
                      <input type="number" value={u.sellPricePSF} onChange={e => setUnit(u.id, 'sellPricePSF', e.target.value)}
                        className="bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none text-right text-slate-300 w-14" />
                    </div>
                  </td>
                  <td className="text-right py-2 px-3 text-slate-300">{fmt(u.grossSalePrice)}</td>
                  <td className="text-right py-2 px-3 text-green-400">{fmt(u.netProceeds)}</td>
                  <td className="text-right py-2 px-3 text-blue-400 font-semibold">{fmt(u.totalNet)}</td>
                  <td className="py-2 px-3">
                    <button onClick={() => setInp(p => ({ ...p, unitTypes: p.unitTypes.filter(x => x.id !== u.id) }))} className="text-slate-600 hover:text-red-400">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-600 font-bold bg-slate-900/40 text-xs">
                <td className="py-2 px-3 text-slate-300">TOTAL</td>
                <td className="text-right py-2 px-3 text-white">{calc.totalUnits}</td>
                <td className="py-2 px-3"></td>
                <td className="text-right py-2 px-3 text-red-400">{fmt(calc.totalRenoCost)}</td>
                <td className="text-right py-2 px-3 text-slate-400">${calc.avgPricePSF.toFixed(0)}</td>
                <td className="text-right py-2 px-3 text-slate-300">{fmtM(calc.grossSellout)}</td>
                <td className="text-right py-2 px-3 text-green-400">{fmtM(calc.netSellout)}</td>
                <td className="text-right py-2 px-3 text-blue-400">{fmtM(calc.netProfit)}</td>
                <td className="py-2 px-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Cost Waterfall</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={calc.costWaterfall}>
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="value" name="Cost" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Gross vs Net Proceeds by Type</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={calc.unitSummary}>
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="grossRev" name="Gross Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="netRev" name="Net Proceeds" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cost" name="Allocated Cost" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Hold vs Convert */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Hold Strategy — Value Over Time</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={calc.holdYearlyData}>
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis tickFormatter={v => `$${(v / 1e6).toFixed(1)}M`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmtM(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={calc.netProfit + inp.purchasePrice} stroke="#22c55e" strokeDasharray="4 2" label={{ value: 'Conv. Net', fill: '#22c55e', fontSize: 9 }} />
            <Line type="monotone" dataKey="value" stroke="#94a3b8" strokeWidth={2} dot={false} name="Property Value" strokeDasharray="5 3" />
            <Line type="monotone" dataKey="equity" stroke="#3b82f6" strokeWidth={2} dot={false} name="Equity" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Condo Conversion — Key Considerations</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
          {[
            '📋 CC&Rs + HOA docs: required to sell individually; budget $15-30k for attorney to draft condo declaration and bylaws',
            '🏛 Local approval: many cities require a condo conversion permit + tenant relocation assistance; check local ordinance first',
            '🔍 Building inspection: lenders require condo cert before financing individual units — budget for deferred maintenance repairs',
            '⏱️ Tenant displacement: existing tenants have right-of-first-refusal in most states; plan for 6-12 month vacant timeline',
            '💰 Presales vs build-out: some markets require 50-70% presales before construction; others allow spec sell-out after completion',
            '🏦 Construction financing: bridge loans for conversion typically 65-70% LTC at prime+1-3%; shorter terms (12-24mo)',
            '📈 Condo premium: individually owned condos often trade 10-25% above equivalent apartment cap rate value — the conversion spread',
            '⚖️ vs. Rental hold: conversion is better when sell-out premium > long-term rent growth + appreciation; location matters most',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
