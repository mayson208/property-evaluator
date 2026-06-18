import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

type EvictionType = 'nonPayment' | 'lease' | 'holdover' | 'nuisance'
type ProceedureType = 'judicial' | 'selfHelp'

interface StateTimeline {
  noticeDays: number
  courtFilingDays: number
  hearingDays: number
  appealDays: number
  sheriffDays: number
  name: string
}

const STATE_TIMELINES: Record<string, StateTimeline> = {
  CA: { noticeDays: 3, courtFilingDays: 5, hearingDays: 25, appealDays: 30, sheriffDays: 21, name: 'California' },
  NY: { noticeDays: 14, courtFilingDays: 10, hearingDays: 30, appealDays: 60, sheriffDays: 30, name: 'New York' },
  FL: { noticeDays: 3, courtFilingDays: 5, hearingDays: 5, appealDays: 10, sheriffDays: 24, name: 'Florida' },
  TX: { noticeDays: 3, courtFilingDays: 5, hearingDays: 10, appealDays: 10, sheriffDays: 30, name: 'Texas' },
  IL: { noticeDays: 5, courtFilingDays: 3, hearingDays: 14, appealDays: 30, sheriffDays: 30, name: 'Illinois' },
  OH: { noticeDays: 3, courtFilingDays: 3, hearingDays: 14, appealDays: 30, sheriffDays: 30, name: 'Ohio' },
  GA: { noticeDays: 7, courtFilingDays: 3, hearingDays: 7, appealDays: 30, sheriffDays: 14, name: 'Georgia' },
  AZ: { noticeDays: 5, courtFilingDays: 3, hearingDays: 7, appealDays: 14, sheriffDays: 14, name: 'Arizona' },
  CO: { noticeDays: 10, courtFilingDays: 5, hearingDays: 7, appealDays: 21, sheriffDays: 10, name: 'Colorado' },
  WA: { noticeDays: 14, courtFilingDays: 5, hearingDays: 14, appealDays: 30, sheriffDays: 21, name: 'Washington' },
  NC: { noticeDays: 10, courtFilingDays: 5, hearingDays: 7, appealDays: 21, sheriffDays: 14, name: 'North Carolina' },
  VA: { noticeDays: 5, courtFilingDays: 7, hearingDays: 21, appealDays: 21, sheriffDays: 30, name: 'Virginia' },
  NJ: { noticeDays: 30, courtFilingDays: 14, hearingDays: 30, appealDays: 45, sheriffDays: 30, name: 'New Jersey' },
  MA: { noticeDays: 14, courtFilingDays: 7, hearingDays: 21, appealDays: 30, sheriffDays: 48, name: 'Massachusetts' },
  OTHER: { noticeDays: 7, courtFilingDays: 7, hearingDays: 21, appealDays: 30, sheriffDays: 21, name: 'Other State' },
}

interface Inputs {
  state: string
  evictionType: EvictionType
  monthlyRent: number
  monthsUnpaid: number
  securityDeposit: number
  courtFilingFee: number
  attorneyFeeHours: number
  attorneyHourlyRate: number
  propertyDamage: number
  cleaningCost: number
  paintCost: number
  relettingCost: number
  vacancyMonthsToRelett: number
  newTenantScreeningCost: number
  tenantHasAttorney: boolean
  likelyDefense: boolean
  appealed: boolean
}

const DEF: Inputs = {
  state: 'FL',
  evictionType: 'nonPayment',
  monthlyRent: 1800,
  monthsUnpaid: 2,
  securityDeposit: 1800,
  courtFilingFee: 185,
  attorneyFeeHours: 4,
  attorneyHourlyRate: 250,
  propertyDamage: 2500,
  cleaningCost: 400,
  paintCost: 600,
  relettingCost: 1200,
  vacancyMonthsToRelett: 1.5,
  newTenantScreeningCost: 75,
  tenantHasAttorney: false,
  likelyDefense: false,
  appealed: false,
}

