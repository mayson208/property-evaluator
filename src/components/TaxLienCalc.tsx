import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line, ReferenceLine } from 'recharts'

interface StateData {
  rate: number
  method: 'simple' | 'compound' | 'penalty'
  redemptionMonths: number
  bidType: 'bid-down' | 'premium' | 'random' | 'overbid'
  deedRights: boolean
  notes: string
}

const STATES: Record<string, StateData> = {
  'Iowa':        { rate: 24, method: 'simple',   redemptionMonths: 24, bidType: 'bid-down',  deedRights: true,  notes: 'Bid-down interest; 2-yr redemption; one of the best for investors' },
  'Florida':     { rate: 18, method: 'simple',   redemptionMonths: 24, bidType: 'bid-down',  deedRights: true,  notes: 'Min 5% even if bid to 0%; 2-yr window; large competitive market' },
  'Illinois':    { rate: 36, method: 'compound', redemptionMonths: 30, bidType: 'bid-down',  deedRights: true,  notes: 'Highest rate; compound interest; 2.5yr redemption; suburban Chicago very competitive' },
  'Arizona':     { rate: 16, method: 'simple',   redemptionMonths: 36, bidType: 'bid-down',  deedRights: true,  notes: '3-yr redemption; 16% max; Maricopa Co is a major market' },
  'New Jersey':  { rate: 18, method: 'simple',   redemptionMonths: 24, bidType: 'premium',   deedRights: true,  notes: 'Premium overbid system; higher competition drives premiums up in NJ' },
  'Maryland':    { rate: 6,  method: 'simple',   redemptionMonths: 24, bidType: 'overbid',   deedRights: true,  notes: 'Low rate — value comes from below-market deed acquisition strategy' },
  'Indiana':     { rate: 15, method: 'penalty',  redemptionMonths: 12, bidType: 'bid-down',  deedRights: true,  notes: 'Short 1-yr redemption; 10-15% penalty; faster deed acquisition path' },
  'Colorado':    { rate: 15, method: 'simple',   redemptionMonths: 36, bidType: 'bid-down',  deedRights: false, notes: 'Tax deed state — lien converts; competitive online auctions' },
  'Nebraska':    { rate: 14, method: 'simple',   redemptionMonths: 36, bidType: 'random',    deedRights: true,  notes: 'Random assignment — luck-based; good rural opportunities' },
  'Mississippi': { rate: 18, method: 'simple',   redemptionMonths: 24, bidType: 'bid-down',  deedRights: true,  notes: 'Lower competition vs Northeast; rural markets available' },
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const N = (v: string) => parseFloat(v) || 0

interface Inputs {
  state: string
  customRate: number
  useCustomRate: boolean
  investmentAmount: number
  bidRate: number
  premiumPaid: number
  redemptionMonth: number
  propertyValue: number
  deedAcqCost: number
  propertyCondition: 'excellent' | 'good' | 'fair' | 'poor'
  redemptionProbability: number
  reinvestRate: number
}

const DEF: Inputs = {
  state: 'Iowa',
  customRate: 18,
  useCustomRate: false,
  investmentAmount: 8500,
  bidRate: 18,
  premiumPaid: 0,
  redemptionMonth: 18,
  propertyValue: 185000,
  deedAcqCost: 5000,
  propertyCondition: 'good',
  redemptionProbability: 92,
  reinvestRate: 6,
}

export default function TaxLienCalc() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = <K extends keyof Inputs>(k: K, v: Inputs[K]) => setInp(p => ({ ...p, [k]: v }))
  const setN = (k: keyof Inputs, v: string) => setInp(p => ({ ...p, [k]: N(v) }))

  const stateInfo = STATES[inp.state] ?? STATES['Iowa']
  const effectiveRate = inp.useCustomRate ? inp.customRate : Math.min(inp.bidRate, stateInfo.rate)

  const calc = useMemo(() => {
    const { investmentAmount, premiumPaid, redemptionMonth, propertyValue, deedAcqCost, propertyCondition, redemptionProbability, reinvestRate } = inp
    const totalInvested = investmentAmount + premiumPaid

    // Interest earned at redemption
    const months = Math.max(1, redemptionMonth)
    let interestEarned = 0
    if (stateInfo.method === 'simple') {
      interestEarned = investmentAmount * effectiveRate / 100 * (months / 12)
    } else if (stateInfo.method === 'compound') {
      interestEarned = investmentAmount * (Math.pow(1 + effectiveRate / 100 / 12, months) - 1)
    } else {
      // penalty method — flat penalty on redemption
      interestEarned = investmentAmount * effectiveRate / 100
    }

    const totalRedemptionProceeds = investmentAmount + interestEarned
    const netRedemptionProfit = totalRedemptionProceeds - totalInvested
    const redemptionROI = totalInvested > 0 ? netRedemptionProfit / totalInvested * 100 : 0
    const annualizedRedemptionROI = months > 0 ? redemptionROI / months * 12 : 0

    // Deed acquisition scenario (if not redeemed)
    const conditionMultiplier = { excellent: 1.0, good: 0.92, fair: 0.78, poor: 0.60 }[propertyCondition]
    const rehabCost = propertyValue * (1 - conditionMultiplier) * 0.5 // rough rehab estimate
    const deedBasis = totalInvested + deedAcqCost + rehabCost
    const deedValue = propertyValue * conditionMultiplier
    const deedProfit = deedValue - deedBasis
    const deedROI = totalInvested > 0 ? deedProfit / totalInvested * 100 : 0

    // Expected value blended
    const pRedemption = redemptionProbability / 100
    const pDeed = 1 - pRedemption
    const expectedProfit = pRedemption * netRedemptionProfit + pDeed * deedProfit
    const expectedROI = totalInvested > 0 ? expectedProfit / totalInvested * 100 : 0
    const expectedAnnualizedROI = months > 0 ? expectedROI / months * 12 : 0

    // Month-by-month interest accrual
    const monthlyData = Array.from({ length: Math.min(stateInfo.redemptionMonths, 36) }, (_, i) => {
      const m = i + 1
      let intEarned = 0
      if (stateInfo.method === 'simple') intEarned = investmentAmount * effectiveRate / 100 * (m / 12)
      else if (stateInfo.method === 'compound') intEarned = investmentAmount * (Math.pow(1 + effectiveRate / 100 / 12, m) - 1)
      else intEarned = investmentAmount * effectiveRate / 100
      const annualizedROI = m > 0 ? (intEarned / totalInvested * 100) / m * 12 : 0
      return { month: `Mo ${m}`, interest: Math.round(intEarned), annROI: parseFloat(annualizedROI.toFixed(2)) }
    })

    // Comparison vs alternatives
    const altComparison = [
      { name: 'Tax Lien (Redem.)', roi: annualizedRedemptionROI },
      { name: 'Tax Lien (Expect.)', roi: expectedAnnualizedROI },
      { name: 'S&P 500 (10yr avg)', roi: 10.5 },
      { name: 'HY Savings', roi: 4.8 },
      { name: 'Treasury Bond', roi: 4.3 },
      { name: 'CD (12mo)', roi: 5.2 },
      { name: 'Real Estate Direct', roi: reinvestRate },
    ]

    // Risk flags
    const risks = [
      { flag: premiumPaid > investmentAmount * 0.1, text: `Premium ${fmt(premiumPaid)} is >10% of lien — erodes yield significantly` },
      { flag: effectiveRate < 10, text: 'Effective rate <10% — marginal advantage over liquid alternatives' },
      { flag: redemptionProbability < 85, text: `Low redemption probability (${redemptionProbability}%) — higher deed acquisition risk` },
      { flag: deedProfit < 0, text: 'Deed acquisition scenario is unprofitable — lien value exceeds property value' },
      { flag: stateInfo.redemptionMonths > 24, text: `Long redemption window (${stateInfo.redemptionMonths}mo) ties up capital — consider reinvestment cost` },
    ].filter(r => r.flag)

    return {
      totalInvested, interestEarned, totalRedemptionProceeds, netRedemptionProfit,
      redemptionROI, annualizedRedemptionROI,
      rehabCost, deedBasis, deedValue, deedProfit, deedROI,
      expectedProfit, expectedROI, expectedAnnualizedROI,
      monthlyData, altComparison, risks,
    }
  }, [inp, stateInfo, effectiveRate])

  const field = (label: string, key: keyof Inputs, suffix = '', prefix = '') => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{prefix}</span>}
        <input type="number" value={inp[key] as number} onChange={e => setN(key, e.target.value)}
          className={`w-full bg-slate-800 border border-slate-700 rounded-lg py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 ${prefix ? 'pl-5 pr-3' : suffix ? 'pl-3 pr-8' : 'px-3'}`} />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{suffix}</span>}
      </div>
    </div>
  )

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-lg font-bold text-white">Tax Lien Certificate Analyzer</h2>
        <p className="text-slate-400 text-xs mt-1">State-specific interest rates, redemption probability, deed acquisition ROI, expected-value blended return vs alternatives</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Interest at Redemption', value: fmt(calc.interestEarned), color: 'text-green-400' },
          { label: 'Annualized ROI (if redeemed)', value: `${calc.annualizedRedemptionROI.toFixed(1)}%`, color: 'text-blue-400' },
          { label: 'Expected Value ROI', value: `${calc.expectedAnnualizedROI.toFixed(1)}%`, color: calc.expectedAnnualizedROI > 8 ? 'text-green-400' : 'text-yellow-400' },
          { label: 'Deed Acquisition Profit', value: fmt(calc.deedProfit), color: calc.deedProfit > 0 ? 'text-purple-400' : 'text-red-400' },
        ].map(m => (
          <div key={m.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
            <p className={`text-2xl font-black ${m.color}`}>{m.value}</p>
            <p className="text-xs text-slate-400 mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      {calc.risks.length > 0 && (
        <div className="bg-yellow-900/20 rounded-xl p-3 border border-yellow-700/40">
          <p className="text-xs font-bold text-yellow-300 mb-2">⚠️ Risk Flags</p>
          <ul className="space-y-1">{calc.risks.map((r, i) => <li key={i} className="text-xs text-yellow-200">• {r.text}</li>)}</ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* State & Lien */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">State & Lien Details</p>
          <div>
            <label className="block text-xs text-slate-400 mb-1">State</label>
            <select value={inp.state} onChange={e => set('state', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
              {Object.keys(STATES).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Statutory Rate</span><span className="text-green-400 font-bold">{stateInfo.rate}%</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Interest Method</span><span className="text-slate-300 capitalize">{stateInfo.method}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Redemption Period</span><span className="text-slate-300">{stateInfo.redemptionMonths} months</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Bidding System</span><span className="text-slate-300 capitalize">{stateInfo.bidType}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Deed Rights</span><span className={stateInfo.deedRights ? 'text-green-400' : 'text-yellow-400'}>{stateInfo.deedRights ? 'Yes' : 'Tax Deed Only'}</span></div>
            <p className="text-slate-500 mt-1 pt-1 border-t border-slate-700">{stateInfo.notes}</p>
          </div>
          {field('Lien Amount (taxes owed)', 'investmentAmount', '', '$')}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Custom Bid Rate</span>
            <button onClick={() => set('useCustomRate', !inp.useCustomRate)}
              className={`w-10 h-5 rounded-full transition-colors ${inp.useCustomRate ? 'bg-blue-500' : 'bg-slate-700'}`}>
              <div className={`w-4 h-4 bg-white rounded-full mx-0.5 transition-transform ${inp.useCustomRate ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          {inp.useCustomRate
            ? field('Your Bid Rate', 'customRate', '%')
            : field('Bid Rate (bid-down systems)', 'bidRate', '%')}
          <div className="p-2 bg-blue-900/20 border border-blue-700/30 rounded-lg text-xs">
            <span className="text-blue-300">Effective Rate: </span>
            <span className="text-white font-bold">{effectiveRate}%</span>
          </div>
          {field('Premium Paid (overbid)', 'premiumPaid', '', '$')}
          {field('Expected Redemption Month', 'redemptionMonth', 'mo')}
        </div>

        {/* Redemption Scenario */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Redemption Scenario</p>
          <div className="space-y-1.5">
            {[
              { label: 'Total Invested', value: fmt(calc.totalInvested), color: 'text-slate-300' },
              { label: 'Interest Earned', value: fmt(calc.interestEarned), color: 'text-green-400' },
              { label: 'Total Redemption Proceeds', value: fmt(calc.totalRedemptionProceeds), color: 'text-white' },
              { label: 'Net Profit', value: fmt(calc.netRedemptionProfit), color: 'text-green-400' },
              { label: 'Total ROI', value: `${calc.redemptionROI.toFixed(2)}%`, color: 'text-blue-400' },
              { label: 'Annualized ROI', value: `${calc.annualizedRedemptionROI.toFixed(2)}%`, color: 'text-blue-400' },
            ].map(m => (
              <div key={m.label} className="flex justify-between items-center p-2 bg-slate-900/50 rounded-lg">
                <span className="text-xs text-slate-400">{m.label}</span>
                <span className={`text-xs font-bold ${m.color}`}>{m.value}</span>
              </div>
            ))}
          </div>
          <hr className="border-slate-700" />
          <p className="text-xs font-bold text-slate-400">Expected Value Blended</p>
          {field('Redemption Probability', 'redemptionProbability', '%')}
          <div className="space-y-1.5">
            {[
              { label: 'Expected Profit', value: fmt(calc.expectedProfit), color: calc.expectedProfit > 0 ? 'text-green-400' : 'text-red-400' },
              { label: 'Expected Annualized ROI', value: `${calc.expectedAnnualizedROI.toFixed(2)}%`, color: calc.expectedAnnualizedROI > 8 ? 'text-green-400' : 'text-yellow-400' },
            ].map(m => (
              <div key={m.label} className="flex justify-between items-center p-2 bg-slate-900/50 rounded-lg">
                <span className="text-xs text-slate-400">{m.label}</span>
                <span className={`text-xs font-bold ${m.color}`}>{m.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Deed Acquisition */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Deed Acquisition (If Not Redeemed)</p>
          {field('Property Market Value', 'propertyValue', '', '$')}
          {field('Legal / Eviction / Deed Cost', 'deedAcqCost', '', '$')}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Property Condition</label>
            <select value={inp.propertyCondition} onChange={e => set('propertyCondition', e.target.value as Inputs['propertyCondition'])}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500">
              <option value="excellent">Excellent — move-in ready</option>
              <option value="good">Good — cosmetic updates only</option>
              <option value="fair">Fair — moderate rehab needed</option>
              <option value="poor">Poor — significant renovation</option>
            </select>
          </div>
          <div className="space-y-1.5">
            {[
              { label: 'Estimated Rehab Cost', value: fmt(calc.rehabCost), color: 'text-red-400' },
              { label: 'Total Deed Basis', value: fmt(calc.deedBasis), color: 'text-orange-400' },
              { label: 'Estimated After-Rehab Value', value: fmt(calc.deedValue), color: 'text-white' },
              { label: 'Deed Acquisition Profit', value: fmt(calc.deedProfit), color: calc.deedProfit > 0 ? 'text-green-400' : 'text-red-400' },
              { label: 'Deed ROI on Investment', value: `${calc.deedROI.toFixed(1)}%`, color: calc.deedROI > 20 ? 'text-green-400' : 'text-yellow-400' },
            ].map(m => (
              <div key={m.label} className="flex justify-between items-center p-2 bg-slate-900/50 rounded-lg">
                <span className="text-xs text-slate-400">{m.label}</span>
                <span className={`text-xs font-bold ${m.color}`}>{m.value}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 italic">Note: Deed acquisition carries title, occupant, and condition risk. Always research property before bidding.</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Interest Accrual Over Time</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={calc.monthlyData.filter((_, i) => i % 2 === 0 || i === calc.monthlyData.length - 1)}>
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 9 }} />
              <YAxis yAxisId="left" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}%`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip formatter={(v: number, n: string) => n === 'Annualized ROI' ? `${v.toFixed(1)}%` : fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine yAxisId="left" x={`Mo ${inp.redemptionMonth}`} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Expected', fill: '#f59e0b', fontSize: 9 }} />
              <Line yAxisId="left" type="monotone" dataKey="interest" stroke="#22c55e" strokeWidth={2} dot={false} name="Interest Earned" />
              <Line yAxisId="right" type="monotone" dataKey="annROI" stroke="#3b82f6" strokeWidth={2} dot={false} name="Annualized ROI" strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Annualized ROI vs Alternatives</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={calc.altComparison} layout="vertical">
              <XAxis type="number" tickFormatter={v => `${v}%`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 9 }} width={110} />
              <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <ReferenceLine x={0} stroke="#475569" />
              <Bar dataKey="roi" name="Annualized ROI" radius={[0, 4, 4, 0]}
                fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Tax Lien Investing — Key Concepts</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
          {[
            '📋 Bid-down states (IA, FL, AZ): investors compete by bidding DOWN the interest rate — lower bid wins; Iowa starts at 24%',
            '💰 Premium bid states (NJ): investors bid above lien face value; premium not recoverable at redemption — erodes net yield',
            '🔒 Interest method matters: simple vs compound vs penalty — IL at 36% compound is the highest effective yield in the US',
            '⏱️ Redemption window: owner/lender has this period to pay off lien + interest; most liens (90-95%) are redeemed before deed',
            '📝 Due diligence: always check 1) IRS/federal liens (senior to yours), 2) environmental contamination, 3) property condition',
            '🏛 Deed acquisition: if not redeemed, you file for tax deed; process varies by state; can take additional 6-18 months',
            '🎯 Best markets for yield: Iowa, Illinois, Indiana — but competition is high in metro areas; rural can offer uncrowded inventory',
            '💡 OTC (Over-the-Counter): liens not sold at auction can be purchased directly from county — sometimes better prices',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
