import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

export default function OpportunityZone() {
  const [capitalGain,    setCapitalGain]    = useState(300000)
  const [gainYear,       setGainYear]       = useState(2025)
  const [ozReturn,       setOzReturn]       = useState(10)    // % annual return in QOF
  const [taxableReturn,  setTaxableReturn]  = useState(8)     // % taxable portfolio
  const [ltcgRate,       setLtcgRate]       = useState(20)    // federal LTCG %
  const [niitRate,       setNiitRate]       = useState(3.8)   // NIIT %
  const [stateRate,      setStateRate]      = useState(5)     // state %
  const [holdYears,      setHoldYears]      = useState(12)    // how long to hold QOF

  const calc = useMemo(() => {
    const totalTaxRate  = (ltcgRate + niitRate + stateRate) / 100

    // --- Scenario A: Don't invest in QOF ---
    // Pay all taxes NOW, invest net in taxable account
    const taxNow        = capitalGain * totalTaxRate
    const netAfterTax   = capitalGain - taxNow
    const taxableEnd    = netAfterTax * Math.pow(1 + taxableReturn / 100, holdYears)
    // Pay cap gains on the gain in taxable account at end
    const taxableGainEnd = taxableEnd - netAfterTax
    const taxOnTaxable  = taxableGainEnd * (ltcgRate / 100 + niitRate / 100)
    const scenarioAnet  = taxableEnd - taxOnTaxable

    // --- Scenario B: Invest full gain in QOF ---
    // Defer original gain tax to 2026 (Dec 31, 2026 → filed April 2027)
    const deferYears    = Math.max(2026 - gainYear, 0)

    // At deferral end (2026), pay taxes on original gain
    // Note: 5-yr and 7-yr step-ups have expired for investments after 2022
    const deferredTax   = capitalGain * totalTaxRate

    // QOF grows for holdYears — put the FULL capital gain in (not net after tax)
    const ozEndValue    = capitalGain * Math.pow(1 + ozReturn / 100, holdYears)
    const ozGain        = ozEndValue - capitalGain  // appreciation in QOF
    // If held 10+ years, zero federal tax on QOF appreciation (state taxes may still apply)
    const ozTaxOnGain   = holdYears >= 10
      ? ozGain * (stateRate / 100)                // only state tax
      : ozGain * totalTaxRate                     // full tax if sold early
    const scenarioBnet  = ozEndValue - deferredTax - ozTaxOnGain

    // Benefit of OZ
    const netBenefit    = scenarioBnet - scenarioAnet
    const taxSavedOnGain = holdYears >= 10 ? ozGain * (ltcgRate + niitRate) / 100 : 0

    // Year-by-year chart
    const chartData = Array.from({ length: holdYears + 1 }, (_, yr) => {
      // Taxable: net after immediate tax invested at taxableReturn
      const taxableVal = netAfterTax * Math.pow(1 + taxableReturn / 100, yr)
      const taxableGain = taxableVal - netAfterTax
      const taxableNet  = taxableVal - taxableGain * (ltcgRate / 100 + niitRate / 100)

      // QOF: full gain invested, deferred tax paid in 2026, zero tax on growth at 10yr
      const qofRaw   = capitalGain * Math.pow(1 + ozReturn / 100, yr)
      const dtPaid   = yr >= deferYears ? deferredTax : 0   // deferred tax paid in 2026
      const qofGainAtYr = qofRaw - capitalGain
      const qofTaxAtYr  = yr >= 10
        ? qofGainAtYr * (stateRate / 100)       // only state after 10yr
        : qofGainAtYr * totalTaxRate             // full tax if exited early
      const qofNet   = qofRaw - dtPaid - qofTaxAtYr

      return { yr, Taxable: Math.round(taxableNet), 'QOF (Opp Zone)': Math.round(qofNet) }
    })

    // OZ qualification steps
    const steps = [
      { done: true,  text: 'Realize a capital gain (sale of stock, property, business, etc.)' },
      { done: false, text: `Invest gain into a QOF within 180 days of sale (before ${gainYear}-12-31 for year-${gainYear} gain)` },
      { done: false, text: 'QOF must deploy 90% of assets into Qualified Opportunity Zone Property within 30 months' },
      { done: false, text: 'For real property: must "substantially improve" the property (improvements > original building basis) within 30 months' },
      { done: false, text: `Hold QOF investment through Dec 31, 2026 to trigger deferred gain (taxes due on ${gainYear + 1 > 2026 ? 2027 : 2027} return)` },
      { done: false, text: 'Hold for 10+ full years to exclude ALL federal tax on QOF appreciation' },
    ]

    return { taxNow, netAfterTax, ozEndValue, scenarioAnet, scenarioBnet, netBenefit, taxSavedOnGain, deferredTax, ozGain, deferYears, chartData, steps }
  }, [capitalGain, gainYear, ozReturn, taxableReturn, ltcgRate, niitRate, stateRate, holdYears])

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

  const isBetter = calc.netBenefit > 0

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Opportunity Zone (QOF) Analyzer</h3>
        <p className="text-xs text-slate-500">
          Qualified Opportunity Funds let you defer capital gains tax and eliminate federal tax on fund appreciation
          if held 10+ years. Compare the QOF path vs paying taxes now and reinvesting.
        </p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Capital Gain</p>
          <Slider label="Capital Gain Amount" value={capitalGain} min={10000} max={5000000} step={10000} onChange={setCapitalGain} prefix="$" />
          <Slider label="Year Gain Was Realized" value={gainYear} min={2024} max={2026} step={1} onChange={setGainYear} />
          <Slider label="Hold Period (years)" value={holdYears} min={5} max={20} step={1} onChange={setHoldYears} suffix=" yrs" />
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Returns & Taxes</p>
          <Slider label="Expected QOF Return" value={ozReturn} min={3} max={20} step={0.5} onChange={setOzReturn} suffix="%" />
          <Slider label="Taxable Portfolio Return" value={taxableReturn} min={3} max={15} step={0.5} onChange={setTaxableReturn} suffix="%" />
          <Slider label="Federal LTCG Rate" value={ltcgRate} min={0} max={23.8} step={0.1} onChange={setLtcgRate} suffix="%" />
          <Slider label="NIIT (3.8% if AGI > $250K)" value={niitRate} min={0} max={3.8} step={0.1} onChange={setNiitRate} suffix="%" />
          <Slider label="State Capital Gains Rate" value={stateRate} min={0} max={15} step={0.5} onChange={setStateRate} suffix="%" />
        </div>
      </div>

      {/* Verdict */}
      <div className={`rounded-xl p-4 border ${isBetter ? 'bg-green-900/20 border-green-700/50' : 'bg-yellow-900/20 border-yellow-700/50'}`}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">QOF vs Taxable</p>
          <span className={`text-xl font-black ${isBetter ? 'text-green-400' : 'text-yellow-400'}`}>
            {isBetter ? `+${fmt(calc.netBenefit)} advantage` : `${fmt(calc.netBenefit)} disadvantage`}
          </span>
        </div>
        <p className="text-xs text-slate-400">
          {isBetter
            ? `The QOF strategy ends with ${fmt(calc.netBenefit)} more after ${holdYears} years, driven by tax-free growth on fund appreciation.`
            : `The taxable reinvestment wins by ${fmt(-calc.netBenefit)} because your taxable return (${taxableReturn}%) outpaces the QOF return (${ozReturn}%) enough to overcome the tax advantage.`}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tax Paid Now (no QOF)',   val: fmt(calc.taxNow),           color: 'text-red-400' },
          { label: 'Deferred Tax (QOF)',       val: fmt(calc.deferredTax),      color: 'text-orange-400' },
          { label: 'Tax Saved on 10yr Growth', val: fmt(calc.taxSavedOnGain),   color: 'text-green-400' },
          { label: 'QOF End Value',            val: fmt(calc.ozEndValue),       color: 'text-blue-400' },
          { label: 'Taxable Net (after tax)',  val: fmt(calc.scenarioAnet),     color: 'text-slate-300' },
          { label: 'QOF Net (after all tax)',  val: fmt(calc.scenarioBnet),     color: 'text-white' },
          { label: 'Deferred Gain in QOF',    val: fmt(calc.ozGain),           color: 'text-purple-400' },
          { label: 'Deferral Period',          val: `${calc.deferYears} yrs`,   color: 'text-yellow-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-lg font-black ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Wealth Trajectory: QOF vs Taxable Portfolio</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={calc.chartData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="yr" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} label={{ value: 'Year', position: 'insideBottom', fill: '#475569', fontSize: 10 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number) => [fmt(v)]} />
            <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
            {holdYears >= 10 && (
              <ReferenceLine x={10} stroke="#10b981" strokeDasharray="4 4"
                label={{ value: '10yr: 0% on gains', position: 'top', fill: '#10b981', fontSize: 9 }} />
            )}
            <ReferenceLine x={calc.deferYears} stroke="#f59e0b" strokeDasharray="4 4"
              label={{ value: '2026: tax due', position: 'top', fill: '#f59e0b', fontSize: 9 }} />
            <Line type="monotone" dataKey="Taxable" stroke="#3b82f6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="QOF (Opp Zone)" stroke="#10b981" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Qualification steps */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-4 py-2 bg-slate-800/80 border-b border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">QOF Qualification Roadmap</p>
        </div>
        <div className="divide-y divide-slate-700/50">
          {calc.steps.map((s, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3">
              <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-black mt-0.5 ${s.done ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                {s.done ? '✓' : i + 1}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Key rules */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Critical Rules</p>
        <div className="space-y-1.5 text-xs text-slate-400">
          {[
            '⏱️ 180-day window is from the date of sale (not year-end) — missing it forfeits ALL OZ benefits.',
            '🏢 The QOF must hold 90% of assets in OZ property, tested semi-annually. Failure = 5% penalty.',
            '🔨 For existing buildings: improvements must EXCEED the purchase price of the building (not land) within 30 months.',
            '📍 "Original use" exception: new construction doesn\'t need the substantial improvement test.',
            '📅 Deferred gain is recognized Dec 31, 2026 regardless of whether you sell — have cash ready for the tax bill.',
            '🎯 The 10-year zero-tax benefit is federal only — check your state\'s OZ conformity (many states don\'t conform).',
            '💀 Stepped-up basis at death also works inside a QOF — the 10-year exclusion compounds with estate planning.',
            '🔍 Verify the census tract is actually a designated OZ at treasury.gov/CDFI before investing.',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        OZ rules are complex and this is a simplified model. Consult a tax attorney and CPA
        before investing in a Qualified Opportunity Fund. State tax conformity varies significantly.
      </p>
    </div>
  )
}
