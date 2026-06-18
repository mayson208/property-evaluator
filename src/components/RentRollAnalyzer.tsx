import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts'

type UnitStatus = 'occupied' | 'vacant' | 'notice' | 'model' | 'down'
type BRType = 'Studio' | '1BR' | '2BR' | '3BR' | '4BR+'

interface Unit {
  id: string
  unitNum: string
  type: BRType
  sqft: number
  actualRent: number
  marketRent: number
  leaseEnd: string
  status: UnitStatus
  tenantName: string
}

const DEF_UNITS: Unit[] = [
  { id: '1',  unitNum: '101', type: '1BR', sqft: 720,  actualRent: 1250, marketRent: 1400, leaseEnd: '2025-09-30', status: 'occupied', tenantName: 'Smith, J.' },
  { id: '2',  unitNum: '102', type: '1BR', sqft: 720,  actualRent: 1300, marketRent: 1400, leaseEnd: '2025-08-31', status: 'occupied', tenantName: 'Lee, M.' },
  { id: '3',  unitNum: '103', type: '2BR', sqft: 980,  actualRent: 1650, marketRent: 1800, leaseEnd: '2025-11-30', status: 'occupied', tenantName: 'Garcia, A.' },
  { id: '4',  unitNum: '104', type: '2BR', sqft: 980,  actualRent: 0,    marketRent: 1800, leaseEnd: '',           status: 'vacant',   tenantName: '' },
  { id: '5',  unitNum: '201', type: '1BR', sqft: 720,  actualRent: 1350, marketRent: 1400, leaseEnd: '2025-12-31', status: 'occupied', tenantName: 'Park, S.' },
  { id: '6',  unitNum: '202', type: '1BR', sqft: 720,  actualRent: 1200, marketRent: 1400, leaseEnd: '2025-07-31', status: 'notice',   tenantName: 'Brown, T.' },
  { id: '7',  unitNum: '203', type: '2BR', sqft: 980,  actualRent: 1700, marketRent: 1800, leaseEnd: '2026-01-31', status: 'occupied', tenantName: 'Wilson, K.' },
  { id: '8',  unitNum: '204', type: '2BR', sqft: 980,  actualRent: 1775, marketRent: 1800, leaseEnd: '2025-10-31', status: 'occupied', tenantName: 'Davis, R.' },
  { id: '9',  unitNum: '301', type: '3BR', sqft: 1240, actualRent: 2100, marketRent: 2300, leaseEnd: '2026-03-31', status: 'occupied', tenantName: 'Martinez, L.' },
  { id: '10', unitNum: '302', type: '3BR', sqft: 1240, actualRent: 0,    marketRent: 2300, leaseEnd: '',           status: 'down',     tenantName: '' },
]

const STATUS_COLORS: Record<UnitStatus, string> = {
  occupied: '#22c55e', vacant: '#ef4444', notice: '#f59e0b', model: '#3b82f6', down: '#94a3b8',
}
const STATUS_LABELS: Record<UnitStatus, string> = {
  occupied: 'Occupied', vacant: 'Vacant', notice: 'Notice (MTM)', model: 'Model Unit', down: 'Down/Reno',
}

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const N = (v: string) => parseFloat(v) || 0
let nextId = 11

const today = new Date()
const monthsUntil = (dateStr: string) => {
  if (!dateStr) return null
  const d = new Date(dateStr)
  return Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
}

