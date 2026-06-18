import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line, Legend } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}
function fmtPsf(n: number) {
  return '$' + n.toFixed(2) + '/sf'
}

type PropType     = 'office' | 'retail' | 'industrial' | 'mixed' | 'strip'
type LeaseType    = 'nnn' | 'gross' | 'modified'
type TenantCredit = 'national' | 'regional' | 'local' | 'startup'

const PROP_CAPS: Record<PropType, { low: number; high: number; label: string }> = {
  office:    { low: 6.0,  high: 8.5,  label: 'Office' },
  retail:    { low: 5.5,  high: 7.5,  label: 'Retail / Strip' },
  industrial:{ low: 4.5,  high: 6.5,  label: 'Industrial / Warehouse' },
  mixed:     { low: 5.5,  high: 7.0,  label: 'Mixed-Use' },
  strip:     { low: 6.0,  high: 8.0,  label: 'Strip Center' },
}

const TENANT_RISK: Record<TenantCredit, { label: string; vacancyAdj: number; capAdj: number }> = {
  national: { label: 'National / Credit Tenant', vacancyAdj: 0.02, capAdj: -0.5 },
  regional: { label: 'Regional Chain',            vacancyAdj: 0.04, capAdj:  0.0 },
  local:    { label: 'Local Business',            vacancyAdj: 0.08, capAdj:  0.5 },
  startup:  { label: 'Startup / Unproven',        vacancyAdj: 0.15, capAdj:  1.5 },
}

