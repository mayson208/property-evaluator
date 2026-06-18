import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line, AreaChart, Area } from 'recharts'

type LeaseType = 'nnn' | 'gross' | 'modified' | 'fsg'
type BumpType = 'fixed' | 'cpi' | 'stepped' | 'flat'

interface Inputs {
  leaseType: LeaseType
  sqft: number
  baseRentPSF: number
  bumpType: BumpType
  annualBumpPct: number
  leaseTerm: number
  freeRentMonths: number
  tiAllowance: number
  landlordBuildout: number
  landlordCapRate: number
  tenantDiscountRate: number
  camPSF: number
  taxPSF: number
  insurancePSF: number
  mgmtFeePct: number
  renewalOptions: number
  renewalBumpPct: number
  purchaseOption: boolean
  purchaseOptionPricePSF: number
  perspective: 'landlord' | 'tenant'
}

const DEF: Inputs = {
  leaseType: 'nnn',
  sqft: 5000,
  baseRentPSF: 22,
  bumpType: 'fixed',
  annualBumpPct: 3,
  leaseTerm: 5,
  freeRentMonths: 3,
  tiAllowance: 45,
  landlordBuildout: 20,
  landlordCapRate: 7,
  tenantDiscountRate: 8,
  camPSF: 4.5,
  taxPSF: 3.2,
  insurancePSF: 0.8,
  mgmtFeePct: 4,
  renewalOptions: 2,
  renewalBumpPct: 10,
  purchaseOption: false,
  purchaseOptionPricePSF: 250,
  perspective: 'landlord',
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const fmtPSF = (n: number) => `$${n.toFixed(2)}/sqft`
const N = (v: string) => parseFloat(v) || 0

export default function CommercialLease() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = (k: keyof Inputs, v: string | LeaseType | BumpType | boolean | 'landlord' | 'tenant') =>
    setInp(p => ({ ...p, [k]: typeof DEF[k] === 'number' ? N(v as string) : v }))

  const calc = useMemo(() => {
    const {
      leaseType, sqft, baseRentPSF, bumpType, annualBumpPct, leaseTerm,
      freeRentMonths, tiAllowance, landlordBuildout, landlordCapRate, tenantDiscountRate,
      camPSF, taxPSF, insurancePSF, mgmtFeePct, renewalOptions, renewalBumpPct,
      purchaseOption, purchaseOptionPricePSF,
    } = inp

    // NNN: tenant pays CAM/tax/insurance on top of base rent
    // Gross: landlord pays all operating costs
    // Modified: split expenses
    const nnnExpensesPSF = camPSF + taxPSF + insurancePSF
    const landlordExpensesPSF = leaseType === 'gross' ? nnnExpensesPSF : leaseType === 'modified' ? nnnExpensesPSF * 0.5 : 0
    const tenantExpensesPSF = leaseType === 'nnn' ? nnnExpensesPSF : leaseType === 'modified' ? nnnExpensesPSF * 0.5 : 0

    // Annual rent schedule
    const yearlyData = Array.from({ length: leaseTerm }, (_, i) => {
      const y = i + 1
      let rentPSF = baseRentPSF
      if (bumpType === 'fixed' || bumpType === 'cpi') rentPSF = baseRentPSF * Math.pow(1 + annualBumpPct / 100, i)
      else if (bumpType === 'stepped') rentPSF = baseRentPSF + (baseRentPSF * annualBumpPct / 100) * i
      // 'flat': no change

      const annualBaseRent = rentPSF * sqft
      const freeRentCredit = y === 1 ? freeRentMonths * (baseRentPSF * sqft / 12) : 0
      const effectiveAnnualBase = annualBaseRent - freeRentCredit

      const grossRent = rentPSF * sqft  // what tenant pays for space
      const nnnPassThroughs = tenantExpensesPSF * sqft
      const tenantTotalCost = grossRent + nnnPassThroughs - freeRentCredit

      const landlordGross = effectiveAnnualBase + landlordExpensesPSF * sqft
      const landlordOwnExpenses = leaseType === 'gross' ? nnnExpensesPSF * sqft : leaseType === 'modified' ? nnnExpensesPSF * 0.5 * sqft : 0
      const mgmtFee = effectiveAnnualBase * mgmtFeePct / 100
      const landlordNOI = effectiveAnnualBase - landlordOwnExpenses - mgmtFee

      return {
        year: `Yr ${y}`,
        rentPSF: parseFloat(rentPSF.toFixed(2)),
        annualBaseRent: Math.round(annualBaseRent),
        freeRentCredit: Math.round(freeRentCredit),
        effectiveBase: Math.round(effectiveAnnualBase),
        tenantTotal: Math.round(tenantTotalCost),
        landlordNOI: Math.round(landlordNOI),
        nnnPassThroughs: Math.round(nnnPassThroughs),
      }
    })

    const totalBaseRent = yearlyData.reduce((s, y) => s + y.annualBaseRent, 0)
    const totalFreeRent = yearlyData.reduce((s, y) => s + y.freeRentCredit, 0)
    const totalEffectiveBase = yearlyData.reduce((s, y) => s + y.effectiveBase, 0)
    const totalTenantCost = yearlyData.reduce((s, y) => s + y.tenantTotal, 0)
    const totalLandlordNOI = yearlyData.reduce((s, y) => s + y.landlordNOI, 0)

    const tiCost = tiAllowance * sqft
    const buildoutCost = landlordBuildout * sqft
    const landlordUpfrontCost = tiCost + buildoutCost

    // Effective rent (accounting for TI and free rent — amortized over term)
    const effectiveRentPSF = leaseTerm > 0 ? (totalEffectiveBase - landlordUpfrontCost) / (sqft * leaseTerm) : 0
    const tenantEffectivePSF = sqft > 0 && leaseTerm > 0 ? totalTenantCost / (sqft * leaseTerm) : 0

    // Landlord PV of lease
    let landlordPV = -landlordUpfrontCost
    yearlyData.forEach((row, i) => {
      landlordPV += row.landlordNOI / Math.pow(1 + landlordCapRate / 100, i + 1)
    })

    // Tenant PV of total occupancy cost
    let tenantPV = 0
    yearlyData.forEach((row, i) => {
      tenantPV += row.tenantTotal / Math.pow(1 + tenantDiscountRate / 100, i + 1)
    })
    tenantPV += tiCost // tenant "receives" TI as benefit
    const tenantNetPV = tenantPV - tiCost

    // Capitalized value of landlord income stream
    const avgNOI = totalLandlordNOI / leaseTerm
    const impliedPropertyValue = landlordCapRate > 0 ? avgNOI / (landlordCapRate / 100) : 0

    // Purchase option
    const purchaseOptionValue = purchaseOption ? purchaseOptionPricePSF * sqft : 0

    // Renewal scenario
    const renewalRentPSF = baseRentPSF * Math.pow(1 + annualBumpPct / 100, leaseTerm - 1) * (1 + renewalBumpPct / 100)

    return {
      nnnExpensesPSF, landlordExpensesPSF, tenantExpensesPSF,
      yearlyData, totalBaseRent, totalFreeRent, totalEffectiveBase,
      totalTenantCost, totalLandlordNOI,
      tiCost, buildoutCost, landlordUpfrontCost,
      effectiveRentPSF, tenantEffectivePSF,
      landlordPV, tenantPV, tenantNetPV,
      avgNOI, impliedPropertyValue, purchaseOptionValue, renewalRentPSF,
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

  const leaseLabels: Record<LeaseType, string> = { nnn: 'Triple-Net (NNN)', gross: 'Full Service Gross', modified: 'Modified Gross', fsg: 'Full Service Gross' }

  return (
    <div className="space-y-6 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Commercial Lease Analyzer</h2>
          <p className="text-slate-400 text-xs mt-1">NNN/Gross/Modified lease — effective rent, TI, CAM reconciliation, PV of lease stream, renewal options</p>
        </div>
        <div className="flex gap-2">
          {(['landlord', 'tenant'] as const).map(p => (
            <button key={p} onClick={() => set('perspective', p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition capitalize ${inp.perspective === p ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Lease Terms */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Lease Terms</p>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Lease Structure</label>
            <select value={inp.leaseType} onChange={e => set('leaseType', e.target.value as LeaseType)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
              <option value="nnn">Triple-Net (NNN) — tenant pays CAM/tax/ins</option>
              <option value="gross">Gross — landlord pays all operating costs</option>
              <option value="modified">Modified Gross — split operating costs</option>
            </select>
          </div>
          {field('Rentable Sqft', 'sqft', 'sqft', '', '100')}
          {field('Base Rent', 'baseRentPSF', '/sqft/yr', '$')}
          {field('Lease Term', 'leaseTerm', 'yr', '', '1')}
          {field('Free Rent (abatement)', 'freeRentMonths', 'mo', '', '1')}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Rent Bump Type</label>
            <select value={inp.bumpType} onChange={e => set('bumpType', e.target.value as BumpType)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
              <option value="fixed">Fixed % Annually</option>
              <option value="cpi">CPI-Linked</option>
              <option value="stepped">Stepped (flat per year)</option>
              <option value="flat">Flat (no bumps)</option>
            </select>
          </div>
          {inp.bumpType !== 'flat' && field('Annual Bump %', 'annualBumpPct', '%')}
        </div>

        {/* TI & Expenses */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">TI & Operating Costs</p>
          {field('TI Allowance (landlord pays)', 'tiAllowance', '/sqft', '$')}
          {field('Additional Landlord Buildout', 'landlordBuildout', '/sqft', '$')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Total TI Cost</span><span className="text-red-400">{fmt(calc.tiCost)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Total Buildout Cost</span><span className="text-red-400">{fmt(calc.buildoutCost)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Total Landlord Upfront</span><span className="text-red-400 font-bold">{fmt(calc.landlordUpfrontCost)}</span></div>
          </div>
          <hr className="border-slate-700" />
          <p className="text-xs text-slate-400 font-semibold">Operating Expenses (NNN pass-throughs)</p>
          {field('CAM / sqft / yr', 'camPSF', '/sqft', '$')}
          {field('Property Tax / sqft / yr', 'taxPSF', '/sqft', '$')}
          {field('Insurance / sqft / yr', 'insurancePSF', '/sqft', '$')}
          {field('Mgmt Fee (on base rent)', 'mgmtFeePct', '%')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Total NNN / sqft / yr</span><span className="text-orange-400 font-bold">{fmtPSF(calc.nnnExpensesPSF)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Tenant pays</span><span className="text-slate-300">{fmtPSF(calc.tenantExpensesPSF)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Landlord pays</span><span className="text-slate-300">{fmtPSF(calc.landlordExpensesPSF)}</span></div>
          </div>
        </div>

        {/* Options & Valuation */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Options & Valuation</p>
          {field('Renewal Options (count)', 'renewalOptions', '', '', '1')}
          {field('Renewal Bump at Exercise', 'renewalBumpPct', '% above last yr')}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Purchase Option</span>
            <button onClick={() => set('purchaseOption', !inp.purchaseOption)}
              className={`w-11 h-6 rounded-full transition-colors ${inp.purchaseOption ? 'bg-green-500' : 'bg-slate-700'}`}>
              <div className={`w-4 h-4 bg-white rounded-full mx-1 transition-transform ${inp.purchaseOption ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          {inp.purchaseOption && field('Purchase Option Price/sqft', 'purchaseOptionPricePSF', '/sqft', '$')}
          {field('Landlord Cap Rate', 'landlordCapRate', '%')}
          {field('Tenant Discount Rate', 'tenantDiscountRate', '%')}
          <div className="p-3 bg-slate-900/50 rounded-lg text-xs space-y-1.5">
            <div className="flex justify-between"><span className="text-slate-400">Implied Property Value</span><span className="text-blue-400 font-bold">{fmt(calc.impliedPropertyValue)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">PV of Landlord NOI</span><span className={calc.landlordPV > 0 ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>{fmt(calc.landlordPV)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Tenant Occ. Cost PV</span><span className="text-orange-400">{fmt(calc.tenantNetPV)}</span></div>
            {inp.purchaseOption && <div className="flex justify-between"><span className="text-slate-400">Purchase Option Value</span><span className="text-purple-400">{fmt(calc.purchaseOptionValue)}</span></div>}
          </div>
          <div className="p-2 bg-blue-900/20 border border-blue-700/30 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-blue-300">Effective Rent (Landlord)</span><span className="text-white font-bold">{fmtPSF(calc.effectiveRentPSF)}/yr</span></div>
            <div className="flex justify-between"><span className="text-blue-300">Effective Cost (Tenant)</span><span className="text-white font-bold">{fmtPSF(calc.tenantEffectivePSF)}/yr</span></div>
            {inp.renewalOptions > 0 && <div className="flex justify-between"><span className="text-blue-300">Renewal Rent at Yr {inp.leaseTerm + 1}</span><span className="text-white">{fmtPSF(calc.renewalRentPSF)}/yr</span></div>}
          </div>
        </div>
      </div>

      {/* Summary Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {inp.perspective === 'landlord' ? [
          { label: 'Total Base Rent', value: fmt(calc.totalBaseRent), sub: `Over ${inp.leaseTerm} years`, color: 'text-white' },
          { label: 'Free Rent Concession', value: fmt(calc.totalFreeRent), sub: `${inp.freeRentMonths} mo abatement`, color: 'text-orange-400' },
          { label: 'Total Landlord NOI', value: fmt(calc.totalLandlordNOI), sub: 'After mgmt, less LL expenses', color: 'text-blue-400' },
          { label: 'PV of Lease (net upfront)', value: fmt(calc.landlordPV), sub: `At ${inp.landlordCapRate}% cap rate`, color: calc.landlordPV > 0 ? 'text-green-400' : 'text-red-400' },
        ] : [
          { label: 'Total Occupancy Cost', value: fmt(calc.totalTenantCost), sub: `Base + NNN over ${inp.leaseTerm} yrs`, color: 'text-white' },
          { label: 'Effective Rent / sqft', value: fmtPSF(calc.tenantEffectivePSF), sub: 'Incl. NNN pass-throughs', color: 'text-orange-400' },
          { label: 'TI Value Received', value: fmt(calc.tiCost), sub: `${inp.tiAllowance}/sqft landlord contribution`, color: 'text-green-400' },
          { label: 'PV of Occ. Cost', value: fmt(calc.tenantNetPV), sub: `At ${inp.tenantDiscountRate}% discount`, color: 'text-blue-400' },
        ].map(m => (
          <div key={m.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
            <p className={`text-xl font-black ${m.color}`}>{m.value}</p>
            <p className="text-xs text-slate-400 mt-1">{m.label}</p>
            <p className="text-xs text-slate-500">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Rent Schedule Chart */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Annual Rent Schedule — {leaseLabels[inp.leaseType]}</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={calc.yearlyData}>
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="effectiveBase" name="Effective Base Rent" fill="#3b82f6" radius={[4, 4, 0, 0]} stackId="a" />
            <Bar dataKey="nnnPassThroughs" name="NNN Pass-Throughs (tenant)" fill="#f59e0b" radius={[0, 0, 0, 0]} stackId="a" />
            <Bar dataKey="freeRentCredit" name="Free Rent Credit" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Rent PSF + NOI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Rent PSF Escalation</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={calc.yearlyData}>
              <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tickFormatter={v => `$${v}`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip formatter={(v: number) => `$${v.toFixed(2)}/sqft`} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="rentPSF" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Base Rent PSF" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Annual Landlord NOI</p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={calc.yearlyData}>
              <defs>
                <linearGradient id="noiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Area type="monotone" dataKey="landlordNOI" stroke="#22c55e" fill="url(#noiGrad)" strokeWidth={2} name="Landlord NOI" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Commercial Lease Quick Reference</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
          {[
            '📋 NNN: tenant pays base rent + CAM + property tax + insurance — landlord net of operating expenses (best for landlord stability)',
            '🏢 Gross: tenant pays one flat rate; landlord absorbs all operating cost increases — common in office; more landlord risk',
            '🔄 Modified Gross: hybrid — tenant pays base + some expenses (e.g., utilities); negotiate each item specifically',
            '💰 TI (Tenant Improvement): landlord funds build-out; amortized into effective rent — higher TI = higher nominal rent ask',
            '📊 Effective rent = (total rent - TI - free rent) ÷ term in months — always compare leases on effective rent basis',
            '⚡ CAM reconciliation: landlord estimates CAM annually, reconciles at year-end vs actuals — cap CAM increases in lease',
            '🔁 Renewal options: tenant right to renew at a defined rate or market — "fair market value" renewals favor landlord',
            '⚖️ SNDA + Estoppel: Subordination/Non-Disturbance/Attornment + estoppel certificates — required by lenders at financing/sale',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
