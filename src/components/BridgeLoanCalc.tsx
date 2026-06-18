import { useState, useMemo } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts'

type PaymentType = 'io' | 'amortizing'
type ExitType = 'refi' | 'sell' | 'conventional'

interface Inputs {
  purchasePrice: number
  rehabBudget: number
  afterRepairValue: number
  // Bridge
  bridgeLTV: number
  bridgeRate: number
  bridgeOriginationPct: number
  bridgeExitFeePct: number
  bridgeTerm: number
  bridgePaymentType: PaymentType
  // Stabilization
  stabMonths: number
  monthlyNOI: number
  // Perm / Exit
  exitType: ExitType
  permRate: number
  permLTV: number
  permTerm: number
  permOriginationPct: number
  permAmortYears: number
  // Conventional alt
  convRate: number
  convLTV: number
  convOriginationPct: number
  convAmortYears: number
  // Carry
  monthlyCarry: number
  // Delay scenario
  delayMonths: number
}

const DEF: Inputs = {
  purchasePrice: 850000,
  rehabBudget: 120000,
  afterRepairValue: 1250000,
  bridgeLTV: 75,
  bridgeRate: 9.5,
  bridgeOriginationPct: 2.0,
  bridgeExitFeePct: 1.0,
  bridgeTerm: 18,
  bridgePaymentType: 'io',
  stabMonths: 12,
  monthlyNOI: 8200,
  exitType: 'refi',
  permRate: 6.75,
  permLTV: 70,
  permTerm: 10,
  permOriginationPct: 1.0,
  permAmortYears: 30,
  convRate: 7.25,
  convLTV: 65,
  convOriginationPct: 1.5,
  convAmortYears: 30,
  monthlyCarry: 1800,
  delayMonths: 6,
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const N = (v: string) => parseFloat(v) || 0

function monthlyPmt(principal: number, annualRate: number, amortYears: number): number {
  if (annualRate === 0) return principal / (amortYears * 12)
  const r = annualRate / 100 / 12
  const n = amortYears * 12
  return principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1)
}