export default function CRECalc() {
  const [purchasePrice,   setPurchasePrice]   = useState(2000000)
  const [sqft,            setSqft]            = useState(8000)
  const [propType,        setPropType]        = useState<PropType>('retail')
  const [leaseType,       setLeaseType]       = useState<LeaseType>('nnn')
  const [tenantCredit,    setTenantCredit]    = useState<TenantCredit>('regional')
  const [leaseRatePsf,    setLeaseRatePsf]    = useState(22)       // $ per sf per year
  const [occupancy,       setOccupancy]       = useState(90)       // %
  const [leaseYearsLeft,  setLeaseYearsLeft]  = useState(5)
  const [annualEscalation,setAnnualEscalation] = useState(2.5)    // % rent escalation
  const [opexPsf,         setOpexPsf]         = useState(4)        // operating expenses (landlord's) per sf
  const [capexReserve,    setCapexReserve]    = useState(0.50)     // $ per sf per yr reserve
  const [downPct,         setDownPct]         = useState(30)       // %
  const [interestRate,    setInterestRate]    = useState(7.5)      // CRE rates higher
  const [amortYears,      setAmortYears]      = useState(25)       // typical 25-yr amortization
  const [balloonYears,    setBalloonYears]    = useState(10)       // balloon due in 10 years
  const [exitCapRate,     setExitCapRate]     = useState(7.0)      // cap rate at exit

  const calc = useMemo(() => {
    const grossAnnualRent  = leaseRatePsf * sqft
    const effectiveRent    = grossAnnualRent * occupancy / 100
    const vacancyLoss      = grossAnnualRent * (1 - occupancy / 100)

    // Landlord expenses vary by lease type
    const landlordOpex = leaseType === 'nnn'
      ? 0                               // tenant pays everything in NNN
      : leaseType === 'gross'
        ? opexPsf * sqft               // landlord pays everything in gross
        : opexPsf * sqft * 0.3         // modified gross: landlord pays some
    const capexAnnual  = capexReserve * sqft
    const totalOpex    = landlordOpex + capexAnnual
    const noi          = effectiveRent - totalOpex

    // Valuation
    const capRateMarket = (PROP_CAPS[propType].low + PROP_CAPS[propType].high) / 2 + TENANT_RISK[tenantCredit].capAdj
    const impliedCapRate = purchasePrice > 0 ? noi / purchasePrice * 100 : 0
    const marketValue   = capRateMarket > 0 ? noi / (capRateMarket / 100) : 0

    // Financing
    const downPayment  = purchasePrice * downPct / 100
    const loanAmount   = purchasePrice - downPayment
    const r            = interestRate / 100 / 12
    const termMonths   = amortYears * 12
    const monthlyPI    = loanAmount * (r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1)
    const annualDebt   = monthlyPI * 12
    const dscr         = annualDebt > 0 ? noi / annualDebt : 0

    // Balloon balance
    const balloonMonths = balloonYears * 12
    const balloonBalance = loanAmount * Math.pow(1 + r, balloonMonths) - monthlyPI * (Math.pow(1 + r, balloonMonths) - 1) / r

    // Cash flow
    const cashFlow     = noi - annualDebt
    const cocReturn    = downPayment > 0 ? cashFlow / downPayment * 100 : 0
    const cocReturn10  = downPayment > 0 ? (cashFlow * Math.pow(1 + annualEscalation / 100, 5)) / downPayment * 100 : 0

    // Per SF metrics
    const noimPsf      = noi / sqft
    const pricePsf     = purchasePrice / sqft
    const rentPsf      = effectiveRent / sqft

    // DSCR adequacy check
    const dscrStatus   = dscr >= 1.25 ? 'ok' : dscr >= 1.10 ? 'tight' : 'fail'
    const dscrColor    = dscr >= 1.25 ? 'text-green-400' : dscr >= 1.10 ? 'text-yellow-400' : 'text-red-400'

    // Exit analysis (sell at year 10 at exitCapRate)
    const yr10noi      = noi * Math.pow(1 + annualEscalation / 100, 10)
    const exitValue    = yr10noi / (exitCapRate / 100)
    const exitEquity   = exitValue - balloonBalance
    const totalCashFlow10 = Array.from({ length: 10 }, (_, y) =>
      (noi * Math.pow(1 + annualEscalation / 100, y)) - annualDebt
    ).reduce((s, v) => s + v, 0)
    const totalReturn10 = exitEquity + totalCashFlow10
    const em10         = downPayment > 0 ? (totalReturn10 + downPayment) / downPayment : 0

    // Rent escalation chart
    const rentChart = Array.from({ length: 11 }, (_, yr) => ({
      yr,
      Rent:  Math.round(effectiveRent * Math.pow(1 + annualEscalation / 100, yr)),
      NOI:   Math.round(noi * Math.pow(1 + annualEscalation / 100, yr)),
      CF:    Math.round((noi * Math.pow(1 + annualEscalation / 100, yr)) - annualDebt),
    }))

    return {
      grossAnnualRent, effectiveRent, vacancyLoss, landlordOpex, capexAnnual, totalOpex, noi,
      capRateMarket, impliedCapRate, marketValue,
      downPayment, loanAmount, monthlyPI, annualDebt, dscr, balloonBalance,
      cashFlow, cocReturn, cocReturn10, noimPsf, pricePsf, rentPsf,
      dscrStatus, dscrColor, yr10noi, exitValue, exitEquity, totalCashFlow10, totalReturn10, em10,
      rentChart,
    }
  }, [purchasePrice, sqft, propType, leaseType, tenantCredit, leaseRatePsf, occupancy,
      leaseYearsLeft, annualEscalation, opexPsf, capexReserve, downPct, interestRate,
      amortYears, balloonYears, exitCapRate])

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

  const leaseTypeDesc: Record<LeaseType, string> = {
    nnn:      'NNN (Triple Net): Tenant pays base rent + property taxes + insurance + maintenance',
    gross:    'Gross Lease: Tenant pays flat rent, landlord covers all operating expenses',
    modified: 'Modified Gross: Costs split between landlord and tenant by negotiation',
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Commercial Real Estate Analyzer</h3>
        <p className="text-xs text-slate-500">
          Analyze commercial properties — office, retail, industrial, or mixed-use. Model NNN/gross leases,
          DSCR underwriting, balloon payments, and 10-year returns.
        </p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Property</p>
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-xs text-slate-400">Purchase Price</label>
              <span className="text-xs font-bold text-blue-400">{fmt(purchasePrice)}</span>
            </div>
            <input type="range" min={200000} max={20000000} step={100000} value={purchasePrice}
              onChange={e => setPurchasePrice(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
          </div>
          <Slider label="Square Footage" value={sqft} min={500} max={100000} step={500} onChange={setSqft} suffix=" sf" />
          <div>
            <label className="text-xs text-slate-400">Property Type</label>
            <div className="grid grid-cols-3 gap-1 mt-1">
              {(Object.entries(PROP_CAPS) as [PropType, typeof PROP_CAPS[PropType]][]).map(([k, v]) => (
                <button key={k} onClick={() => setPropType(k)}
                  className={`py-1.5 rounded-lg text-xs font-bold transition ${propType === k ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                  {v.label.split('/')[0].trim()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400">Lease Type</label>
            <div className="grid grid-cols-3 gap-1 mt-1">
              {(['nnn', 'gross', 'modified'] as LeaseType[]).map(t => (
                <button key={t} onClick={() => setLeaseType(t)}
                  className={`py-1.5 rounded-lg text-xs font-bold uppercase transition ${leaseType === t ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                  {t}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-1">{leaseTypeDesc[leaseType]}</p>
          </div>
          <div>
            <label className="text-xs text-slate-400">Tenant Credit Quality</label>
            <select value={tenantCredit} onChange={e => setTenantCredit(e.target.value as TenantCredit)}
              className="mt-1 w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200">
              {(Object.entries(TENANT_RISK) as [TenantCredit, typeof TENANT_RISK[TenantCredit]][]).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Income & Financing</p>
          <Slider label="Base Rent ($/sf/yr)" value={leaseRatePsf} min={5} max={100} step={0.50} onChange={setLeaseRatePsf} prefix="$" suffix="/sf" />
          <Slider label="Occupancy" value={occupancy} min={50} max={100} step={1} onChange={setOccupancy} suffix="%" />
          <Slider label="Annual Rent Escalation" value={annualEscalation} min={0} max={5} step={0.25} onChange={setAnnualEscalation} suffix="%" />
          {leaseType !== 'nnn' && (
            <Slider label="Landlord OpEx ($/sf/yr)" value={opexPsf} min={0} max={20} step={0.25} onChange={setOpexPsf} prefix="$" suffix="/sf" />
          )}
          <Slider label="CapEx Reserve ($/sf/yr)" value={capexReserve} min={0} max={3} step={0.10} onChange={setCapexReserve} prefix="$" suffix="/sf" />
          <Slider label="Down Payment" value={downPct} min={20} max={50} step={5} onChange={setDownPct} suffix="%" />
          <Slider label="Loan Rate" value={interestRate} min={5} max={12} step={0.125} onChange={setInterestRate} suffix="%" />
          <Slider label="Amortization" value={amortYears} min={15} max={30} step={5} onChange={setAmortYears} suffix=" yrs" />
          <Slider label="Balloon Due" value={balloonYears} min={3} max={15} step={1} onChange={setBalloonYears} suffix=" yrs" />
          <Slider label="Exit Cap Rate (yr 10)" value={exitCapRate} min={4} max={12} step={0.25} onChange={setExitCapRate} suffix="%" />
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Effective Gross Income', val: fmt(calc.effectiveRent),      color: 'text-green-400' },
          { label: 'NOI',                    val: fmt(calc.noi),                color: 'text-blue-400' },
          { label: 'Implied Cap Rate',       val: calc.impliedCapRate.toFixed(2) + '%', color: calc.impliedCapRate >= PROP_CAPS[propType].low && calc.impliedCapRate <= PROP_CAPS[propType].high ? 'text-green-400' : 'text-yellow-400' },
          { label: 'Market Cap Rate',        val: calc.capRateMarket.toFixed(1) + '%', color: 'text-slate-300' },
          { label: 'DSCR',                   val: calc.dscr.toFixed(2) + 'x',  color: calc.dscrColor },
          { label: 'Annual Cash Flow',       val: fmt(calc.cashFlow),           color: calc.cashFlow >= 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'Cash-on-Cash',           val: calc.cocReturn.toFixed(1) + '%', color: calc.cocReturn >= 8 ? 'text-green-400' : 'text-yellow-400' },
          { label: 'Balloon Balance',        val: fmt(calc.balloonBalance),     color: 'text-orange-400' },
          { label: 'Price / SF',             val: fmtPsf(calc.pricePsf),        color: 'text-slate-300' },
          { label: 'NOI / SF',              val: fmtPsf(calc.noimPsf),          color: 'text-blue-400' },
          { label: '10-yr Exit Value',      val: fmt(calc.exitValue),           color: 'text-purple-400' },
          { label: '10-yr Equity Multiple', val: calc.em10.toFixed(2) + 'x',    color: calc.em10 >= 2 ? 'text-green-400' : 'text-yellow-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className={`text-base font-black ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* DSCR warning */}
      {calc.dscr < 1.25 && (
        <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-4">
          <p className="text-xs font-bold text-red-400 mb-1">⚠️ DSCR Below Lender Minimum</p>
          <p className="text-xs text-slate-400">
            DSCR of <strong className="text-white">{calc.dscr.toFixed(2)}x</strong> is below the typical 1.25x minimum most commercial lenders require.
            Consider: increasing rent, reducing the purchase price, or adding a larger down payment.
            <br />Need to reach {fmt(calc.annualDebt * 1.25)} NOI (currently {fmt(calc.noi)}) — gap: {fmt(calc.annualDebt * 1.25 - calc.noi)}.
          </p>
        </div>
      )}

      {/* NOI chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">10-Year Rent & NOI Growth</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={calc.rentChart} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="yr" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} label={{ value: 'Year', position: 'insideBottom', fill: '#475569', fontSize: 10 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
            <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
              formatter={(v: number) => [fmt(v)]} />
            <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
            <Line type="monotone" dataKey="Rent"  stroke="#3b82f6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="NOI"   stroke="#10b981" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="CF"    stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* P&L summary */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">CRE Pro Forma (Year 1)</p>
        <div className="space-y-1 text-xs">
          {[
            { label: 'Gross Potential Rent',        val: fmt(calc.grossAnnualRent),   color: 'text-green-400' },
            { label: `  – Vacancy (${100 - occupancy}%)`, val: `-${fmt(calc.vacancyLoss)}`,  color: 'text-red-400' },
            { label: 'Effective Gross Income',      val: fmt(calc.effectiveRent),     color: 'text-slate-200', bold: true },
            { label: `  – Landlord OpEx (${leaseType.toUpperCase()})`, val: `-${fmt(calc.landlordOpex)}`, color: 'text-slate-400' },
            { label: '  – CapEx Reserve',           val: `-${fmt(calc.capexAnnual)}`, color: 'text-slate-400' },
            { label: 'Net Operating Income',        val: fmt(calc.noi),               color: 'text-blue-400', bold: true },
            { label: '  – Annual Debt Service',     val: `-${fmt(calc.annualDebt)}`,  color: 'text-slate-400' },
            { label: 'Cash Flow Before Tax',        val: fmt(calc.cashFlow),          color: calc.cashFlow >= 0 ? 'text-green-400' : 'text-red-400', bold: true },
          ].map(r => (
            <div key={r.label} className="flex justify-between py-1 border-b border-slate-700/30">
              <span className="text-slate-400">{r.label}</span>
              <span className={`${r.bold ? 'font-black' : 'font-semibold'} ${r.color}`}>{r.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CRE tips */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Commercial RE Fundamentals</p>
        <div className="space-y-1.5 text-xs text-slate-400">
          {[
            '📋 NNN leases: tenant pays base rent PLUS property taxes, insurance, and maintenance. Lower risk for landlord, lower yield.',
            '🏢 Typical CRE cap rates: industrial 4-6%, retail 5-8%, office 6-9%. Higher cap = higher risk = more NOI per dollar invested.',
            '🏦 Commercial loans: higher rates, 25-yr amortization, 5-10 yr balloon. Underwriting is NOI-based (DSCR), not income-based.',
            '📊 DSCR ≥ 1.25x is the standard. Some lenders require 1.30x. DSCR < 1.10x and the deal won\'t finance.',
            '🔄 Lease rollover risk: what happens when the tenant\'s lease expires? Account for 6-12 months of TI allowances and free rent.',
            '🧾 Tenant Improvement (TI) allowances: landlord typically pays $30-80/sf for tenant buildout — a major upfront cost.',
            '🏗 Value-add CRE: buy below market cap rate, improve NOI via rent increases/leasing up vacant space, sell at lower exit cap.',
            '💡 Balloon risk: have a plan for the balloon payment. Refinance risk is real — don\'t assume rates will be favorable in 10 years.',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
