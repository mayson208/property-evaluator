import type { MarketDataPoint, NeighborhoodScore, InvestmentAnalysis } from '../types'

export function generateMarketData(state: string, basePPF: number): MarketDataPoint[] {
  const months: MarketDataPoint[] = []
  const now = new Date()

  // Simulate 24 months of market data with trend
  let price = basePPF * 1800   // rough median home value
  let ppf = basePPF

  for (let i = 23; i >= 0; i--) {
    const d = new Date(now)
    d.setMonth(d.getMonth() - i)
    const label = d.toLocaleString('default', { month: 'short', year: '2-digit' })

    // Add slight upward trend + seasonal noise
    const seasonal = Math.sin((d.getMonth() / 12) * Math.PI * 2) * 0.02
    const trend = 0.004
    const noise = (Math.random() - 0.5) * 0.015
    price = price * (1 + trend + seasonal + noise)
    ppf = ppf * (1 + trend * 0.8 + noise * 0.5)

    months.push({
      month: label,
      medianPrice: Math.round(price / 1000) * 1000,
      pricePerSqft: Math.round(ppf),
      daysOnMarket: Math.round(28 + (Math.random() - 0.5) * 20),
      inventory: Math.round(1.8 + (Math.random() - 0.5) * 1.2),
    })
  }

  return months
}

export function generateNeighborhoodScore(zip: string): NeighborhoodScore {
  // Deterministic from zip so it doesn't change on re-render
  const seed = zip.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  const rng = (offset: number) => {
    const x = Math.sin(seed + offset) * 10000
    return Math.round(50 + (x - Math.floor(x)) * 45)
  }

  const schools    = rng(1)
  const safety     = rng(2)
  const walkability = rng(3)
  const transit    = rng(4)
  const amenities  = rng(5)
  const overall    = Math.round((schools + safety + walkability + transit + amenities) / 5)

  return { overall, schools, safety, walkability, transit, amenities }
}

export function calculateInvestment(
  propertyValue: number,
  monthlyRent: number,
  downPaymentPct: number,
  interestRate: number,
  expenses: { taxes: number; insurance: number; maintenance: number; vacancy: number },
): InvestmentAnalysis {
  const annualRent = monthlyRent * 12
  const annualExpenses =
    expenses.taxes + expenses.insurance +
    (annualRent * expenses.vacancy / 100) +
    (propertyValue * expenses.maintenance / 100)

  const noi = annualRent - annualExpenses
  const capRate = (noi / propertyValue) * 100

  const downPayment = propertyValue * downPaymentPct / 100
  const loanAmount = propertyValue - downPayment
  const monthlyRate = interestRate / 100 / 12
  const numPayments = 360
  const monthlyMortgage =
    monthlyRate === 0
      ? loanAmount / numPayments
      : (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
        (Math.pow(1 + monthlyRate, numPayments) - 1)

  const annualDebtService = monthlyMortgage * 12
  const annualCashFlow = noi - annualDebtService
  const cashOnCash = (annualCashFlow / downPayment) * 100
  const monthlyCashFlow = annualCashFlow / 12

  // 5-year appreciation at 4% annual
  const futureValue = propertyValue * Math.pow(1.04, 5)
  const equityGain = futureValue - propertyValue
  const totalReturn5yr = ((annualCashFlow * 5 + equityGain) / downPayment) * 100

  const breakEvenYears = annualCashFlow > 0 ? downPayment / annualCashFlow : 999

  return {
    monthlyRent,
    grossYield: (annualRent / propertyValue) * 100,
    netYield: (noi / propertyValue) * 100,
    capRate,
    cashOnCash,
    monthlyCashFlow,
    breakEvenYears: Math.round(breakEvenYears * 10) / 10,
    totalReturn5yr: Math.round(totalReturn5yr * 10) / 10,
  }
}
