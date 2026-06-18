import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line, PieChart, Pie, Cell } from 'recharts'

interface Inputs {
  totalPads: number
  occupiedPads: number
  lotRent: number
  pohCount: number
  pohRent: number
  utilityPassThrough: boolean
  waterSewer: number
  electricPassThrough: boolean
  electricPerPad: number
  trashPerPad: number
  targetOccupancy: number
  askingPrice: number
  purchaseCapRate: number
  stabilizedCapRate: number
  mortgageLTV: number
  mortgageRate: number
  mortgageTerm: number
  mgmtFeePct: number
  maintenancePerPad: number
  adminAnnual: number
  insuranceAnnual: number
  propertyTaxAnnual: number
  padFillCostEach: number
  fillRatePerYear: number
}

const DEF: Inputs = {
  totalPads: 75,
  occupiedPads: 58,
  lotRent: 425,
  pohCount: 8,
  pohRent: 650,
  utilityPassThrough: true,
  waterSewer: 65,
  electricPassThrough: false,
  electricPerPad: 0,
  trashPerPad: 18,
  targetOccupancy: 95,
  askingPrice: 2800000,
  purchaseCapRate: 7.5,
  stabilizedCapRate: 8.5,
  mortgageLTV: 70,
  mortgageRate: 6.75,
  mortgageTerm: 25,
  mgmtFeePct: 8,
  maintenancePerPad: 50,
  adminAnnual: 24000,
  insuranceAnnual: 18000,
  propertyTaxAnnual: 22000,
  padFillCostEach: 5000,
  fillRatePerYear: 4,
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const N = (v: string) => parseFloat(v) || 0
const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444']

function monthlyPmt(principal: number, annualRate: number, termYears: number) {
  if (annualRate === 0) return principal / (termYears * 12)
  const r = annualRate / 100 / 12
  const n = termYears * 12
  return principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1)
}

