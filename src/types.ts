export type AssetCategory = 'Cash' | 'Stock' | 'Term Deposit' | 'Gold' | 'Silver' | 'Crypto' | 'Fixed Income' | 'Other';

export interface Asset {
  id: number;
  name: string;
  category: AssetCategory;
  type: string; // e.g., "Gold", "USD", "AAPL"
  units: number;
  buyPrice: number;
  currentPrice: number;
  currency: string;
  buyDate: string;
  note: string;
  updatedAt: string;
}

export interface PortfolioStats {
  totalValue: number;
  totalProfitLoss: number;
  profitLossPercentage: number;
  categoryDistribution: { name: string; value: number }[];
}

export interface MarketPrice {
  symbol: string;
  price: number;
  updatedAt: string;
}
