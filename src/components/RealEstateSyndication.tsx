import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line, PieChart, Pie, Cell } from 'recharts'

interface Inputs {
  totalRaise: number
  gpCommit: number
  preferredReturn: number
  catchUp: boolean
  catchUpPct: number
  lpSplit: number
  gpSplit: number
  holdYears: number
  annualCashYield: number
  projectedEquityMultiple: number
  acquisitionFee: number
  assetMgmtFee: number
  dispositionFee: number
  debtRatio: number
  purchasePrice: number
  exitCapRate: number
  noi: number
}

const DEF: Inputs = {
  totalRaise: 5000000,
  gpCommit: 250000,
  preferredReturn: 8,
  catchUp: true,
  catchUpPct: 50,
  lpSplit: 70,
  gpSplit: 30,
  holdYears: 5,
  annualCashYield: 6,
  projectedEquityMultiple: 1.85,
  acquisitionFee: 1.5,
  assetMgmtFee: 1.5,
  dispositionFee: 1,
  debtRatio: 65,
  purchasePrice: 14000000,
  exitCapRate: 5.5,
  noi: 750000,
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const fmtM = (n: number) => `$${(n / 1_000_000).toFixed(2)}M`
const pct = (n: number) => `${n.toFixed(2)}%`
const N = (v: string) => parseFloat(v) || 0
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7']

function calcIRR(cashflows: number[]): number {
  let rate = 0.1
  for (let i = 0; i < 100; i++) {
    let npv = 0, dnpv = 0
    cashflows.forEach((cf, t) => {
      npv += cf / Math.pow(1 + rate, t)
      dnpv -= t * cf / Math.pow(1 + rate, t + 1)
    })
    const step = npv / dnpv
    rate -= step
    if (Math.abs(step) < 1e-8) break
  }
  return isFinite(rate) ? rate * 100 : 0
}

export default function RealEstateSyndication() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = (k: keyof Inputs, v: string | boolean) =>
    setInp(p => ({ ...p, [k]: typeof DEF[k] === 'boolean' ? v : N(v as string) }))

  const calc = useMemo(() => {
    const {
      totalRaise, gpCommit, preferredReturn, catchUp, catchUpPct,
      lpSplit, gpSplit, holdYears, annualCashYield, projectedEquityMultiple,
      acquisitionFee, assetMgmtFee, dispositionFee, debtRatio,
      purchasePrice, exitCapRate, noi,
    } = inp

    const lpRaise = totalRaise - gpCommit
    const equity = totalRaise
    const debt = purchasePrice * debtRatio / 100

    // Fees
    const acqFeeAmt = purchasePrice * acquisitionFee / 100
    const annualMgmtFee = equity * assetMgmtFee / 100
    const dispFeeAmt = purchasePrice * dispositionFee / 100

    // Annual cash distributions
    const annualDistTotal = equity * annualCashYield / 100
    const annualPrefAmount = equity * preferredReturn / 100

    // Total exit proceeds from property
    const exitValue = noi / (exitCapRate / 100)
    const remainingDebt = debt * Math.pow(1 - 0.025, holdYears) // ~2.5% annual amortization
    const exitEquityProceeds = exitValue - remainingDebt - dispFeeAmt

    // Total distributions over hold
    const totalCashDist = annualDistTotal * holdYears
    const totalProceeds = totalCashDist + exitEquityProceeds

    // Waterfall calculation
    const totalLP = lpRaise / equity
    const totalGP = gpCommit / equity

    // 1) Preferred return — LP gets pref on their capital
    const lpPrefTotal = lpRaise * preferredReturn / 100 * holdYears
    const lpPrefRemaining = Math.max(0, lpPrefTotal - totalCashDist * totalLP)

    // Simplified waterfall on exit proceeds
    let remaining = exitEquityProceeds
    let lpTotal = totalCashDist * totalLP
    let gpTotal = totalCashDist * totalGP + annualMgmtFee * holdYears

    // Step 1: Return of capital
    const lpCapReturn = Math.min(remaining * totalLP, lpRaise)
    const gpCapReturn = Math.min(remaining * totalGP, gpCommit)
    remaining -= lpCapReturn + gpCapReturn

    // Step 2: Preferred return (LP)
    const lpPrefDue = lpRaise * preferredReturn / 100 * holdYears
    const lpPrefCashflow = totalCashDist * totalLP
    const lpPrefShortfall = Math.max(0, lpPrefDue - lpPrefCashflow)
    const lpPrefPaid = Math.min(remaining, lpPrefShortfall)
    remaining -= lpPrefPaid
    lpTotal += lpCapReturn + lpPrefPaid

    // Step 3: GP catch-up
    let gpCatchUp = 0
    if (catchUp && remaining > 0) {
      // GP catches up to receive catchUpPct% of total pref paid so far
      const totalPrefPaid = lpPrefCashflow + lpPrefPaid
      const gpTarget = totalPrefPaid * (gpSplit / 100)
      gpCatchUp = Math.min(remaining, gpTarget)
      remaining -= gpCatchUp
    }

    // Step 4: Residual split
    const lpResidual = remaining * lpSplit / 100
    const gpResidual = remaining * gpSplit / 100
    remaining = 0

    const gpExitTotal = gpCapReturn + gpCatchUp + gpResidual
    const lpExitTotal = lpCapReturn + lpPrefPaid + lpResidual

    gpTotal += gpExitTotal
    lpTotal += lpExitTotal

    const lpEM = lpRaise > 0 ? (lpTotal / lpRaise) : 0
    const gpEM = gpCommit > 0 ? ((gpTotal + annualMgmtFee * holdYears + acqFeeAmt + dispFeeAmt) / gpCommit) : 0

    // IRR approximation — LP
    const lpCashflows = [-lpRaise]
    for (let y = 1; y <= holdYears; y++) {
      lpCashflows.push(annualDistTotal * totalLP)
    }
    lpCashflows[holdYears] += lpExitTotal
    const lpIRR = calcIRR(lpCashflows)

    // GP fee income
    const totalGPFees = acqFeeAmt + annualMgmtFee * holdYears + dispFeeAmt

    // Year-by-year cash flow chart
    const yearData = Array.from({ length: holdYears }, (_, i) => ({
      year: `Yr ${i + 1}`,
      lpCashDist: Math.round(annualDistTotal * totalLP),
      gpMgmtFee: Math.round(annualMgmtFee),
      gpCashDist: Math.round(annualDistTotal * totalGP),
    }))

    // Waterfall breakdown for chart
    const waterfallData = [
      { name: 'Return of Capital', LP: Math.round(lpCapReturn), GP: Math.round(gpCapReturn) },
      { name: 'Preferred Return', LP: Math.round(lpPrefCashflow + lpPrefPaid), GP: 0 },
      { name: 'GP Catch-Up', LP: 0, GP: Math.round(gpCatchUp) },
      { name: 'Residual Split', LP: Math.round(lpResidual), GP: Math.round(gpResidual) },
      { name: 'Mgmt Fees', LP: 0, GP: Math.round(totalGPFees) },
    ]

    const pieData = [
      { name: 'LP Returns', value: Math.round(lpTotal) },
      { name: 'GP Returns + Fees', value: Math.round(gpTotal + totalGPFees) },
    ]

    return {
      lpRaise, debt, equity, acqFeeAmt, annualMgmtFee, dispFeeAmt, totalGPFees,
      exitValue, exitEquityProceeds, totalCashDist, totalProceeds,
      lpTotal, gpTotal, lpEM, gpEM, lpIRR,
      lpPrefPaid, lpCapReturn, gpCapReturn, gpCatchUp, lpResidual, gpResidual,
      yearData, waterfallData, pieData,
    }
  }, [inp])

  const field = (label: string, key: keyof Inputs, suffix = '', prefix = '', step = 'any') => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{prefix}</span>}
        <input type="number" step={step} value={inp[key] as number} onChange={e => set(key, e.target.value)}
          className={`w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 ${prefix ? 'pl-5 pr-3' : suffix ? 'pl-3 pr-8' : 'px-3'}`} />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{suffix}</span>}
      </div>
    </div>
  )

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-lg font-bold text-white">Real Estate Syndication Analyzer</h2>
        <p className="text-slate-400 text-xs mt-1">Model LP/GP waterfall structure, preferred returns, catch-up provisions, fee income, IRR, and equity multiples</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Deal Structure */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Deal Structure</p>
          {field('Purchase Price', 'purchasePrice', '', '$', '10000')}
          {field('Total Equity Raise', 'totalRaise', '', '$', '10000')}
          {field('GP Co-Invest', 'gpCommit', '', '$', '10000')}
          {field('Debt Ratio', 'debtRatio', '%')}
          {field('Hold Period (years)', 'holdYears', 'yr', '', '1')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">LP Raise</span><span className="text-blue-400 font-bold">{fmtM(calc.lpRaise)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Total Debt</span><span className="text-slate-300">{fmtM(calc.debt)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">LP% of Equity</span><span className="text-slate-300">{(calc.lpRaise / inp.totalRaise * 100).toFixed(1)}%</span></div>
          </div>
        </div>

        {/* Waterfall */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Waterfall & Returns</p>
          {field('Preferred Return (LP)', 'preferredReturn', '%')}
          <div className="grid grid-cols-2 gap-2">
            {field('LP Split %', 'lpSplit', '%')}
            {field('GP Split %', 'gpSplit', '%')}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">GP Catch-Up Provision</span>
            <button onClick={() => set('catchUp', !inp.catchUp)}
              className={`w-11 h-6 rounded-full transition-colors ${inp.catchUp ? 'bg-green-500' : 'bg-slate-700'}`}>
              <div className={`w-4 h-4 bg-white rounded-full mx-1 transition-transform ${inp.catchUp ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          {inp.catchUp && field('Catch-Up %', 'catchUpPct', '%')}
          {field('Annual Cash Yield (CoC)', 'annualCashYield', '%')}
          {field('NOI at Exit', 'noi', '', '$', '1000')}
          {field('Exit Cap Rate', 'exitCapRate', '%')}
        </div>

        {/* Fees */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">GP Fees</p>
          {field('Acquisition Fee', 'acquisitionFee', '% of PP')}
          {field('Asset Mgmt Fee (annual)', 'assetMgmtFee', '% of equity')}
          {field('Disposition Fee', 'dispositionFee', '% of SP')}
          <div className="p-3 bg-slate-900/50 rounded-lg text-xs space-y-1.5">
            <p className="text-slate-400 font-semibold">Total GP Fee Income</p>
            <div className="flex justify-between"><span className="text-slate-500">Acquisition Fee</span><span className="text-slate-300">{fmt(calc.acqFeeAmt)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Mgmt Fees ({inp.holdYears} yrs)</span><span className="text-slate-300">{fmt(calc.annualMgmtFee * inp.holdYears)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Disposition Fee</span><span className="text-slate-300">{fmt(calc.dispFeeAmt)}</span></div>
            <div className="flex justify-between border-t border-slate-700 pt-1"><span className="text-slate-300 font-bold">Total GP Fees</span><span className="text-yellow-400 font-bold">{fmt(calc.totalGPFees)}</span></div>
          </div>
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Projected Exit Value</span><span className="text-white font-bold">{fmtM(calc.exitValue)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Exit Equity Proceeds</span><span className="text-blue-400 font-bold">{fmtM(calc.exitEquityProceeds)}</span></div>
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'LP Equity Multiple', value: `${calc.lpEM.toFixed(2)}x`, sub: `${fmt(calc.lpTotal)} returned on ${fmt(calc.lpRaise)}`, color: 'text-blue-400' },
          { label: 'LP IRR', value: pct(calc.lpIRR), sub: `${inp.holdYears}-year hold`, color: 'text-green-400' },
          { label: 'GP Equity Multiple', value: `${calc.gpEM.toFixed(2)}x`, sub: `Incl. fees on co-invest`, color: 'text-yellow-400' },
          { label: 'Total Proceeds', value: fmtM(calc.totalProceeds), sub: 'Cash dist + exit', color: 'text-purple-400' },
        ].map(m => (
          <div key={m.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
            <p className={`text-2xl font-black ${m.color}`}>{m.value}</p>
            <p className="text-xs text-slate-400 mt-1">{m.label}</p>
            <p className="text-xs text-slate-500">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Waterfall Chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Waterfall Distribution Breakdown</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={calc.waterfallData} layout="vertical">
            <XAxis type="number" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis dataKey="name" type="category" width={100} tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="LP" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            <Bar dataKey="GP" fill="#f59e0b" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Annual Cash Flow */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Annual Cash Distributions by Year</p>
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={calc.yearData}>
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="lpCashDist" name="LP Cash Dist" fill="#3b82f6" radius={[4, 4, 0, 0]} stackId="a" />
            <Bar dataKey="gpCashDist" name="GP Cash Dist" fill="#f59e0b" radius={[0, 0, 0, 0]} stackId="a" />
            <Bar dataKey="gpMgmtFee" name="GP Mgmt Fee" fill="#a855f7" radius={[4, 4, 0, 0]} stackId="b" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tips */}
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Syndication Structure Guide</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
          {[
            '📋 Most syndicates use a 506(b) or 506(c) Regulation D exemption — file Form D with SEC within 15 days',
            '💰 Typical preferred return: 6–8% per annum; lower for riskier deals, higher for lower-risk NNN/debt',
            '🔀 Common split after pref: 70/30 or 80/20 LP/GP; GP earns more upside for management and risk',
            '⚡ Catch-up lets GP "catch up" to their share before residual split — common in high-pref structures',
            '📊 Target LP metrics: 7–9% pref, 1.7–2.0x EM, 14–18% IRR for value-add; adjust for risk',
            '💼 Asset management fee: typically 1–2% of equity or 3–5% of collected rents',
            '⚠️ Reg D investors must be accredited (506(b): up to 35 non-accredited, 506(c): accredited only)',
            '🏦 Operating agreement governs: capital calls, distribution timing, removal of GP, exit rights',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