export default function BridgeLoanCalc() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = <K extends keyof Inputs>(k: K, v: string | PaymentType | ExitType) =>
    setInp(p => ({ ...p, [k]: typeof p[k] === 'number' ? N(v as string) : v }))

  const calc = useMemo(() => {
    const {
      purchasePrice, rehabBudget, afterRepairValue,
      bridgeLTV, bridgeRate, bridgeOriginationPct, bridgeExitFeePct, bridgeTerm, bridgePaymentType,
      stabMonths, monthlyNOI,
      exitType, permRate, permLTV, permTerm, permOriginationPct, permAmortYears,
      convRate, convLTV, convOriginationPct, convAmortYears,
      monthlyCarry, delayMonths,
    } = inp

    const totalCost = purchasePrice + rehabBudget
    const bridgeLoan = purchasePrice * bridgeLTV / 100
    const bridgeOriginFee = bridgeLoan * bridgeOriginationPct / 100
    const bridgeMonthlyIO = bridgeLoan * bridgeRate / 100 / 12
    const bridgeAmortPmt = bridgePaymentType === 'amortizing' ? monthlyPmt(bridgeLoan, bridgeRate, 30) : bridgeMonthlyIO
    const bridgeTotalInterest = bridgeAmortPmt * bridgeTerm
    const bridgeExitFee = bridgeLoan * bridgeExitFeePct / 100
    const totalCarryDuring = monthlyCarry * bridgeTerm
    const totalBridgeCost = bridgeOriginFee + bridgeTotalInterest + bridgeExitFee

    // Perm loan (refi exit)
    const permLoanAmt = afterRepairValue * permLTV / 100
    const permOriginFee = permLoanAmt * permOriginationPct / 100
    const permMonthlyPmt = monthlyPmt(permLoanAmt, permRate, permAmortYears)
    const permDSCR = permMonthlyPmt > 0 ? monthlyNOI / permMonthlyPmt : Infinity
    const permCashOut = permLoanAmt - bridgeLoan

    // Conventional alt (day-1 financing)
    const convLoan = purchasePrice * convLTV / 100
    const convOriginFee = convLoan * convOriginationPct / 100
    const convMonthlyPmt = monthlyPmt(convLoan, convRate, convAmortYears)
    const convTotalInterest = convMonthlyPmt * bridgeTerm // same hold period for comparison
    const totalConvCost = convOriginFee + convTotalInterest

    // Bridge total all-in vs conv total all-in
    const bridgeAllIn = bridgeOriginFee + bridgeTotalInterest + bridgeExitFee + (exitType === 'refi' ? permOriginFee : 0)
    const convAllIn = convOriginFee + convTotalInterest

    const bridgePremium = bridgeAllIn - convAllIn
    const bridgePremiumMonthly = bridgeTerm > 0 ? bridgePremium / bridgeTerm : 0

    // Equity at refi / sale
    const equityAtRefi = afterRepairValue - bridgeLoan
    const netCashOut = permCashOut - permOriginFee
    const equityCapture = afterRepairValue - totalCost

    // Delay scenario
    const delayExtraCost = (bridgeMonthlyIO + monthlyCarry) * delayMonths
    const delayTotalBridgeCost = totalBridgeCost + delayExtraCost

    // Month-by-month cost timeline
    const timelineMonths = bridgeTerm + delayMonths + 6
    const bridgeLine: { month: number; bridge: number; conv: number; noi: number }[] = []
    let bridgeCum = bridgeOriginFee
    let convCum = convOriginFee
    for (let m = 1; m <= timelineMonths; m++) {
      bridgeCum += m <= bridgeTerm ? bridgeAmortPmt : m === bridgeTerm + 1 ? bridgeExitFee + permOriginFee : permMonthlyPmt
      convCum += convMonthlyPmt
      const noiBenefit = m > stabMonths ? monthlyNOI * (m - stabMonths) : 0
      bridgeLine.push({ month: m, bridge: Math.round(bridgeCum), conv: Math.round(convCum), noi: Math.round(noiBenefit) })
    }

    // Breakeven: how many months does refi/value-add premium need to be recovered
    const refiYieldSpread = ((afterRepairValue - totalCost) / totalCost * 100)

    // Comparable scenarios bar
    const scenarioBar = [
      { name: 'Bridge (base)', total: Math.round(totalBridgeCost), origin: Math.round(bridgeOriginFee), interest: Math.round(bridgeTotalInterest), exitFee: Math.round(bridgeExitFee) },
      { name: `Bridge + ${delayMonths}mo delay`, total: Math.round(delayTotalBridgeCost), origin: Math.round(bridgeOriginFee), interest: Math.round(bridgeTotalInterest + delayExtraCost), exitFee: Math.round(bridgeExitFee) },
      { name: 'Conventional Alt', total: Math.round(totalConvCost), origin: Math.round(convOriginFee), interest: Math.round(convTotalInterest), exitFee: 0 },
    ]

    const risks = [
      { flag: bridgeLoan > totalCost * 0.90, text: 'Bridge loan covers >90% of purchase — very thin equity cushion; any value decline wipes equity' },
      { flag: permDSCR < 1.20, text: `Perm loan DSCR ${permDSCR === Infinity ? '∞' : permDSCR.toFixed(2)}x — below 1.20x; lender may not approve refi at target LTV` },
      { flag: bridgeTerm < stabMonths + 3, text: `Bridge term (${bridgeTerm}mo) may be too short to stabilize (${stabMonths}mo) + close refi — consider extending or allowing buffer` },
      { flag: bridgePremium > equityCapture * 0.25, text: `Bridge premium ${fmt(bridgePremium)} is >25% of value-add gain — financing cost is eroding deal upside significantly` },
      { flag: equityCapture < 0, text: 'No equity capture — ARV − (purchase + rehab) is negative; deal destroys value even before financing costs' },
    ].filter(r => r.flag)

    return {
      bridgeLoan, bridgeOriginFee, bridgeMonthlyIO, bridgeAmortPmt, bridgeTotalInterest,
      bridgeExitFee, totalCarryDuring, totalBridgeCost, bridgeAllIn, convAllIn, bridgePremium,
      bridgePremiumMonthly, permLoanAmt, permOriginFee, permMonthlyPmt, permDSCR, permCashOut,
      netCashOut, equityAtRefi, equityCapture, convLoan, convOriginFee, convMonthlyPmt,
      convTotalInterest, totalConvCost, delayExtraCost, delayTotalBridgeCost,
      refiYieldSpread, bridgeLine, scenarioBar, risks, timelineMonths,
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
        <h2 className="text-lg font-bold text-white">Bridge Loan Calculator</h2>
        <p className="text-slate-400 text-xs mt-1">Short-term bridge vs day-1 conventional — total financing cost, delay scenario, refi DSCR, cash-out at stabilization, cumulative cost timeline</p>
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
          { label: 'Bridge Loan Amount', value: fmt(calc.bridgeLoan), color: 'text-blue-400' },
          { label: 'Total Bridge Cost', value: fmt(calc.totalBridgeCost), color: 'text-orange-400' },
          { label: 'Bridge Premium vs Conv', value: fmt(calc.bridgePremium), color: calc.bridgePremium < calc.equityCapture * 0.20 ? 'text-green-400' : 'text-yellow-400' },
          { label: 'Value-Add Equity Capture', value: fmt(calc.equityCapture), color: calc.equityCapture > 0 ? 'text-green-400' : 'text-red-400' },
        ].map(m => (
          <div key={m.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
            <p className={`text-2xl font-black ${m.color}`}>{m.value}</p>
            <p className="text-xs text-slate-400 mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Bridge Terms */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Deal & Bridge Loan</p>
          {field('Purchase Price', 'purchasePrice', '', '$')}
          {field('Rehab / CapEx Budget', 'rehabBudget', '', '$')}
          {field('After-Repair / Stabilized Value', 'afterRepairValue', '', '$')}
          {field('Bridge LTV (% of purchase)', 'bridgeLTV', '%')}
          {field('Bridge Rate', 'bridgeRate', '%')}
          {field('Origination Fee', 'bridgeOriginationPct', '%')}
          {field('Exit Fee', 'bridgeExitFeePct', '%')}
          {field('Bridge Term', 'bridgeTerm', 'mo')}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Payment Structure</label>
            <div className="flex gap-2">
              {(['io', 'amortizing'] as const).map(v => (
                <button key={v} onClick={() => set('bridgePaymentType', v)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${inp.bridgePaymentType === v ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                  {v === 'io' ? 'Interest Only' : 'Amortizing'}
                </button>
              ))}
            </div>
          </div>
          {field('Monthly IO Payment', 'monthlyCarry', '(other carry)', '$')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Monthly Payment</span><span className="text-blue-400">{fmt(calc.bridgeAmortPmt)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Total Interest ({inp.bridgeTerm}mo)</span><span className="text-orange-400">{fmt(calc.bridgeTotalInterest)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Origination Fee</span><span className="text-orange-400">{fmt(calc.bridgeOriginFee)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Exit Fee</span><span className="text-orange-400">{fmt(calc.bridgeExitFee)}</span></div>
            <div className="flex justify-between border-t border-slate-700 pt-1"><span className="text-white font-bold">Total Bridge Cost</span><span className="text-red-400 font-bold">{fmt(calc.totalBridgeCost)}</span></div>
          </div>
        </div>

        {/* Perm / Exit */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Stabilization & Exit</p>
          {field('Months to Stabilize', 'stabMonths', 'mo')}
          {field('Stabilized Monthly NOI', 'monthlyNOI', '/mo', '$')}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Exit Strategy</label>
            <div className="space-y-1">
              {([['refi', '🏦 Refi to perm (hold)'], ['sell', '🏷 Sell after stabilization'], ['conventional', '🔄 Refinance to conventional']] as const).map(([v, label]) => (
                <label key={v} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs transition ${inp.exitType === v ? 'border-blue-500 bg-blue-900/20' : 'border-slate-700'}`}>
                  <input type="radio" name="exit" value={v} checked={inp.exitType === v} onChange={() => set('exitType', v)} />
                  <span className="text-slate-200">{label}</span>
                </label>
              ))}
            </div>
          </div>
          {(inp.exitType === 'refi' || inp.exitType === 'conventional') && (
            <>
              {field('Perm Rate', 'permRate', '%')}
              {field('Perm LTV (% of ARV)', 'permLTV', '%')}
              {field('Perm Term', 'permTerm', 'yr')}
              {field('Perm Amort', 'permAmortYears', 'yr')}
              {field('Perm Origination', 'permOriginationPct', '%')}
            </>
          )}
          <div className="p-2 bg-blue-900/20 border border-blue-700/30 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-blue-300">Perm Loan Amount</span><span className="text-white">{fmt(calc.permLoanAmt)}</span></div>
            <div className="flex justify-between"><span className="text-blue-300">Cash-Out at Refi</span><span className="text-green-400 font-bold">{fmt(calc.netCashOut)}</span></div>
            <div className="flex justify-between"><span className="text-blue-300">Perm Monthly Pmt</span><span className="text-white">{fmt(calc.permMonthlyPmt)}</span></div>
            <div className="flex justify-between"><span className="text-blue-300">Perm DSCR</span><span className={calc.permDSCR >= 1.25 ? 'text-green-400 font-bold' : calc.permDSCR >= 1.0 ? 'text-yellow-400 font-bold' : 'text-red-400 font-bold'}>{calc.permDSCR === Infinity ? '∞' : calc.permDSCR.toFixed(2)}x</span></div>
          </div>
          <div className="border-t border-slate-700 pt-3">
            <p className="text-xs font-bold text-slate-400 mb-2">Delay Scenario</p>
            {field('Project Overrun', 'delayMonths', 'extra mo')}
            <div className="p-2 bg-red-900/10 border border-red-700/30 rounded-lg text-xs space-y-1 mt-2">
              <div className="flex justify-between"><span className="text-slate-400">Extra Cost ({inp.delayMonths}mo)</span><span className="text-red-400">{fmt(calc.delayExtraCost)}</span></div>
              <div className="flex justify-between"><span className="text-red-300 font-bold">Total Bridge w/ Delay</span><span className="text-red-400 font-bold">{fmt(calc.delayTotalBridgeCost)}</span></div>
            </div>
          </div>
        </div>

        {/* Conventional Comparison */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Conventional Alt</p>
          <p className="text-xs text-slate-500">If property qualified for conventional financing on day 1</p>
          {field('Conv Rate', 'convRate', '%')}
          {field('Conv LTV (% of purchase)', 'convLTV', '%')}
          {field('Conv Amort', 'convAmortYears', 'yr')}
          {field('Conv Origination', 'convOriginationPct', '%')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Conv Loan</span><span className="text-white">{fmt(calc.convLoan)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Monthly Pmt</span><span className="text-white">{fmt(calc.convMonthlyPmt)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Origination</span><span className="text-orange-400">{fmt(calc.convOriginFee)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Interest ({inp.bridgeTerm}mo)</span><span className="text-orange-400">{fmt(calc.convTotalInterest)}</span></div>
            <div className="flex justify-between border-t border-slate-700 pt-1"><span className="text-white font-bold">Total Conv Cost</span><span className="text-orange-400 font-bold">{fmt(calc.totalConvCost)}</span></div>
          </div>
          <div className="p-3 rounded-xl border text-xs space-y-1 bg-slate-900/30 border-slate-600">
            <p className="font-bold text-slate-300">Bridge vs Conventional</p>
            <div className="flex justify-between"><span className="text-slate-400">Bridge All-In</span><span className="text-orange-400">{fmt(calc.bridgeAllIn)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Conv All-In</span><span className="text-blue-400">{fmt(calc.convAllIn)}</span></div>
            <div className="flex justify-between border-t border-slate-700 pt-1"><span className="text-white font-bold">Bridge Premium</span><span className={`font-bold ${calc.bridgePremium < 0 ? 'text-green-400' : 'text-yellow-400'}`}>{fmt(calc.bridgePremium)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Per Month</span><span className="text-slate-300">{fmt(calc.bridgePremiumMonthly)}/mo</span></div>
            <p className="text-slate-500 text-xs mt-1">Bridge is worth it if value-add gain ({fmt(calc.equityCapture)}) exceeds premium ({fmt(calc.bridgePremium)})</p>
          </div>
        </div>
      </div>

      {/* Cost comparison bar */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Financing Cost Breakdown by Scenario</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={calc.scenarioBar}>
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="origin" name="Origination" stackId="a" fill="#3b82f6" />
            <Bar dataKey="interest" name="Interest" stackId="a" fill="#f59e0b" />
            <Bar dataKey="exitFee" name="Exit Fee" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Cumulative cost timeline */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Cumulative Financing Cost Over Time — Bridge vs Conventional</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={calc.bridgeLine}>
            <XAxis dataKey="month" tickFormatter={v => `Mo ${v}`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine x={inp.bridgeTerm} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: 'Bridge End', fill: '#f59e0b', fontSize: 9 }} />
            <ReferenceLine x={inp.stabMonths} stroke="#22c55e" strokeDasharray="4 2" label={{ value: 'Stabilized', fill: '#22c55e', fontSize: 9 }} />
            <Line type="monotone" dataKey="bridge" name="Bridge Path" stroke="#f59e0b" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="conv" name="Conventional" stroke="#3b82f6" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Bridge Loan — Investor Guide</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
          {[
            '🏦 Bridge lenders: private/hard money lenders, debt funds, some banks — typically 12-36 month terms, IO, 8-12% rates',
            '📋 Bridge is justified when: conventional won\'t finance (occupancy too low, deferred maintenance, major renovation needed)',
            '⏰ Speed advantage: bridge can close in 7-14 days vs 30-45 days for conventional — critical in competitive markets',
            '💰 Cost of capital: total effective cost = origination + interest + exit fee; compare against value-add equity gain',
            '🎯 LTV on bridge: typically 70-75% of purchase (not ARV) — lender protects against downside; bring equity to close',
            '📊 Refi DSCR: stabilized NOI must service perm loan at 1.25x+ — if NOI is too low, perm won\'t pencil; adjust LTV or rate',
            '⚠️ Extension risk: if project overruns, bridge lenders charge extension fees (0.5-1.0%/mo) — always budget 20-30% schedule buffer',
            '🔄 Bridge-to-perm programs: some lenders offer combined bridge + automatic perm conversion — reduces transaction costs',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
