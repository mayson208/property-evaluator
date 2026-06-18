import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line, AreaChart, Area } from 'recharts'

interface DrawStage {
  id: string
  name: string
  pctOfHardCost: number
  month: number
}

interface Inputs {
  landCost: number
  hardCostPSF: number
  grossSqft: number
  softCostPct: number
  contingencyPct: number
  loanLTC: number
  loanRate: number
  loanTermMonths: number
  originationPoints: number
  extensionFeesPct: number
  afterCompletionValue: number
  stabilizedCapRate: number
  stabilizedNOI: number
  permLoanLTV: number
  permLoanRate: number
  permLoanTermYrs: number
  drawStages: DrawStage[]
}

const DEF_STAGES: DrawStage[] = [
  { id: '1', name: 'Closing / Land Draw',  pctOfHardCost: 10, month: 0 },
  { id: '2', name: 'Foundation & Demo',    pctOfHardCost: 15, month: 2 },
  { id: '3', name: 'Framing & Structure',  pctOfHardCost: 25, month: 4 },
  { id: '4', name: 'MEP (Mech/Elec/Plumb)',pctOfHardCost: 20, month: 7 },
  { id: '5', name: 'Drywall & Finishes',   pctOfHardCost: 20, month: 10 },
  { id: '6', name: 'Final / CO Draw',      pctOfHardCost: 10, month: 13 },
]

