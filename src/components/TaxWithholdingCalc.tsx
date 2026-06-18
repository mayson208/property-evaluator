import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

type SellerType = 'usCitizen' | 'greenCard' | 'foreignPerson' | 'foreignCorp'
type PropertyUse = 'primaryResidence' | 'investmentProperty' | 'foreignSellerPrimary'

interface StateWithholding {
  rate: number
  name: string
  hasWithholding: boolean
  threshold: number
  notes: string
}

const STATE_WITHHOLDING: Record<string, StateWithholding> = {
  CA: { rate: 3.33, name: 'California', hasWithholding: true, threshold: 100000, notes: '3.33% of sale price' },
  NY: { rate: 8.82, name: 'New York', hasWithholding: true, threshold: 0, notes: 'Non-resident: 8.82% of gain' },
  FL: { rate: 0, name: 'Florida', hasWithholding: false, threshold: 0, notes: 'No state income tax' },
  TX: { rate: 0, name: 'Texas', hasWithholding: false, threshold: 0, notes: 'No state income tax' },
  WA: { rate: 7, name: 'Washington', hasWithholding: true, threshold: 250000, notes: '7% capital gains tax (gains >$250K)' },
  CO: { rate: 2, name: 'Colorado', hasWithholding: true, threshold: 0, notes: '2% of sale price (non-resident)' },
  AZ: { rate: 4.5, name: 'Arizona', hasWithholding: true, threshold: 0, notes: '4.5% of gain (non-resident)' },
  GA: { rate: 3, name: 'Georgia', hasWithholding: true, threshold: 0, notes: '3% of sale price or gain' },
  NC: { rate: 4, name: 'North Carolina', hasWithholding: true, threshold: 0, notes: '4% of sale price' },
  MA: { rate: 5, name: 'Massachusetts', hasWithholding: true, threshold: 0, notes: '5% of gain (non-resident)' },
  IL: { rate: 2.5, name: 'Illinois', hasWithholding: true, threshold: 0, notes: '2.5% of sale price' },
  NV: { rate: 0, name: 'Nevada', hasWithholding: false, threshold: 0, notes: 'No state income tax' },
  OR: { rate: 4, name: 'Oregon', hasWithholding: true, threshold: 0, notes: '4% withholding (non-resident)' },
  PA: { rate: 3.07, name: 'Pennsylvania', hasWithholding: true, threshold: 0, notes: '3.07% of gain' },
  TN: { rate: 0, name: 'Tennessee', hasWithholding: false, threshold: 0, notes: 'No income tax on gains' },
  OH: { rate: 4, name: 'Ohio', hasWithholding: true, threshold: 0, notes: '4% withholding (non-resident)' },
  VA: { rate: 4, name: 'Virginia', hasWithholding: true, threshold: 0, notes: '4% of gain (non-resident)' },
  MI: { rate: 4.25, name: 'Michigan', hasWithholding: true, threshold: 0, notes: '4.25% of gain' },
  NJ: { rate: 2, name: 'New Jersey', hasWithholding: true, threshold: 0, notes: '2% of sale price (GIT withholding)' },
  MN: { rate: 9.85, name: 'Minnesota', hasWithholding: true, threshold: 0, notes: '9.85% of gain (non-resident)' },
  OTHER: { rate: 3, name: 'Other State', hasWithholding: true, threshold: 0, notes: 'Estimate — verify with tax professional' },
}

interface Inputs {
  sellerType: SellerType
  propertyUse: PropertyUse
  salePrice: number
  adjustedBasis: number
  originalPurchasePrice: number
  yearsOwned: number
  depreciationTaken: number
  isNonResident: boolean
  sellerState: string
  buyerState: string
  filingStatus: 'single' | 'mfj'
  agi: number
  qualifiedForExclusion: boolean
}