export default function RentRollAnalyzer() {
  const [units, setUnits] = useState<Unit[]>(DEF_UNITS)
  const [purchasePrice, setPurchasePrice] = useState(2800000)
  const [expenseRatio, setExpenseRatio] = useState(38)
  const [capRateTarget, setCapRateTarget] = useState(6.5)
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null)

  const updateUnit = (id: string, k: keyof Unit, v: string | UnitStatus | BRType) =>
    setUnits(us => us.map(u => u.id === id ? { ...u, [k]: typeof u[k] === 'number' ? N(v as string) : v } : u))

  const calc = useMemo(() => {
    const totalUnits = units.length
    const occupiedUnits = units.filter(u => u.status === 'occupied').length
    const vacantUnits = units.filter(u => u.status === 'vacant').length
    const noticeUnits = units.filter(u => u.status === 'notice').length
    const downUnits = units.filter(u => u.status === 'down').length

    const physicalOccupancy = totalUnits > 0 ? occupiedUnits / totalUnits * 100 : 0

    const grossPotentialRent = units.reduce((s, u) => s + u.marketRent, 0)
    const scheduledRent = units.filter(u => u.status === 'occupied' || u.status === 'notice').reduce((s, u) => s + u.actualRent, 0)
    const vacancyLoss = units.filter(u => u.status === 'vacant' || u.status === 'down').reduce((s, u) => s + u.marketRent, 0)
    const effectiveGrossIncome = grossPotentialRent - vacancyLoss
    const economicOccupancy = grossPotentialRent > 0 ? effectiveGrossIncome / grossPotentialRent * 100 : 0

    // Loss to lease = market rent minus what's actually charged for occupied units
    const lossToLease = units.filter(u => u.status === 'occupied').reduce((s, u) => s + Math.max(0, u.marketRent - u.actualRent), 0)
    const lossToLeasePct = grossPotentialRent > 0 ? lossToLease / grossPotentialRent * 100 : 0
    const upside = vacancyLoss + lossToLease

    const annualRevenue = scheduledRent * 12
    const annualGPR = grossPotentialRent * 12
    const annualEGI = effectiveGrossIncome * 12

    const noi = annualEGI * (1 - expenseRatio / 100)
    const capRate = purchasePrice > 0 ? noi / purchasePrice * 100 : 0
    const grm = purchasePrice > 0 ? purchasePrice / annualGPR : 0
    const impliedValueAtTarget = capRateTarget > 0 ? noi / (capRateTarget / 100) : 0

    // Upside NOI (if fully leased at market)
    const upsideNOI = annualGPR * (1 - expenseRatio / 100)
    const upsideCapRate = purchasePrice > 0 ? upsideNOI / purchasePrice * 100 : 0

    // Lease expiration concentration
    const expBuckets = { '0-90': 0, '91-180': 0, '181-365': 0, '365+': 0, 'MTM/Vacant': 0 }
    units.forEach(u => {
      if (u.status === 'vacant' || u.status === 'down' || !u.leaseEnd) { expBuckets['MTM/Vacant']++; return }
      const mos = monthsUntil(u.leaseEnd) ?? 999
      if (mos <= 3) expBuckets['0-90']++
      else if (mos <= 6) expBuckets['91-180']++
      else if (mos <= 12) expBuckets['181-365']++
      else expBuckets['365+']++
    })
    const expirationData = Object.entries(expBuckets).map(([name, count]) => ({ name, count }))

    // By type breakdown
    const byType: Record<string, { count: number; avgRent: number; avgMarket: number; totalRent: number; totalMarket: number }> = {}
    units.forEach(u => {
      if (!byType[u.type]) byType[u.type] = { count: 0, avgRent: 0, avgMarket: 0, totalRent: 0, totalMarket: 0 }
      byType[u.type].count++
      byType[u.type].totalRent += u.actualRent
      byType[u.type].totalMarket += u.marketRent
    })
    const typeData = Object.entries(byType).map(([type, v]) => ({
      type, count: v.count,
      avgRent: Math.round(v.totalRent / v.count),
      avgMarket: Math.round(v.totalMarket / v.count),
      ltl: Math.round(v.totalMarket - v.totalRent),
    }))

    // Status distribution for pie
    const statusDist = Object.entries(
      units.reduce((acc, u) => { acc[u.status] = (acc[u.status] || 0) + 1; return acc }, {} as Record<string, number>)
    ).map(([status, count]) => ({ name: STATUS_LABELS[status as UnitStatus], count, status }))

    return {
      totalUnits, occupiedUnits, vacantUnits, noticeUnits, downUnits,
      physicalOccupancy, economicOccupancy,
      grossPotentialRent, scheduledRent, vacancyLoss, effectiveGrossIncome,
      lossToLease, lossToLeasePct, upside,
      annualRevenue, annualGPR, annualEGI,
      noi, capRate, grm, impliedValueAtTarget,
      upsideNOI, upsideCapRate,
      expirationData, typeData, statusDist,
    }
  }, [units, purchasePrice, expenseRatio, capRateTarget])

  const selUnit = units.find(u => u.id === selectedUnit)

  const nearExpiry = units.filter(u => {
    const mos = monthsUntil(u.leaseEnd)
    return mos !== null && mos >= 0 && mos <= 3 && u.status === 'occupied'
  })

  return (
    <div className="space-y-6 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Rent Roll Analyzer</h2>
          <p className="text-slate-400 text-xs mt-1">Multifamily rent roll — loss to lease, physical/economic occupancy, lease expiration concentration, upside NOI</p>
        </div>
        <button onClick={() => setUnits(us => [...us, { id: String(nextId++), unitNum: String(nextId - 1), type: '1BR', sqft: 720, actualRent: 1300, marketRent: 1400, leaseEnd: '2026-06-30', status: 'occupied', tenantName: '' }])}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition">+ Add Unit</button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Physical Occupancy', value: `${calc.physicalOccupancy.toFixed(1)}%`, color: calc.physicalOccupancy >= 93 ? 'text-green-400' : calc.physicalOccupancy >= 85 ? 'text-yellow-400' : 'text-red-400' },
          { label: 'Economic Occupancy', value: `${calc.economicOccupancy.toFixed(1)}%`, color: calc.economicOccupancy >= 90 ? 'text-green-400' : 'text-yellow-400' },
          { label: 'Loss to Lease / mo', value: fmt(calc.lossToLease), color: 'text-orange-400' },
          { label: 'Total Upside / mo', value: fmt(calc.upside), color: 'text-purple-400' },
        ].map(m => (
          <div key={m.label} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 text-center">
            <p className={`text-2xl font-black ${m.color}`}>{m.value}</p>
            <p className="text-xs text-slate-400 mt-1">{m.label}</p>
          </div>
        ))}
      </div>

      {nearExpiry.length > 0 && (
        <div className="bg-yellow-900/20 rounded-xl p-3 border border-yellow-700/40">
          <p className="text-xs font-bold text-yellow-300 mb-1">⚠️ {nearExpiry.length} lease{nearExpiry.length > 1 ? 's' : ''} expiring within 90 days</p>
          <p className="text-xs text-yellow-200">{nearExpiry.map(u => `Unit ${u.unitNum} (${u.tenantName || 'Tenant'}) — expires ${u.leaseEnd}`).join(' · ')}</p>
        </div>
      )}

      {/* Income Statement */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Monthly Income Statement</p>
          <div className="space-y-1.5 text-xs">
            {[
              { label: 'Gross Potential Rent (GPR)', value: fmt(calc.grossPotentialRent), color: 'text-slate-300' },
              { label: 'Loss to Lease', value: `(${fmt(calc.lossToLease)})`, color: 'text-orange-400' },
              { label: 'Vacancy / Down Loss', value: `(${fmt(calc.vacancyLoss)})`, color: 'text-red-400' },
              { label: 'Effective Gross Income', value: fmt(calc.effectiveGrossIncome), color: 'text-white', bold: true },
            ].map(m => (
              <div key={m.label} className={`flex justify-between items-center p-2 rounded-lg ${m.bold ? 'bg-blue-900/20 border border-blue-700/30' : 'bg-slate-900/50'}`}>
                <span className="text-slate-400">{m.label}</span>
                <span className={`font-bold ${m.color}`}>{m.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Underwriting</p>
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Purchase Price</label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
                <input type="number" value={purchasePrice} onChange={e => setPurchasePrice(N(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-5 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Expense Ratio</label>
              <div className="relative">
                <input type="number" value={expenseRatio} onChange={e => setExpenseRatio(N(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-3 pr-8 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500" />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">%</span>
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Target Cap Rate</label>
              <div className="relative">
                <input type="number" value={capRateTarget} onChange={e => setCapRateTarget(N(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-3 pr-8 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500" />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 text-xs">%</span>
              </div>
            </div>
          </div>
          <div className="space-y-1 text-xs">
            {[
              { label: 'Annual NOI (current)', value: fmt(calc.noi), color: 'text-blue-400' },
              { label: 'Current Cap Rate', value: `${calc.capRate.toFixed(2)}%`, color: calc.capRate >= capRateTarget ? 'text-green-400' : 'text-red-400' },
              { label: 'GRM', value: calc.grm.toFixed(1) + 'x', color: 'text-slate-300' },
              { label: 'Value at Target Cap', value: fmt(calc.impliedValueAtTarget), color: calc.impliedValueAtTarget > purchasePrice ? 'text-green-400' : 'text-red-400' },
              { label: 'Upside NOI (stabilized)', value: fmt(calc.upsideNOI), color: 'text-purple-400' },
              { label: 'Upside Cap Rate', value: `${calc.upsideCapRate.toFixed(2)}%`, color: 'text-purple-400' },
            ].map(m => (
              <div key={m.label} className="flex justify-between items-center">
                <span className="text-slate-400">{m.label}</span>
                <span className={`font-bold ${m.color}`}>{m.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Unit Summary</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { label: 'Total Units', value: calc.totalUnits, color: 'text-white' },
              { label: 'Occupied', value: calc.occupiedUnits, color: 'text-green-400' },
              { label: 'Vacant', value: calc.vacantUnits, color: 'text-red-400' },
              { label: 'Notice / MTM', value: calc.noticeUnits, color: 'text-yellow-400' },
              { label: 'Down / Reno', value: calc.downUnits, color: 'text-slate-400' },
              { label: 'Loss-to-Lease%', value: `${calc.lossToLeasePct.toFixed(1)}%`, color: 'text-orange-400' },
            ].map(m => (
              <div key={m.label} className="bg-slate-900/50 rounded-lg p-2 text-center">
                <p className={`text-lg font-black ${m.color}`}>{m.value}</p>
                <p className="text-slate-500">{m.label}</p>
              </div>
            ))}
          </div>

          {/* Status pie */}
          <ResponsiveContainer width="100%" height={130}>
            <PieChart>
              <Pie data={calc.statusDist} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={55} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {calc.statusDist.map((s, i) => <Cell key={i} fill={STATUS_COLORS[s.status as UnitStatus] ?? '#94a3b8'} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Rent Roll Table */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-3 border-b border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Rent Roll ({units.length} units) — Click to edit</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-slate-500 border-b border-slate-700 bg-slate-900/30">
              <th className="text-left py-2 px-2">Unit</th>
              <th className="text-left py-2 px-2">Type</th>
              <th className="text-right py-2 px-2">Sqft</th>
              <th className="text-right py-2 px-2">Actual Rent</th>
              <th className="text-right py-2 px-2">Market Rent</th>
              <th className="text-right py-2 px-2">LTL</th>
              <th className="text-left py-2 px-2">Lease End</th>
              <th className="text-left py-2 px-2">Status</th>
              <th className="py-2 px-2"></th>
            </tr></thead>
            <tbody className="divide-y divide-slate-700/50">
              {units.map(u => {
                const ltl = Math.max(0, u.marketRent - u.actualRent)
                const mos = monthsUntil(u.leaseEnd)
                const expiring = mos !== null && mos >= 0 && mos <= 3
                return (
                  <tr key={u.id} className={`cursor-pointer transition ${selectedUnit === u.id ? 'bg-blue-900/20' : 'hover:bg-slate-700/20'} ${expiring ? 'border-l-2 border-yellow-500' : ''}`}
                    onClick={() => setSelectedUnit(s => s === u.id ? null : u.id)}>
                    <td className="py-2 px-2 text-slate-200 font-semibold">{u.unitNum}</td>
                    <td className="py-2 px-2 text-slate-400">{u.type}</td>
                    <td className="text-right py-2 px-2 text-slate-400">{u.sqft.toLocaleString()}</td>
                    <td className="text-right py-2 px-2 text-white">{u.actualRent > 0 ? fmt(u.actualRent) : '—'}</td>
                    <td className="text-right py-2 px-2 text-slate-400">{fmt(u.marketRent)}</td>
                    <td className={`text-right py-2 px-2 ${ltl > 0 ? 'text-orange-400' : 'text-green-400'}`}>{ltl > 0 ? `-${fmt(ltl)}` : '✓'}</td>
                    <td className="py-2 px-2 text-slate-400">
                      {u.leaseEnd || '—'}
                      {expiring && <span className="ml-1 text-yellow-400 font-bold">⚡{mos}mo</span>}
                    </td>
                    <td className="py-2 px-2">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: STATUS_COLORS[u.status] + '33', color: STATUS_COLORS[u.status] }}>
                        {STATUS_LABELS[u.status]}
                      </span>
                    </td>
                    <td className="py-2 px-2">
                      <button onClick={e => { e.stopPropagation(); setUnits(us => us.filter(x => x.id !== u.id)) }} className="text-slate-600 hover:text-red-400">✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-600 font-bold bg-slate-900/40 text-xs">
                <td colSpan={3} className="py-2 px-2 text-slate-300">TOTAL ({units.length} units)</td>
                <td className="text-right py-2 px-2 text-white">{fmt(calc.scheduledRent)}</td>
                <td className="text-right py-2 px-2 text-slate-400">{fmt(calc.grossPotentialRent)}</td>
                <td className="text-right py-2 px-2 text-orange-400">-{fmt(calc.lossToLease)}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Edit Panel */}
      {selUnit && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-blue-700/40">
          <p className="text-xs font-bold text-blue-300 uppercase tracking-widest mb-3">Editing Unit {selUnit.unitNum}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(['unitNum', 'sqft', 'actualRent', 'marketRent', 'tenantName', 'leaseEnd'] as const).map(k => (
              <div key={k}>
                <label className="block text-xs text-slate-400 mb-1 capitalize">{k.replace(/([A-Z])/g, ' $1')}</label>
                <input value={String(selUnit[k])} onChange={e => updateUnit(selUnit.id, k, e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500" />
              </div>
            ))}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Type</label>
              <select value={selUnit.type} onChange={e => updateUnit(selUnit.id, 'type', e.target.value as BRType)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500">
                {(['Studio', '1BR', '2BR', '3BR', '4BR+'] as BRType[]).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Status</label>
              <select value={selUnit.status} onChange={e => updateUnit(selUnit.id, 'status', e.target.value as UnitStatus)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500">
                {(Object.keys(STATUS_LABELS) as UnitStatus[]).map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Rent vs Market by Unit Type</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={calc.typeData}>
              <XAxis dataKey="type" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tickFormatter={v => `$${v}`} tick={{ fill: '#64748b', fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="avgRent" name="Avg Actual Rent" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="avgMarket" name="Avg Market Rent" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-3">Lease Expiration Concentration</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={calc.expirationData}>
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
              <YAxis tickFormatter={v => `${v} units`} tick={{ fill: '#64748b', fontSize: 10 }} allowDecimals={false} />
              <Tooltip formatter={(v: number) => `${v} unit${v !== 1 ? 's' : ''}`} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="count" name="Units Expiring" radius={[4, 4, 0, 0]}
                fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-500 mt-2">High concentration in 0-90 day bucket increases rollover risk</p>
        </div>
      </div>
    </div>
  )
}
