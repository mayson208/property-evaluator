import { usePropertyStore } from '../store/usePropertyStore'
import { generateNeighborhoodScore } from '../engine/market'
import { getAnnualPropertyTax, getAnnualInsurance, getAnnualMaintenance } from '../engine/valuation'

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-base font-bold text-slate-700 border-b border-slate-200 pb-1 mb-3 uppercase tracking-widest">{title}</h2>
      {children}
    </div>
  )
}

export default function PrintReport() {
  const { result, input, renovations, selectedRenovations } = usePropertyStore()

  const handlePrint = () => window.print()

  if (!result) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-4xl mb-3">🖨</p>
        <p>Run a valuation to generate a printable report</p>
      </div>
    )
  }

  const neighborhood = generateNeighborhoodScore(input.zip || input.city || input.state || '00000')
  const selected = renovations.filter(r => selectedRenovations.has(r.id))
  const totalCost = selected.reduce((s, r) => s + r.cost, 0)
  const totalValueAdd = selected.reduce((s, r) => s + r.valueAdd, 0)
  const appreciation = input.purchasePrice && input.purchaseYear
    ? ((result.estimatedValue - input.purchasePrice) / input.purchasePrice) * 100
    : null
  const annualTax   = getAnnualPropertyTax(result.estimatedValue, input.state)
  const annualIns   = getAnnualInsurance(result.estimatedValue)
  const annualMaint = getAnnualMaintenance(result.estimatedValue, input.yearBuilt)
  const annualOwnership = annualTax + annualIns + annualMaint

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest">Print Report</h3>
          <p className="text-xs text-slate-500 mt-0.5">Full valuation summary for printing or sharing</p>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-4 py-2 rounded-xl transition"
        >
          🖨 Print / Save PDF
        </button>
      </div>

      {/* Print preview */}
      <div
        id="print-report"
        className="bg-white text-slate-800 rounded-xl p-8 border border-slate-300 print:border-0 print:rounded-none print:p-0"
        style={{ fontFamily: 'Georgia, serif' }}
      >
        {/* Report header */}
        <div className="text-center mb-8 pb-6 border-b-2 border-slate-200">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">PropValue — Property Valuation Report</p>
          <h1 className="text-3xl font-black text-slate-900 mb-1">
            {input.address || `${input.bedrooms}bd/${input.bathrooms}ba Property`}
          </h1>
          <p className="text-slate-500">
            {[input.city, input.state, input.zip].filter(Boolean).join(', ')}
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Report generated {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Estimated value hero */}
        <div className="bg-slate-50 rounded-xl p-6 mb-8 text-center border border-slate-200">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Estimated Market Value</p>
          <p className="text-5xl font-black text-blue-600">{fmt(result.estimatedValue)}</p>
          <p className="text-slate-500 mt-2">
            Range: {fmt(result.lowValue)} — {fmt(result.highValue)}
          </p>
          <div className="flex justify-center gap-6 mt-3 text-sm text-slate-600">
            <span><strong>${result.pricePerSqft}</strong>/sqft</span>
            <span>Confidence: <strong>{result.confidenceScore}%</strong></span>
            <span>{result.methodology}</span>
          </div>
        </div>

        {/* Property details */}
        <Section title="Property Details">
          <div className="grid grid-cols-3 gap-4 text-sm">
            {[
              ['Type',        input.propertyType.replace('_', ' ')],
              ['Living Area', `${input.sqft.toLocaleString()} sqft`],
              ['Lot Size',    `${input.lotSqft.toLocaleString()} sqft`],
              ['Bedrooms',    input.bedrooms],
              ['Bathrooms',   input.bathrooms],
              ['Year Built',  input.yearBuilt],
              ['Condition',   input.condition],
              ['Garage',      input.garage.replace('_', ' ')],
              ['Stories',     input.stories],
              ['Pool',        input.hasPool ? 'Yes' : 'No'],
              ['Basement',    input.hasBasement ? `Yes (${input.basementSqft} sqft)` : 'No'],
              ['Fireplace',   input.hasFireplace ? 'Yes' : 'No'],
            ].map(([l, v]) => (
              <div key={String(l)} className="border-b border-slate-100 pb-2">
                <p className="text-xs text-slate-400 uppercase tracking-wide">{l}</p>
                <p className="font-semibold text-slate-700 capitalize">{String(v)}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Value adjustments */}
        {result.adjustments.length > 0 && (
          <Section title="Value Adjustments">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase tracking-wide">
                  <th className="pb-2">Item</th>
                  <th className="pb-2 text-right">Adjustment</th>
                </tr>
              </thead>
              <tbody>
                {result.adjustments.map((adj, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-600">{adj.label}</td>
                    <td className={`py-1.5 text-right font-semibold font-mono ${adj.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {adj.amount >= 0 ? '+' : ''}{fmt(adj.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* Comparable sales */}
        <Section title="Comparable Sales">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 uppercase tracking-wide">
                <th className="pb-2">Address</th>
                <th className="pb-2 text-right">Sale Price</th>
                <th className="pb-2 text-right">Sqft</th>
                <th className="pb-2 text-right">$/sqft</th>
                <th className="pb-2 text-right">Adjusted</th>
                <th className="pb-2 text-right">Date</th>
              </tr>
            </thead>
            <tbody>
              {result.comps.map((c, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="py-1.5 text-slate-600">{c.address} <span className="text-slate-400">({c.distance}mi)</span></td>
                  <td className="py-1.5 text-right font-mono">{fmt(c.soldPrice)}</td>
                  <td className="py-1.5 text-right font-mono">{c.sqft.toLocaleString()}</td>
                  <td className="py-1.5 text-right font-mono">${c.pricePerSqft}</td>
                  <td className="py-1.5 text-right font-mono font-semibold text-blue-600">{fmt(c.adjustedPrice)}</td>
                  <td className="py-1.5 text-right text-slate-400 text-xs">{c.soldDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* Appreciation (if applicable) */}
        {appreciation !== null && input.purchasePrice > 0 && (
          <Section title="Purchase History">
            <div className="grid grid-cols-4 gap-4 text-sm">
              {[
                ['Purchase Price', fmt(input.purchasePrice)],
                ['Purchase Year',  input.purchaseYear],
                ['Current Value',  fmt(result.estimatedValue)],
                ['Total Gain',     `${appreciation >= 0 ? '+' : ''}${appreciation.toFixed(1)}% (${fmt(result.estimatedValue - input.purchasePrice)})`],
              ].map(([l, v]) => (
                <div key={String(l)} className="border-b border-slate-100 pb-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wide">{l}</p>
                  <p className="font-semibold text-slate-700">{String(v)}</p>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Annual Costs */}
        <Section title="Estimated Annual Ownership Costs">
          <div className="grid grid-cols-4 gap-4 text-sm mb-2">
            {[
              ['Property Tax',  fmt(annualTax),   `${input.state} eff. rate`],
              ['Insurance',     fmt(annualIns),   '~0.5% of value'],
              ['Maintenance',   fmt(annualMaint), input.yearBuilt < 1990 ? '1.5%/yr' : '1.0%/yr'],
              ['Total Annual',  fmt(annualOwnership), `${fmt(Math.round(annualOwnership / 12))}/mo`],
            ].map(([l, v, sub]) => (
              <div key={String(l)} className="border-b border-slate-100 pb-2">
                <p className="text-xs text-slate-400 uppercase tracking-wide">{l}</p>
                <p className="font-semibold text-slate-700">{String(v)}</p>
                <p className="text-xs text-slate-400">{String(sub)}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400">Excludes HOA, utilities, and mortgage payments.</p>
        </Section>

        {/* Neighborhood */}
        <Section title="Neighborhood Scores">
          <div className="grid grid-cols-3 gap-3 text-sm">
            {[
              ['Overall',     neighborhood.overall],
              ['Schools',     neighborhood.schools],
              ['Safety',      neighborhood.safety],
              ['Walkability', neighborhood.walkability],
              ['Transit',     neighborhood.transit],
              ['Amenities',   neighborhood.amenities],
            ].map(([l, v]) => (
              <div key={String(l)} className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-600">{l}</span>
                <span className={`font-bold ${Number(v) >= 70 ? 'text-green-600' : Number(v) >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{v}/100</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Renovations if any selected */}
        {selected.length > 0 && (
          <Section title="Renovation Plan">
            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase tracking-wide">
                  <th className="pb-2">Renovation</th>
                  <th className="pb-2 text-right">Cost</th>
                  <th className="pb-2 text-right">Value Added</th>
                  <th className="pb-2 text-right">ROI</th>
                </tr>
              </thead>
              <tbody>
                {selected.map(r => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-600">{r.name}</td>
                    <td className="py-1.5 text-right font-mono text-red-600">-{fmt(r.cost)}</td>
                    <td className="py-1.5 text-right font-mono text-green-600">+{fmt(r.valueAdd)}</td>
                    <td className={`py-1.5 text-right font-bold ${r.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>{r.roi}%</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-300 font-bold">
                  <td className="pt-2">Total</td>
                  <td className="pt-2 text-right font-mono text-red-600">-{fmt(totalCost)}</td>
                  <td className="pt-2 text-right font-mono text-green-600">+{fmt(totalValueAdd)}</td>
                  <td className={`pt-2 text-right ${totalValueAdd >= totalCost ? 'text-green-600' : 'text-red-600'}`}>
                    {Math.round(((totalValueAdd - totalCost) / totalCost) * 100)}%
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
              After-renovation estimated value:{' '}
              <strong className="text-blue-600">{fmt(result.estimatedValue + totalValueAdd)}</strong>
            </div>
          </Section>
        )}

        {/* Disclaimer */}
        <div className="text-xs text-slate-400 text-center mt-8 pt-4 border-t border-slate-200">
          This report is generated by PropValue for informational purposes only. It is not a certified appraisal.
          Values are estimates based on publicly available state market data and should not be used for financing, legal, or tax purposes.
          For a certified appraisal, consult a licensed real estate appraiser.
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-report, #print-report * { visibility: visible; }
          #print-report { position: fixed; top: 0; left: 0; width: 100%; background: white; }
        }
      `}</style>
    </div>
  )
}
