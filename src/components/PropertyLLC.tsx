import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

interface StateData { name: string; filingFee: number; annualFee: number; privacy: boolean; seriesLLC: boolean }

const STATES: Record<string, StateData> = {
  CA: { name: 'California',  filingFee: 70,   annualFee: 800,  privacy: false, seriesLLC: false },
  TX: { name: 'Texas',       filingFee: 300,  annualFee: 0,    privacy: false, seriesLLC: true  },
  FL: { name: 'Florida',     filingFee: 125,  annualFee: 138,  privacy: false, seriesLLC: false },
  NY: { name: 'New York',    filingFee: 200,  annualFee: 25,   privacy: false, seriesLLC: false },
  DE: { name: 'Delaware',    filingFee: 90,   annualFee: 300,  privacy: true,  seriesLLC: true  },
  WY: { name: 'Wyoming',     filingFee: 100,  annualFee: 52,   privacy: true,  seriesLLC: true  },
  NV: { name: 'Nevada',      filingFee: 75,   annualFee: 200,  privacy: true,  seriesLLC: true  },
  OH: { name: 'Ohio',        filingFee: 99,   annualFee: 0,    privacy: false, seriesLLC: false },
  GA: { name: 'Georgia',     filingFee: 100,  annualFee: 50,   privacy: false, seriesLLC: false },
  CO: { name: 'Colorado',    filingFee: 50,   annualFee: 10,   privacy: false, seriesLLC: false },
  AZ: { name: 'Arizona',     filingFee: 50,   annualFee: 0,    privacy: false, seriesLLC: false },
  IL: { name: 'Illinois',    filingFee: 150,  annualFee: 75,   privacy: false, seriesLLC: false },
  WA: { name: 'Washington',  filingFee: 200,  annualFee: 60,   privacy: false, seriesLLC: false },
  NC: { name: 'N. Carolina', filingFee: 125,  annualFee: 202,  privacy: false, seriesLLC: false },
  PA: { name: 'Pennsylvania',filingFee: 125,  annualFee: 0,    privacy: false, seriesLLC: false },
  OTHER: { name: 'Other',    filingFee: 100,  annualFee: 50,   privacy: false, seriesLLC: false },
}

