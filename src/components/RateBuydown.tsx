import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function monthlyPI(principal: number, annualRate: number, termYears: number) {
  const r = annualRate / 100 / 12
  const n = termYears * 12
  if (r === 0) return principal / n
  return principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
}

export default function RateBuydown() {
  const { result, downPaymentPct, interestRate } = usePropertyStore()

  const purchasePrice = result?.estimatedValue ?? 400000
  const loanAmt       = purchasePrice * (1 - downPaymentPct / 100)

  const [baseRate,     setBaseRate]     = useState(interestRate)
  const [termYears,    setTermYears]    = useState(30)
  const [pointCost,    setPointCost]    = useState(1.0)
  const [ratePerPoint, setRatePerPoint] = useState(0.25)
  const [scenario,     setScenario]     = useState<'permanent' | '21' | '32' | 'custom'>('permanent')
  const [customRate1,  setCustomRate1]  = useState(Math.max(2, interestRate - 2))
  const [customRate2,  setCustomRate2]  = useState(Math.max(2, interestRate - 1))

  // Scenario parameters
  const scenarios = useMemo(() => {
    const base = baseRate
    const pointsUsed = pointCost
    const rateDrop   = pointsUsed * ratePerPoint
    const permanent  = Math.max(2, base - rateDrop)
    const pointsCost = loanAmt * (pointsUsed / 100)

    const monthlyBase   = monthlyPI(loanAmt, base, termYears)
    const monthlyPerm   = monthlyPI(loanAmt, permanent, termYears)
    const savingPerm    = monthlyBase - monthlyPerm
    const breakEvenPerm = savingPerm > 0 ? Math.ceil(pointsCost / savingPerm) : Infinity

    // 2-1 buydown: seller typically pays. Year 1 = rate-2%, Year 2 = rate-1%, Year 3+ = base
    const rate21_yr1 = Math.max(2, base - 2)
    const rate21_yr2 = Math.max(2, base - 1)
    const monthly21_yr1 = monthlyPI(loanAmt, rate21_yr1, termYears)
    const monthly21_yr2 = monthlyPI(loanAmt, rate21_yr2, termYears)
    const cost21 = (monthlyBase - monthly21_yr1) * 12 + (monthlyBase - monthly21_yr2) * 12
    const saving21_avg  = ((monthlyBase - monthly21_yr1) * 12 + (monthlyBase - monthly21_yr2) * 12) / 24

    // 3-2-1 buydown: Year1 -3%, Year2 -2%, Year3 -1%, Year4+ base
    const rate321_yr1 = Math.max(2, base - 3)
    const rate321_yr2 = Math.max(2, base - 2)
    const rate321_yr3 = Math.max(2, base - 1)
    const monthly321_1 = monthlyPI(loanAmt, rate321_yr1, termYears)
    const monthly321_2 = monthlyPI(loanAmt, rate321_yr2, termYears)
    const monthly321_3 = monthlyPI(loanAmt, rate321_yr3, termYears)
    const cost321 = (monthlyBase - monthly321_1) * 12 + (monthlyBase - monthly321_2) * 12 + (monthlyBase - monthly321_3) * 12

    return {
      base: { rate: base, monthly: monthlyBase },
      permanent: { rate: permanent, monthly: monthlyPerm, cost: pointsCost, saving: savingPerm, breakEven: breakEvenPerm, points: pointsUsed },
      buydown21: { yr1Rate: rate21_yr1, yr2Rate: rate21_yr2, yr3Rate: base, monthly_yr1: monthly21_yr1, monthly_yr2: monthly21_yr2, monthly_yr3: monthlyBase, cost: cost21, avgSaving: saving21_avg },
      buydown321: { yr1Rate: rate321_yr1, yr2Rate: rate321_yr2, yr3Rate: rate321_yr3, yr4Rate: base, monthly_yr1: monthly321_1, monthly_yr2: monthly321_2, monthly_yr3: monthly321_3, monthly_yr4: monthlyBase, cost: cost321 },
    }
  }, [loanAmt, baseRate, termYears, pointCost, ratePerPoint])

  const chartData = useMemo(() => {
    const pts = []
    for (let yr = 1; yr <= Math.min(termYears, 30); yr++) {
      const r21  = yr === 1 ? scenarios.buydown21.yr1Rate : yr === 2 ? scenarios.buydown21.yr2Rate : scenarios.base.rate
      const r321 = yr === 1 ? scenarios.buydown321.yr1Rate : yr === 2 ? scenarios.buydown321.yr2Rate : yr === 3 ? scenarios.buydown321.yr3Rate : scenarios.base.rate

      pts.push({
        yr: `Yr ${yr}`,
        base:      Math.round(monthlyPI(loanAmt, scenarios.base.rate, termYears)),
        permanent: Math.round(monthlyPI(loanAmt, scenarios.permanent.rate, termYears)),
        buydown21: Math.round(monthlyPI(loanAmt, r21, termYears)),
        buydown321:Math.round(monthlyPI(loanAmt, r321, termYears)),
      })
    }
    return pts
  }, [loanAmt, scenarios, termYears])

  if (!result) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-4xl mb-3">💲</p>
        <p>Run a valuation first to compare rate buydown options</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Mortgage Points &amp; Rate Buydown</h3>
        <p className="text-xs text-slate-500">
          Compare paying discount points for a permanent rate reduction vs temporary buydown programs (2-1, 3-2-1).
        </p>
      </div>

      {/* Settings */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Loan Parameters</p>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Market Rate (no points)', value: baseRate, min: 3, max: 12, step: 0.125, set: setBaseRate, fmt: (v: number) => `${v.toFixed(3)}%` },
            { label: 'Points to Pay',           value: pointCost, min: 0, max: 4, step: 0.25, set: setPointCost, fmt: (v: number) => `${v} pt${v !== 1 ? 's' : ''} (${fmt(loanAmt * v / 100)})` },
            { label: 'Rate Drop per Point',     value: ratePerPoint, min: 0.125, max: 0.5, step: 0.125, set: setRatePerPoint, fmt: (v: number) => `${v.toFixed(3)}%/pt` },
          ].map(s => (
            <div key={s.label}>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-slate-400 uppercase tracking-widest">{s.label}</label>
                <span className="text-xs font-bold text-blue-400">{s.fmt(s.value)}</span>
              </div>
              <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                onChange={e => s.set(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
            </div>
          ))}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Loan Term</p>
            <div className="flex gap-2">
              {[10, 15, 20, 30].map(t => (
                <button key={t}
                  onClick={() => setTermYears(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${termYears === t ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                  {t}yr
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Comparison cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'No Buydown',
            rate:  `${baseRate.toFixed(3)}%`,
            monthly: fmt(scenarios.base.monthly),
            cost:    '$0 upfront',
            note:    'Market rate',
            color:   'text-slate-300',
          },
          {
            label: `${pointCost}pt Permanent Buydown`,
            rate:  `${scenarios.permanent.rate.toFixed(3)}%`,
            monthly: fmt(scenarios.permanent.monthly),
            cost:    `${fmt(scenarios.permanent.cost)} upfront`,
            note:    scenarios.permanent.breakEven < Infinity ? `break-even: ${scenarios.permanent.breakEven} mo` : 'No break-even',
            color:   scenarios.permanent.breakEven <= 60 ? 'text-green-400' : 'text-yellow-400',
          },
          {
            label: '2-1 Buydown',
            rate:  `Yr1: ${scenarios.buydown21.yr1Rate.toFixed(2)}% → ${scenarios.base.rate.toFixed(2)}%`,
            monthly: `${fmt(scenarios.buydown21.monthly_yr1)} → ${fmt(scenarios.base.monthly)}`,
            cost:    `${fmt(scenarios.buydown21.cost)} (seller pays)`,
            note:    'Seller concession',
            color:   'text-blue-400',
          },
          {
            label: '3-2-1 Buydown',
            rate:  `Yr1: ${scenarios.buydown321.yr1Rate.toFixed(2)}% → ${scenarios.base.rate.toFixed(2)}%`,
            monthly: `${fmt(scenarios.buydown321.monthly_yr1)} → ${fmt(scenarios.base.monthly)}`,
            cost:    `${fmt(scenarios.buydown321.cost)} (seller pays)`,
            note:    'Seller concession',
            color:   'text-purple-400',
          },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <p className="text-xs text-slate-500 mb-2 font-bold">{s.label}</p>
            <p className={`text-sm font-black mb-1 ${s.color}`}>{s.monthly}</p>
            <p className="text-xs text-slate-400">{s.rate}</p>
            <p className="text-xs text-orange-400 mt-1">{s.cost}</p>
            <p className={`text-xs mt-1 ${s.color}`}>{s.note}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Monthly P&amp;I Over Time — All Scenarios</p>
        <p className="text-xs text-slate-600 mb-4">Temporary buydowns step up to the base rate. Permanent buydown stays lower forever.</p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData.slice(0, 8)} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="yr" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false}
              tickFormatter={v => `$${(v / 1000).toFixed(1)}K`} width={55} />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
              formatter={(v: number, name: string) => [fmt(v), name]} />
            <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
            <Line type="stepAfter" dataKey="base"       name="No Points"       stroke="#64748b" strokeWidth={2} dot={false} />
            <Line type="stepAfter" dataKey="permanent"  name={`${pointCost}pt Perm`}  stroke="#22c55e" strokeWidth={2.5} dot={false} />
            <Line type="stepAfter" dataKey="buydown21"  name="2-1 Buydown"     stroke="#3b82f6" strokeWidth={2} dot={false} />
            <Line type="stepAfter" dataKey="buydown321" name="3-2-1 Buydown"   stroke="#a855f7" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Permanent buydown break-even */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Permanent Buydown Analysis</p>
        <div className="space-y-2 text-xs">
          {[
            { label: 'Points paid',                   value: `${pointCost} pt${pointCost !== 1 ? 's' : ''} = ${fmt(scenarios.permanent.cost)}` },
            { label: 'Rate reduction',                value: `${baseRate.toFixed(3)}% → ${scenarios.permanent.rate.toFixed(3)}% (−${(pointCost * ratePerPoint).toFixed(3)}%)` },
            { label: 'Monthly savings',               value: `${fmt(scenarios.permanent.saving)}/mo` },
            { label: 'Break-even month',              value: scenarios.permanent.breakEven < Infinity ? `Month ${scenarios.permanent.breakEven} (${(scenarios.permanent.breakEven / 12).toFixed(1)} years)` : 'Never (saving too small)' },
            { label: `Lifetime savings (${termYears}yr)`, value: fmt(scenarios.permanent.saving * termYears * 12 - scenarios.permanent.cost) },
          ].map(r => (
            <div key={r.label} className="flex justify-between">
              <span className="text-slate-500">{r.label}</span>
              <span className="text-slate-300 font-semibold">{r.value}</span>
            </div>
          ))}
        </div>

        {scenarios.permanent.breakEven < Infinity && (
          <div className={`mt-3 rounded-lg p-3 text-xs font-semibold ${
            scenarios.permanent.breakEven <= 36 ? 'bg-green-900/20 border border-green-700/30 text-green-400'
            : scenarios.permanent.breakEven <= 60 ? 'bg-yellow-900/20 border border-yellow-700/30 text-yellow-400'
            : 'bg-slate-700/50 border border-slate-600 text-slate-400'
          }`}>
            {scenarios.permanent.breakEven <= 36 && `Strong case for buying points — break-even in ${scenarios.permanent.breakEven} months. If you stay ${Math.ceil(scenarios.permanent.breakEven / 12)+1}+ years, you win.`}
            {scenarios.permanent.breakEven > 36 && scenarios.permanent.breakEven <= 60 && `Moderate case — break-even at ${(scenarios.permanent.breakEven / 12).toFixed(1)} years. Worth it only if you stay long-term.`}
            {scenarios.permanent.breakEven > 60 && `Long break-even (${(scenarios.permanent.breakEven / 12).toFixed(1)} years). Points may not be worth it unless you plan to hold very long-term.`}
          </div>
        )}
      </div>

      {/* Temporary buydown guidance */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Temporary Buydown Guidance</p>
        <div className="space-y-3 text-xs text-slate-400">
          <p>
            Temporary buydowns (2-1, 3-2-1) are typically <span className="text-blue-400 font-semibold">seller-paid concessions</span>.
            The seller deposits the total buydown cost into an escrow account at closing.
          </p>
          <ul className="space-y-2">
            <li className="flex gap-2"><span className="text-blue-400">2-1:</span> Rate is 2% below market in Year 1, 1% below in Year 2, then full rate. Cost to seller: <span className="text-orange-400 font-semibold">{fmt(scenarios.buydown21.cost)}</span></li>
            <li className="flex gap-2"><span className="text-purple-400">3-2-1:</span> Rate drops 3%, 2%, 1% in years 1-3 before stepping to full market rate. Cost: <span className="text-orange-400 font-semibold">{fmt(scenarios.buydown321.cost)}</span></li>
          </ul>
          <p className="text-slate-500">
            Tip: In a buyer's market, ask the seller to contribute a 2-1 buydown instead of a price reduction.
            It lowers your payment when cash flow matters most (early years) while helping the seller keep a higher sale price.
          </p>
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        1 discount point = 1% of loan amount. Typical rate reduction: 0.125–0.25% per point (varies by lender and market).
        Points are tax-deductible in the year paid for primary residences (subject to IRS rules).
      </p>
    </div>
  )
}
