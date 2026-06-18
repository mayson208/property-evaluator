import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line, Legend } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
function pct(n: number) { return n.toFixed(1) + '%' }

const STRATEGY_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444']

export default function DispositionCalc() {
  const [purchasePrice,  setPurchasePrice]  = useState(200000)
  const [currentValue,   setCurrentValue]   = useState(500000)
  const [depreciationClaimed, setDepreciationClaimed] = useState(80000)
  const [sellingCosts,   setSellingCosts]   = useState(6)        // % of sale price
  const [filingStatus,   setFilingStatus]   = useState<'single' | 'mfj'>('mfj')
  const [otherIncome,    setOtherIncome]    = useState(150000)
  const [primaryHome,    setPrimaryHome]    = useState(false)    // Section 121 eligible?
  const [yearsOwned,     setYearsOwned]     = useState(7)
  const [state,          setState]          = useState(0)        // state cap gains rate
  const [reinvestRate,   setReinvestRate]   = useState(7)        // % if proceeds reinvested
  const [rentNetMonthly, setRentNetMonthly] = useState(800)      // net cash flow if held
  const [futureAppreciation, setFutureAppreciation] = useState(4) // % / yr

  // Installment-sale settings
  const [installYears,  setInstallYears]  = useState(5)
  const [sellerIntRate, setSellerIntRate] = useState(6)         // interest rate for seller note

  const calc = useMemo(() => {
    const grossProceeds  = currentValue
    const sellCostAmt    = grossProceeds * sellingCosts / 100
    const netProceeds    = grossProceeds - sellCostAmt

    // Adjusted cost basis
    const adjBasis       = purchasePrice - depreciationClaimed

    // Total realized gain
    const totalGain      = netProceeds - adjBasis

    // Depreciation recapture (§1250) — taxed at 25% (max)
    const recaptureGain  = Math.min(depreciationClaimed, totalGain > 0 ? totalGain : 0)
    const capitalGain    = Math.max(totalGain - recaptureGain, 0)

    // Section 121 exclusion
    const exclusionCap   = filingStatus === 'mfj' ? 500000 : 250000
    const sec121Excl     = (primaryHome && yearsOwned >= 2) ? Math.min(capitalGain, exclusionCap) : 0
    const taxableCapGain = capitalGain - sec121Excl

    // Federal LTCG rate
    const income = otherIncome + taxableCapGain
    let ltcgRate = 0
    if (filingStatus === 'mfj') {
      if (income > 583750) ltcgRate = 20
      else if (income > 94050) ltcgRate = 15
    } else {
      if (income > 518900) ltcgRate = 20
      else if (income > 47025) ltcgRate = 15
    }

    // NIIT (3.8%) — applies when AGI > $200K single / $250K MFJ
    const niitThreshold = filingStatus === 'mfj' ? 250000 : 200000
    const niitApplies   = (otherIncome + taxableCapGain) > niitThreshold
    const niitRate      = niitApplies ? 3.8 : 0

    const recaptureTax  = recaptureGain * 0.25
    const capitalGainTax = taxableCapGain * (ltcgRate + niitRate) / 100
    const stateTax       = totalGain * state / 100        // state taxes all gain

    const totalTaxStraightSale = recaptureTax + capitalGainTax + stateTax
    const netAfterTaxStraightSale = netProceeds - totalTaxStraightSale

    // 1031 Exchange: defer all taxes, must reinvest netProceeds into like-kind
    // 10yr wealth = reinvested proceeds grown at reinvestRate% − deferred tax paid at end
    const deferredTax      = totalTaxStraightSale
    const xchg10yr         = netProceeds * Math.pow(1 + reinvestRate / 100, 10)
    const xchgNet10yr      = xchg10yr - deferredTax   // rough (taxes due when sold again)

    // Straight sale: invest net-after-tax at reinvestRate%
    const sale10yr         = netAfterTaxStraightSale * Math.pow(1 + reinvestRate / 100, 10)

    // Installment sale — spread gain over installYears
    const gainPerYear      = totalGain / installYears
    const recapturePerYear = recaptureGain / installYears
    const capGainPerYear   = taxableCapGain / installYears
    const principalPerYear = (netProceeds - totalGain) / installYears  // basis portion
    const installPrincipalPmt = netProceeds / installYears

    // Interest income on outstanding balance
    let installNetTotal    = 0
    let installBalance     = netProceeds
    for (let y = 0; y < installYears; y++) {
      const interestIncome = installBalance * sellerIntRate / 100
      const taxOnGain      = recapturePerYear * 0.25 + capGainPerYear * (ltcgRate + niitRate) / 100 + gainPerYear * state / 100
      const taxOnInterest  = interestIncome * 0.32   // ordinary income approx
      const netYear        = principalPerYear + interestIncome - taxOnGain - taxOnInterest
      installNetTotal     += netYear
      installBalance      -= installPrincipalPmt
    }
    // Remaining: grow the collected amounts for the rest of 10yrs
    const installAvgYr     = installNetTotal / installYears
    const install10yr      = installAvgYr * ((Math.pow(1 + reinvestRate / 100, 10) - 1) / (reinvestRate / 100))

    // Hold & Rent
    const rentCashFlow10yr = rentNetMonthly * 12 * 10
    const futureValue10yr  = currentValue * Math.pow(1 + futureAppreciation / 100, 10)
    const futureGain       = futureValue10yr - adjBasis - depreciationClaimed * 0  // simplified
    const futureRecapture  = depreciationClaimed * 0.25
    const futureCapTax     = Math.max(futureGain - recaptureGain, 0) * (ltcgRate + niitRate) / 100
    const holdSellCosts    = futureValue10yr * sellingCosts / 100
    const holdNetAt10yr    = futureValue10yr - holdSellCosts - futureRecapture - futureCapTax
    const hold10yr         = holdNetAt10yr + rentCashFlow10yr

    // Seller Finance (like installment but you hold the note yourself + interest)
    const sellerFinance10yr = install10yr * 1.05  // slightly better due to higher interest

    const strategies = [
      {
        name: 'Straight Sale',
        short: 'Sell Now',
        desc: 'Sell, pay all taxes immediately, reinvest net proceeds.',
        taxNow: totalTaxStraightSale,
        netNow: netAfterTaxStraightSale,
        net10yr: sale10yr,
        color: STRATEGY_COLORS[0],
        risk: 'Low',
        complexity: 'Easy',
        pros: ['Maximum liquidity', 'No future landlord headaches', 'Simplest exit'],
        cons: ['Full tax bill immediately', 'Lose future appreciation', 'Opportunity cost of reinvestment'],
      },
      {
        name: '1031 Exchange',
        short: '1031',
        desc: 'Defer ALL capital gains by reinvesting into like-kind property within 180 days.',
        taxNow: 0,
        netNow: netProceeds,
        net10yr: xchgNet10yr,
        color: STRATEGY_COLORS[1],
        risk: 'Medium',
        complexity: 'Moderate',
        pros: ['Zero taxes due now', 'Full proceeds reinvested and compounding', 'Defer indefinitely (step-up at death)'],
        cons: ['Must ID replacement in 45 days', 'Must close in 180 days', 'Stays in real estate — no diversification'],
      },
      {
        name: 'Installment Sale',
        short: 'Installment',
        desc: `Spread gain over ${installYears} years via IRC §453 — pay taxes as you receive payments.`,
        taxNow: recaptureTax,   // recapture still due in year 1
        netNow: principalPerYear + (netProceeds * sellerIntRate / 100) - (recaptureGain * 0.25 + taxableCapGain / installYears * (ltcgRate + niitRate) / 100),
        net10yr: install10yr,
        color: STRATEGY_COLORS[2],
        risk: 'Medium',
        complexity: 'Moderate',
        pros: ['Spreads tax burden over years', 'Buyer pays interest = additional income', 'May keep you in lower bracket each year'],
        cons: ['Depreciation recapture still due in year 1', 'Buyer default risk', 'Lower lump sum upfront'],
      },
      {
        name: 'Seller Financing',
        short: 'Seller Finance',
        desc: 'Act as the bank — hold a mortgage note, collect monthly P&I, earn interest income.',
        taxNow: recaptureTax,
        netNow: installPrincipalPmt * 0.2,  // first year payment approx
        net10yr: sellerFinance10yr,
        color: STRATEGY_COLORS[3],
        risk: 'Medium-High',
        complexity: 'Complex',
        pros: ['Interest income above market returns', 'Installment sale tax treatment', 'Buyer pool = anyone you approve'],
        cons: ['Foreclosure risk if buyer defaults', 'Due-on-sale if you have a mortgage', 'Active management of note'],
      },
      {
        name: 'Hold & Rent',
        short: 'Hold',
        desc: 'Keep the property, collect rent, and sell in 10 years at higher appreciation.',
        taxNow: 0,
        netNow: rentNetMonthly * 12,   // first year cash flow
        net10yr: hold10yr,
        color: STRATEGY_COLORS[4],
        risk: 'High',
        complexity: 'Ongoing',
        pros: ['Continue appreciation', 'Rental cash flow', 'Ongoing depreciation deductions'],
        cons: ['Landlord responsibilities', 'Concentration risk', 'No liquidity until sold'],
      },
    ]

    const best10yr = Math.max(...strategies.map(s => s.net10yr))

    // 10yr growth chart data
    const chartData = Array.from({ length: 11 }, (_, yr) => {
      const row: Record<string, number | string> = { yr: `Yr ${yr}` }
      row['Straight Sale'] = netAfterTaxStraightSale * Math.pow(1 + reinvestRate / 100, yr)
      row['1031 Exchange'] = netProceeds * Math.pow(1 + reinvestRate / 100, yr) - (yr < 10 ? 0 : deferredTax)
      row['Hold & Rent']   = currentValue * Math.pow(1 + futureAppreciation / 100, yr) + rentNetMonthly * 12 * yr
      return row
    })

    return { strategies, best10yr, chartData, totalGain, recaptureGain, capitalGain, sec121Excl, taxableCapGain, ltcgRate, niitRate, netProceeds, totalTaxStraightSale, deferredTax }
  }, [purchasePrice, currentValue, depreciationClaimed, sellingCosts, filingStatus, otherIncome, primaryHome, yearsOwned, state, reinvestRate, rentNetMonthly, futureAppreciation, installYears, sellerIntRate])

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
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Exit Strategy Analyzer</h3>
        <p className="text-xs text-slate-500">
          Compare five ways to exit a property: straight sale, 1031 exchange, installment sale,
          seller financing, or hold as a rental. See the 10-year wealth outcome for each path.
        </p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Property</p>
          <Slider label="Purchase Price" value={purchasePrice} min={50000} max={2000000} step={10000} onChange={setPurchasePrice} prefix="$" />
          <Slider label="Current Market Value" value={currentValue} min={50000} max={5000000} step={10000} onChange={setCurrentValue} prefix="$" />
          <Slider label="Depreciation Claimed to Date" value={depreciationClaimed} min={0} max={500000} step={5000} onChange={setDepreciationClaimed} prefix="$" />
          <Slider label="Selling Costs (agent + closing)" value={sellingCosts} min={1} max={10} step={0.5} onChange={setSellingCosts} suffix="%" />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="primary" checked={primaryHome} onChange={e => setPrimaryHome(e.target.checked)} className="w-4 h-4 accent-blue-500" />
            <label htmlFor="primary" className="text-xs text-slate-400">Primary home (Section 121 eligible)</label>
          </div>
          {primaryHome && (
            <Slider label="Years Owned" value={yearsOwned} min={1} max={30} step={1} onChange={setYearsOwned} suffix=" yrs" />
          )}
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Tax & Returns</p>
          <div>
            <label className="text-xs text-slate-400">Filing Status</label>
            <select value={filingStatus} onChange={e => setFilingStatus(e.target.value as 'single' | 'mfj')}
              className="mt-1 w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200">
              <option value="mfj">Married Filing Jointly</option>
              <option value="single">Single</option>
            </select>
          </div>
          <Slider label="Other Annual Income" value={otherIncome} min={0} max={1000000} step={10000} onChange={setOtherIncome} prefix="$" />
          <Slider label="State Capital Gains Rate" value={state} min={0} max={15} step={0.5} onChange={setState} suffix="%" />
          <Slider label="Reinvestment Return (non-RE)" value={reinvestRate} min={3} max={12} step={0.5} onChange={setReinvestRate} suffix="%" />
          <Slider label="Rent Net Monthly (if held)" value={rentNetMonthly} min={-500} max={5000} step={100} onChange={setRentNetMonthly} prefix="$" />
          <Slider label="Future Appreciation (if held)" value={futureAppreciation} min={0} max={10} step={0.5} onChange={setFutureAppreciation} suffix="%" />
        </div>
      </div>

      {/* Installment settings */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 grid grid-cols-2 gap-4">
        <p className="col-span-2 text-xs font-bold text-slate-300 uppercase tracking-widest">Installment / Seller Finance Settings</p>
        <Slider label="Installment Period" value={installYears} min={2} max={30} step={1} onChange={setInstallYears} suffix=" yrs" />
        <Slider label="Seller Note Interest Rate" value={sellerIntRate} min={4} max={12} step={0.25} onChange={setSellerIntRate} suffix="%" />
      </div>

      {/* Gain breakdown */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Gain Breakdown</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          {[
            { label: 'Total Gain',          val: fmt(calc.totalGain),      color: 'text-white' },
            { label: 'Depreciation Recap',  val: fmt(calc.recaptureGain),  color: 'text-orange-400' },
            { label: 'Long-Term Cap Gain',  val: fmt(calc.capitalGain),    color: 'text-yellow-400' },
            { label: '§121 Exclusion',      val: fmt(calc.sec121Excl),     color: 'text-green-400' },
          ].map(s => (
            <div key={s.label} className="bg-slate-900/60 rounded-xl p-3 border border-slate-700">
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className={`text-lg font-black ${s.color}`}>{s.val}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
          <span>Federal LTCG rate: <strong className="text-white">{pct(calc.ltcgRate)}</strong></span>
          <span>NIIT: <strong className="text-white">{pct(calc.niitRate)}</strong></span>
          <span>Taxable cap gain: <strong className="text-white">{fmt(calc.taxableCapGain)}</strong></span>
          <span>Total tax (straight sale): <strong className="text-red-400">{fmt(calc.totalTaxStraightSale)}</strong></span>
        </div>
      </div>

      {/* Strategy cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {calc.strategies.map(s => (
          <div key={s.name} className={`rounded-xl border p-4 space-y-3 ${s.net10yr === calc.best10yr ? 'border-blue-500 bg-blue-900/10' : 'border-slate-700 bg-slate-800/50'}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-bold text-slate-200">{s.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>
              </div>
              {s.net10yr === calc.best10yr && (
                <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ml-2">Best</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-slate-900/60 rounded-lg p-2">
                <p className="text-xs text-slate-500">Tax Now</p>
                <p className="text-sm font-black text-red-400">{fmt(s.taxNow)}</p>
              </div>
              <div className="bg-slate-900/60 rounded-lg p-2">
                <p className="text-xs text-slate-500">Net In Pocket</p>
                <p className="text-sm font-black text-green-400">{fmt(s.netNow)}</p>
              </div>
            </div>
            <div className="bg-slate-900/60 rounded-lg p-2 text-center">
              <p className="text-xs text-slate-500">10-Year Wealth</p>
              <p className="text-xl font-black" style={{ color: s.color }}>{fmt(s.net10yr)}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div>
                <p className="text-slate-600">Risk</p>
                <p className={`font-semibold ${s.risk === 'Low' ? 'text-green-400' : s.risk === 'Medium' ? 'text-yellow-400' : 'text-red-400'}`}>{s.risk}</p>
              </div>
              <div>
                <p className="text-slate-600">Complexity</p>
                <p className="text-slate-300 font-semibold">{s.complexity}</p>
              </div>
            </div>
            <div className="text-xs space-y-0.5">
              {s.pros.slice(0, 2).map(p => <p key={p} className="text-green-400">✓ {p}</p>)}
              {s.cons.slice(0, 1).map(c => <p key={c} className="text-red-400">✗ {c}</p>)}
            </div>
          </div>
        ))}
      </div>

      {/* 10yr comparison bar chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">10-Year Net Wealth by Strategy</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={calc.strategies.map(s => ({ name: s.short, value: Math.round(s.net10yr) }))} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number) => [fmt(v), '10-yr wealth']} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {calc.strategies.map((s, i) => <Cell key={i} fill={s.color} fillOpacity={s.net10yr === calc.best10yr ? 1 : 0.6} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Growth trajectory */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Wealth Trajectory (top 3 strategies)</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={calc.chartData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="yr" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number) => [fmt(v)]} />
            <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
            <Line type="monotone" dataKey="Straight Sale" stroke={STRATEGY_COLORS[0]} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="1031 Exchange" stroke={STRATEGY_COLORS[1]} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Hold & Rent"   stroke={STRATEGY_COLORS[4]} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Key considerations */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Key Considerations</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-slate-400">
          {[
            '🔁 1031 wins mathematically in almost every scenario — the deferred taxes compound in your favor for decades.',
            '📆 45-day ID window and 180-day close are non-negotiable; missing either means full tax bill.',
            '🏠 Section 121 exclusion is the single biggest tax break in the code — use it before converting to rental.',
            '⚖️ Depreciation recapture at 25% is unavoidable regardless of strategy (except step-up at death).',
            '📄 Installment sale: get buyer to provide a lien on the property — you\'re now a lender.',
            '💀 Dying with real estate = stepped-up basis for heirs; deferred gains disappear forever.',
            '🏦 If you carry seller financing, service the note yourself — get a promissory note and deed of trust.',
            '📊 Hold & Rent makes sense when appreciation rate > your after-tax reinvestment return.',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        All projections are estimates. Consult a CPA or tax attorney before executing any disposition strategy,
        especially 1031 exchanges, installment sales, and seller financing arrangements.
      </p>
    </div>
  )
}
