import { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LabelList } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
function pct(n: number) { return n.toFixed(1) + '%' }

export default function JointVenture() {
  // Deal structure
  const [totalInvestment,  setTotalInvestment]  = useState(500000)
  const [moneyPtnrPct,     setMoneyPtnrPct]      = useState(80)    // % of equity
  const [prefReturn,       setPrefReturn]         = useState(8)     // % preferred return (cumulative)
  const [catchUpPct,       setCatchUpPct]         = useState(50)    // % of profits to GP before split
  const [afterCatchupSplit,setAfterCatchupSplit]  = useState(70)    // LP % after catch-up (e.g., 70/30)
  const [prefReturnType,   setPrefReturnType]     = useState<'cumulative' | 'non-cumulative'>('cumulative')
  const [holdYears,        setHoldYears]          = useState(5)

  // Deal returns
  const [totalProfitOnSale, setTotalProfitOnSale] = useState(300000)  // profit from sale net of return of capital
  const [annualCashFlow,    setAnnualCashFlow]     = useState(30000)   // total annual NOI to distribute
  const [cashFlowMoneyPtnrPct, setCashFlowMoneyPtnrPct] = useState(80)  // LP share of ongoing cash flow (usually same as equity split)

  const opPtnrPct = 100 - moneyPtnrPct  // operating partner %

  const calc = useMemo(() => {
    const moneyPtnrCapital = totalInvestment * moneyPtnrPct / 100
    const opPtnrCapital    = totalInvestment * opPtnrPct / 100

    // Annual cash flow distributions (ongoing)
    const annualLP     = annualCashFlow * cashFlowMoneyPtnrPct / 100
    const annualGP     = annualCashFlow * (100 - cashFlowMoneyPtnrPct) / 100
    const totalLPCash  = annualLP * holdYears
    const totalGPCash  = annualGP * holdYears

    // Accumulated preferred return on LP capital (compounded annually)
    const totalPrefAccum = prefReturnType === 'cumulative'
      ? moneyPtnrCapital * (Math.pow(1 + prefReturn / 100, holdYears) - 1)
      : moneyPtnrCapital * prefReturn / 100 * holdYears

    // Pref already satisfied by cash flow distributions to LP
    const prefSatisfied  = Math.min(totalLPCash, totalPrefAccum)
    const prefOutstanding = Math.max(totalPrefAccum - prefSatisfied, 0)

    // Waterfall on sale proceeds
    let saleProfit = totalProfitOnSale
    const waterfall: { tier: string; lp: number; gp: number; desc: string }[] = []

    // Tier 1: Return of capital
    waterfall.push({ tier: 'Return of Capital', lp: moneyPtnrCapital, gp: opPtnrCapital, desc: 'Each partner receives their contributed capital back' })
    // (capital already returned in the totalProfitOnSale framing, so we won't double-count — profit is on top of capital)

    // Tier 2: Preferred return to LP (money partner)
    const prefFromSale = Math.min(saleProfit, prefOutstanding)
    waterfall.push({ tier: `Pref Return (${prefReturn}% to LP)`, lp: prefFromSale, gp: 0, desc: `LP gets ${pct(prefReturn)} preferred return first (${prefReturnType})` })
    saleProfit -= prefFromSale

    // Tier 3: Catch-up to GP
    let catchUpFromSale = 0
    if (catchUpPct > 0 && saleProfit > 0) {
      // GP catch-up: GP gets catchUpPct% of remaining until GP has received afterCatchupGPSplit% of total profits to date
      // Simplified: GP gets catchUpPct% of remaining profit in this tier
      catchUpFromSale = saleProfit * catchUpPct / 100
      waterfall.push({ tier: `GP Catch-Up (${catchUpPct}% to GP)`, lp: 0, gp: catchUpFromSale, desc: `Operating partner catches up before final split` })
      saleProfit -= catchUpFromSale
    }

    // Tier 4: Final split of remaining profit
    const finalLP = saleProfit * afterCatchupSplit / 100
    const finalGP = saleProfit * (100 - afterCatchupSplit) / 100
    waterfall.push({ tier: `Final Split (${afterCatchupSplit}/${100 - afterCatchupSplit})`, lp: finalLP, gp: finalGP, desc: `LP:GP = ${afterCatchupSplit}:${100 - afterCatchupSplit} on remaining profit` })

    // Totals from sale
    const lpFromSale = waterfall.slice(1).reduce((s, t) => s + t.lp, 0)
    const gpFromSale = waterfall.slice(1).reduce((s, t) => s + t.gp, 0)

    // Grand totals (capital + cash flow + sale profit)
    const lpTotal    = moneyPtnrCapital + totalLPCash + lpFromSale
    const gpTotal    = opPtnrCapital    + totalGPCash + gpFromSale

    // Returns
    const lpEquityMultiple = lpTotal / moneyPtnrCapital
    const gpEquityMultiple = opPtnrCapital > 0 ? gpTotal / opPtnrCapital : Infinity

    const lpIRR    = moneyPtnrCapital > 0 ? Math.pow(lpTotal / moneyPtnrCapital, 1 / holdYears) - 1 : 0
    const gpIRR    = opPtnrCapital > 0    ? Math.pow(gpTotal / opPtnrCapital, 1 / holdYears) - 1    : Infinity

    // Pie data
    const pieLP = [
      { name: 'LP Cash Flow', value: Math.round(totalLPCash) },
      { name: 'LP Sale Profit', value: Math.round(lpFromSale) },
      { name: 'LP Capital Return', value: Math.round(moneyPtnrCapital) },
    ]
    const pieGP = [
      { name: 'GP Cash Flow', value: Math.round(totalGPCash) },
      { name: 'GP Sale Profit', value: Math.round(gpFromSale) },
      { name: 'GP Capital Return', value: Math.round(opPtnrCapital) },
    ]

    // Bar: waterfall visualization
    const waterfallBar = waterfall.map(t => ({ name: t.tier, LP: Math.round(t.lp), GP: Math.round(t.gp) }))

    return {
      moneyPtnrCapital, opPtnrCapital, totalLPCash, totalGPCash, prefAccum: totalPrefAccum,
      prefSatisfied, prefOutstanding, waterfall, lpFromSale, gpFromSale,
      lpTotal, gpTotal, lpEquityMultiple, gpEquityMultiple, lpIRR, gpIRR,
      pieLP, pieGP, waterfallBar,
    }
  }, [totalInvestment, moneyPtnrPct, opPtnrPct, prefReturn, catchUpPct, afterCatchupSplit,
      prefReturnType, holdYears, totalProfitOnSale, annualCashFlow, cashFlowMoneyPtnrPct])

  const COLORS_LP = ['#3b82f6', '#60a5fa', '#93c5fd']
  const COLORS_GP = ['#10b981', '#34d399', '#6ee7b7']

  const Slider = ({ label, value, min, max, step, onChange, prefix = '', suffix = '' }: {
    label: string; value: number; min: number; max: number; step: number;
    onChange: (v: number) => void; prefix?: string; suffix?: string
  }) => (
    <div>
      <div className="flex justify-between mb-1">
        <label className="text-xs text-slate-400">{label}</label>
        <span className="text-xs font-bold text-blue-400">{prefix}{value.toLocaleString()}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Joint Venture Waterfall Calculator</h3>
        <p className="text-xs text-slate-500">
          Model a real estate joint venture between a money partner (LP/equity partner) and an operating partner (GP/deal sponsor).
          Calculate preferred returns, catch-up provisions, and waterfall profit splits.
        </p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Deal Structure</p>
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-slate-400">Total Capital Required</label>
              <span className="text-xs font-bold text-blue-400">{fmt(totalInvestment)}</span>
            </div>
            <input type="range" min={50000} max={10000000} step={50000} value={totalInvestment}
              onChange={e => setTotalInvestment(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-slate-400">Money Partner (LP) Equity %</label>
              <span className="text-xs font-bold text-blue-400">{moneyPtnrPct}% LP / {opPtnrPct}% GP</span>
            </div>
            <input type="range" min={50} max={100} step={5} value={moneyPtnrPct}
              onChange={e => setMoneyPtnrPct(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-center">
            <div className="bg-blue-900/20 border border-blue-800/40 rounded-lg p-2">
              <p className="text-slate-500">LP Capital</p>
              <p className="text-blue-400 font-black">{fmt(calc.moneyPtnrCapital)}</p>
            </div>
            <div className="bg-green-900/20 border border-green-800/40 rounded-lg p-2">
              <p className="text-slate-500">GP Capital</p>
              <p className="text-green-400 font-black">{fmt(calc.opPtnrCapital)}</p>
            </div>
          </div>
          <Slider label="Hold Period" value={holdYears} min={1} max={15} step={1} onChange={setHoldYears} suffix=" yrs" />
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Waterfall Terms</p>
          <Slider label="Preferred Return to LP" value={prefReturn} min={0} max={15} step={0.5} onChange={setPrefReturn} suffix="%" />
          <div>
            <label className="text-xs text-slate-400">Preferred Return Type</label>
            <div className="grid grid-cols-2 gap-1 mt-1">
              {['cumulative', 'non-cumulative'].map(t => (
                <button key={t} onClick={() => setPrefReturnType(t as typeof prefReturnType)}
                  className={`py-1.5 rounded-lg text-xs font-bold capitalize transition ${prefReturnType === t ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                  {t.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>
          <Slider label="GP Catch-Up %" value={catchUpPct} min={0} max={100} step={10} onChange={setCatchUpPct} suffix="%" />
          <Slider label="LP% After Catch-Up (final split)" value={afterCatchupSplit} min={50} max={90} step={5} onChange={setAfterCatchupSplit} suffix="%" />
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest pt-1">Deal Returns</p>
          <Slider label="Total Profit from Sale (after debt)" value={totalProfitOnSale} min={0} max={5000000} step={10000} onChange={setTotalProfitOnSale} prefix="$" />
          <Slider label="Annual Cash Flow to Distribute" value={annualCashFlow} min={0} max={500000} step={1000} onChange={setAnnualCashFlow} prefix="$" />
          <Slider label="LP Share of Annual Cash Flow" value={cashFlowMoneyPtnrPct} min={50} max={100} step={5} onChange={setCashFlowMoneyPtnrPct} suffix="%" />
        </div>
      </div>

      {/* Partner summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          {
            label: 'Money Partner (LP)', color: 'border-blue-700/50 bg-blue-900/10',
            items: [
              { k: 'Capital Contributed',  v: fmt(calc.moneyPtnrCapital) },
              { k: 'Cash Flow Over Hold',  v: fmt(calc.totalLPCash) },
              { k: 'Preferred Return Accrued', v: fmt(calc.prefAccum) },
              { k: 'Sale Profit Share',   v: fmt(calc.lpFromSale) },
              { k: 'Total Return',        v: fmt(calc.lpTotal), bold: true },
              { k: 'Equity Multiple',     v: calc.lpEquityMultiple.toFixed(2) + 'x', bold: true },
              { k: 'Annualized Return',   v: pct(calc.lpIRR * 100), bold: true },
            ],
          },
          {
            label: 'Operating Partner (GP)', color: 'border-green-700/50 bg-green-900/10',
            items: [
              { k: 'Capital Contributed',  v: fmt(calc.opPtnrCapital) },
              { k: 'Cash Flow Over Hold',  v: fmt(calc.totalGPCash) },
              { k: 'Sale Profit Share',   v: fmt(calc.gpFromSale) },
              { k: 'Total Return',        v: fmt(calc.gpTotal), bold: true },
              { k: 'Equity Multiple',     v: calc.opPtnrCapital > 0 ? calc.gpEquityMultiple.toFixed(2) + 'x' : '∞ (no capital)', bold: true },
              { k: 'Annualized Return',   v: calc.opPtnrCapital > 0 ? pct(calc.gpIRR * 100) : '∞', bold: true },
            ],
          },
        ].map(side => (
          <div key={side.label} className={`rounded-xl border p-4 ${side.color}`}>
            <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">{side.label}</p>
            <div className="space-y-1.5">
              {side.items.map(item => (
                <div key={item.k} className="flex justify-between text-xs">
                  <span className="text-slate-500">{item.k}</span>
                  <span className={`${item.bold ? 'font-black text-white' : 'text-slate-300 font-semibold'}`}>{item.v}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Waterfall table */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-4 py-2 bg-slate-800/80 border-b border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Sale Profit Waterfall Distribution</p>
        </div>
        <div className="divide-y divide-slate-700/50">
          {calc.waterfall.map((t, i) => (
            <div key={i} className="px-4 py-3 grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="font-bold text-slate-200">{t.tier}</p>
                <p className="text-slate-500 mt-0.5">{t.desc}</p>
              </div>
              <div className="text-center">
                <p className="text-slate-500 mb-1">LP Receives</p>
                <p className="text-blue-400 font-black text-sm">{fmt(t.lp)}</p>
              </div>
              <div className="text-center">
                <p className="text-slate-500 mb-1">GP Receives</p>
                <p className="text-green-400 font-black text-sm">{fmt(t.gp)}</p>
              </div>
            </div>
          ))}
          <div className="px-4 py-3 grid grid-cols-3 gap-2 text-xs bg-slate-700/30">
            <span className="font-black text-slate-200">Total from Sale</span>
            <span className="text-blue-400 font-black text-sm text-center">{fmt(calc.lpFromSale)}</span>
            <span className="text-green-400 font-black text-sm text-center">{fmt(calc.gpFromSale)}</span>
          </div>
        </div>
      </div>

      {/* Waterfall bar chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Waterfall Distribution by Tier</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={calc.waterfallBar} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number) => [fmt(v)]} />
            <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
            <Bar dataKey="LP" stackId="a" fill="#3b82f6" name="LP (Money Partner)" />
            <Bar dataKey="GP" stackId="a" fill="#10b981" name="GP (Operating Partner)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* JV tips */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">JV Structuring Notes</p>
        <div className="space-y-1.5 text-xs text-slate-400">
          {[
            '📋 The typical structure is "LP/GP" or "passive/active" — money partner puts in capital, operating partner runs the deal for a promote.',
            '🎯 Pref return: if LP doesn\'t receive their preferred return from cash flow, the remainder is owed from sale proceeds before GP profits.',
            '💡 Cumulative pref = all owed pref compounds and must be paid eventually. Non-cumulative = each year stands alone.',
            '🔁 Catch-up: after pref is satisfied, GP receives a disproportionate share until they\'ve "caught up" to their target overall split.',
            '⚖️ Common structures: 80/20 LP/GP equity, 8% pref, 50% catch-up, 70/30 final split. Or 90/10 with 10% pref, no catch-up.',
            '📝 Always document in an operating agreement with an attorney — verbal JV agreements create massive liability.',
            '🏦 SEC consideration: if raising from multiple investors, you may need Reg D exemption filing — consult a securities attorney.',
            '🤝 Alignment: GP\'s incentive should be to hit the pref AND generate above-market returns — the waterfall aligns this.',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
