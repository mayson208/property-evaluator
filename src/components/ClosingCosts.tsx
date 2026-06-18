import { useState, useMemo } from 'react'
import { usePropertyStore } from '../store/usePropertyStore'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function fmtPct(n: number) {
  return `${n.toFixed(2)}%`
}

type Role = 'buyer' | 'seller'

export default function ClosingCosts() {
  const { result } = usePropertyStore()
  const homeValue = result?.estimatedValue ?? 400000

  const [role, setRole]               = useState<Role>('buyer')
  const [salePrice, setSalePrice]     = useState(homeValue)
  const [loanAmount, setLoanAmount]   = useState(Math.round(homeValue * 0.8))
  const [originationPct, setOrigination] = useState(1.0)
  const [titleInsurancePct, setTitle] = useState(0.5)
  const [agentFeesPct, setAgentFees]  = useState(6.0)
  const [transferTaxPct, setTransfer] = useState(0.1)

  const buyerCosts = useMemo(() => {
    const loanOrigination      = loanAmount * (originationPct / 100)
    const appraisal            = 600
    const homeInspection       = 450
    const titleInsurance       = salePrice * (titleInsurancePct / 100)
    const titleSearch          = 300
    const escrowFees           = 800
    const recordingFees        = 150
    const prepaidInterest      = (loanAmount * 0.0725 / 365) * 15  // ~15 days prepaid interest
    const prepaidInsurance     = Math.round(salePrice * 0.005)    // 1yr homeowners insurance
    const prepaidTax           = Math.round(salePrice * 0.011 / 12 * 3) // 3mo property tax escrow
    const creditReport         = 35
    const floodCert            = 25
    const surveyFee            = 500

    const items = [
      { category: 'Loan Costs', label: 'Loan Origination Fee',   amount: Math.round(loanOrigination),  pct: originationPct },
      { category: 'Loan Costs', label: 'Credit Report',          amount: creditReport,                  pct: null },
      { category: 'Loan Costs', label: 'Flood Certification',    amount: floodCert,                    pct: null },
      { category: 'Title',      label: 'Title Insurance',        amount: Math.round(titleInsurance),   pct: titleInsurancePct },
      { category: 'Title',      label: 'Title Search',           amount: titleSearch,                  pct: null },
      { category: 'Settlement', label: 'Appraisal Fee',          amount: appraisal,                    pct: null },
      { category: 'Settlement', label: 'Home Inspection',        amount: homeInspection,               pct: null },
      { category: 'Settlement', label: 'Escrow / Settlement Fee',amount: escrowFees,                   pct: null },
      { category: 'Settlement', label: 'Recording Fees',         amount: recordingFees,                pct: null },
      { category: 'Settlement', label: 'Survey Fee',             amount: surveyFee,                    pct: null },
      { category: 'Prepaids',   label: 'Prepaid Interest (15d)', amount: Math.round(prepaidInterest),  pct: null },
      { category: 'Prepaids',   label: 'Homeowner\'s Insurance (1yr)', amount: prepaidInsurance,       pct: null },
      { category: 'Prepaids',   label: 'Property Tax Escrow (3mo)',    amount: prepaidTax,             pct: null },
    ]

    const total = items.reduce((s, i) => s + i.amount, 0)
    return { items, total }
  }, [salePrice, loanAmount, originationPct, titleInsurancePct])

  const sellerCosts = useMemo(() => {
    const agentCommission     = salePrice * (agentFeesPct / 100)
    const transferTax         = salePrice * (transferTaxPct / 100)
    const titleInsurance      = salePrice * 0.003
    const escrowFees          = 800
    const recordingFees       = 100
    const homeWarranty        = 500
    const staging             = 2000
    const repairAllowance     = salePrice * 0.005  // typical concession ~0.5%

    const items = [
      { category: 'Commissions', label: `Agent Commission (${agentFeesPct}%)`, amount: Math.round(agentCommission), pct: agentFeesPct },
      { category: 'Taxes',       label: `Transfer Tax (${fmtPct(transferTaxPct)})`,  amount: Math.round(transferTax),  pct: transferTaxPct },
      { category: 'Title',       label: 'Title Insurance (owner\'s)',  amount: Math.round(titleInsurance), pct: null },
      { category: 'Settlement',  label: 'Escrow / Closing Fee',        amount: escrowFees,                 pct: null },
      { category: 'Settlement',  label: 'Recording Fees',              amount: recordingFees,              pct: null },
      { category: 'Settlement',  label: 'Home Warranty',               amount: homeWarranty,               pct: null },
      { category: 'Misc',        label: 'Staging / Prep',             amount: staging,                    pct: null },
      { category: 'Misc',        label: 'Repair Allowance / Concessions', amount: Math.round(repairAllowance), pct: null },
    ]

    const total = items.reduce((s, i) => s + i.amount, 0)
    return { items, total }
  }, [salePrice, agentFeesPct, transferTaxPct])

  const costs = role === 'buyer' ? buyerCosts : sellerCosts
  const netProceeds = role === 'seller' ? salePrice - sellerCosts.total : null

  const categories = [...new Set(costs.items.map(i => i.category))]

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1">Closing Costs Estimator</h3>
        <p className="text-xs text-slate-500">Estimate buyer or seller closing costs for a transaction</p>
      </div>

      {result && (
        <div className="bg-blue-900/30 border border-blue-800/50 rounded-xl p-3 text-xs text-blue-300">
          Using estimated value of <strong>{fmt(homeValue)}</strong> as the starting sale price.
        </div>
      )}

      {/* Role toggle */}
      <div className="flex gap-2">
        {(['buyer', 'seller'] as Role[]).map(r => (
          <button key={r} onClick={() => setRole(r)}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition border capitalize ${
              role === r ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
            }`}>
            {r === 'buyer' ? '🏠 Buyer' : '🏷 Seller'}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 space-y-4">
        <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Transaction Details</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-400 uppercase tracking-widest block mb-1">Sale Price</label>
            <input type="number" value={salePrice}
              onChange={e => { setSalePrice(Number(e.target.value)); setLoanAmount(Math.round(Number(e.target.value) * 0.8)) }}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
          </div>
          {role === 'buyer' && (
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-widest block mb-1">Loan Amount</label>
              <input type="number" value={loanAmount}
                onChange={e => setLoanAmount(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
            </div>
          )}
        </div>

        {role === 'buyer' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-slate-400 uppercase tracking-widest">Loan Origination</label>
                <span className="text-xs font-bold text-blue-400">{originationPct}%</span>
              </div>
              <input type="range" min={0} max={3} step={0.125} value={originationPct}
                onChange={e => setOrigination(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-slate-400 uppercase tracking-widest">Title Insurance</label>
                <span className="text-xs font-bold text-blue-400">{titleInsurancePct}%</span>
              </div>
              <input type="range" min={0.2} max={1} step={0.05} value={titleInsurancePct}
                onChange={e => setTitle(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
            </div>
          </div>
        )}

        {role === 'seller' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-slate-400 uppercase tracking-widest">Agent Commission</label>
                <span className="text-xs font-bold text-blue-400">{agentFeesPct}%</span>
              </div>
              <input type="range" min={0} max={10} step={0.5} value={agentFeesPct}
                onChange={e => setAgentFees(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-slate-400 uppercase tracking-widest">Transfer Tax</label>
                <span className="text-xs font-bold text-blue-400">{transferTaxPct}%</span>
              </div>
              <input type="range" min={0} max={2} step={0.05} value={transferTaxPct}
                onChange={e => setTransfer(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500" />
            </div>
          </div>
        )}
      </div>

      {/* Hero total */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 border border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">
              Total {role === 'buyer' ? 'Closing Costs' : 'Seller Costs'}
            </p>
            <p className="text-4xl font-black text-white">{fmt(costs.total)}</p>
            <p className="text-sm text-slate-400 mt-1">
              {((costs.total / salePrice) * 100).toFixed(1)}% of sale price
            </p>
          </div>
          {netProceeds !== null && (
            <div className="text-right">
              <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Net Proceeds</p>
              <p className="text-2xl font-black text-green-400">{fmt(netProceeds)}</p>
              <p className="text-xs text-slate-500 mt-1">After all seller costs</p>
            </div>
          )}
        </div>
      </div>

      {/* Itemized by category */}
      <div className="space-y-3">
        {categories.map(cat => {
          const catItems = costs.items.filter(i => i.category === cat)
          const catTotal = catItems.reduce((s, i) => s + i.amount, 0)
          return (
            <div key={cat} className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700 bg-slate-800">
                <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">{cat}</p>
                <p className="text-xs font-bold text-slate-200">{fmt(catTotal)}</p>
              </div>
              {catItems.map((item, i) => (
                <div key={i} className="flex justify-between items-center px-4 py-2 border-b border-slate-700/50 text-sm last:border-0">
                  <span className="text-slate-400">{item.label}</span>
                  <span className="font-mono text-slate-200">{fmt(item.amount)}</span>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-slate-600 text-center">
        Estimates only. Actual closing costs vary by lender, location, and transaction terms.
        {role === 'buyer' && ' Some costs may be negotiated with the seller as a concession.'}
        {role === 'seller' && ' Net proceeds do not include capital gains tax or outstanding mortgage payoff.'}
      </p>
    </div>
  )
}
