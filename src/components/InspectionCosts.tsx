import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

interface InspectionItem {
  id: string
  category: string
  item: string
  severity: 'critical' | 'major' | 'minor' | 'cosmetic'
  costLow: number
  costHigh: number
  diy: boolean
  checked: boolean
  urgency: 'immediate' | '1yr' | '3yr' | 'monitor'
}

const DEFAULT_ITEMS: InspectionItem[] = [
  // Roof
  { id: 'roof_replace',  category: 'Roof',          item: 'Full roof replacement',         severity: 'critical', costLow: 8000,  costHigh: 20000, diy: false, checked: false, urgency: 'immediate' },
  { id: 'roof_repair',   category: 'Roof',          item: 'Partial roof repair / flashing', severity: 'major',    costLow: 500,   costHigh: 3000,  diy: false, checked: false, urgency: '1yr' },
  { id: 'gutters',       category: 'Roof',          item: 'Gutters / downspouts replace',  severity: 'minor',    costLow: 800,   costHigh: 2500,  diy: true,  checked: false, urgency: '1yr' },
  // Foundation
  { id: 'found_major',   category: 'Foundation',    item: 'Foundation crack repair (major)',severity: 'critical', costLow: 10000, costHigh: 50000, diy: false, checked: false, urgency: 'immediate' },
  { id: 'found_minor',   category: 'Foundation',    item: 'Minor crack / waterproofing',   severity: 'major',    costLow: 2000,  costHigh: 8000,  diy: false, checked: false, urgency: '1yr' },
  { id: 'crawlspace',    category: 'Foundation',    item: 'Crawlspace encapsulation',      severity: 'major',    costLow: 3000,  costHigh: 10000, diy: false, checked: false, urgency: '1yr' },
  // HVAC
  { id: 'hvac_replace',  category: 'HVAC',          item: 'HVAC system replacement',       severity: 'major',    costLow: 5000,  costHigh: 12000, diy: false, checked: false, urgency: '1yr' },
  { id: 'hvac_service',  category: 'HVAC',          item: 'HVAC service / tune-up',        severity: 'minor',    costLow: 150,   costHigh: 400,   diy: false, checked: false, urgency: 'immediate' },
  { id: 'ductwork',      category: 'HVAC',          item: 'Ductwork repair / seal',        severity: 'minor',    costLow: 500,   costHigh: 2500,  diy: false, checked: false, urgency: '3yr' },
  // Plumbing
  { id: 'main_sewer',    category: 'Plumbing',      item: 'Sewer line replace / repair',   severity: 'critical', costLow: 3000,  costHigh: 15000, diy: false, checked: false, urgency: 'immediate' },
  { id: 'water_heater',  category: 'Plumbing',      item: 'Water heater replacement',      severity: 'major',    costLow: 800,   costHigh: 2500,  diy: false, checked: false, urgency: '1yr' },
  { id: 'plumb_repair',  category: 'Plumbing',      item: 'Pipe repairs / leaks',          severity: 'major',    costLow: 300,   costHigh: 3000,  diy: false, checked: false, urgency: 'immediate' },
  { id: 'repipe',        category: 'Plumbing',      item: 'Full repipe (galvanized/poly)',  severity: 'critical', costLow: 5000,  costHigh: 15000, diy: false, checked: false, urgency: '1yr' },
  // Electrical
  { id: 'panel_upgrade', category: 'Electrical',    item: 'Panel upgrade / replace',       severity: 'critical', costLow: 2500,  costHigh: 6000,  diy: false, checked: false, urgency: 'immediate' },
  { id: 'gfci_afci',    category: 'Electrical',    item: 'GFCI/AFCI outlets, safety fixes', severity: 'major',  costLow: 400,   costHigh: 1500,  diy: true,  checked: false, urgency: '1yr' },
  { id: 'knob_tube',    category: 'Electrical',    item: 'Knob-and-tube wiring remediate', severity: 'critical', costLow: 5000, costHigh: 20000, diy: false, checked: false, urgency: 'immediate' },
  // Insulation / Windows
  { id: 'insulation',   category: 'Insulation',    item: 'Attic insulation add / replace', severity: 'minor',   costLow: 1500,  costHigh: 5000,  diy: true,  checked: false, urgency: '3yr' },
  { id: 'windows',      category: 'Windows',       item: 'Window replace (single pane)',   severity: 'minor',   costLow: 300,   costHigh: 800,   diy: false, checked: false, urgency: '3yr' },
  // Interior
  { id: 'mold',         category: 'Mold / IAQ',    item: 'Mold remediation',               severity: 'critical', costLow: 2000, costHigh: 30000, diy: false, checked: false, urgency: 'immediate' },
  { id: 'asbestos',     category: 'Hazmat',        item: 'Asbestos abatement',             severity: 'critical', costLow: 1500, costHigh: 15000, diy: false, checked: false, urgency: 'immediate' },
  { id: 'lead_paint',   category: 'Hazmat',        item: 'Lead paint remediation',         severity: 'major',    costLow: 2000, costHigh: 10000, diy: false, checked: false, urgency: '1yr' },
  // Exterior
  { id: 'siding',       category: 'Exterior',      item: 'Siding repair / replace',        severity: 'major',    costLow: 3000, costHigh: 20000, diy: false, checked: false, urgency: '1yr' },
  { id: 'driveway',     category: 'Exterior',      item: 'Driveway / walkway repair',      severity: 'cosmetic', costLow: 500,  costHigh: 5000,  diy: true,  checked: false, urgency: '3yr' },
  { id: 'deck',         category: 'Exterior',      item: 'Deck repair / replace',          severity: 'major',    costLow: 2000, costHigh: 20000, diy: true,  checked: false, urgency: '1yr' },
]

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  major:    '#f59e0b',
  minor:    '#3b82f6',
  cosmetic: '#64748b',
}

