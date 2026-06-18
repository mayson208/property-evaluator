import { useState, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts'

type Perspective = 'seller' | 'buyer'
type LeaseType = 'nnn' | 'gross' | 'modified'

interface Inputs {
  perspective: Perspective
  propertyValue: number
  adjustedBasis: number
  depreciationTaken: number
  leaseType: LeaseType
  annualRent: number
  leaseTermYears: number
  annualEscalations: number
  renewalOptions: number
  renewalRentBump: number
  buyerCapRate: number
  buyerFinancingRate: number
  buyerLTV: number
  tenantCreditRating: 'investment' | 'subInvestment' | 'private'
  sellerTaxRate: number
  alternativeCapitalCost: number
  leaseVsOwnCOC: number
}

const DEF: Inputs = {
  perspective: 'seller',
  propertyValue: 3500000,
  adjustedBasis: 1200000,
  depreciationTaken: 350000,
  leaseType: 'nnn',
  annualRent: 227500,
  leaseTermYears: 15,
  annualEscalations: 2,
  renewalOptions: 4,
  renewalRentBump: 10,
  buyerCapRate: 6.5,
  buyerFinancingRate: 6.75,
  buyerLTV: 65,
  tenantCreditRating: 'investment',
  sellerTaxRate: 23.8,
  alternativeCapitalCost: 8,
  leaseVsOwnCOC: 1.2,
}

const LEASE_LABELS: Record<LeaseType, string> = { nnn: 'Triple-Net (NNN)', gross: 'Gross Lease', modified: 'Modified Gross' }
const CREDIT_ADJUSTMENTS: Record<string, number> = { investment: 0, subInvestment: 0.5, private: 1.0 }

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const pct = (n: number) => `${n.toFixed(2)}%`
const N = (v: string) => parseFloat(v) || 0

export default function SaleLeasebackCalc() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = (k: keyof Inputs, v: string | Perspective | LeaseType | 'investment' | 'subInvestment' | 'private') =>
    setInp(p => ({ ...p, [k]: typeof DEF[k] === 'number' ? N(v as string) : v }))

  const calc = useMemo(() => {
    const { propertyValue, adjustedBasis, depreciationTaken, leaseType, annualRent,
            leaseTermYears, annualEscalations, renewalOptions, renewalRentBump,
            buyerCapRate, buyerFinancingRate, buyerLTV, tenantCreditRating,
            sellerTaxRate, alternativeCapitalCost } = inp

    // ---- SELLER ANALYSIS ----
    const gain = propertyValue - adjustedBasis
    const recaptureGain = depreciationTaken
    const ltcgGain = Math.max(0, gain - recaptureGain)
    const taxOnSale = ltcgGain * sellerTaxRate / 100 + recaptureGain * 0.25
    const netProceeds = propertyValue - taxOnSale

    // Present value of leases (cost to seller)
    const discountRate = alternativeCapitalCost / 100
    let pvLeases = 0
    let cumulativeRent = 0
    for (let y = 1; y <= leaseTermYears; y++) {
      const yearRent = annualRent * Math.pow(1 + annualEscalations / 100, y - 1)
      pvLeases += yearRent / Math.pow(1 + discountRate, y)
      cumulativeRent += yearRent
    }

    // Renewal periods
    let cumulativeRentWithRenewals = cumulativeRent
    let pvLeasesWithRenewals = pvLeases
    const renewalTermYears = 5
    for (let r = 0; r < renewalOptions; r++) {
      const startYear = leaseTermYears + r * renewalTermYears
      const renewalBaseRent = annualRent * Math.pow(1 + annualEscalations / 100, leaseTermYears - 1) * Math.pow(1 + renewalRentBump / 100, r)
      for (let y = 1; y <= renewalTermYears; y++) {
        const yearRent = renewalBaseRent * Math.pow(1 + annualEscalations / 100, y - 1)
        pvLeasesWithRenewals += yearRent / Math.pow(1 + discountRate, startYear + y)
        cumulativeRentWithRenewals += yearRent
      }
    }

    // Cost of occupancy comparison
    const mortgageR = buyerFinancingRate / 100 / 12
    const n2 = 25 * 12
    const ownedLoan = propertyValue * 0.75
    const monthlyMortgage = ownedLoan * mortgageR / (1 - Math.pow(1 + mortgageR, -n2))
    const annualOwnershipCost = monthlyMortgage * 12 + propertyValue * 0.02 // mortgage + maint
    const annualLeaseRent = annualRent

    const netProceedsReturnOnCapital = netProceeds * alternativeCapitalCost / 100

    // Net cost of leaseback = rent - opportunity income from deployed capital
    const annualNetLeaseCost = annualRent - netProceedsReturnOnCapital

    // ---- BUYER ANALYSIS ----
    const capRateAdj = buyerCapRate + CREDIT_ADJUSTMENTS[tenantCreditRating]
    const impliedValue = annualRent / (capRateAdj / 100)
    const priceDiff = propertyValue - impliedValue

    const loanAmount = propertyValue * buyerLTV / 100
    const equity = propertyValue - loanAmount
    const annualDebt = loanAmount * buyerFinancingRate / 100
    const noi = leaseType === 'nnn' ? annualRent : annualRent * 0.75
    const cashFlow = noi - annualDebt
    const cocReturn = cashFlow / equity * 100
    const dscr = noi / annualDebt

    // 10-year model
    const yearData = Array.from({ length: leaseTermYears + 1 }, (_, y) => {
      const rent = annualRent * Math.pow(1 + annualEscalations / 100, y)
      const noi2 = leaseType === 'nnn' ? rent : rent * 0.75
      const cf = noi2 - annualDebt
      const propVal = propertyValue * Math.pow(1 + (buyerCapRate > 6 ? 2.5 : 3.5) / 100, y)
      return {
        year: y,
        rent: rent,
        cashFlow: cf,
        propertyValue: propVal,
        sellerCapitalGrowth: netProceeds * Math.pow(1 + alternativeCapitalCost / 100, y),
      }
    })

    return {
      gain, recaptureGain, ltcgGain, taxOnSale, netProceeds,
      pvLeases, pvLeasesWithRenewals, cumulativeRent, cumulativeRentWithRenewals,
      annualOwnershipCost, annualLeaseRent, netProceedsReturnOnCapital, annualNetLeaseCost,
      capRateAdj, impliedValue, priceDiff, loanAmount, equity,
      annualDebt, noi, cashFlow, cocReturn, dscr, yearData,
    }
  }, [inp])

  const field = (label: string, key: keyof Inputs, prefix = '', suffix = '', step = '1') => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{prefix}</span>}
        <input type="number" step={step} value={inp[key] as number} onChange={e => set(key, e.target.value)}
          className={`w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 ${prefix ? 'pl-5 pr-3' : suffix ? 'pl-3 pr-7' : 'px-3'}`} />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{suffix}</span>}
      </div>
    </div>
  )

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-lg font-bold text-white">Sale-Leaseback Analyzer</h2>
        <p className="text-slate-400 text-xs mt-1">Analyze sale-leaseback transactions from both seller (capital unlock) and buyer (NNN income) perspectives</p>
      </div>

      {/* Perspective Toggle */}
      <div className="flex gap-2">
        {(['seller', 'buyer'] as Perspective[]).map(p => (
          <button key={p} onClick={() => set('perspective', p)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold border capitalize transition ${inp.perspective === p ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
            {p === 'seller' ? '🏢 Seller (Operating Business)' : '🏦 Buyer (Net Lease Investor)'}
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Property &amp; Transaction</p>
          {field('Property Sale Price', 'propertyValue', '$')}
          {field('Adjusted Basis', 'adjustedBasis', '$')}
          {field('Depreciation Taken', 'depreciationTaken', '$')}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Lease Type</label>
            <select value={inp.leaseType} onChange={e => set('leaseType', e.target.value as LeaseType)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
              {Object.entries(LEASE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Tenant Credit</label>
            <select value={inp.tenantCreditRating} onChange={e => set('tenantCreditRating', e.target.value as 'investment' | 'subInvestment' | 'private')}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
              <option value="investment">Investment Grade (IG)</option>
              <option value="subInvestment">Sub-Investment Grade</option>
              <option value="private">Private / Unrated</option>
            </select>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Lease Terms</p>
          {field('Annual Base Rent', 'annualRent', '$')}
          {field('Lease Term', 'leaseTermYears', '', 'years')}
          {field('Annual Escalations', 'annualEscalations', '', '%', '0.5')}
          {field('Renewal Options', 'renewalOptions', '', 'options')}
          {field('Rent Bump at Each Renewal', 'renewalRentBump', '', '%')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Initial Cap Rate (Seller)</span><span className="text-blue-400 font-bold">{pct(inp.annualRent / inp.propertyValue * 100)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">10-Year Cumulative Rent</span><span className="text-slate-200">{fmt(calc.cumulativeRent)}</span></div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Buyer &amp; Seller Rates</p>
          {field('Buyer Cap Rate Target', 'buyerCapRate', '', '%', '0.25')}
          {field('Buyer Financing Rate', 'buyerFinancingRate', '', '%', '0.125')}
          {field('Buyer LTV', 'buyerLTV', '', '%')}
          {field('Seller Tax Rate', 'sellerTaxRate', '', '%', '0.1')}
          {field('Alt. Capital Return', 'alternativeCapitalCost', '', '%/yr', '0.5')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Tax on Sale</span><span className="text-red-400">{fmt(calc.taxOnSale)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Net Proceeds</span><span className="text-green-400 font-bold">{fmt(calc.netProceeds)}</span></div>
          </div>
        </div>
      </div>

      {/* Results by perspective */}
      {inp.perspective === 'seller' ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Net Proceeds Deployed', value: fmt(calc.netProceeds), color: 'text-green-400', sub: 'After taxes on gain' },
            { label: 'Annual Alt. Return', value: fmt(calc.netProceedsReturnOnCapital), color: 'text-blue-400', sub: `At ${inp.alternativeCapitalCost}% invested` },
            { label: 'Net Annual Rent Cost', value: fmt(calc.annualNetLeaseCost), color: calc.annualNetLeaseCost > 0 ? 'text-orange-400' : 'text-green-400', sub: 'Rent minus opportunity cost' },
            { label: 'PV of All Lease Payments', value: fmt(calc.pvLeasesWithRenewals), color: 'text-purple-400', sub: `w/ ${inp.renewalOptions} renewals` },
          ].map(c => (
            <div key={c.label} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center">
              <p className={`text-xl font-black ${c.color}`}>{c.value}</p>
              <p className="text-xs text-slate-300 mt-1">{c.label}</p>
              <p className="text-xs text-slate-500">{c.sub}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Cap Rate (adj for credit)', value: pct(calc.capRateAdj), color: calc.capRateAdj >= inp.buyerCapRate ? 'text-green-400' : 'text-red-400', sub: `+${CREDIT_ADJUSTMENTS[inp.tenantCreditRating]}% credit adj` },
            { label: 'NOI (Year 1)', value: fmt(calc.noi), color: 'text-blue-400', sub: LEASE_LABELS[inp.leaseType] },
            { label: 'Cash Flow', value: fmt(calc.cashFlow), color: calc.cashFlow > 0 ? 'text-green-400' : 'text-red-400', sub: 'After debt service' },
            { label: 'DSCR', value: calc.dscr.toFixed(2) + 'x', color: calc.dscr >= 1.25 ? 'text-green-400' : 'text-red-400', sub: 'Debt Service Coverage' },
          ].map(c => (
            <div key={c.label} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center">
              <p className={`text-xl font-black ${c.color}`}>{c.value}</p>
              <p className="text-xs text-slate-300 mt-1">{c.label}</p>
              <p className="text-xs text-slate-500">{c.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Rent Escalation Over Lease Term</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={calc.yearData}>
              <defs>
                <linearGradient id="rentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => `Yr ${v}`} />
              <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="rent" stroke="#3b82f6" fill="url(#rentGrad)" strokeWidth={2} name="Annual Rent" />
              {inp.perspective === 'buyer' && <Area type="monotone" dataKey="cashFlow" stroke="#22c55e" fill="none" strokeWidth={2} name="Annual Cash Flow" />}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">
            {inp.perspective === 'seller' ? 'Seller Capital Growth vs Cumulative Rent' : 'Buyer Property Value Over Time'}
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={calc.yearData}>
              <defs>
                <linearGradient id="propGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="capGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={v => `Yr ${v}`} />
              <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {inp.perspective === 'seller' && <Area type="monotone" dataKey="sellerCapitalGrowth" stroke="#a855f7" fill="url(#capGrad)" strokeWidth={2} name="Seller Deployed Capital" />}
              <Area type="monotone" dataKey="propertyValue" stroke="#22c55e" fill="url(#propGrad)" strokeWidth={2} name="Property Value" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Strategy Guide */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-blue-900/20 rounded-xl p-4 border border-blue-700/40">
          <p className="text-xs font-bold text-blue-300 uppercase tracking-widest mb-2">Seller Benefits</p>
          <div className="space-y-1 text-xs text-blue-200/70">
            {['✓ Unlocks trapped equity — converts illiquid real estate to working capital',
              '✓ Removes property from balance sheet — improves financial ratios / leverage',
              '✓ Continues operating from the same location without disruption',
              '✓ Lease payments are fully deductible as operating expenses (vs partial mortgage interest)',
              '✓ Flexibility to exit or relocate at end of lease term if business needs change'].map((t, i) => <p key={i}>{t}</p>)}
          </div>
        </div>
        <div className="bg-green-900/20 rounded-xl p-4 border border-green-700/40">
          <p className="text-xs font-bold text-green-300 uppercase tracking-widest mb-2">Buyer Benefits</p>
          <div className="space-y-1 text-xs text-green-200/70">
            {['✓ Long-term, predictable cash flow with built-in rent escalations',
              '✓ Strong credit tenants — investment-grade leases have minimal management demands',
              '✓ NNN leases: tenant pays taxes, insurance, maintenance — truly passive income',
              '✓ 1031 exchange eligible — reinvest capital gains into net lease product',
              '⚠️ Residual value risk at lease end if tenant vacates — location & building quality critical'].map((t, i) => <p key={i}>{t}</p>)}
          </div>
        </div>
      </div>
    </div>
  )
}