const EVICTION_LABELS: Record<EvictionType, string> = {
  nonPayment: 'Non-Payment of Rent',
  lease: 'Lease Violation',
  holdover: 'Holdover Tenancy',
  nuisance: 'Nuisance / Criminal Activity',
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const N = (v: string) => parseFloat(v) || 0
const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7']

export default function EvictionCostCalc() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = (k: keyof Inputs, v: string | boolean | EvictionType) =>
    setInp(p => ({ ...p, [k]: typeof DEF[k] === 'number' ? N(v as string) : v }))

  const calc = useMemo(() => {
    const { state, monthlyRent, monthsUnpaid, securityDeposit,
            courtFilingFee, attorneyFeeHours, attorneyHourlyRate,
            propertyDamage, cleaningCost, paintCost, relettingCost,
            vacancyMonthsToRelett, newTenantScreeningCost,
            tenantHasAttorney, likelyDefense, appealed } = inp

    const timeline = STATE_TIMELINES[state] ?? STATE_TIMELINES.OTHER

    // Timeline
    let totalDays = timeline.noticeDays + timeline.courtFilingDays + timeline.hearingDays + timeline.sheriffDays
    if (tenantHasAttorney) totalDays += 21
    if (likelyDefense) totalDays += 30
    if (appealed) totalDays += timeline.appealDays
    const totalMonths = totalDays / 30

    // Lost rent during eviction
    const lostRentDuringEviction = monthlyRent * totalMonths
    const unpaidRentAlreadyOwed = monthlyRent * monthsUnpaid
    const totalRentLoss = lostRentDuringEviction + unpaidRentAlreadyOwed

    // Legal costs
    const attorneyFees = attorneyFeeHours * attorneyHourlyRate * (tenantHasAttorney ? 1.5 : 1) * (likelyDefense ? 2 : 1)
    const totalLegal = courtFilingFee + attorneyFees

    // Property costs
    const totalPropertyCosts = propertyDamage + cleaningCost + paintCost

    // Re-letting costs
    const vacancyLoss = monthlyRent * vacancyMonthsToRelett
    const totalReletting = relettingCost + newTenantScreeningCost + vacancyLoss

    // Security deposit offset
    const depositApplied = Math.min(securityDeposit, totalPropertyCosts + unpaidRentAlreadyOwed)

    // Total cost
    const grossCost = lostRentDuringEviction + totalLegal + totalPropertyCosts + totalReletting
    const netCost = grossCost - depositApplied

    // Break-even (months of good rental to recover)
    const netMonthlyProfit = monthlyRent * 0.6 // assume 60% NOI margin
    const recoveryMonths = netCost / netMonthlyProfit

    // Prevention value (how much screening saves)
    const screeningCost = 75
    const preventionROI = netCost / screeningCost

    // Cost breakdown chart
    const breakdown = [
      { name: 'Lost Rent (Eviction)', value: lostRentDuringEviction },
      { name: 'Unpaid Back Rent', value: unpaidRentAlreadyOwed },
      { name: 'Legal Costs', value: totalLegal },
      { name: 'Property Damage', value: totalPropertyCosts },
      { name: 'Re-Letting Costs', value: totalReletting },
    ]

    // Timeline stages
    const stages = [
      { stage: 'Notice Period', days: timeline.noticeDays, label: `${timeline.noticeDays}-day notice` },
      { stage: 'Court Filing', days: timeline.courtFilingDays, label: 'File in court' },
      { stage: 'Hearing', days: timeline.hearingDays, label: 'Judge hearing' },
      { stage: 'Tenant Defense', days: likelyDefense ? 30 : 0, label: 'Defense delays', skip: !likelyDefense },
      { stage: 'Appeal', days: appealed ? timeline.appealDays : 0, label: 'Appeal period', skip: !appealed },
      { stage: 'Sheriff Lockout', days: timeline.sheriffDays, label: 'Writ of possession' },
    ].filter(s => !s.skip && s.days > 0)

    return {
      timeline, totalDays, totalMonths, lostRentDuringEviction, unpaidRentAlreadyOwed, totalRentLoss,
      attorneyFees, totalLegal, totalPropertyCosts, vacancyLoss, totalReletting,
      depositApplied, grossCost, netCost, recoveryMonths, preventionROI, breakdown, stages,
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
        <h2 className="text-lg font-bold text-white">Eviction Cost Calculator</h2>
        <p className="text-slate-400 text-xs mt-1">Full cost of eviction — timeline, legal fees, lost rent, property damage, and re-letting expenses for landlords</p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Situation</p>
          <div>
            <label className="block text-xs text-slate-400 mb-1">State</label>
            <select value={inp.state} onChange={e => setInp(p => ({ ...p, state: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
              {Object.entries(STATE_TIMELINES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Eviction Type</label>
            <select value={inp.evictionType} onChange={e => set('evictionType', e.target.value as EvictionType)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
              {Object.entries(EVICTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {field('Monthly Rent', 'monthlyRent', '$')}
          {field('Months Already Unpaid', 'monthsUnpaid')}
          {field('Security Deposit', 'securityDeposit', '$')}
          <div className="space-y-2">
            {[
              { label: 'Tenant Has Attorney', key: 'tenantHasAttorney' as const },
              { label: 'Likely to Contest', key: 'likelyDefense' as const },
              { label: 'Will Appeal Ruling', key: 'appealed' as const },
            ].map(t => (
              <div key={t.key} className="flex items-center justify-between">
                <span className="text-xs text-slate-400">{t.label}</span>
                <button onClick={() => set(t.key, !inp[t.key])}
                  className={`w-11 h-6 rounded-full transition-colors ${inp[t.key] ? 'bg-orange-500' : 'bg-slate-700'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full mx-1 transition-transform ${inp[t.key] ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Legal Costs</p>
          {field('Court Filing Fee', 'courtFilingFee', '$')}
          {field('Attorney Hours', 'attorneyFeeHours', '', 'hrs')}
          {field('Attorney Hourly Rate', 'attorneyHourlyRate', '$', '/hr')}
          <div className="p-3 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">State</span><span className="text-slate-300">{calc.timeline.name}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Notice Period</span><span className="text-slate-300">{calc.timeline.noticeDays} days</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Court to Hearing</span><span className="text-slate-300">{calc.timeline.courtFilingDays + calc.timeline.hearingDays} days</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Sheriff Lockout</span><span className="text-slate-300">{calc.timeline.sheriffDays} days</span></div>
            <div className="flex justify-between border-t border-slate-700 pt-1 mt-1">
              <span className="text-slate-400 font-semibold">Total Est. Days</span>
              <span className="text-orange-400 font-bold">{calc.totalDays} days</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Turnover Costs</p>
          {field('Property Damage', 'propertyDamage', '$')}
          {field('Cleaning', 'cleaningCost', '$')}
          {field('Paint / Touch-Up', 'paintCost', '$')}
          {field('Re-Letting Fee', 'relettingCost', '$')}
          {field('Vacancy (months)', 'vacancyMonthsToRelett', '', 'mo', '0.5')}
          {field('Tenant Screening', 'newTenantScreeningCost', '$')}
        </div>
      </div>

      {/* Total Cost Banner */}
      <div className="bg-red-900/20 rounded-xl p-5 border border-red-700/40">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-3xl font-black text-red-400">{fmt(calc.netCost)}</p>
            <p className="text-xs text-slate-400">Net Cost (after deposit)</p>
          </div>
          <div>
            <p className="text-2xl font-black text-orange-400">{fmt(calc.grossCost)}</p>
            <p className="text-xs text-slate-400">Gross Total Cost</p>
          </div>
          <div>
            <p className="text-2xl font-black text-yellow-400">{calc.totalDays} days</p>
            <p className="text-xs text-slate-400">Est. Timeline</p>
          </div>
          <div>
            <p className="text-2xl font-black text-purple-400">{calc.recoveryMonths.toFixed(1)} mo</p>
            <p className="text-xs text-slate-400">Months to Recover</p>
          </div>
        </div>
        <p className="text-center text-xs text-slate-400 mt-3">
          Prevention via better screening: <span className="text-green-400 font-bold">{calc.preventionROI.toFixed(0)}x ROI</span> — investing {fmt(75)} in screening saves this eviction cost
        </p>
      </div>

      {/* Cost Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Cost Components</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={calc.breakdown} layout="vertical">
              <XAxis type="number" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} width={125} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {calc.breakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Timeline */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Eviction Timeline ({calc.timeline.name})</p>
          <div className="space-y-2">
            {calc.stages.map((s, i) => (
              <div key={s.stage} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: COLORS[i % COLORS.length] + '33', color: COLORS[i % COLORS.length] }}>
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-slate-300 font-semibold">{s.stage}</span>
                    <span className="text-slate-500">{s.days} days</span>
                  </div>
                  <div className="bg-slate-700 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, s.days / calc.totalDays * 100)}%`, background: COLORS[i % COLORS.length] }} />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{s.label} · Rent loss: {fmt(inp.monthlyRent * s.days / 30)}</p>
                </div>
              </div>
            ))}
            <div className="pt-2 border-t border-slate-700 flex justify-between text-xs">
              <span className="text-slate-400 font-bold">Total Timeline</span>
              <span className="text-orange-400 font-black">{calc.totalDays} days ({(calc.totalMonths).toFixed(1)} months)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Table */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Full Cost Summary</p>
        <div className="space-y-1.5">
          {[
            { label: 'Lost rent during eviction process', value: calc.lostRentDuringEviction, color: 'text-red-400' },
            { label: 'Back rent already owed', value: calc.unpaidRentAlreadyOwed, color: 'text-red-300' },
            { label: 'Legal costs (filing + attorney)', value: calc.totalLegal, color: 'text-orange-400' },
            { label: 'Property damage & cleaning', value: calc.totalPropertyCosts, color: 'text-yellow-400' },
            { label: 'Re-letting & vacancy loss', value: calc.totalReletting, color: 'text-orange-300' },
            { label: '━━━ Gross Total Cost', value: calc.grossCost, color: 'text-white font-bold' },
            { label: 'Security deposit applied', value: -calc.depositApplied, color: 'text-green-400' },
            { label: '━━━ NET COST TO LANDLORD', value: calc.netCost, color: 'text-red-400 font-black text-sm' },
          ].map((r, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-slate-400">{r.label}</span>
              <span className={r.color}>{r.value >= 0 ? fmt(r.value) : `-${fmt(-r.value)}`}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Prevention Tips */}
      <div className="bg-green-900/20 rounded-xl p-4 border border-green-700/40">
        <p className="text-xs font-bold text-green-300 uppercase tracking-widest mb-2">Prevention: Better Tenants, Fewer Evictions</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-green-200/70">
          {[
            '✓ Run full credit, criminal, and eviction history checks ($50-100 per applicant)',
            '✓ Require income ≥ 3x monthly rent — verify with 2 months pay stubs or tax returns',
            '✓ Call ALL listed references — prior landlords are the best predictor of future behavior',
            '✓ Use a thorough written lease with specific late fee, pet, and maintenance policies',
            '✓ Respond quickly to maintenance requests — delays are the #1 cause of disputes',
            '✓ Offer a cash-for-keys deal early — often cheaper than full eviction process',
            '✓ Document everything in writing — build an eviction case file from day one of issues',
            '✓ Know your state\'s notice requirements exactly — one wrong notice restarts the clock',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