export default function PropertyLLC() {
  const [numProperties,   setNumProperties]   = useState(2)
  const [totalValue,      setTotalValue]       = useState(600000)
  const [annualRentIncome, setAnnualRentIncome] = useState(36000)
  const [netWorth,        setNetWorth]         = useState(500000)
  const [stateKey,        setStateKey]         = useState('TX')
  const [hasUmbrella,     setHasUmbrella]      = useState(false)
  const [umbrellaAmount,  setUmbrellaAmount]   = useState(1000000)
  const [llcType,         setLlcType]          = useState<'single' | 'series'>('single')
  const [separateLLCs,    setSeparateLLCs]     = useState(false)  // one per property
  const [existingMortgage, setExistingMortgage] = useState(true)
  const [marginalRate,    setMarginalRate]     = useState(32)     // %
  const [accountingCost,  setAccountingCost]   = useState(500)    // $ extra per year

  const stateData = STATES[stateKey]

  const calc = useMemo(() => {
    // -- Formation & annual costs --
    const llcCount = separateLLCs ? numProperties : 1
    const formationCost = stateData.filingFee * llcCount
    const registeredAgentAnnual = 150 * llcCount   // ~$150/yr per LLC
    const annualStateFee = stateData.annualFee * llcCount
    const accountingAnnual = accountingCost * llcCount
    const totalAnnualCost = registeredAgentAnnual + annualStateFee + accountingAnnual
    const year1Cost = formationCost + totalAnnualCost

    // -- Liability exposure --
    const exposureWithout = netWorth  // personal assets at risk
    const umbrellaCoversWithout = hasUmbrella ? umbrellaAmount : 0
    const netExposureWithout = Math.max(exposureWithout - umbrellaCoversWithout, 0)
    // With LLC: only equity in that LLC (not all properties if separate, and not other personal assets)
    const equityPerLLC = separateLLCs ? (totalValue / numProperties) * 0.7 : totalValue * 0.7  // 70% LTV approx
    const maxLLCExposure = separateLLCs ? equityPerLLC : totalValue * 0.7
    const netExposureWith = maxLLCExposure  // only the equity in the LLC

    // -- Tax implications (single-member LLC = disregarded entity, same taxes) --
    // S-corp election can save SE tax on distributions above reasonable salary — not modeled here
    // Marginal cost = 0 if disregarded entity (same tax treatment)
    const selfEmploymentTaxIf = 0  // rental income is NOT subject to SE tax regardless

    // -- Mortgage considerations --
    // "Due on sale" clause — if you transfer to LLC, lender can call the loan
    const mortgageRisk = existingMortgage
      ? 'HIGH: Transferring property with existing mortgage can trigger due-on-sale clause'
      : 'LOW: No existing mortgage — transfer is cleaner'

    // -- Break-even: years until cumulative annual costs = liability protection value --
    // Rough heuristic: cost of equivalent coverage via umbrella insurance
    const umbrellaEquivalentCost = (totalValue * 0.7) / 1000 * 10  // ~$10/$1000 of coverage/yr
    const annualSavingVsUmbrella = Math.max(umbrellaEquivalentCost - totalAnnualCost, 0)
    const breakEvenYears = annualSavingVsUmbrella > 0
      ? formationCost / annualSavingVsUmbrella
      : Infinity

    // -- 10yr cost comparison --
    const costBarData = [
      { name: 'Formation',      cost: formationCost },
      { name: 'State Fees (10yr)', cost: annualStateFee * 10 },
      { name: 'Reg. Agent (10yr)', cost: registeredAgentAnnual * 10 },
      { name: 'Accounting (10yr)', cost: accountingAnnual * 10 },
    ]

    // -- Score: should you LLC? --
    let score = 0
    let reasons: string[] = []
    if (netWorth > 200000)      { score += 2; reasons.push('Net worth > $200K — significant personal assets at risk') }
    if (numProperties >= 2)     { score += 2; reasons.push('Multiple properties multiply liability exposure') }
    if (!hasUmbrella)           { score += 2; reasons.push('No umbrella policy — LLC is your only shield') }
    if (totalValue > 500000)    { score += 1; reasons.push('High property value increases litigation target size') }
    if (stateData.annualFee < 200) { score += 1; reasons.push('Low annual state fee makes LLC economical') }
    if (existingMortgage)       { score -= 1; reasons.push('⚠️ Existing mortgage: due-on-sale risk') }
    if (stateData.filingFee > 200) { score -= 1; reasons.push('High formation cost in your state') }

    const verdict = score >= 5 ? 'Strongly Recommended'
      : score >= 3 ? 'Recommended'
      : score >= 1 ? 'Consider It'
      : 'May Not Be Necessary'

    const verdictColor = score >= 5 ? 'text-green-400'
      : score >= 3 ? 'text-blue-400'
      : score >= 1 ? 'text-yellow-400'
      : 'text-slate-400'

    return {
      formationCost, totalAnnualCost, year1Cost, annualStateFee, registeredAgentAnnual, accountingAnnual,
      netExposureWithout, netExposureWith, maxLLCExposure,
      mortgageRisk, breakEvenYears, costBarData,
      score, reasons, verdict, verdictColor, llcCount,
    }
  }, [numProperties, totalValue, annualRentIncome, netWorth, stateKey, hasUmbrella, umbrellaAmount,
      llcType, separateLLCs, existingMortgage, marginalRate, accountingCost, stateData])

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
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">LLC vs Personal Ownership</h3>
        <p className="text-xs text-slate-500">
          Analyze whether forming an LLC for your rental properties makes sense — weighing liability protection,
          formation costs, mortgage complications, and tax treatment.
        </p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Your Situation</p>
          <Slider label="Number of Rental Properties" value={numProperties} min={1} max={20} step={1} onChange={setNumProperties} />
          <Slider label="Total Property Value" value={totalValue} min={50000} max={5000000} step={25000} onChange={setTotalValue} prefix="$" />
          <Slider label="Annual Rental Income" value={annualRentIncome} min={0} max={500000} step={1000} onChange={setAnnualRentIncome} prefix="$" />
          <Slider label="Personal Net Worth" value={netWorth} min={50000} max={5000000} step={25000} onChange={setNetWorth} prefix="$" />
          <Slider label="Your Marginal Tax Rate" value={marginalRate} min={10} max={40} step={1} onChange={setMarginalRate} suffix="%" />
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">LLC Settings</p>
          <div>
            <label className="text-xs text-slate-400">State of Formation</label>
            <select value={stateKey} onChange={e => setStateKey(e.target.value)}
              className="mt-1 w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200">
              {Object.entries(STATES).map(([k, v]) => (
                <option key={k} value={k}>{v.name} — ${v.filingFee} filing, ${v.annualFee}/yr</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="sep" checked={separateLLCs} onChange={e => setSeparateLLCs(e.target.checked)} className="w-4 h-4 accent-blue-500" />
              <label htmlFor="sep" className="text-xs text-slate-400">Separate LLC per property (better isolation, higher cost)</label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="umbrella" checked={hasUmbrella} onChange={e => setHasUmbrella(e.target.checked)} className="w-4 h-4 accent-blue-500" />
              <label htmlFor="umbrella" className="text-xs text-slate-400">I have an umbrella insurance policy</label>
            </div>
            {hasUmbrella && (
              <Slider label="Umbrella Coverage Amount" value={umbrellaAmount} min={500000} max={5000000} step={500000} onChange={setUmbrellaAmount} prefix="$" />
            )}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="mortgage" checked={existingMortgage} onChange={e => setExistingMortgage(e.target.checked)} className="w-4 h-4 accent-blue-500" />
              <label htmlFor="mortgage" className="text-xs text-slate-400">Properties have existing mortgages</label>
            </div>
          </div>
          <Slider label="Extra Accounting Cost / LLC / yr" value={accountingCost} min={0} max={2000} step={100} onChange={setAccountingCost} prefix="$" />
        </div>
      </div>

      {/* Verdict banner */}
      <div className={`rounded-xl p-4 border ${calc.score >= 5 ? 'bg-green-900/20 border-green-700/50' : calc.score >= 3 ? 'bg-blue-900/20 border-blue-700/50' : calc.score >= 1 ? 'bg-yellow-900/20 border-yellow-700/50' : 'bg-slate-800/50 border-slate-700'}`}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Recommendation</p>
          <span className={`text-lg font-black ${calc.verdictColor}`}>{calc.verdict}</span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {calc.reasons.map((r, i) => (
            <p key={i} className="text-xs text-slate-400">{r.startsWith('⚠️') ? r : `• ${r}`}</p>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Formation Cost',       val: fmt(calc.formationCost),       color: 'text-yellow-400' },
          { label: 'Annual LLC Cost',      val: fmt(calc.totalAnnualCost),     color: 'text-orange-400' },
          { label: 'Assets at Risk (no LLC)', val: fmt(calc.netExposureWithout), color: 'text-red-400' },
          { label: 'Max Exposure (LLC)',   val: fmt(calc.netExposureWith),     color: 'text-blue-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-lg font-black ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Break-even */}
      {isFinite(calc.breakEvenYears) && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex justify-between">
            <p className="text-xs text-slate-400">Break-even vs equivalent umbrella coverage</p>
            <span className="text-sm font-black text-blue-400">{calc.breakEvenYears.toFixed(1)} years</span>
          </div>
        </div>
      )}

      {/* Cost breakdown chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">10-Year Cost Breakdown ({calc.llcCount} LLC{calc.llcCount > 1 ? 's' : ''})</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={calc.costBarData} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 9 }} tickLine={false} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number) => [fmt(v), 'Cost']} />
            <Bar dataKey="cost" radius={[6, 6, 0, 0]} fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* State comparison */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">{stateData.name} LLC Details</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
          {[
            { label: 'Filing Fee',     val: fmt(stateData.filingFee) },
            { label: 'Annual State Fee', val: fmt(stateData.annualFee) },
            { label: 'Privacy Shield', val: stateData.privacy ? '✅ Yes' : '❌ No' },
            { label: 'Series LLC',     val: stateData.seriesLLC ? '✅ Available' : '❌ No' },
          ].map(s => (
            <div key={s.label} className="bg-slate-900/60 rounded-xl p-3 border border-slate-700">
              <p className="text-slate-500 mb-1">{s.label}</p>
              <p className="font-bold text-slate-200">{s.val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Mortgage warning */}
      {existingMortgage && (
        <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-4">
          <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-2">⚠️ Mortgage Due-on-Sale Risk</p>
          <p className="text-xs text-slate-400">
            Virtually all conventional mortgages (Fannie/Freddie) contain a "due-on-sale" clause. Transferring the property
            to an LLC — even one you fully own — gives the lender the right to call the entire loan balance immediately.
            In practice, lenders rarely enforce this, but the risk is real.
          </p>
          <div className="mt-2 space-y-1 text-xs text-slate-400">
            <p>✓ <strong className="text-slate-300">Mitigations:</strong> Get lender consent in writing (rare), use a land trust first, wait until refinance to re-title in LLC.</p>
            <p>✓ <strong className="text-slate-300">Best practice:</strong> Buy new properties in the LLC name from day one — use commercial/portfolio lending.</p>
          </div>
        </div>
      )}

      {/* Comparison table */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-4 py-2 bg-slate-800/80 border-b border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Personal vs LLC Comparison</p>
        </div>
        <div className="divide-y divide-slate-700/50">
          {[
            ['Liability Protection',  '❌ All personal assets at risk', '✅ Limited to LLC equity only'],
            ['Privacy',               '❌ Name on public deed',          stateData.privacy ? '✅ Member info not public' : '⚠️ Members may be public'],
            ['Tax Treatment',         '✅ Same (pass-through)',           '✅ Disregarded entity by default'],
            ['Mortgage Financing',    '✅ Conventional rates',            '⚠️ May need portfolio/commercial loan (higher rate)'],
            ['Ease of Setup',         '✅ None required',                 '⚠️ Filing, EIN, separate bank account'],
            ['Annual Cost',           '✅ $0',                            `❌ ${fmt(calc.totalAnnualCost)}/yr`],
            ['Multiple Properties',  '❌ All in one basket',             separateLLCs ? '✅ Isolated per property' : '⚠️ All in one LLC'],
          ].map(([feature, personal, llc]) => (
            <div key={feature} className="grid grid-cols-3 gap-2 px-4 py-2.5 text-xs">
              <p className="text-slate-400 font-semibold">{feature}</p>
              <p className="text-slate-400">{personal}</p>
              <p className="text-slate-400">{llc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Key tips */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Structuring Tips</p>
        <div className="space-y-1.5 text-xs text-slate-400">
          {[
            '🏢 Single-member LLC = disregarded entity for federal taxes. File Schedule E exactly as before — no extra forms.',
            '📋 Always open a dedicated bank account and never commingle personal funds — "piercing the veil" destroys your protection.',
            '🔁 If you have multiple properties, consider a "Series LLC" (TX, WY, NV, DE) — one master LLC with sub-series, cheaper than multiple LLCs.',
            '💼 S-corp election only makes sense if you\'re a real estate dealer (not passive investor) and want to reduce SE tax on earned income.',
            '🏠 Existing-mortgage properties: use a land trust with a beneficiary change instead of direct LLC title to avoid triggering due-on-sale.',
            '📍 Form the LLC in your property\'s state — Wyoming/Delaware LLCs sound good but require a foreign registration in your home state anyway.',
            '🛡️ LLC + umbrella insurance is the gold standard. Neither alone is as strong as both together.',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        This analysis is educational only. Consult a real estate attorney and CPA before forming an LLC —
        state laws, mortgage terms, and your specific situation all affect the decision.
      </p>
    </div>
  )
}