const URGENCY_LABELS: Record<string, string> = {
  immediate: 'Fix before close / immediately',
  '1yr':     'Address within 1 year',
  '3yr':     'Plan for within 3 years',
  monitor:   'Monitor, no action yet',
}

export default function InspectionCosts() {
  const [items, setItems]       = useState<InspectionItem[]>(DEFAULT_ITEMS)
  const [negotiateTarget, setNegotiateTarget] = useState(50)  // % of total to ask seller to cover

  const toggleItem = (id: string) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, checked: !it.checked } : it))
  }

  const checked = useMemo(() => items.filter(i => i.checked), [items])

  const totals = useMemo(() => {
    const low  = checked.reduce((s, i) => s + i.costLow, 0)
    const high = checked.reduce((s, i) => s + i.costHigh, 0)
    const mid  = (low + high) / 2
    const criticalCost = checked.filter(i => i.severity === 'critical').reduce((s, i) => s + (i.costLow + i.costHigh) / 2, 0)
    const byCategory = Object.entries(
      checked.reduce((acc, i) => { acc[i.category] = (acc[i.category] ?? 0) + (i.costLow + i.costHigh) / 2; return acc }, {} as Record<string, number>)
    ).sort((a, b) => b[1] - a[1]).map(([cat, cost]) => ({ cat, cost: Math.round(cost) }))

    const askSeller = mid * negotiateTarget / 100
    const buyerPays = mid - askSeller

    return { low, high, mid, criticalCost, byCategory, askSeller, buyerPays }
  }, [checked, negotiateTarget])

  const categories = [...new Set(DEFAULT_ITEMS.map(i => i.category))]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Inspection Cost Estimator</h3>
        <p className="text-xs text-slate-500">
          Check off inspection findings to estimate repair costs, prioritize by severity,
          and determine your negotiation position with the seller.
        </p>
      </div>

      {/* Totals */}
      {checked.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Low Estimate',     value: fmt(totals.low),          color: 'text-green-400' },
            { label: 'High Estimate',    value: fmt(totals.high),         color: 'text-red-400' },
            { label: 'Mid Estimate',     value: fmt(totals.mid),          color: 'text-white' },
            { label: 'Critical Items',   value: fmt(totals.criticalCost), color: 'text-red-400' },
          ].map(s => (
            <div key={s.label} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700 text-center">
              <p className="text-xs text-slate-500 mb-1">{s.label}</p>
              <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Negotiation slider */}
      {checked.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <div className="flex justify-between mb-1">
            <label className="text-xs text-slate-400 uppercase tracking-widest">Ask Seller to Cover</label>
            <span className="text-xs font-bold text-blue-400">{negotiateTarget}% = {fmt(totals.askSeller)}</span>
          </div>
          <input type="range" min={0} max={100} step={10} value={negotiateTarget}
            onChange={e => setNegotiateTarget(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
            <div className="bg-green-900/20 border border-green-800/40 rounded-lg p-2 text-center">
              <p className="text-slate-500">Request from Seller</p>
              <p className="text-green-400 font-black text-lg">{fmt(totals.askSeller)}</p>
            </div>
            <div className="bg-blue-900/20 border border-blue-800/40 rounded-lg p-2 text-center">
              <p className="text-slate-500">Buyer Covers</p>
              <p className="text-blue-400 font-black text-lg">{fmt(totals.buyerPays)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Cost by category chart */}
      {totals.byCategory.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-4">Cost by Category</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={totals.byCategory} layout="vertical" margin={{ top: 0, right: 40, left: 80, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false}
                tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
              <YAxis type="category" dataKey="cat" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} width={75} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(v: number) => [fmt(v), 'Estimated']} />
              <Bar dataKey="cost" radius={[0, 4, 4, 0]} fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Checklist */}
      <div className="space-y-4">
        {categories.map(cat => {
          const catItems = items.filter(i => i.category === cat)
          const catChecked = catItems.filter(i => i.checked).length
          return (
            <div key={cat} className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-800/80 border-b border-slate-700">
                <p className="text-xs font-bold text-slate-200">{cat}</p>
                <span className="text-xs text-slate-500">{catChecked}/{catItems.length} flagged</span>
              </div>
              <div className="divide-y divide-slate-700/50">
                {catItems.map(item => (
                  <div key={item.id}
                    className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition ${item.checked ? 'bg-slate-700/30' : 'hover:bg-slate-700/20'}`}
                    onClick={() => toggleItem(item.id)}>
                    <div className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border ${item.checked ? 'bg-blue-600 border-blue-600' : 'border-slate-600'}`}>
                      {item.checked && <span className="text-white text-xs font-black">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-200">{item.item}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ background: SEVERITY_COLORS[item.severity] + '33', color: SEVERITY_COLORS[item.severity] }}>
                          {item.severity}
                        </span>
                        {item.diy && <span className="text-xs text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded-full">DIY ok</span>}
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{URGENCY_LABELS[item.urgency]}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-bold text-slate-300">{fmt(item.costLow)}–{fmt(item.costHigh)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Negotiation Strategy</p>
        <div className="space-y-1.5 text-xs text-slate-400">
          {[
            '🔴 Critical items (foundation, electrical panel, sewer, mold): ask seller to repair or credit 100%. These are deal-breakers if unresolved.',
            '🟡 Major items (HVAC, roof, water heater): negotiate a credit at closing — more flexible than demanding repairs.',
            '🔵 Minor items: these are normal wear; consider bundling into one credit request instead of itemizing.',
            '💡 Cash credit > seller repairs: you control the contractor, timing, and quality.',
            '📋 Re-inspect after seller repairs — don\'t just accept "we fixed it" without verification.',
            '⚠️ Ask for a price reduction instead of a credit if you\'re at your DTI limit — credits can\'t always be used for down payment.',
          ].map((t, i) => <p key={i}>{t}</p>)}
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Cost estimates are national averages and vary significantly by region, contractor, and scope.
        Always get 2–3 contractor quotes before negotiating repairs or credits.
      </p>
    </div>
  )
}
