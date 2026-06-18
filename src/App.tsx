import { usePropertyStore } from './store/usePropertyStore'
import PropertyForm from './components/PropertyForm'
import ValuationResult from './components/ValuationResult'
import CompsTable from './components/CompsTable'
import MarketTrends from './components/MarketTrends'
import RenovationCalc from './components/RenovationCalc'
import InvestmentAnalysis from './components/InvestmentAnalysis'
import NeighborhoodScore from './components/NeighborhoodScore'
import MortgageCalc from './components/MortgageCalc'
import SavedProperties from './components/SavedProperties'
import PrintReport from './components/PrintReport'
import PropertyComparison from './components/PropertyComparison'
import AppreciationCalc from './components/AppreciationCalc'
import FlipCalc from './components/FlipCalc'
import CostOfOwnership from './components/CostOfOwnership'
import RentVsBuy from './components/RentVsBuy'
import PropertyScorecard from './components/PropertyScorecard'
import WhatIfAnalyzer from './components/WhatIfAnalyzer'
import ClosingCosts from './components/ClosingCosts'
import CapGainsTax from './components/CapGainsTax'
import StressTest from './components/StressTest'
import AffordabilityCalc from './components/AffordabilityCalc'
import EquityGrowth from './components/EquityGrowth'
import TaxBenefits from './components/TaxBenefits'
import RefinanceCalc from './components/RefinanceCalc'
import DownPaymentTracker from './components/DownPaymentTracker'
import SellerNetSheet from './components/SellerNetSheet'
import Exchange1031 from './components/Exchange1031'
import BuyingTimeline from './components/BuyingTimeline'
import EnergyROI from './components/EnergyROI'
import ShortTermRental from './components/ShortTermRental'
import MultiFamilyCalc from './components/MultiFamilyCalc'
import MaintenanceReserve from './components/MaintenanceReserve'
import CommuteCost from './components/CommuteCost'
import RateBuydown from './components/RateBuydown'
import HelocCalc from './components/HelocCalc'
import FirstTimeBuyer from './components/FirstTimeBuyer'
import BrrrrCalc from './components/BrrrrCalc'
import AppraisalGap from './components/AppraisalGap'
import WholesaleCalc from './components/WholesaleCalc'
import PropertyMgmt from './components/PropertyMgmt'
import MortgagePayoff from './components/MortgagePayoff'
import DepreciationCalc from './components/DepreciationCalc'
import LenderCompare from './components/LenderCompare'
import OfferCalculator from './components/OfferCalculator'
import HOACalc from './components/HOACalc'
import PropertyTaxAppeal from './components/PropertyTaxAppeal'
import LandlordROI from './components/LandlordROI'
import BorrowerQualifier from './components/BorrowerQualifier'
import LeaseOption from './components/LeaseOption'
import OwnerFinancing from './components/OwnerFinancing'
import CashFlowSensitivity from './components/CashFlowSensitivity'
import NewConstruction from './components/NewConstruction'
import InspectionCosts from './components/InspectionCosts'
import VacantLand from './components/VacantLand'
import MoveUpBuyer from './components/MoveUpBuyer'
import ConvertToRental from './components/ConvertToRental'
import DispositionCalc from './components/DispositionCalc'
import PropertyLLC from './components/PropertyLLC'
import PortfolioTracker from './components/PortfolioTracker'
import OpportunityZone from './components/OpportunityZone'
import HouseHack from './components/HouseHack'
import ArmAnalyzer from './components/ArmAnalyzer'
import RentalTaxCalc from './components/RentalTaxCalc'
import PropertyInsurance from './components/PropertyInsurance'
import PMIRemoval from './components/PMIRemoval'
import { buildShareUrl } from './utils/share'
import { useState } from 'react'

