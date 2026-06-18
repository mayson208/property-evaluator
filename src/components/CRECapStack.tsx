import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts'

interface CapLayer {
  id: string
  name: string
  amount: number
  rate: number
  isEquity: boolean
  term: number
  originationFee: number
  color: string
}

interface Inputs {
  dealValue: number
  noi: number
  exitCapRate: number
  holdYears: number
  noiGrowthRate: number
  sellingCostPct: number
  layers: CapLayer[]
}

const DEF_LAYERS: CapLayer[] = [
  { id: '1', name: 'Senior Debt (1st Mortgage)', amount: 3500000, rate: 6.75, isEquity: false, term: 10, originationFee: 1.0, color: '#3b82f6' },
  { id: '2', name: 'Mezzanine Debt',             amount: 700000,  rate: 11.5, isEquity: false, term: 5,  originationFee: 2.0, color: '#f59e0b' },
  { id: '3', name: 'Preferred Equity',           amount: 500000,  rate: 14.0, isEquity: true,  term: 5,  originationFee: 1.5, color: '#a855f7' },
  { id: '4', name: 'Common Equity (LP/GP)',      amount: 800000,  rate: 0,    isEquity: true,  term: 10, originationFee: 0,   color: '#22c55e' },
]

const DEF: Inputs = {
  dealValue: 5500000,
  noi: 330000,
  exitCapRate: 6.5,
  holdYears: 7,
  noiGrowthRate: 3,
  sellingCostPct: 2,
  layers: DEF_LAYERS,
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const fmtM = (n: number) => n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : fmt(n)
const N = (v: string) => parseFloat(v) || 0
let nextLayerId = 5

function calcIRR(cashflows: number[]): number {
  let rate = 0.15
  for (let i = 0; i < 150; i++) {
    let npv = 0, d = 0
    cashflows.forEach((cf, t) => {
      const disc = Math.pow(1 + rate, t)
      npv += cf / disc
      d -= t * cf / (disc * (1 + rate))
    })
    const next = rate - npv / d
    if (!isFinite(next) || Math.abs(next - rate) < 1e-8) return next * 100
    rate = next
  }
  return rate * 100
}

export default function CRECapStack() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = (k: keyof Inputs, v: string) => setInp(p => ({ ...p, [k]: N(v) }))
  const setLayer = (id: string, k: keyof CapLayer, v: string | boolean) =>
    setInp(p => ({ ...p, layers: p.layers.map(l => l.id === id ? { ...l, [k]: typeof v === 'boolean' ? v : (typeof l[k] === 'number' ? N(v as string) : v) } : l) }))

  const calc = useMemo(() => {
    const { dealValue, noi, exitCapRate, holdYears, noiGrowthRate, sellingCostPct, layers } = inp

    const totalCapStack = layers.reduce((s, l) => s + l.amount, 0)
    const ltv = dealValue > 0 ? totalCapStack / dealValue * 100 : 0
    const capRate = dealValue > 0 ? noi / dealValue * 100 : 0

    // Senior debt only metrics
    const seniorDebt = layers.find(l => l.id === '1') ?? layers.filter(l => !l.isEquity)[0]
    const seniorLTV = seniorDebt ? seniorDebt.amount / dealValue * 100 : 0
    const seniorDSCR = seniorDebt ? noi / (seniorDebt.amount * seniorDebt.rate / 100) : 0

    // Whole loan (all debt)
    const totalDebt = layers.filter(l => !l.isEquity).reduce((s, l) => s + l.amount, 0)
    const totalAnnualInterest = layers.filter(l => !l.isEquity).reduce((s, l) => s + l.amount * l.rate / 100, 0)
    const wholeDebtDSCR = totalAnnualInterest > 0 ? noi / totalAnnualInterest : Infinity
    const debtYield = totalDebt > 0 ? noi / totalDebt * 100 : 0

    // Preferred equity annual payment
    const prefEquityAnnual = layers.filter(l => l.isEquity && l.rate > 0).reduce((s, l) => s + l.amount * l.rate / 100, 0)
    const cashFlowAfterDebtAndPref = noi - totalAnnualInterest - prefEquityAnnual

    // Common equity basis
    const commonEquity = layers.find(l => l.isEquity && l.rate === 0)
    const totalEquity = layers.filter(l => l.isEquity).reduce((s, l) => s + l.amount, 0)
    const equityCOC = commonEquity && commonEquity.amount > 0 ? Math.max(0, cashFlowAfterDebtAndPref) / commonEquity.amount * 100 : 0

    // Exit value
    const exitNOI = noi * Math.pow(1 + noiGrowthRate / 100, holdYears)
    const exitValue = exitCapRate > 0 ? exitNOI / (exitCapRate / 100) : dealValue
    const sellingCosts = exitValue * sellingCostPct / 100
    const netExitProceeds = exitValue - sellingCosts

    // Remaining balances at exit (simplified — interest only for mezz/pref, amortizing for senior)
    const layerReturns = layers.map(l => {
      const annualPmt = l.amount * l.rate / 100
      const originationFee = l.amount * l.originationFee / 100
      const totalInterestPaid = annualPmt * Math.min(l.term, holdYears)
      const exitRepayment = l.amount // simplified (IO or bullet)

      // IRR: outflow = amount, inflows = annual interest, exit = principal
      const cashflows = [-l.amount, ...Array(holdYears - 1).fill(annualPmt), annualPmt + exitRepayment]
      const irr = l.isEquity && l.rate === 0 ? 0 : calcIRR(cashflows)
      const multiple = l.amount > 0 ? (totalInterestPaid + exitRepayment) / l.amount : 0

      return {
        ...l, annualPmt, originationFee, totalInterestPaid, exitRepayment, irr, multiple,
        annualReturn: l.amount > 0 ? annualPmt / l.amount * 100 : 0,
      }
    })

    // Common equity IRR (gets residual after all debt/pref paid)
    const totalDebtRepay = layers.filter(l => !l.isEquity).reduce((s, l) => s + l.amount, 0)
    const totalPrefRepay = layers.filter(l => l.isEquity && l.rate > 0).reduce((s, l) => s + l.amount, 0)
    const commonEquityResidual = netExitProceeds - totalDebtRepay - totalPrefRepay
    const commonEquityTotalReturn = commonEquity ? commonEquityResidual + cashFlowAfterDebtAndPref * holdYears : 0
    const commonEquityIRR = commonEquity && commonEquity.amount > 0 ? calcIRR(
      [-commonEquity.amount, ...Array(holdYears - 1).fill(Math.max(0, cashFlowAfterDebtAndPref)), Math.max(0, cashFlowAfterDebtAndPref) + Math.max(0, commonEquityResidual)]
    ) : 0
    const commonEquityMultiple = commonEquity && commonEquity.amount > 0 ? Math.max(0, commonEquityTotalReturn) / commonEquity.amount : 0

    // Pie data
    const stackPie = layers.map(l => ({ name: l.name, value: l.amount, color: l.color }))

    // Year-by-year NOI vs debt service
    const yearlyData = Array.from({ length: holdYears }, (_, i) => {
      const y = i + 1
      const projNOI = noi * Math.pow(1 + noiGrowthRate / 100, y - 1)
      return {
        year: `Yr ${y}`,
        noi: Math.round(projNOI),
        debtService: Math.round(totalAnnualInterest),
        prefReturn: Math.round(prefEquityAnnual),
        cashFlow: Math.round(projNOI - totalAnnualInterest - prefEquityAnnual),
      }
    })

    const risks = [
      { flag: wholeDebtDSCR < 1.0, text: `Whole-loan DSCR ${wholeDebtDSCR.toFixed(2)}x — NOI does NOT cover total debt service; deal is cash-flow negative` },
      { flag: wholeDebtDSCR >= 1.0 && wholeDebtDSCR < 1.25, text: `Whole-loan DSCR ${wholeDebtDSCR.toFixed(2)}x — tight coverage; no buffer for NOI decline` },
      { flag: seniorLTV > 75, text: `Senior LTV ${seniorLTV.toFixed(1)}% — above typical 70-75% bank threshold; expect required reserves or cross-collateral` },
      { flag: ltv > 90, text: `Total stack LTV ${ltv.toFixed(1)}% — highly leveraged; minimal equity cushion at exit` },
      { flag: commonEquityResidual < 0, text: `Common equity receives $0 at exit — waterfall shortfall; common equity is wiped out` },
      { flag: debtYield < 8, text: `Debt yield ${debtYield.toFixed(1)}% — below 8% threshold most lenders require for construction/bridge` },
    ].filter(r => r.flag)

    return {
      totalCapStack, ltv, capRate, seniorLTV, seniorDSCR, totalDebt, totalAnnualInterest,
      wholeDebtDSCR, debtYield, prefEquityAnnual, cashFlowAfterDebtAndPref,
      equityCOC, exitNOI, exitValue, sellingCosts, netExitProceeds,
      commonEquityResidual, commonEquityTotalReturn, commonEquityIRR, commonEquityMultiple,
      layerReturns, stackPie, yearlyData, risks,
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
        <h2 className="text-lg font-bold text-white">CRE Capital Stack Analyzer</h2>
        <p className="text-slate-400 text-xs mt-1">Senior debt · Mezzanine · Preferred equity · Common equity — DSCR, debt yield, returns by position, waterfall at exit</p>
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
          { label: 'Total Capital Stack', value: fmtM(calc.totalCapStack), color: 'text-white' },
          { label: 'Overall LTV', value: `${calc.ltv.toFixed(1)}%`, color: calc.ltv <= 75 ? 'text-green-400' : calc.ltv <= 85 ? 'text-yellow-400' : 'text-red-400' },
          { label: 'Whole-Loan DSCR', value: calc.wholeDebtDSCR === Infinity ? '∞' : calc.wholeDebtDSCR.toFixed(2) + 'x', color: calc.wholeDebtDSCR >= 1.25 ? 'text-green-400' : calc.wholeDebtDSCR >= 1.0 ? 'text-yellow-400' : 'text-red-400' },
          { label: 'Debt Yield', value: `${calc.debtYield.toFixed(1)}%`, color: calc.debtYield >= 9 ? 'text-green-400' : calc.debtYield >= 7 ? 'text-yellow-400' : 'text-red-400' },
        ].map(m => (
          <div key={m.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
            <p className={`text-2xl font-black ${m.color}`}>{m.value}</p>
            <p className="text-xs text-slate-400 mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Deal Setup */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Deal Fundamentals</p>
          {field('Acquisition / Current Value', 'dealValue', '', '$')}
          {field('Current Year NOI', 'noi', '/yr', '$')}
          {field('NOI Growth Rate', 'noiGrowthRate', '%')}
          {field('Exit Cap Rate', 'exitCapRate', '%')}
          {field('Hold Period', 'holdYears', 'yr')}
          {field('Selling Costs at Exit', 'sellingCostPct', '%')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Going-In Cap Rate</span><span className="text-blue-400 font-bold">{calc.capRate.toFixed(2)}%</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Exit NOI</span><span className="text-slate-300">{fmt(calc.exitNOI)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Exit Value</span><span className="text-green-400 font-bold">{fmtM(calc.exitValue)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Net Exit Proceeds</span><span className="text-green-400">{fmtM(calc.netExitProceeds)}</span></div>
          </div>
        </div>

        {/* Coverage Tests */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Coverage Tests</p>
          <div className="space-y-2">
            {[
              { label: 'NOI', value: fmt(inp.noi), color: 'text-white' },
              { label: 'Total Annual Debt Interest', value: `(${fmt(calc.totalAnnualInterest)})`, color: 'text-red-400' },
              { label: 'Preferred Equity Return', value: `(${fmt(calc.prefEquityAnnual)})`, color: 'text-orange-400' },
              { label: 'Cash Flow to Common', value: fmt(calc.cashFlowAfterDebtAndPref), color: calc.cashFlowAfterDebtAndPref > 0 ? 'text-green-400' : 'text-red-400', bold: true },
            ].map(m => (
              <div key={m.label} className={`flex justify-between items-center p-2 rounded-lg ${(m as {bold?: boolean}).bold ? 'bg-blue-900/20 border border-blue-700/30' : 'bg-slate-900/50'}`}>
                <span className="text-xs text-slate-400">{m.label}</span>
                <span className={`text-xs font-bold ${m.color}`}>{m.value}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { label: 'Senior DSCR', value: calc.seniorDSCR.toFixed(2) + 'x', color: calc.seniorDSCR >= 1.25 ? 'text-green-400' : 'text-red-400' },
              { label: 'Whole DSCR', value: calc.wholeDebtDSCR === Infinity ? '∞' : calc.wholeDebtDSCR.toFixed(2) + 'x', color: calc.wholeDebtDSCR >= 1.25 ? 'text-green-400' : 'text-red-400' },
              { label: 'Senior LTV', value: `${calc.seniorLTV.toFixed(1)}%`, color: calc.seniorLTV <= 65 ? 'text-green-400' : 'text-yellow-400' },
              { label: 'Debt Yield', value: `${calc.debtYield.toFixed(1)}%`, color: calc.debtYield >= 9 ? 'text-green-400' : 'text-yellow-400' },
              { label: 'Common CoC', value: `${calc.equityCOC.toFixed(1)}%`, color: calc.equityCOC >= 8 ? 'text-green-400' : 'text-yellow-400' },
              { label: 'Common Residual', value: fmtM(calc.commonEquityResidual), color: calc.commonEquityResidual > 0 ? 'text-green-400' : 'text-red-400' },
              { label: 'Common IRR', value: `${calc.commonEquityIRR.toFixed(1)}%`, color: calc.commonEquityIRR >= 15 ? 'text-green-400' : 'text-yellow-400' },
              { label: 'Common EM', value: `${calc.commonEquityMultiple.toFixed(2)}x`, color: calc.commonEquityMultiple >= 2 ? 'text-green-400' : 'text-yellow-400' },
            ].map(m => (
              <div key={m.label} className="bg-slate-900/50 rounded-lg p-2 text-center">
                <p className={`text-sm font-bold ${m.color}`}>{m.value}</p>
                <p className="text-slate-500 text-xs">{m.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stack Pie */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Capital Stack</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={calc.stackPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {calc.stackPie.map((l, i) => <Cell key={i} fill={l.color} />)}
              </Pie>
              <Tooltip formatter={(v: number) => fmtM(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1">
            {inp.layers.map(l => (
              <div key={l.id} className="flex items-center gap-2 text-xs">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: l.color }} />
                <span className="text-slate-400 flex-1 truncate">{l.name}</span>
                <span className="text-slate-300">{fmtM(l.amount)}</span>
                <span className="text-slate-500">{(l.amount / inp.dealValue * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Layer Editor */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Capital Stack Layers</p>
          <button onClick={() => setInp(p => ({ ...p, layers: [...p.layers, { id: String(nextLayerId++), name: 'New Layer', amount: 500000, rate: 10, isEquity: false, term: 5, originationFee: 1, color: '#06b6d4' }] }))}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg">+ Add Layer</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-slate-500 border-b border-slate-700 bg-slate-900/30">
              <th className="text-left py-2 px-3">Position</th>
              <th className="text-right py-2 px-3">Amount</th>
              <th className="text-right py-2 px-3">Rate</th>
              <th className="text-right py-2 px-3">Term</th>
              <th className="text-right py-2 px-3">Orig Fee</th>
              <th className="text-right py-2 px-3">Annual Pmt</th>
              <th className="text-right py-2 px-3">Type</th>
              <th className="py-2 px-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-slate-700/50">
              {calc.layerReturns.map(l => (
                <tr key={l.id} className="hover:bg-slate-700/20">
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
                      <input value={l.name} onChange={e => setLayer(l.id, 'name', e.target.value)}
                        className="bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none text-slate-200 w-36" />
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-slate-500">$</span>
                      <input type="number" value={l.amount} onChange={e => setLayer(l.id, 'amount', e.target.value)}
                        className="bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none text-right text-slate-300 w-20" />
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center justify-end gap-1">
                      <input type="number" value={l.rate} onChange={e => setLayer(l.id, 'rate', e.target.value)}
                        className="bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none text-right text-slate-300 w-12" />
                      <span className="text-slate-500">%</span>
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center justify-end gap-1">
                      <input type="number" value={l.term} onChange={e => setLayer(l.id, 'term', e.target.value)}
                        className="bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none text-right text-slate-300 w-10" />
                      <span className="text-slate-500">yr</span>
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center justify-end gap-1">
                      <input type="number" value={l.originationFee} onChange={e => setLayer(l.id, 'originationFee', e.target.value)}
                        className="bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none text-right text-slate-300 w-10" />
                      <span className="text-slate-500">%</span>
                    </div>
                  </td>
                  <td className="text-right py-2 px-3 text-orange-400">{l.rate > 0 ? fmt(l.annualPmt) : '—'}</td>
                  <td className="py-2 px-3">
                    <button onClick={() => setLayer(l.id, 'isEquity', !l.isEquity)}
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${l.isEquity ? 'bg-green-900/40 text-green-300' : 'bg-blue-900/40 text-blue-300'}`}>
                      {l.isEquity ? 'Equity' : 'Debt'}
                    </button>
                  </td>
                  <td className="py-2 px-3">
                    <button onClick={() => setInp(p => ({ ...p, layers: p.layers.filter(x => x.id !== l.id) }))} className="text-slate-600 hover:text-red-400">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* NOI vs Debt Service Chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">NOI vs Debt Service + Preferred — Annual Cash Flow to Common</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={calc.yearlyData}>
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="noi" name="NOI" fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="debtService" name="Debt Interest" fill="#ef4444" radius={[4, 4, 0, 0]} />
            <Bar dataKey="prefReturn" name="Pref Return" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            <Bar dataKey="cashFlow" name="To Common Equity" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Capital Stack — Key Concepts</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
          {[
            '🏦 Senior debt: lowest risk, lowest return; typically 5-7% on stabilized CRE; first lien, highest recovery in default',
            '💰 Mezzanine debt: 2nd position behind senior; 10-14% typical; structurally subordinated; UCC lien on borrower entity',
            '⭐ Preferred equity: equity layer with preferred return (12-16%); accrues if cash insufficient; no lien — legal dispute in default',
            '📊 Debt yield: NOI ÷ Loan Amount — lenders target 8-10%+ on stabilized assets; more conservative than LTV alone',
            '🔒 DSCR: Debt Service Coverage Ratio — NOI ÷ annual debt service; lenders require 1.20-1.35x; below 1.0x = cash-flow negative',
            '📐 Whole loan DSCR: covers ALL debt (senior + mezz) — tells you if the deal actually cash flows before equity distributions',
            '🎯 Preferred return accrual: if NOI doesn\'t cover pref return, it accrues; cash at exit pays accrued pref before common',
            '💹 Common equity IRR: should target 15-20%+ to compensate for last-in-line position; gets all residual upside',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
