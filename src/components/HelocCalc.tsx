import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line, Legend } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function monthlyPmt(principal: number, annualRate: number, termYears: number) {
  const r = annualRate / 100 / 12
  const n = termYears * 12
  if (r === 0) return principal / n
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

export default function HelocCalc() {
  const { result, downPaymentPct, interestRate } = usePropertyStore()

  const homeValue   = result?.estimatedValue ?? 400000
  const origLoan    = homeValue * (1 - downPaymentPct / 100)

  const [currentBalance,    setCurrentBalance]    = useState(Math.round(origLoan * 0.8))
  const [helocRate,         setHelocRate]         = useState(8.5)
  const [helocDraw,         setHelocDraw]         = useState(50000)
  const [helocDrawYears,    setHelocDrawYears]    = useState(10)
  const [helocRepayYears,   setHelocRepayYears]   = useState(20)
  const [cashOutRate,       setCashOutRate]       = useState(interestRate)
  const [cashOutTerm,       setCashOutTerm]       = useState(30)
  const [cashOutAmount,     setCashOutAmount]     = useState(50000)
  const [closingCostsCashOut, setClosingCostsCashOut] = useState(6000)
  const [closingCostsHeloc,   setClosingCostsHeloc]   = useState(500)

  const equity      = homeValue - currentBalance
  const maxHeloc    = Math.max(0, homeValue * 0.85 - currentBalance)
  const maxCashOut  = Math.max(0, homeValue * 0.80 - currentBalance)
  const ltv         = (currentBalance / homeValue) * 100

  // HELOC analysis
  const helocAnalysis = useMemo(() => {
    const drawR         = helocRate / 100 / 12
    const interestOnly  = helocDraw * drawR
    const repayPmt      = monthlyPmt(helocDraw, helocRate, helocRepayYears)
    const totalInterest = interestOnly * helocDrawYears * 12 + (repayPmt * helocRepayYears * 12 - helocDraw)
    return { interestOnly, repayPmt, totalInterest }
  }, [helocDraw, helocRate, helocDrawYears, helocRepayYears])

  // Cash-out refi analysis
  const cashOutAnalysis = useMemo(() => {
    const newLoan      = currentBalance + cashOutAmount
    const newMonthly   = monthlyPmt(newLoan, cashOutRate, cashOutTerm)
    const oldMonthly   = monthlyPmt(currentBalance, interestRate, 30)
    const monthlyDelta = newMonthly - oldMonthly
    const totalCost    = newMonthly * cashOutTerm * 12 - newLoan + closingCostsCashOut
    return { newLoan, newMonthly, oldMonthly, monthlyDelta, totalCost }
  }, [currentBalance, cashOutAmount, cashOutRate, cashOutTerm, interestRate, closingCostsCashOut])

  // Comparison chart
  const compareData = [
    { label: 'HELOC', monthly: Math.round(helocAnalysis.interestOnly), color: '#3b82f6', note: 'draw period (IO)' },
    { label: 'HELOC Repay', monthly: Math.round(helocAnalysis.repayPmt), color: '#60a5fa', note: 'repay period' },
    { label: 'Cash-Out Refi', monthly: Math.round(cashOutAnalysis.newMonthly), color: '#f59e0b', note: 'full term' },
    { label: 'Old Mortgage', monthly: Math.round(cashOutAnalysis.oldMonthly), color: '#64748b', note: 'current' },
  ]

  const cashOutBetter = cashOutAnalysis.totalCost < helocAnalysis.totalInterest + closingCostsHeloc

  if (!result) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-4xl mb-3">🏦</p>
        <p>Run a valuation first to analyze HELOC and cash-out refi options</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">HELOC vs Cash-Out Refinance</h3>
        <p className="text-xs text-slate-500">
          Compare two ways to access your home equity: a Home Equity Line of Credit vs a cash-out refinance.
        </p>
      </div>

      {/* Equity snapshot */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Your Equity Position</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            { label: 'Home Value',       value: fmt(homeValue),             color: 'text-white' },
            { label: 'Current Balance',  value: fmt(currentBalance),        color: 'text-red-400' },
            { label: 'Equity',           value: fmt(equity),                color: 'text-green-400' },
            { label: 'LTV',              value: `${ltv.toFixed(1)}%`,       color: ltv <= 80 ? 'text-green-400' : 'text-yellow-400' },
          ].map(s => (
            <div key={s.label}>
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-center">
          <div className="bg-slate-700/50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Max HELOC (85% CLTV)</p>
            <p className="text-lg font-black text-blue-400">{fmt(maxHeloc)}</p>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Max Cash-Out (80% LTV)</p>
            <p className="text-lg font-black text-yellow-400">{fmt(maxCashOut)}</p>
          </div>
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-500">Equity used (LTV)</span>
            <span className="text-slate-400">{ltv.toFixed(1)}%</span>
          </div>
          <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-green-500 to-yellow-500 rounded-full"
              style={{ width: `${Math.min(100, ltv)}%` }} />
          </div>
          <div className="flex justify-between text-xs mt-1 text-slate-600">
            <span>0%</span><span>80% (cash-out max)</span><span>85% (HELOC max)</span><span>100%</span>
          </div>
        </div>
      </div>

      {/* Current mortgage */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Current Mortgage</p>
        <div>
          <div className="flex justify-between mb-1">
            <label className="text-xs text-slate-400 uppercase tracking-widest">Outstanding Balance</label>
            <span className="text-xs font-bold text-blue-400">{fmt(currentBalance)}</span>
          </div>
          <input type="range" min={0} max={homeValue} step={5000} value={currentBalance}
            onChange={e => setCurrentBalance(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
        </div>
      </div>

      {/* Two-column options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* HELOC */}
        <div className="bg-blue-900/20 border border-blue-700/30 rounded-xl p-4 space-y-3">
          <p className="text-xs text-blue-400 uppercase tracking-widest font-bold">Option A — HELOC</p>
          <p className="text-xs text-slate-500">Variable-rate revolving credit line. Draw period then repayment.</p>
          {[
            { label: 'Draw Amount',     value: helocDraw,       min: 5000,  max: maxHeloc, step: 5000, set: setHelocDraw,       fmt: fmt },
            { label: 'HELOC Rate',      value: helocRate,       min: 4,     max: 15,      step: 0.25, set: setHelocRate,       fmt: (v: number) => `${v.toFixed(2)}% (variable)` },
            { label: 'Draw Period',     value: helocDrawYears,  min: 5,     max: 10,      step: 1,    set: setHelocDrawYears,  fmt: (v: number) => `${v}yr` },
            { label: 'Repay Period',    value: helocRepayYears, min: 5,     max: 20,      step: 1,    set: setHelocRepayYears, fmt: (v: number) => `${v}yr` },
            { label: 'Closing Costs',   value: closingCostsHeloc, min: 0,  max: 3000,    step: 100,  set: setClosingCostsHeloc, fmt: fmt },
          ].map(s => (
            <div key={s.label}>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-slate-400 uppercase tracking-widest">{s.label}</label>
                <span className="text-xs font-bold text-blue-400">{s.fmt(s.value)}</span>
              </div>
              <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                onChange={e => s.set(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-600 rounded-full appearance-none cursor-pointer accent-blue-400" />
            </div>
          ))}
          <div className="bg-slate-900/60 rounded-lg p-3 space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-slate-500">Draw period payment (IO)</span><span className="text-blue-400 font-bold">{fmt(helocAnalysis.interestOnly)}/mo</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Repay period payment</span><span className="text-blue-400 font-bold">{fmt(helocAnalysis.repayPmt)}/mo</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Total interest paid</span><span className="text-red-400 font-bold">{fmt(helocAnalysis.totalInterest)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Total cost of funds</span><span className="text-red-400 font-bold">{fmt(helocAnalysis.totalInterest + closingCostsHeloc)}</span></div>
          </div>
        </div>

        {/* Cash-out refi */}
        <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl p-4 space-y-3">
          <p className="text-xs text-yellow-400 uppercase tracking-widest font-bold">Option B — Cash-Out Refi</p>
          <p className="text-xs text-slate-500">Refinance your entire mortgage at a new rate, pulling out cash.</p>
          {[
            { label: 'Cash-Out Amount',  value: cashOutAmount,         min: 10000, max: maxCashOut, step: 5000,  set: setCashOutAmount,         fmt: fmt },
            { label: 'New Rate',         value: cashOutRate,           min: 3,     max: 12,         step: 0.125, set: setCashOutRate,           fmt: (v: number) => `${v.toFixed(3)}%` },
            { label: 'New Term',         value: cashOutTerm,           min: 10,    max: 30,         step: 5,     set: setCashOutTerm,           fmt: (v: number) => `${v}yr` },
            { label: 'Closing Costs',    value: closingCostsCashOut,   min: 0,     max: 20000,      step: 500,   set: setClosingCostsCashOut,   fmt: fmt },
          ].map(s => (
            <div key={s.label}>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-slate-400 uppercase tracking-widest">{s.label}</label>
                <span className="text-xs font-bold text-yellow-400">{s.fmt(s.value)}</span>
              </div>
              <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                onChange={e => s.set(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-600 rounded-full appearance-none cursor-pointer accent-yellow-400" />
            </div>
          ))}
          <div className="bg-slate-900/60 rounded-lg p-3 space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-slate-500">New loan amount</span><span className="text-yellow-400 font-bold">{fmt(cashOutAnalysis.newLoan)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">New monthly payment</span><span className="text-yellow-400 font-bold">{fmt(cashOutAnalysis.newMonthly)}/mo</span></div>
            <div className="flex justify-between"><span className="text-slate-500">vs current payment</span><span className={cashOutAnalysis.monthlyDelta > 0 ? 'text-red-400' : 'text-green-400'}>{cashOutAnalysis.monthlyDelta >= 0 ? '+' : ''}{fmt(cashOutAnalysis.monthlyDelta)}/mo</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Total cost of funds</span><span className="text-red-400 font-bold">{fmt(cashOutAnalysis.totalCost)}</span></div>
          </div>
        </div>
      </div>

      {/* Verdict */}
      <div className={`rounded-xl p-4 border text-xs ${cashOutBetter ? 'bg-yellow-900/20 border-yellow-700/40' : 'bg-blue-900/20 border-blue-700/40'}`}>
        <p className={`font-bold text-sm mb-2 ${cashOutBetter ? 'text-yellow-400' : 'text-blue-400'}`}>
          {cashOutBetter ? '📊 Cash-Out Refi is cheaper' : '📈 HELOC is cheaper'} for this scenario
        </p>
        <p className="text-slate-400">
          {cashOutBetter
            ? `Cash-out refi total cost: ${fmt(cashOutAnalysis.totalCost)} vs HELOC total: ${fmt(helocAnalysis.totalInterest + closingCostsHeloc)}. Savings: ${fmt(Math.abs(cashOutAnalysis.totalCost - helocAnalysis.totalInterest - closingCostsHeloc))}.`
            : `HELOC total cost: ${fmt(helocAnalysis.totalInterest + closingCostsHeloc)} vs cash-out refi: ${fmt(cashOutAnalysis.totalCost)}. Savings: ${fmt(Math.abs(cashOutAnalysis.totalCost - helocAnalysis.totalInterest - closingCostsHeloc))}.`}
        </p>
        <p className="text-slate-500 mt-2">Consider HELOC if: you need flexible access, rate will drop soon, or your existing mortgage rate is very low. Consider cash-out refi if: you want a fixed rate, lower monthly payment, or are already refinancing anyway.</p>
      </div>

      {/* Monthly payment comparison */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Monthly Payment Comparison</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={compareData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(1)}K`} width={45} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v: number, name: string) => [fmt(v), name]} />
            <Bar dataKey="monthly" name="Monthly Payment" radius={[4, 4, 0, 0]}>
              {compareData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-slate-600 text-center">
        HELOC rates are variable and typically Prime Rate + margin. Cash-out refi resets your mortgage clock.
        Both options use your home as collateral — missed payments risk foreclosure. Consult a mortgage professional.
      </p>
    </div>
  )
}