const TABS = [
  { id: 'valuation',     label: 'Valuation',    icon: '🏠' },
  { id: 'comps',         label: 'Comps',        icon: '🏘' },
  { id: 'market',        label: 'Market',       icon: '📈' },
  { id: 'appreciation',  label: 'History',      icon: '📅' },
  { id: 'scorecard',     label: 'Scorecard',    icon: '🏆' },
  { id: 'renovation',    label: 'Renovation',   icon: '🔨' },
  { id: 'investment',    label: 'Investment',   icon: '💰' },
  { id: 'flip',          label: 'Flip',         icon: '🔄' },
  { id: 'costs',         label: 'Ownership',    icon: '💸' },
  { id: 'rentvsbuy',     label: 'Rent vs Buy',  icon: '⚖️' },
  { id: 'neighborhood',  label: 'Area',         icon: '📍' },
  { id: 'mortgage',      label: 'Mortgage',     icon: '🏦' },
  { id: 'whatif',        label: 'What-If',      icon: '🔮' },
  { id: 'closing',       label: 'Closing',      icon: '📋' },
  { id: 'capgains',      label: 'Cap Gains',    icon: '📊' },
  { id: 'stress',        label: 'Stress Test',  icon: '⚡' },
  { id: 'affordability', label: 'Affordability', icon: '💡' },
  { id: 'equity',        label: 'Equity',        icon: '📈' },
  { id: 'taxbenefits',  label: 'Tax Benefits',  icon: '🏛' },
  { id: 'refinance',    label: 'Refinance',     icon: '🔁' },
  { id: 'downpayment',  label: 'Down Payment',  icon: '🏦' },
  { id: 'sellersheet',  label: 'Seller Net',    icon: '📄' },
  { id: 'exchange1031', label: '1031 Exchange', icon: '🔄' },
  { id: 'timeline',     label: 'Buy Guide',     icon: '📅' },
  { id: 'energyroi',   label: 'Green ROI',     icon: '🌱' },
  { id: 'str',         label: 'STR / Airbnb',  icon: '🏡' },
  { id: 'multifamily', label: 'Multi-Family',  icon: '🏘' },
  { id: 'maintenance', label: 'Maintenance',   icon: '🔧' },
  { id: 'commute',     label: 'Commute',       icon: '🚗' },
  { id: 'buydown',     label: 'Rate Buydown',  icon: '💲' },
  { id: 'heloc',       label: 'HELOC',         icon: '🏦' },
  { id: 'firsttime',   label: 'First-Time',    icon: '🔑' },
  { id: 'brrrr',       label: 'BRRRR',         icon: '♻️' },
  { id: 'appraisal',   label: 'Appraisal Gap', icon: '📐' },
  { id: 'wholesale',   label: 'Wholesale',     icon: '🤝' },
  { id: 'propmgmt',    label: 'Prop Mgmt',     icon: '🏢' },
  { id: 'payoff',      label: 'Payoff Planner',icon: '🎯' },
  { id: 'depreciation',label: 'Depreciation',  icon: '📉' },
  { id: 'lendercomp',  label: 'Lender Compare',icon: '🏦' },
  { id: 'offer',       label: 'Offer Strategy',icon: '📝' },
  { id: 'hoa',         label: 'HOA Impact',    icon: '🏘' },
  { id: 'taxappeal',   label: 'Tax Appeal',    icon: '⚖️' },
  { id: 'landlord',    label: 'Landlord ROI',  icon: '🏠' },
  { id: 'qualify',     label: 'Qualifier',     icon: '✅' },
  { id: 'leaseoption', label: 'Lease Option',  icon: '🔑' },
  { id: 'ownerfinance',label: 'Seller Finance',icon: '🤝' },
  { id: 'sensitivity', label: 'Sensitivity',   icon: '📊' },
  { id: 'newconstruct',label: 'Build vs Buy',  icon: '🏗' },
  { id: 'inspection',  label: 'Inspection',    icon: '🔍' },
  { id: 'vacantland',  label: 'Vacant Land',   icon: '🌿' },
  { id: 'moveup',      label: 'Move-Up',       icon: '⬆️' },
  { id: 'convertrent', label: 'Convert to Rental', icon: '🔄' },
  { id: 'disposition',  label: 'Exit Strategy',   icon: '🚪' },
  { id: 'llc',          label: 'LLC Analysis',    icon: '🏢' },
  { id: 'portfolio',    label: 'Portfolio',       icon: '📂' },
  { id: 'oppzone',      label: 'Opp Zone',        icon: '🏗' },
  { id: 'househack',    label: 'House Hack',      icon: '🔑' },
  { id: 'arm',          label: 'ARM Analyzer',    icon: '📉' },
  { id: 'rentaltax',    label: 'Rental Tax',      icon: '🧾' },
  { id: 'insurance',    label: 'Insurance',       icon: '🛡' },
  { id: 'pmiremoval',   label: 'PMI Removal',     icon: '✂️' },
  { id: 'compare',       label: 'Compare',      icon: '🔀' },
  { id: 'saved',         label: 'Saved',        icon: '💾' },
  { id: 'report',        label: 'Report',       icon: '🖨' },
]