const DEF: Inputs = {
  landCost: 350000,
  hardCostPSF: 140,
  grossSqft: 3200,
  softCostPct: 15,
  contingencyPct: 8,
  loanLTC: 70,
  loanRate: 9.5,
  loanTermMonths: 18,
  originationPoints: 1.5,
  extensionFeesPct: 0.5,
  afterCompletionValue: 980000,
  stabilizedCapRate: 6,
  stabilizedNOI: 52000,
  permLoanLTV: 70,
  permLoanRate: 6.75,
  permLoanTermYrs: 30,
  drawStages: DEF_STAGES,
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const N = (v: string) => parseFloat(v) || 0
let nextStageId = 7

export default function ConstructionLoanCalc() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = (k: keyof Inputs, v: string) => setInp(p => ({ ...p, [k]: N(v) }))
  const setStage = (id: string, k: keyof DrawStage, v: string) =>
    setInp(p => ({ ...p, drawStages: p.drawStages.map(s => s.id === id ? { ...s, [k]: typeof s[k] === 'number' ? N(v) : v } : s) }))

  const calc = useMemo(() => {
    const {
      landCost, hardCostPSF, grossSqft, softCostPct, contingencyPct,
      loanLTC, loanRate, loanTermMonths, originationPoints, extensionFeesPct,
      afterCompletionValue, stabilizedCapRate, stabilizedNOI,
      permLoanLTV, permLoanRate, permLoanTermYrs, drawStages,
    } = inp

    const hardCost = hardCostPSF * grossSqft
    const softCost = hardCost * softCostPct / 100
    const contingency = hardCost * contingencyPct / 100
    const totalProjectCost = landCost + hardCost + softCost + contingency
    const costPSF = grossSqft > 0 ? totalProjectCost / grossSqft : 0

    // Loan sizing
    const maxLoan = totalProjectCost * loanLTC / 100
    const originationFee = maxLoan * originationPoints / 100
    const equityRequired = totalProjectCost - maxLoan + originationFee

    // Normalize draw stages to 100% of hard cost
    const totalPct = drawStages.reduce((s, d) => s + d.pctOfHardCost, 0)
    const normalizedStages = drawStages.map(d => ({ ...d, normalizedPct: totalPct > 0 ? d.pctOfHardCost / totalPct * 100 : 0 }))

    // Monthly interest accrual on outstanding balance
    const monthlyRate = loanRate / 100 / 12
    let outstandingBalance = 0
    let totalInterest = 0

    // Build month-by-month draw schedule
    const monthData: { month: number; label: string; draw: number; balance: number; interest: number; cumInterest: number; stageName?: string }[] = []
    for (let m = 0; m <= loanTermMonths; m++) {
      const stagesThisMonth = normalizedStages.filter(s => s.month === m)
      const drawAmt = stagesThisMonth.reduce((s, d) => s + maxLoan * d.normalizedPct / 100, 0)
      outstandingBalance += drawAmt
      const monthInterest = outstandingBalance * monthlyRate
      totalInterest += monthInterest
      outstandingBalance += monthInterest // accruing interest reserve style
      monthData.push({
        month: m,
        label: `Mo ${m}`,
        draw: Math.round(drawAmt),
        balance: Math.round(outstandingBalance),
        interest: Math.round(monthInterest),
        cumInterest: Math.round(totalInterest),
        stageName: stagesThisMonth.length > 0 ? stagesThisMonth.map(s => s.name).join(', ') : undefined,
      })
    }

    const totalLoanCost = totalInterest + originationFee
    const interestReserveNeeded = totalInterest
    const allInCost = totalProjectCost + totalLoanCost

    // Profitability
    const devSpread = afterCompletionValue > 0 ? afterCompletionValue - totalProjectCost : 0
    const devSpreadPct = totalProjectCost > 0 ? devSpread / totalProjectCost * 100 : 0
    const returnOnCost = afterCompletionValue > 0 && totalProjectCost > 0 ? stabilizedCapRate : 0 // implied cap rate vs exit cap
    const yieldOnCost = grossSqft > 0 && totalProjectCost > 0 ? stabilizedNOI / totalProjectCost * 100 : 0
    const developmentSpread = yieldOnCost - stabilizedCapRate // positive = creating value
    const profitOnCost = afterCompletionValue - allInCost
    const roi = equityRequired > 0 ? profitOnCost / equityRequired * 100 : 0

    // Permanent loan sizing
    const permValueBasis = Math.max(afterCompletionValue, stabilizedNOI > 0 && stabilizedCapRate > 0 ? stabilizedNOI / (stabilizedCapRate / 100) : 0)
    const permLoanAmount = permValueBasis * permLoanLTV / 100
    const permMonthlyRate = permLoanRate / 100 / 12
    const permNumPayments = permLoanTermYrs * 12
    const permMonthlyPayment = permLoanAmount > 0 ? permLoanAmount * permMonthlyRate * Math.pow(1 + permMonthlyRate, permNumPayments) / (Math.pow(1 + permMonthlyRate, permNumPayments) - 1) : 0
    const permAnnualDS = permMonthlyPayment * 12
    const permDSCR = permAnnualDS > 0 ? stabilizedNOI / permAnnualDS : 0
    const cashOutAtRefi = permLoanAmount - maxLoan
    const equityRecaptured = cashOutAtRefi > 0 ? cashOutAtRefi : 0

    // Simplified bar chart data for draw schedule
    const drawChartData = normalizedStages.map(s => ({ name: s.name.split('(')[0].trim(), draw: Math.round(maxLoan * s.normalizedPct / 100), month: s.month }))

    return {
      hardCost, softCost, contingency, totalProjectCost, costPSF,
      maxLoan, originationFee, equityRequired,
      normalizedStages, monthData, totalInterest, totalLoanCost, interestReserveNeeded, allInCost,
      devSpread, devSpreadPct, yieldOnCost, developmentSpread, profitOnCost, roi,
      permLoanAmount, permMonthlyPayment, permAnnualDS, permDSCR, cashOutAtRefi, equityRecaptured,
      drawChartData, totalPct,
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

  const profitable = calc.devSpread > 0
  const positiveSpread = calc.developmentSpread > 0

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-lg font-bold text-white">Construction Loan Analyzer</h2>
        <p className="text-slate-400 text-xs mt-1">Draw schedule, interest reserve, LTC, yield-on-cost vs exit cap rate, development spread, permanent loan sizing and cash-out</p>
      </div>

      {/* KPI Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Project Cost', value: fmt(calc.totalProjectCost), color: 'text-white' },
          { label: 'Equity Required', value: fmt(calc.equityRequired), color: 'text-orange-400' },
          { label: 'Development Profit', value: fmt(calc.profitOnCost), color: calc.profitOnCost > 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'Equity ROI', value: `${calc.roi.toFixed(1)}%`, color: calc.roi >= 20 ? 'text-green-400' : calc.roi >= 10 ? 'text-yellow-400' : 'text-red-400' },
        ].map(m => (
          <div key={m.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
            <p className={`text-2xl font-black ${m.color}`}>{m.value}</p>
            <p className="text-xs text-slate-400 mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Dev Spread Banner */}
      <div className={`rounded-xl p-4 border ${positiveSpread ? 'bg-green-900/20 border-green-700/40' : 'bg-red-900/20 border-red-700/40'}`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{positiveSpread ? '📈' : '📉'}</span>
          <div>
            <p className={`font-bold ${positiveSpread ? 'text-green-300' : 'text-red-300'}`}>
              Development Spread: {calc.developmentSpread > 0 ? '+' : ''}{calc.developmentSpread.toFixed(2)}% (Yield-on-Cost {calc.yieldOnCost.toFixed(2)}% vs Exit Cap {inp.stabilizedCapRate}%)
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {positiveSpread
                ? `Creating value — yield exceeds cap rate. Implied value ${fmt(inp.stabilizedNOI > 0 ? inp.stabilizedNOI / (inp.stabilizedCapRate / 100) : 0)} vs cost ${fmt(calc.totalProjectCost)}`
                : `Destroying value — building costs more than stabilized NOI supports at this cap rate. Increase rents or reduce costs.`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Project Costs */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Project Costs</p>
          {field('Land / Acquisition Cost', 'landCost', '', '$')}
          {field('Hard Cost / sqft', 'hardCostPSF', '/sqft', '$')}
          {field('Gross Building Sqft', 'grossSqft', 'sqft')}
          {field('Soft Costs (% of hard)', 'softCostPct', '%')}
          {field('Contingency (% of hard)', 'contingencyPct', '%')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Hard Cost</span><span className="text-slate-300">{fmt(calc.hardCost)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Soft Costs</span><span className="text-slate-300">{fmt(calc.softCost)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Contingency</span><span className="text-slate-300">{fmt(calc.contingency)}</span></div>
            <div className="flex justify-between border-t border-slate-700 pt-1"><span className="text-white font-bold">Total Project Cost</span><span className="text-white font-bold">{fmt(calc.totalProjectCost)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Cost / sqft</span><span className="text-blue-400">${calc.costPSF.toFixed(0)}/sqft</span></div>
          </div>
        </div>

        {/* Construction Loan */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Construction Loan</p>
          {field('Loan-to-Cost (LTC)', 'loanLTC', '%')}
          {field('Interest Rate', 'loanRate', '%')}
          {field('Loan Term', 'loanTermMonths', 'mo')}
          {field('Origination Points', 'originationPoints', 'pts')}
          {field('Extension Fee', 'extensionFeesPct', '%')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Max Loan Amount</span><span className="text-blue-400 font-bold">{fmt(calc.maxLoan)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Origination Fee</span><span className="text-red-400">{fmt(calc.originationFee)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Interest Reserve Needed</span><span className="text-red-400">{fmt(calc.interestReserveNeeded)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Total Loan Cost</span><span className="text-red-400">{fmt(calc.totalLoanCost)}</span></div>
            <div className="flex justify-between border-t border-slate-700 pt-1"><span className="text-slate-300 font-bold">Equity Required</span><span className="text-orange-400 font-bold">{fmt(calc.equityRequired)}</span></div>
          </div>
        </div>

        {/* Profitability & Perm */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Exit & Permanent Loan</p>
          {field('After-Completion Value (ARV)', 'afterCompletionValue', '', '$')}
          {field('Stabilized NOI', 'stabilizedNOI', '/yr', '$')}
          {field('Exit Cap Rate', 'stabilizedCapRate', '%')}
          {field('Perm Loan LTV', 'permLoanLTV', '%')}
          {field('Perm Loan Rate', 'permLoanRate', '%')}
          {field('Perm Loan Term', 'permLoanTermYrs', 'yr')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Perm Loan Amount</span><span className="text-blue-400">{fmt(calc.permLoanAmount)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Monthly Payment</span><span className="text-slate-300">{fmt(calc.permMonthlyPayment)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Perm DSCR</span><span className={calc.permDSCR >= 1.25 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>{calc.permDSCR.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Cash-Out at Refi</span><span className={calc.cashOutAtRefi > 0 ? 'text-green-400 font-bold' : 'text-red-400'}>{fmt(calc.cashOutAtRefi)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Equity Recaptured</span><span className={calc.equityRecaptured > 0 ? 'text-green-400' : 'text-slate-400'}>{fmt(calc.equityRecaptured)}</span></div>
          </div>
        </div>
      </div>

      {/* Draw Schedule Table */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between p-3 border-b border-slate-700">
          <div>
            <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Draw Schedule</p>
            {calc.totalPct !== 100 && <p className="text-xs text-yellow-400 mt-0.5">⚠️ Draw %s total {calc.totalPct.toFixed(0)}% — will be auto-normalized to 100%</p>}
          </div>
          <button onClick={() => setInp(p => ({ ...p, drawStages: [...p.drawStages, { id: String(nextStageId++), name: 'New Stage', pctOfHardCost: 10, month: 6 }] }))}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg">+ Stage</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-slate-500 border-b border-slate-700 bg-slate-900/30">
              <th className="text-left py-2 px-3">Stage Name</th>
              <th className="text-right py-2 px-3">% of Hard Cost</th>
              <th className="text-right py-2 px-3">Draw Month</th>
              <th className="text-right py-2 px-3">Draw Amount</th>
              <th className="py-2 px-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-slate-700/50">
              {calc.normalizedStages.map(s => (
                <tr key={s.id} className="hover:bg-slate-700/20">
                  <td className="py-2 px-3">
                    <input value={s.name} onChange={e => setStage(s.id, 'name', e.target.value)}
                      className="bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none text-slate-200 w-48" />
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center justify-end gap-1">
                      <input type="number" value={s.pctOfHardCost} onChange={e => setStage(s.id, 'pctOfHardCost', e.target.value)}
                        className="bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none text-right text-slate-300 w-14" />
                      <span className="text-slate-500">%</span>
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-slate-500">Mo</span>
                      <input type="number" value={s.month} onChange={e => setStage(s.id, 'month', e.target.value)}
                        className="bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none text-right text-slate-300 w-12" />
                    </div>
                  </td>
                  <td className="text-right py-2 px-3 text-blue-400 font-semibold">{fmt(calc.maxLoan * s.normalizedPct / 100)}</td>
                  <td className="py-2 px-3">
                    <button onClick={() => setInp(p => ({ ...p, drawStages: p.drawStages.filter(x => x.id !== s.id) }))} className="text-slate-600 hover:text-red-400">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-600 font-bold text-xs bg-slate-900/30">
                <td className="py-2 px-3 text-slate-300">Total</td>
                <td className="text-right py-2 px-3 text-yellow-400">{calc.totalPct.toFixed(0)}%</td>
                <td className="py-2 px-3"></td>
                <td className="text-right py-2 px-3 text-blue-400">{fmt(calc.maxLoan)}</td>
                <td className="py-2 px-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Draw Amounts by Stage</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={calc.drawChartData} layout="vertical">
              <XAxis type="number" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 9 }} width={110} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="draw" name="Draw Amount" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Outstanding Balance & Accrued Interest</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={calc.monthData.filter((_, i) => i % 2 === 0)}>
              <defs>
                <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="balance" stroke="#3b82f6" fill="url(#balGrad)" strokeWidth={2} name="Loan Balance" />
              <Line type="monotone" dataKey="cumInterest" stroke="#f59e0b" strokeWidth={2} dot={false} name="Accrued Interest" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cost breakdown */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">All-In Cost Waterfall</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={[
            { name: 'Land', value: inp.landCost, fill: '#94a3b8' },
            { name: 'Hard Cost', value: calc.hardCost, fill: '#3b82f6' },
            { name: 'Soft Costs', value: calc.softCost, fill: '#f59e0b' },
            { name: 'Contingency', value: calc.contingency, fill: '#a855f7' },
            { name: 'Loan Cost', value: calc.totalLoanCost, fill: '#ef4444' },
          ]}>
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Bar dataKey="value" name="Cost Component" radius={[4, 4, 0, 0]}>
              {[{ fill: '#94a3b8' }, { fill: '#3b82f6' }, { fill: '#f59e0b' }, { fill: '#a855f7' }, { fill: '#ef4444' }].map((c, i) => (
                <rect key={i} fill={c.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Construction Finance — Key Concepts</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
          {[
            '🏗 LTC (Loan-to-Cost): construction loan basis — typically 65-75%; never confuse with LTV (which is based on value)',
            '📐 Yield-on-Cost: Stabilized NOI ÷ Total Project Cost — compare to exit cap rate to measure value creation',
            '💹 Development Spread: Yield-on-Cost minus Exit Cap Rate — positive spread = project creates value at these numbers',
            '📋 Draw schedule: lender releases funds in stages against inspected work completion; inspector verifies before each draw',
            '💰 Interest reserve: pre-funded holdback from loan proceeds to cover I/O payments during construction — avoids cash drag',
            '🔄 Mini-perm: short-term bridge loan (12-24mo) after construction before stabilization; then refi to permanent',
            '⏱️ Construction timeline risk: delays increase interest carry; 5% contingency is minimum — 10%+ for ground-up',
            '🏦 Perm loan sizing: based on stabilized DSCR (≥1.25x) and LTV — underwrite to the lower of the two constraints',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