export default function MobileHomePark() {
  const [inp, setInp] = useState<Inputs>(DEF)
  const set = (k: keyof Inputs, v: string | boolean) =>
    setInp(p => ({ ...p, [k]: typeof DEF[k] === 'boolean' ? v : N(v as string) }))

  const calc = useMemo(() => {
    const {
      totalPads, occupiedPads, lotRent, pohCount, pohRent,
      utilityPassThrough, waterSewer, electricPassThrough, electricPerPad, trashPerPad,
      targetOccupancy, askingPrice, stabilizedCapRate,
      mortgageLTV, mortgageRate, mortgageTerm,
      mgmtFeePct, maintenancePerPad, adminAnnual, insuranceAnnual, propertyTaxAnnual,
      padFillCostEach, fillRatePerYear,
    } = inp

    const occupancyPct = totalPads > 0 ? occupiedPads / totalPads * 100 : 0
    const vacantPads = totalPads - occupiedPads
    const targetPads = Math.round(totalPads * targetOccupancy / 100)
    const padsToFill = Math.max(0, targetPads - occupiedPads)
    const monthsToStabilize = fillRatePerYear > 0 ? padsToFill / fillRatePerYear * 12 : 0

    // Current Revenue
    const lotRevenue = occupiedPads * lotRent * 12
    const pohRevenue = pohCount * pohRent * 12
    const utilityRevenue = utilityPassThrough ? occupiedPads * (waterSewer + trashPerPad) * 12 : 0
    const electricRevenue = electricPassThrough ? occupiedPads * electricPerPad * 12 : 0
    const currentGrossRevenue = lotRevenue + pohRevenue + utilityRevenue + electricRevenue

    // Stabilized Revenue (at target occupancy)
    const stabLotRevenue = targetPads * lotRent * 12
    const stabPOHRevenue = pohCount * pohRent * 12 // POH doesn't change
    const stabUtilityRevenue = utilityPassThrough ? targetPads * (waterSewer + trashPerPad) * 12 : 0
    const stabElectricRevenue = electricPassThrough ? targetPads * electricPerPad * 12 : 0
    const stabilizedGrossRevenue = stabLotRevenue + stabPOHRevenue + stabUtilityRevenue + stabElectricRevenue

    // Expenses (scale with occupancy for some items)
    const mgmtFee = currentGrossRevenue * mgmtFeePct / 100
    const maintenance = totalPads * maintenancePerPad * 12
    const totalExpenses = mgmtFee + maintenance + adminAnnual + insuranceAnnual + propertyTaxAnnual

    const stabMgmtFee = stabilizedGrossRevenue * mgmtFeePct / 100
    const stabExpenses = stabMgmtFee + maintenance + adminAnnual + insuranceAnnual + propertyTaxAnnual

    const currentNOI = currentGrossRevenue - totalExpenses
    const stabilizedNOI = stabilizedGrossRevenue - stabExpenses

    // Valuation
    const currentCapRate = askingPrice > 0 ? currentNOI / askingPrice * 100 : 0
    const stabilizedValue = stabilizedCapRate > 0 ? stabilizedNOI / (stabilizedCapRate / 100) : 0
    const valueAdd = stabilizedValue - askingPrice
    const fillCost = padsToFill * padFillCostEach

    // Financing
    const loanAmount = askingPrice * mortgageLTV / 100
    const downPayment = askingPrice - loanAmount
    const monthlyPayment = monthlyPmt(loanAmount, mortgageRate, mortgageTerm)
    const annualDebtService = monthlyPayment * 12

    const currentCashFlow = currentNOI - annualDebtService
    const stabilizedCashFlow = stabilizedNOI - annualDebtService
    const currentCoC = downPayment > 0 ? currentCashFlow / downPayment * 100 : 0
    const stabCoC = downPayment > 0 ? stabilizedCashFlow / (downPayment + fillCost) * 100 : 0
    const dscr = annualDebtService > 0 ? currentNOI / annualDebtService : 0

    // Value-add fill path (year by year)
    const years = Math.ceil(monthsToStabilize / 12) + 2
    const filledPerYear = fillRatePerYear
    const yearlyPath = Array.from({ length: Math.min(10, years) }, (_, i) => {
      const y = i + 1
      const filledPads = Math.min(padsToFill, filledPerYear * y)
      const totalOcc = occupiedPads + filledPads
      const yr_lot = totalOcc * lotRent * 12
      const yr_util = utilityPassThrough ? totalOcc * (waterSewer + trashPerPad) * 12 : 0
      const yr_gross = yr_lot + pohRevenue + yr_util
      const yr_exp = yr_gross * mgmtFeePct / 100 + maintenance + adminAnnual + insuranceAnnual + propertyTaxAnnual
      const yr_noi = yr_gross - yr_exp
      const yr_value = stabilizedCapRate > 0 ? yr_noi / (stabilizedCapRate / 100) : 0
      return {
        year: `Yr ${y}`,
        noi: Math.round(yr_noi),
        value: Math.round(yr_value),
        cashFlow: Math.round(yr_noi - annualDebtService),
        occ: Math.round(totalOcc / totalPads * 100),
      }
    })

    // Revenue breakdown pie
    const revenueBreakdown = [
      { name: 'Lot Rent', value: lotRevenue },
      { name: 'POH Rent', value: pohRevenue },
      { name: 'Utilities', value: utilityRevenue + electricRevenue },
    ].filter(r => r.value > 0)

    return {
      occupancyPct, vacantPads, targetPads, padsToFill, monthsToStabilize,
      lotRevenue, pohRevenue, utilityRevenue, currentGrossRevenue,
      stabilizedGrossRevenue, stabilizedNOI, currentNOI,
      totalExpenses, stabExpenses,
      currentCapRate, stabilizedValue, valueAdd, fillCost,
      loanAmount, downPayment, monthlyPayment, annualDebtService,
      currentCashFlow, stabilizedCashFlow, currentCoC, stabCoC, dscr,
      yearlyPath, revenueBreakdown,
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

  const toggle = (label: string, key: keyof Inputs) => (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-400">{label}</span>
      <button onClick={() => set(key, !inp[key as keyof Inputs])}
        className={`w-11 h-6 rounded-full transition-colors ${inp[key as keyof Inputs] ? 'bg-green-500' : 'bg-slate-700'}`}>
        <div className={`w-4 h-4 bg-white rounded-full mx-1 transition-transform ${inp[key as keyof Inputs] ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  )

  return (
    <div className="space-y-6 text-sm">
      <div>
        <h2 className="text-lg font-bold text-white">Mobile Home Park (MHP) Analyzer</h2>
        <p className="text-slate-400 text-xs mt-1">Lot rent analysis, pad fill value-add, utility pass-through income, stabilized NOI, and true value creation potential</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Park Basics */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Park & Occupancy</p>
          {field('Total Pads', 'totalPads', '', '', '1')}
          {field('Currently Occupied', 'occupiedPads', '', '', '1')}
          {field('Lot Rent / Pad / mo', 'lotRent', '', '$')}
          {field('Park-Owned Homes (POH)', 'pohCount', '', '', '1')}
          {field('POH Rent / mo', 'pohRent', '', '$')}
          {field('Target Occupancy', 'targetOccupancy', '%')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Current Occupancy</span>
              <span className={calc.occupancyPct >= 90 ? 'text-green-400 font-bold' : calc.occupancyPct >= 75 ? 'text-yellow-400 font-bold' : 'text-red-400 font-bold'}>
                {calc.occupancyPct.toFixed(1)}% ({inp.occupiedPads}/{inp.totalPads})
              </span>
            </div>
            <div className="flex justify-between"><span className="text-slate-400">Vacant Pads</span><span className="text-orange-400">{calc.vacantPads}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Pads to Fill to Target</span><span className="text-blue-400">{calc.padsToFill}</span></div>
          </div>
        </div>

        {/* Utilities & Revenue */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Utility Pass-Through</p>
          {toggle('Water/Sewer Pass-Through', 'utilityPassThrough')}
          {inp.utilityPassThrough && field('Water+Sewer / Pad / mo', 'waterSewer', '', '$')}
          {toggle('Electric Pass-Through', 'electricPassThrough')}
          {inp.electricPassThrough && field('Electric / Pad / mo', 'electricPerPad', '', '$')}
          {field('Trash / Pad / mo', 'trashPerPad', '', '$')}
          <hr className="border-slate-700" />
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Purchase</p>
          {field('Asking Price', 'askingPrice', '', '$', '10000')}
          {field('Stabilized Exit Cap Rate', 'stabilizedCapRate', '%')}
          <div className="p-2 bg-slate-900/50 rounded-lg text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-400">Going-In Cap Rate</span><span className="text-blue-400">{calc.currentCapRate.toFixed(2)}%</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Current Gross Revenue</span><span className="text-slate-300">{fmt(calc.currentGrossRevenue)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Current NOI</span><span className="text-blue-400 font-bold">{fmt(calc.currentNOI)}</span></div>
          </div>
        </div>

        {/* Financing & Expenses */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Financing & Expenses</p>
          {field('LTV', 'mortgageLTV', '%')}
          {field('Interest Rate', 'mortgageRate', '%')}
          {field('Term', 'mortgageTerm', 'yr', '', '1')}
          {field('Mgmt Fee', 'mgmtFeePct', '% of rev')}
          {field('Maintenance / Pad / mo', 'maintenancePerPad', '', '$')}
          {field('Admin / Office (annual)', 'adminAnnual', '', '$')}
          {field('Insurance (annual)', 'insuranceAnnual', '', '$')}
          {field('Property Tax (annual)', 'propertyTaxAnnual', '', '$')}
          <hr className="border-slate-700" />
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Value-Add Fill Plan</p>
          {field('Cost to Fill Each Pad', 'padFillCostEach', '', '$')}
          {field('Pads Filled / Year', 'fillRatePerYear', '', '', '1')}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Stabilized Value', value: fmt(calc.stabilizedValue), sub: `vs ${fmt(inp.askingPrice)} purchase`, color: 'text-blue-400' },
          { label: 'Value-Add Upside', value: fmt(calc.valueAdd), sub: `After ${fmt(calc.fillCost)} fill cost`, color: calc.valueAdd > calc.fillCost ? 'text-green-400' : 'text-red-400' },
          { label: 'Stabilized NOI', value: fmt(calc.stabilizedNOI), sub: `vs ${fmt(calc.currentNOI)} current`, color: 'text-purple-400' },
          { label: 'Stabilized CoC', value: `${calc.stabCoC.toFixed(1)}%`, sub: `Current: ${calc.currentCoC.toFixed(1)}%`, color: calc.stabCoC > 10 ? 'text-green-400' : calc.stabCoC > 6 ? 'text-yellow-400' : 'text-red-400' },
        ].map(m => (
          <div key={m.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
            <p className={`text-2xl font-black ${m.color}`}>{m.value}</p>
            <p className="text-xs text-slate-400 mt-1">{m.label}</p>
            <p className="text-xs text-slate-500">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Current vs Stabilized Revenue */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Current vs Stabilized Income Statement</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          {[
            { label: 'Current', gross: calc.currentGrossRevenue, expenses: calc.totalExpenses, noi: calc.currentNOI, debt: calc.annualDebtService, cf: calc.currentCashFlow },
            { label: `Stabilized (${inp.targetOccupancy}% occ)`, gross: calc.stabilizedGrossRevenue, expenses: calc.stabExpenses, noi: calc.stabilizedNOI, debt: calc.annualDebtService, cf: calc.stabilizedCashFlow },
            { label: 'Difference', gross: calc.stabilizedGrossRevenue - calc.currentGrossRevenue, expenses: calc.stabExpenses - calc.totalExpenses, noi: calc.stabilizedNOI - calc.currentNOI, debt: 0, cf: calc.stabilizedCashFlow - calc.currentCashFlow },
          ].map((col, i) => (
            <div key={col.label} className={`space-y-1.5 ${i === 2 ? 'bg-green-900/10 border border-green-700/30' : 'bg-slate-900/50'} rounded-lg p-3`}>
              <p className={`font-bold mb-2 ${i === 2 ? 'text-green-400' : 'text-slate-200'}`}>{col.label}</p>
              {[
                { l: 'Gross Revenue', v: col.gross },
                { l: 'Operating Expenses', v: i === 2 ? -Math.abs(col.expenses) : -col.expenses },
                { l: 'NOI', v: col.noi },
                { l: 'Debt Service', v: i === 2 ? 0 : -col.debt },
                { l: 'Cash Flow', v: col.cf },
              ].map(row => (
                <div key={row.l} className="flex justify-between border-b border-slate-700/40 pb-1">
                  <span className="text-slate-400">{row.l}</span>
                  <span className={row.v < 0 ? 'text-red-400' : row.v > 0 ? (i === 2 ? 'text-green-400 font-bold' : 'text-slate-300') : 'text-slate-500'}>
                    {row.v === 0 ? '—' : (row.v < 0 ? `-${fmt(Math.abs(row.v))}` : fmt(row.v))}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Fill Path */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-1">Value-Add Fill Path: NOI & Property Value Over Time</p>
        <p className="text-xs text-slate-500 mb-3">Filling {inp.fillRatePerYear} pads/year — {calc.padsToFill} pads to target — ~{calc.monthsToStabilize.toFixed(0)} months to stabilize</p>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={calc.yearlyPath}>
            <XAxis dataKey="year" tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis yAxisId="left" tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <YAxis yAxisId="right" orientation="right" tickFormatter={v => `$${(v / 1000000).toFixed(1)}M`} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line yAxisId="left" type="monotone" dataKey="noi" stroke="#3b82f6" strokeWidth={2} dot={false} name="NOI" />
            <Line yAxisId="left" type="monotone" dataKey="cashFlow" stroke="#22c55e" strokeWidth={2} dot={false} name="Cash Flow" />
            <Line yAxisId="right" type="monotone" dataKey="value" stroke="#a855f7" strokeWidth={2} dot={false} name="Est. Value" strokeDasharray="5 3" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">MHP Investing Key Points</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
          {[
            '🏆 MHPs have the lowest resident turnover in real estate — residents own their home and moving costs $5–15K',
            '💰 Lot rent is typically recession-resistant — MHP residents are often price-sensitive and have few alternatives',
            '🔧 Tenant-owned homes (TOH) reduce park maintenance burden — park responsible for land/infrastructure, not homes',
            '⚠️ Avoid parks with more than 20% POH — increases management complexity and capital requirements',
            '🚰 Utility pass-through (water/sewer on master meter) is a major value-add — bill back to tenants',
            '📊 MHP lenders (Fannie/Freddie, banks) want 90%+ occupancy, 1.25+ DSCR, and proven lot rent comps',
            '🏗️ Infill value-add: bringing abandoned or vacant pads back online is highest-return MHP strategy',
            '💼 Typical MHP cap rates: 5–7% in primary markets, 8–11% in secondary/tertiary; widest gap vs apartments',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>
    </div>
  )
}