export default function App() {
  const { activeTab, setActiveTab, result, savedProperties, input } = usePropertyStore()
  const [copied, setCopied] = useState(false)

  const handleShare = () => {
    const url = buildShareUrl(input)
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-sm">$</div>
            <div>
              <span className="font-black text-white tracking-tight">PropValue</span>
              <span className="text-slate-500 text-xs ml-2 hidden sm:inline">Property Value Evaluator</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {result && (
              <span className="bg-green-900/40 border border-green-700/50 text-green-400 px-2 py-1 rounded-full font-semibold">
                {result.estimatedValue.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
              </span>
            )}
            {savedProperties.length > 0 && (
              <span className="bg-slate-800 border border-slate-700 text-slate-400 px-2 py-1 rounded-full">
                {savedProperties.length} saved
              </span>
            )}
            {input.sqft > 0 && (
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-1 rounded-full transition"
              >
                {copied ? '✓ Copied!' : '🔗 Share'}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">

          {/* Left sidebar — always visible */}
          <div className="space-y-4">
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
              <PropertyForm />
            </div>

            {result && (
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5">
                <ValuationResult />
              </div>
            )}
          </div>

          {/* Right panel — tabbed */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
            {/* Tab bar */}
            <div className="border-b border-slate-800 px-4 pt-4">
              <div className="flex gap-1 overflow-x-auto pb-3 scrollbar-hide">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex-shrink-0 ${
                      activeTab === tab.id
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div className="p-5 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 180px)' }}>
              {activeTab === 'valuation'    && <ValuationPlaceholder />}
              {activeTab === 'comps'        && <CompsTable />}
              {activeTab === 'market'       && <MarketTrends />}
              {activeTab === 'appreciation' && <AppreciationCalc />}
              {activeTab === 'scorecard'    && <PropertyScorecard />}
              {activeTab === 'renovation'   && <RenovationCalc />}
              {activeTab === 'investment'   && <InvestmentAnalysis />}
              {activeTab === 'flip'         && <FlipCalc />}
              {activeTab === 'costs'        && <CostOfOwnership />}
              {activeTab === 'rentvsbuy'    && <RentVsBuy />}
              {activeTab === 'neighborhood' && <NeighborhoodScore />}
              {activeTab === 'mortgage'     && <MortgageCalc />}
              {activeTab === 'whatif'       && <WhatIfAnalyzer />}
              {activeTab === 'closing'      && <ClosingCosts />}
              {activeTab === 'capgains'     && <CapGainsTax />}
              {activeTab === 'stress'       && <StressTest />}
              {activeTab === 'affordability' && <AffordabilityCalc />}
              {activeTab === 'equity'        && <EquityGrowth />}
              {activeTab === 'taxbenefits'  && <TaxBenefits />}
              {activeTab === 'refinance'    && <RefinanceCalc />}
              {activeTab === 'downpayment'  && <DownPaymentTracker />}
              {activeTab === 'sellersheet'  && <SellerNetSheet />}
              {activeTab === 'exchange1031' && <Exchange1031 />}
              {activeTab === 'timeline'     && <BuyingTimeline />}
              {activeTab === 'energyroi'   && <EnergyROI />}
              {activeTab === 'str'         && <ShortTermRental />}
              {activeTab === 'multifamily' && <MultiFamilyCalc />}
              {activeTab === 'maintenance' && <MaintenanceReserve />}
              {activeTab === 'commute'     && <CommuteCost />}
              {activeTab === 'buydown'     && <RateBuydown />}
              {activeTab === 'heloc'       && <HelocCalc />}
              {activeTab === 'firsttime'   && <FirstTimeBuyer />}
              {activeTab === 'brrrr'       && <BrrrrCalc />}
              {activeTab === 'appraisal'   && <AppraisalGap />}
              {activeTab === 'wholesale'   && <WholesaleCalc />}
              {activeTab === 'propmgmt'    && <PropertyMgmt />}
              {activeTab === 'payoff'      && <MortgagePayoff />}
              {activeTab === 'depreciation'&& <DepreciationCalc />}
              {activeTab === 'lendercomp'  && <LenderCompare />}
              {activeTab === 'offer'       && <OfferCalculator />}
              {activeTab === 'hoa'         && <HOACalc />}
              {activeTab === 'taxappeal'   && <PropertyTaxAppeal />}
              {activeTab === 'landlord'    && <LandlordROI />}
              {activeTab === 'qualify'     && <BorrowerQualifier />}
              {activeTab === 'leaseoption' && <LeaseOption />}
              {activeTab === 'ownerfinance'&& <OwnerFinancing />}
              {activeTab === 'sensitivity' && <CashFlowSensitivity />}
              {activeTab === 'newconstruct'&& <NewConstruction />}
              {activeTab === 'inspection'  && <InspectionCosts />}
              {activeTab === 'vacantland'  && <VacantLand />}
              {activeTab === 'moveup'      && <MoveUpBuyer />}
              {activeTab === 'convertrent' && <ConvertToRental />}
              {activeTab === 'disposition' && <DispositionCalc />}
              {activeTab === 'llc'         && <PropertyLLC />}
              {activeTab === 'portfolio'   && <PortfolioTracker />}
              {activeTab === 'oppzone'     && <OpportunityZone />}
              {activeTab === 'househack'   && <HouseHack />}
              {activeTab === 'arm'         && <ArmAnalyzer />}
              {activeTab === 'rentaltax'   && <RentalTaxCalc />}
              {activeTab === 'insurance'   && <PropertyInsurance />}
              {activeTab === 'pmiremoval'  && <PMIRemoval />}
              {activeTab === 'compare'      && <PropertyComparison />}
              {activeTab === 'saved'        && <SavedProperties />}
              {activeTab === 'report'       && <PrintReport />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ValuationPlaceholder() {
  const { result, input } = usePropertyStore()

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <div className="text-6xl mb-4">🏠</div>
        <h2 className="text-lg font-bold text-slate-400 mb-2">Enter Property Details</h2>
        <p className="text-sm text-center max-w-sm">
          Fill in the property form on the left and click <strong className="text-slate-300">Estimate Value</strong> to get a full valuation with comps, market trends, renovation ROI, and investment analysis.
        </p>
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-lg">
          {[
            { icon: '📊', label: 'Sales Comparison', desc: 'Adjusts for 5 nearby comps' },
            { icon: '🔧', label: 'Cost Approach', desc: 'Age, condition, features' },
            { icon: '📍', label: 'Location Data', desc: 'State market pricing' },
            { icon: '🎯', label: 'Confidence Score', desc: 'Data completeness rating' },
          ].map(f => (
            <div key={f.label} className="bg-slate-800/50 rounded-xl p-3 text-center border border-slate-700">
              <div className="text-2xl mb-1">{f.icon}</div>
              <p className="text-xs font-semibold text-slate-300">{f.label}</p>
              <p className="text-xs text-slate-600 mt-0.5">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white mb-1">
          {input.address || `${input.bedrooms}bd/${input.bathrooms}ba in ${input.city || input.state}`}
        </h2>
        <p className="text-sm text-slate-400">
          Valuation complete · {result.comps.length} comps found · Confidence: {result.confidenceScore}%
        </p>
      </div>

      {/* How we calculated */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-3 font-bold">Methodology</p>
        <div className="space-y-2 text-sm">
          <div className="flex gap-3">
            <span className="text-blue-400 font-bold w-4">1</span>
            <span className="text-slate-300">Base value calculated from living area × local $/sqft (state avg)</span>
          </div>
          <div className="flex gap-3">
            <span className="text-blue-400 font-bold w-4">2</span>
            <span className="text-slate-300">Adjusted for condition, age, garage, pool, basement, and bed/bath count</span>
          </div>
          <div className="flex gap-3">
            <span className="text-blue-400 font-bold w-4">3</span>
            <span className="text-slate-300">Blended 45% cost approach + 55% comparable sales approach</span>
          </div>
          <div className="flex gap-3">
            <span className="text-blue-400 font-bold w-4">4</span>
            <span className="text-slate-300">±8% confidence range based on data completeness score</span>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        PropValue is an estimate tool only. For a certified appraisal consult a licensed appraiser.
        Explore the tabs above for comps, market trends, renovation ROI, and investment analysis.
      </p>
    </div>
  )
}