const DEF: Inputs = {
  sellerType: 'usCitizen',
  propertyUse: 'investmentProperty',
  salePrice: 500000,
  adjustedBasis: 280000,
  originalPurchasePrice: 350000,
  yearsOwned: 8,
  depreciationTaken: 72000,
  isNonResident: false,
  sellerState: 'CA',
  buyerState: 'CA',
  filingStatus: 'mfj',
  agi: 250000,
  qualifiedForExclusion: false,
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const pct = (n: number) => `${n.toFixed(2)}%`
const N = (v: string) => parseFloat(v) || 0

const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#22c55e', '#a855f7']

export default function TaxWithholdingCalc() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = (k: keyof Inputs, v: string | boolean | SellerType | PropertyUse | 'single' | 'mfj') =>
    setInp(p => ({ ...p, [k]: typeof DEF[k] === 'number' ? N(v as string) : v }))

  const calc = useMemo(() => {
    const { sellerType, salePrice, adjustedBasis, yearsOwned,
            depreciationTaken, isNonResident, sellerState,
            filingStatus, agi, qualifiedForExclusion, propertyUse } = inp

    const gain = salePrice - adjustedBasis
    const deprecRecapture = Math.min(depreciationTaken, gain)
    const qualifiedLTCG = Math.max(0, gain - deprecRecapture)
    const section121Exclusion = qualifiedForExclusion ? (filingStatus === 'mfj' ? 500000 : 250000) : 0
    const taxableGain = Math.max(0, qualifiedLTCG - section121Exclusion)
    const taxableRecapture = deprecRecapture

    // Federal rates
    const ltcgRate = agi > (filingStatus === 'mfj' ? 553850 : 492300) ? 20 :
                     agi > (filingStatus === 'mfj' ? 94050 : 47025) ? 15 : 0
    const niitApplies = agi > (filingStatus === 'mfj' ? 250000 : 200000) && propertyUse === 'investmentProperty'

    const fedLTCGTax = taxableGain * ltcgRate / 100
    const fedRecaptureTax = taxableRecapture * 0.25
    const niitTax = niitApplies ? (taxableGain + taxableRecapture) * 0.038 : 0
    const totalFedTax = fedLTCGTax + fedRecaptureTax + niitTax

    // FIRPTA withholding
    let firptaWithholding = 0
    let firptaRate = 0
    let firptaNote = ''
    if (sellerType !== 'usCitizen' && sellerType !== 'greenCard') {
      if (salePrice <= 300000 && propertyUse === 'primaryResidence') {
        firptaWithholding = 0
        firptaNote = 'FIRPTA exempt: buyer will use as primary residence, price ≤ $300K'
      } else if (salePrice <= 1000000 && propertyUse === 'foreignSellerPrimary') {
        firptaRate = 10
        firptaWithholding = salePrice * 0.10
        firptaNote = 'FIRPTA 10%: buyer primary residence, price $300K-$1M'
      } else {
        firptaRate = sellerType === 'foreignCorp' ? 21 : 15
        firptaWithholding = salePrice * firptaRate / 100
        firptaNote = `FIRPTA ${firptaRate}%: standard foreign ${sellerType === 'foreignCorp' ? 'corporation' : 'individual'} rate`
      }
    }

    // State withholding
    const stateData = STATE_WITHHOLDING[sellerState] ?? STATE_WITHHOLDING.OTHER
    let stateWithholding = 0
    let stateWithholdingNote = ''
    if (stateData.hasWithholding && (isNonResident || sellerType !== 'usCitizen')) {
      const base = stateData.rate > 5 ? gain : salePrice
      stateWithholding = Math.max(0, base * stateData.rate / 100)
      if (stateData.threshold > 0 && salePrice < stateData.threshold) {
        stateWithholding = 0
        stateWithholdingNote = `Below $${stateData.threshold.toLocaleString()} threshold — no withholding`
      } else {
        stateWithholdingNote = stateData.notes
      }
    } else if (!stateData.hasWithholding) {
      stateWithholdingNote = stateData.notes
    } else {
      stateWithholdingNote = 'Resident seller — no withholding (pay on tax return)'
    }

    // 1099-S requirements
    const requires1099S = salePrice > 250000 || sellerType !== 'usCitizen'

    // Net proceeds
    const totalWithholding = firptaWithholding + stateWithholding
    const netProceeds = salePrice - totalWithholding - totalFedTax
    const effectiveTaxRate = (totalFedTax + stateWithholding) / gain * 100

    // Breakdown chart
    const breakdown = [
      { name: 'LTCG Tax', value: fedLTCGTax, color: COLORS[0] },
      { name: 'Deprec Recapture', value: fedRecaptureTax, color: COLORS[1] },
      { name: 'NIIT (3.8%)', value: niitTax, color: COLORS[2] },
      { name: 'State Tax', value: stateWithholding, color: COLORS[3] },
      { name: 'FIRPTA', value: firptaWithholding, color: COLORS[4] },
    ].filter(d => d.value > 0)

    // Timeline for withheld refund
    const withheldOverpayment = Math.max(0, totalWithholding - (totalFedTax + stateWithholding))

    return {
      gain, deprecRecapture, qualifiedLTCG, section121Exclusion, taxableGain, taxableRecapture,
      ltcgRate, niitApplies, fedLTCGTax, fedRecaptureTax, niitTax, totalFedTax,
      firptaWithholding, firptaRate, firptaNote,
      stateWithholding, stateWithholdingNote, stateData,
      requires1099S, totalWithholding, netProceeds, effectiveTaxRate,
      breakdown, withheldOverpayment,
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
        <h2 className="text-lg font-bold text-white">Real Estate Tax Withholding Calculator</h2>
        <p className="text-slate-400 text-xs mt-1">FIRPTA withholding, state withholding, depreciation recapture (§1250), LTCG, NIIT, and net proceeds at closing</p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Seller &amp; Property</p>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Seller Type</label>
            <select value={inp.sellerType} onChange={e => set('sellerType', e.target.value as SellerType)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
              <option value="usCitizen">U.S. Citizen / Resident</option>
              <option value="greenCard">Green Card Holder</option>
              <option value="foreignPerson">Foreign Individual (FIRPTA)</option>
              <option value="foreignCorp">Foreign Corporation (FIRPTA)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Property Use</label>
            <select value={inp.propertyUse} onChange={e => set('propertyUse', e.target.value as PropertyUse)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
              <option value="primaryResidence">Primary Residence</option>
              <option value="investmentProperty">Investment Property</option>
              <option value="foreignSellerPrimary">Foreign Seller - Primary</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Seller's State</label>
            <select value={inp.sellerState} onChange={e => setInp(p => ({ ...p, sellerState: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
              {Object.entries(STATE_WITHHOLDING).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Non-Resident of Sale State</span>
            <button onClick={() => set('isNonResident', !inp.isNonResident)}
              className={`w-11 h-6 rounded-full transition-colors ${inp.isNonResident ? 'bg-orange-500' : 'bg-slate-700'}`}>
              <div className={`w-4 h-4 bg-white rounded-full mx-1 transition-transform ${inp.isNonResident ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Transaction Details</p>
          {field('Sale Price', 'salePrice', '$')}
          {field('Adjusted Basis', 'adjustedBasis', '$')}
          {field('Original Purchase Price', 'originalPurchasePrice', '$')}
          {field('Years Owned', 'yearsOwned')}
          {field('Total Depreciation Taken', 'depreciationTaken', '$')}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">§121 Exclusion Qualifies</span>
            <button onClick={() => set('qualifiedForExclusion', !inp.qualifiedForExclusion)}
              className={`w-11 h-6 rounded-full transition-colors ${inp.qualifiedForExclusion ? 'bg-green-500' : 'bg-slate-700'}`}>
              <div className={`w-4 h-4 bg-white rounded-full mx-1 transition-transform ${inp.qualifiedForExclusion ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Seller Tax Profile</p>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Filing Status</label>
            <div className="flex gap-2">
              {(['single', 'mfj'] as const).map(s => (
                <button key={s} onClick={() => set('filingStatus', s)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition ${inp.filingStatus === s ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                  {s === 'single' ? 'Single' : 'Married'}
                </button>
              ))}
            </div>
          </div>
          {field('AGI (excl. this sale)', 'agi', '$')}
          <div className="p-3 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Gain</span><span className="text-white font-bold">{fmt(calc.gain)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Deprec Recapture (25%)</span><span className="text-orange-400">{fmt(calc.deprecRecapture)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">LTCG Rate</span><span className="text-blue-400">{calc.ltcgRate}%</span></div>
            <div className="flex justify-between"><span className="text-slate-400">NIIT Applies</span><span className={calc.niitApplies ? 'text-red-400' : 'text-green-400'}>{calc.niitApplies ? 'Yes (3.8%)' : 'No'}</span></div>
            {inp.qualifiedForExclusion && <div className="flex justify-between"><span className="text-slate-400">§121 Exclusion</span><span className="text-green-400">-{fmt(calc.section121Exclusion)}</span></div>}
          </div>
        </div>
      </div>

      {/* FIRPTA Banner */}
      {inp.sellerType === 'foreignPerson' || inp.sellerType === 'foreignCorp' ? (
        <div className={`rounded-xl p-4 border ${calc.firptaWithholding > 0 ? 'bg-red-900/20 border-red-700/40' : 'bg-green-900/20 border-green-700/40'}`}>
          <div className="flex items-start gap-3">
            <span className="text-2xl">{calc.firptaWithholding > 0 ? '⚠️' : '✓'}</span>
            <div>
              <p className="font-bold text-white">FIRPTA (Foreign Investment in Real Property Tax Act)</p>
              <p className="text-sm text-slate-300 mt-1">{calc.firptaNote}</p>
              {calc.firptaWithholding > 0 && <p className="text-lg font-black text-red-400 mt-2">Withholding: {fmt(calc.firptaWithholding)} ({calc.firptaRate}% of sale price)</p>}
              <p className="text-xs text-slate-500 mt-1">Withheld by buyer (as withholding agent) and remitted to IRS via Form 8288 within 20 days of closing</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Tax Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Federal Tax Breakdown</p>
          <div className="space-y-2">
            {[
              { label: `LTCG Tax (${calc.ltcgRate}%)`, value: calc.fedLTCGTax, color: 'text-red-400' },
              { label: 'Depreciation Recapture (25%)', value: calc.fedRecaptureTax, color: 'text-orange-400' },
              { label: 'NIIT 3.8%', value: calc.niitTax, color: 'text-yellow-400', skip: !calc.niitApplies },
            ].filter(r => !r.skip).map(r => (
              <div key={r.label} className="flex justify-between text-xs">
                <span className="text-slate-400">{r.label}</span>
                <span className={`font-bold ${r.color}`}>{fmt(r.value)}</span>
              </div>
            ))}
            <div className="border-t border-slate-600 pt-2 flex justify-between">
              <span className="text-sm font-bold text-white">Total Federal Tax</span>
              <span className="text-red-400 font-black text-sm">{fmt(calc.totalFedTax)}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">State &amp; Withholding</p>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">State Withholding ({calc.stateData.name})</span>
              <span className={`font-bold ${calc.stateWithholding > 0 ? 'text-orange-400' : 'text-green-400'}`}>{calc.stateWithholding > 0 ? fmt(calc.stateWithholding) : 'None'}</span>
            </div>
            <p className="text-xs text-slate-500">{calc.stateWithholdingNote}</p>
            {calc.firptaWithholding > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">FIRPTA Withholding</span>
                <span className="text-red-400 font-bold">{fmt(calc.firptaWithholding)}</span>
              </div>
            )}
            <div className="border-t border-slate-600 pt-2 flex justify-between">
              <span className="text-sm font-bold text-white">Total Withheld at Closing</span>
              <span className="text-red-400 font-black text-sm">{fmt(calc.totalWithholding)}</span>
            </div>
            <div className="flex justify-between text-xs pt-1">
              <span className="text-slate-400">Effective Tax Rate (on gain)</span>
              <span className="text-purple-400 font-bold">{pct(calc.effectiveTaxRate)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Net Proceeds to Seller</span>
              <span className="text-green-400 font-bold text-sm">{fmt(calc.netProceeds)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown Chart */}
      {calc.breakdown.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Tax Components</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={calc.breakdown} layout="vertical">
              <XAxis type="number" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={120} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {calc.breakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 1099-S and Reporting */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={`rounded-xl p-4 border ${calc.requires1099S ? 'bg-yellow-900/20 border-yellow-700/40' : 'bg-slate-800/30 border-slate-700'}`}>
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-2">1099-S Reporting</p>
          <p className={`text-sm font-bold ${calc.requires1099S ? 'text-yellow-300' : 'text-green-300'}`}>
            {calc.requires1099S ? '⚠️ 1099-S Required' : '✓ Likely Exempt'}
          </p>
          <div className="mt-2 space-y-1 text-xs text-slate-400">
            <p>• Required when: sale price {'>'} $250K, or seller is a corporation or foreign person</p>
            <p>• Issued by the settlement agent (title company / closing attorney)</p>
            <p>• Primary residence exclusion does NOT eliminate the 1099-S requirement</p>
            <p>• Transferor certifies on Form W-9S whether §121 exclusion applies</p>
          </div>
        </div>

        {calc.withheldOverpayment > 0 && (
          <div className="bg-green-900/20 rounded-xl p-4 border border-green-700/40">
            <p className="text-xs font-bold text-green-300 uppercase tracking-widest mb-2">Overpayment / Refund</p>
            <p className="text-xl font-black text-green-400">{fmt(calc.withheldOverpayment)}</p>
            <p className="text-xs text-slate-400 mt-2">Estimated overpayment vs actual tax liability — claim as refund on annual tax return. Foreign sellers: file Form 1040-NR / Form 1120-F for refund.</p>
            <p className="text-xs text-slate-500 mt-1">Alternatively: apply for reduced FIRPTA withholding via IRS Form 8288-B before closing to reduce withholding to actual tax liability.</p>
          </div>
        )}
      </div>

      {/* IRS Forms */}
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Key IRS Forms at Closing</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
          {[
            { form: 'Form 8288', use: 'FIRPTA withholding — buyer files with IRS within 20 days of closing' },
            { form: 'Form 8288-A', use: 'Statement of withholding on disposition — given to foreign seller' },
            { form: 'Form 8288-B', use: 'Application to reduce FIRPTA withholding — file BEFORE closing' },
            { form: 'Form 1099-S', use: 'Proceeds from real estate transactions — issued by title/closing agent' },
            { form: 'Schedule D', use: 'Capital gains and losses — filed by seller with annual return' },
            { form: 'Form 4797', use: 'Depreciation recapture and §1231 gains' },
            { form: 'Form W-8ECI', use: 'Foreign seller — income effectively connected to US trade/business' },
            { form: 'Form 1040-NR', use: 'Non-resident alien annual income tax return for refund' },
          ].map(f => (
            <div key={f.form} className="flex gap-2">
              <span className="text-blue-400 font-mono font-bold w-24 shrink-0">{f.form}</span>
              <span>{f.use}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
