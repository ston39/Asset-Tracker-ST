import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  PieChart as PieChartIcon, 
  History, 
  Trash2, 
  Edit2,
  DollarSign,
  Coins,
  BarChart3,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Lock,
  LogOut,
  ChevronUp,
  ChevronDown,
  RefreshCw
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { ref, onValue, set, remove, update, get } from 'firebase/database';
import { database } from './firebase';
import { Asset, AssetCategory, MarketPrice } from './types';

const CATEGORIES: AssetCategory[] = ['Cash', 'Stock', 'Term Deposit', 'Gold', 'Silver', 'Crypto', 'Fixed Income', 'Other'];
const COLORS = ['#10b981', '#3b82f6', '#0ea5e9', '#f59e0b', '#94a3b8', '#8b5cf6', '#ef4444', '#6b7280'];

const formatNumber = (num: number | string) => {
  const value = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(value)) return '';
  return value.toLocaleString('en-US');
};

const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  if (e.target.value === '0') {
    e.target.value = '';
  } else {
    e.target.select();
  }
};

const parseNumber = (str: string) => {
  // Remove commas (thousands separator in en-US)
  const cleanStr = str.replace(/,/g, '');
  return parseFloat(cleanStr) || 0;
};

export default function App() {
  const [passcode, setPasscode] = useState<string | null>(localStorage.getItem('assetflow_passcode'));
  const [assets, setAssets] = useState<Asset[]>([]);
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loginInput, setLoginInput] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [selectedMarketCategory, setSelectedMarketCategory] = useState<AssetCategory>(CATEGORIES[0]);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>({ key: 'buyDate', direction: 'desc' });

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingSymbol, setDeletingSymbol] = useState<string | null>(null);
  const [isSyncingSilver, setIsSyncingSilver] = useState(false);

  useEffect(() => {
    if (passcode) {
      setIsLoading(true);
      const assetsRef = ref(database, `users/${passcode}/assets`);
      const unsubscribeAssets = onValue(assetsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const assetsList = Object.values(data) as Asset[];
          setAssets(assetsList.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()));
        } else {
          setAssets([]);
        }
        setIsLoading(false);
      });

      const pricesRef = ref(database, `users/${passcode}/marketPrices`);
      const unsubscribePrices = onValue(pricesRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setMarketPrices(Object.values(data) as MarketPrice[]);
        } else {
          setMarketPrices([]);
        }
      });

      return () => {
        unsubscribeAssets();
        unsubscribePrices();
      };
    } else {
      setIsLoading(false);
    }
  }, [passcode]);

  const handleSyncSilver = async () => {
    if (!passcode || isSyncingSilver) return;
    setIsSyncingSilver(true);
    try {
      const response = await fetch('/api/scrape-silver');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with ${response.status}`);
      }
      const data = await response.json();
      if (data.success && data.price) {
        await handleUpdateMarketPrice('Silver', data.price);
      } else {
        alert(data.error || 'Failed to sync silver price');
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      alert(`Sync failed: ${error.message || 'Could not connect to service'}`);
    } finally {
      setIsSyncingSilver(false);
    }
  };

  const handleUpdateMarketPrice = async (symbol: string, price: number) => {
    if (!passcode) return;
    try {
      const priceRef = ref(database, `users/${passcode}/marketPrices/${symbol}`);
      await set(priceRef, {
        symbol,
        price,
        updatedAt: new Date().toISOString()
      });
      
      // Update current prices in assets that match this category
      const assetsRef = ref(database, `users/${passcode}/assets`);
      const snapshot = await get(assetsRef);
      const currentAssets = snapshot.val();
      
      if (currentAssets) {
        const updates: any = {};
        Object.keys(currentAssets).forEach(key => {
          const asset = currentAssets[key];
          if (asset.category?.trim().toLowerCase() === symbol.trim().toLowerCase()) {
            updates[`users/${passcode}/assets/${key}/currentPrice`] = price;
            updates[`users/${passcode}/assets/${key}/updatedAt`] = new Date().toISOString();
          }
        });
        if (Object.keys(updates).length > 0) {
          await update(ref(database), updates);
        }
      }
    } catch (error) {
      console.error('Failed to update market price:', error);
    }
  };

  const handleAddMarketPrice = (e: React.FormEvent) => {
    e.preventDefault();
    handleUpdateMarketPrice(selectedMarketCategory, 0);
  };

  const handleDeleteMarketPrice = async (symbol: string) => {
    if (!passcode) return;
    try {
      const priceRef = ref(database, `users/${passcode}/marketPrices/${symbol}`);
      await remove(priceRef);
      setDeletingSymbol(null);
    } catch (error) {
      console.error('Failed to delete market price:', error);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginInput.trim()) {
      localStorage.setItem('assetflow_passcode', loginInput);
      setPasscode(loginInput);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('assetflow_passcode');
    setPasscode(null);
    setAssets([]);
  };

  const handleChangePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode || !newPasscode.trim()) return;

    const updatedPasscode = newPasscode.trim();
    try {
      // Move data to new keys in Firebase
      const oldUserRef = ref(database, `users/${passcode}`);
      const newUserRef = ref(database, `users/${updatedPasscode}`);
      
      const snapshot = await get(oldUserRef);
      const data = snapshot.val();
      
      if (data) {
        await set(newUserRef, data);
        await remove(oldUserRef);
      }

      localStorage.setItem('assetflow_passcode', updatedPasscode);
      setPasscode(updatedPasscode);
      setIsPasscodeModalOpen(false);
      setNewPasscode('');
      alert('Passcode updated successfully!');
    } catch (error) {
      console.error('Failed to change passcode:', error);
      alert('Failed to update passcode.');
    }
  };

  const stats = useMemo(() => {
    const totalValue = assets.reduce((acc, asset) => acc + (asset.units * asset.currentPrice), 0);
    const totalCost = assets.reduce((acc, asset) => acc + (asset.units * asset.buyPrice), 0);
    const totalProfitLoss = totalValue - totalCost;
    const profitLossPercentage = totalCost > 0 ? (totalProfitLoss / totalCost) * 100 : 0;

    const categoryDistribution = CATEGORIES.map(cat => {
      const value = assets.filter(a => a.category === cat).reduce((acc, a) => acc + (a.units * a.currentPrice), 0);
      return {
        name: cat,
        value,
        percentage: totalValue > 0 ? (value / totalValue) * 100 : 0
      };
    }).filter(c => c.value > 0);

    return { totalValue, totalProfitLoss, profitLossPercentage, categoryDistribution };
  }, [assets]);

  const sortedAssets = useMemo(() => {
    let sortableAssets = [...assets].filter(asset => 
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.type.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (sortConfig !== null) {
      sortableAssets.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        // Custom logic for Buying Date: No date -> Latest -> Oldest
        if (sortConfig.key === 'buyDate') {
          if (a.buyDate === b.buyDate) {
            // If dates are same, sort by ID (creation time) descending
            return b.id - a.id;
          }
          if (a.buyDate === "") return -1;
          if (b.buyDate === "") return 1;
          
          return sortConfig.direction === 'asc' 
            ? a.buyDate.localeCompare(b.buyDate) 
            : b.buyDate.localeCompare(a.buyDate);
        }

        if (sortConfig.key === 'marketValue') {
          aValue = a.units * a.currentPrice;
          bValue = b.units * b.currentPrice;
        } else {
          aValue = a[sortConfig.key as keyof Asset];
          bValue = b[sortConfig.key as keyof Asset];
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableAssets;
  }, [assets, searchTerm, sortConfig]);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleDelete = async (id: number) => {
    if (!passcode) return;
    try {
      const assetRef = ref(database, `users/${passcode}/assets/${id}`);
      await remove(assetRef);
      setDeletingId(null);
    } catch (error) {
      console.error('Failed to delete asset:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!passcode || isSubmitting) return;
    
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const category = (formData.get('category') as AssetCategory) || 'Other';
    let currentPrice = parseNumber(formData.get('currentPrice') as string);

    // If currentPrice is 0, try to inherit from market prices
    if (currentPrice === 0) {
      try {
        const priceRef = ref(database, `users/${passcode}/marketPrices/${category}`);
        const priceSnapshot = await get(priceRef);
        const marketPrice = priceSnapshot.val();
        if (marketPrice && marketPrice.price > 0) {
          currentPrice = marketPrice.price;
        }
      } catch (err) {
        console.error('Failed to fetch market price for default:', err);
      }
    }

    const data: Partial<Asset> = {
      name: (formData.get('name') as string) || 'Unnamed Asset',
      category,
      type: (formData.get('type') as string) || 'N/A',
      units: parseNumber(formData.get('units') as string),
      buyPrice: parseNumber(formData.get('buyPrice') as string),
      currentPrice,
      buyDate: (formData.get('buyDate') as string) || '',
      note: (formData.get('note') as string) || '',
      currency: 'VNĐ',
      updatedAt: new Date().toISOString()
    };

    try {
      const id = editingAsset ? editingAsset.id : Date.now();
      const assetRef = ref(database, `users/${passcode}/assets/${id}`);
      
      await set(assetRef, { ...data, id });
      
      setIsModalOpen(false);
      setEditingAsset(null);
    } catch (error: any) {
      console.error('Failed to save asset:', error);
      alert(`Failed to save asset: ${error.message || 'Unknown error'}. Please check your internet connection and Firebase rules.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInlineUpdate = async (asset: Asset, field: keyof Asset, value: string | number) => {
    if (!passcode) return;
    try {
      const assetRef = ref(database, `users/${passcode}/assets/${asset.id}`);
      const updates: any = { [field]: value, updatedAt: new Date().toISOString() };

      // If category is changed, try to auto-update currentPrice to market price
      if (field === 'category') {
        const priceRef = ref(database, `users/${passcode}/marketPrices/${value}`);
        const priceSnapshot = await get(priceRef);
        const marketPrice = priceSnapshot.val();
        if (marketPrice && marketPrice.price > 0) {
          updates.currentPrice = marketPrice.price;
        }
      }

      await update(assetRef, updates);
    } catch (error) {
      console.error('Failed to update asset inline:', error);
    }
  };

  if (!passcode) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200 w-full max-w-md"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="bg-emerald-600 p-3 rounded-2xl mb-4">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Welcome to Asset Tracker</h1>
            <p className="text-slate-500 text-center mt-2">Enter your passcode to access your portfolio</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Passcode</label>
              <input 
                type="password"
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                placeholder="Enter your secret code"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                autoFocus
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-600/20"
            >
              Access Portfolio
            </button>
          </form>
          <p className="text-xs text-slate-400 text-center mt-6">
            Your assets are tied to your passcode. Keep it safe!
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-600 p-2 rounded-lg">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Asset Tracker</h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsPasscodeModalOpen(true)}
              className="text-slate-400 hover:text-emerald-600 p-2 rounded-lg transition-colors"
              title="Change Passcode"
            >
              <Lock className="w-5 h-5" />
            </button>
            <button 
              onClick={handleLogout}
              className="text-slate-400 hover:text-rose-600 p-2 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="flex flex-col gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-500 text-sm font-medium uppercase tracking-wider">Total Portfolio Value</span>
                <div className="p-2 bg-emerald-50 rounded-lg">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900">
                {stats.totalValue.toLocaleString('en-US')}
              </div>
            </motion.div>

            {/* Market Prices Section */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-500" />
                  Market Prices
                </h2>
                <div className="text-[10px] text-slate-400 italic ml-2 hidden sm:block">(Updates all assets in category)</div>
                <form onSubmit={handleAddMarketPrice} className="flex gap-1">
                  <select 
                    value={selectedMarketCategory}
                    onChange={(e) => setSelectedMarketCategory(e.target.value as AssetCategory)}
                    className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <button 
                    type="submit"
                    className="bg-slate-900 text-white px-2 py-1 rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors"
                  >
                    Track
                  </button>
                </form>
              </div>
              <div className="p-3 max-h-[200px] overflow-y-auto">
                <div className="space-y-2">
                  {marketPrices.map((mp) => (
                    <div key={mp.symbol} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100 group">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{mp.symbol}</span>
                          {mp.symbol === 'Silver' && (
                            <button 
                              onClick={handleSyncSilver}
                              disabled={isSyncingSilver}
                              className={`p-1 rounded hover:bg-slate-200 transition-colors ${isSyncingSilver ? 'animate-spin text-emerald-600' : 'text-slate-400'}`}
                              title="Sync real-time price"
                            >
                              <RefreshCw className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <input 
                          type="text"
                          key={`${mp.symbol}-${mp.price}`}
                          defaultValue={formatNumber(mp.price)}
                          onFocus={handleInputFocus}
                          onBlur={(e) => {
                            const val = parseNumber(e.target.value);
                            handleUpdateMarketPrice(mp.symbol, val);
                            e.target.value = formatNumber(val);
                          }}
                          className="bg-transparent text-sm font-bold text-slate-900 w-24 outline-none focus:text-emerald-600"
                        />
                      </div>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (deletingSymbol === mp.symbol) {
                            handleDeleteMarketPrice(mp.symbol);
                          } else {
                            setDeletingSymbol(mp.symbol);
                            // Reset after 3 seconds
                            setTimeout(() => setDeletingSymbol(null), 3000);
                          }
                        }}
                        className={`p-2 rounded-lg border shadow-sm z-30 transition-all flex items-center justify-center cursor-pointer group ${
                          deletingSymbol === mp.symbol 
                            ? 'bg-rose-600 border-rose-600 text-white' 
                            : 'bg-white border-slate-200 text-slate-400 hover:text-rose-500 hover:bg-rose-50'
                        }`}
                        title={deletingSymbol === mp.symbol ? "Click again to confirm" : "Remove"}
                      >
                        {deletingSymbol === mp.symbol ? (
                          <Trash2 className="w-4 h-4" />
                        ) : (
                          <Plus className="w-4 h-4 rotate-45 pointer-events-none group-hover:scale-110 transition-transform" />
                        )}
                      </button>
                    </div>
                  ))}
                  {marketPrices.length === 0 && (
                    <div className="text-slate-400 text-xs italic text-center py-2">Select a category to track its market price.</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm md:col-span-2 flex flex-col md:flex-row items-center gap-8"
          >
            <div className="w-full md:w-1/3 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.categoryDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.categoryDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value: number, name: string, props: any) => {
                      const percentage = props.payload.percentage?.toFixed(1) || 0;
                      return [`${value.toLocaleString('en-US')} (${percentage}%)`, name];
                    }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-2/3 grid grid-cols-2 gap-4">
              {stats.categoryDistribution.map((item, index) => (
                <div key={item.name} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <div>
                    <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">{item.name}</div>
                    <div className="text-sm font-bold text-slate-900">
                      {item.value.toLocaleString('en-US')}
                      <span className="ml-1 text-xs font-medium text-slate-400">({item.percentage.toFixed(1)}%)</span>
                    </div>
                  </div>
                </div>
              ))}
              {stats.categoryDistribution.length === 0 && (
                <div className="col-span-2 text-slate-400 text-sm italic">No data to display. Add assets to see distribution.</div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Asset List Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-600" />
                Your Assets
              </h2>
              <button 
                onClick={() => { setEditingAsset(null); setIsModalOpen(true); }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors text-sm font-medium shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Add Asset
              </button>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search assets..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all w-full sm:w-64"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th 
                    className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Asset
                      {sortConfig?.key === 'name' && (
                        sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort('marketValue')}
                  >
                    <div className="flex items-center gap-1">
                      Market Value
                      {sortConfig?.key === 'marketValue' && (
                        sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort('category')}
                  >
                    <div className="flex items-center gap-1">
                      Category
                      {sortConfig?.key === 'category' && (
                        sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort('buyDate')}
                  >
                    <div className="flex items-center gap-1">
                      Buying Date
                      {sortConfig?.key === 'buyDate' && (
                        sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort('units')}
                  >
                    <div className="flex items-center gap-1">
                      Holdings
                      {sortConfig?.key === 'units' && (
                        sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort('buyPrice')}
                  >
                    <div className="flex items-center gap-1">
                      Buy Price
                      {sortConfig?.key === 'buyPrice' && (
                        sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort('currentPrice')}
                  >
                    <div className="flex items-center gap-1">
                      Current Price
                      {sortConfig?.key === 'currentPrice' && (
                        sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors"
                    onClick={() => handleSort('note')}
                  >
                    <div className="flex items-center gap-1">
                      Note
                      {sortConfig?.key === 'note' && (
                        sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-400">Loading assets...</td>
                  </tr>
                ) : sortedAssets.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-slate-400">No assets found. Click "Add Asset" to get started.</td>
                  </tr>
                ) : (
                  sortedAssets.map((asset) => {
                    // Try to find the latest market price for this category
                    const marketPriceData = marketPrices.find(mp => mp.symbol.trim().toLowerCase() === asset.category.trim().toLowerCase());
                    const effectiveCurrentPrice = marketPriceData ? marketPriceData.price : asset.currentPrice;
                    
                    const marketValue = asset.units * effectiveCurrentPrice;
                    const profitLoss = (effectiveCurrentPrice - asset.buyPrice) * asset.units;
                    const isProfit = profitLoss >= 0;

                    return (
                      <tr 
                        key={asset.id} 
                        className="hover:bg-slate-50/50 transition-colors group"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-bold text-slate-900">{asset.name}</div>
                          <div className="text-xs text-slate-500 font-mono">{asset.type}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-slate-900">{marketValue.toLocaleString('en-US')}</div>
                          <div className={`text-xs flex items-center gap-0.5 ${isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {isProfit ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            {isProfit ? '+' : ''}{profitLoss.toLocaleString('en-US')}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <select 
                            defaultValue={asset.category}
                            onChange={(e) => handleInlineUpdate(asset, 'category', e.target.value)}
                            className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-medium border-transparent hover:border-slate-200 focus:border-emerald-500 focus:bg-white transition-all outline-none cursor-pointer"
                          >
                            {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <input 
                            type="date"
                            defaultValue={asset.buyDate}
                            onBlur={(e) => handleInlineUpdate(asset, 'buyDate', e.target.value)}
                            className="px-2 py-1 bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-500 focus:bg-white rounded text-sm text-slate-600 transition-all outline-none"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <input 
                            type="text"
                            defaultValue={formatNumber(asset.units)}
                            onFocus={handleInputFocus}
                            onBlur={(e) => {
                              const val = parseNumber(e.target.value);
                              handleInlineUpdate(asset, 'units', val);
                              e.target.value = formatNumber(val);
                            }}
                            className="w-20 px-2 py-1 bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-500 focus:bg-white rounded text-sm font-medium text-slate-900 transition-all outline-none"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1">
                            <input 
                              type="text"
                              defaultValue={formatNumber(asset.buyPrice)}
                              onFocus={handleInputFocus}
                              onBlur={(e) => {
                                const val = parseNumber(e.target.value);
                                handleInlineUpdate(asset, 'buyPrice', val);
                                e.target.value = formatNumber(val);
                              }}
                              className="w-24 px-2 py-1 bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-500 focus:bg-white rounded text-sm text-slate-600 transition-all outline-none"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1">
                            <input 
                              type="text"
                              key={`${asset.id}-${effectiveCurrentPrice}`}
                              defaultValue={formatNumber(effectiveCurrentPrice)}
                              onFocus={handleInputFocus}
                              onBlur={(e) => {
                                const val = parseNumber(e.target.value);
                                handleInlineUpdate(asset, 'currentPrice', val);
                                e.target.value = formatNumber(val);
                              }}
                              className="w-24 px-2 py-1 bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-500 focus:bg-white rounded text-sm font-bold text-slate-900 transition-all outline-none"
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4 min-w-[180px]">
                          <input 
                            type="text"
                            defaultValue={asset.note}
                            placeholder="Add note..."
                            onBlur={(e) => handleInlineUpdate(asset, 'note', e.target.value)}
                            className="w-full px-2 py-1 bg-transparent border border-transparent hover:border-slate-200 focus:border-emerald-500 focus:bg-white rounded text-sm text-slate-600 transition-all outline-none whitespace-nowrap overflow-hidden text-ellipsis"
                          />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setEditingAsset(asset);
                                setIsModalOpen(true);
                              }}
                              className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg border border-slate-100 transition-all flex items-center justify-center cursor-pointer"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4 pointer-events-none" />
                            </button>
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (deletingId === asset.id) {
                                  handleDelete(asset.id);
                                } else {
                                  setDeletingId(asset.id);
                                  // Reset after 3 seconds
                                  setTimeout(() => setDeletingId(null), 3000);
                                }
                              }}
                              className={`p-2 rounded-lg border transition-all flex items-center justify-center cursor-pointer ${
                                deletingId === asset.id 
                                  ? 'bg-rose-600 border-rose-600 text-white animate-pulse' 
                                  : 'bg-white border-slate-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                              }`}
                              title={deletingId === asset.id ? "Click again to confirm" : "Delete"}
                            >
                              <Trash2 className="w-4 h-4 pointer-events-none" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
            >
              <div className="p-8 overflow-y-auto">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-bold text-slate-900">
                    {editingAsset ? 'Edit Asset' : 'Add New Asset'}
                  </h3>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <Plus className="w-6 h-6 rotate-45 text-slate-400" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Asset Name</label>
                      <input 
                        name="name"
                        defaultValue={editingAsset?.name}
                        placeholder="e.g. Apple Inc, Gold Bar, Savings Account"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Category</label>
                      <select 
                        name="category"
                        defaultValue={editingAsset?.category || 'Stock'}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      >
                        {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Type/Symbol</label>
                      <input 
                        name="type"
                        defaultValue={editingAsset?.type}
                        placeholder="e.g. AAPL, XAU, BTC"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Units</label>
                      <input 
                        name="units"
                        type="text"
                        defaultValue={editingAsset ? formatNumber(editingAsset.units) : ''}
                        onFocus={handleInputFocus}
                        placeholder="0"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Buy Price (Unit)</label>
                      <input 
                        name="buyPrice"
                        type="text"
                        defaultValue={editingAsset ? formatNumber(editingAsset.buyPrice) : ''}
                        onFocus={handleInputFocus}
                        placeholder="0"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Current Price (Unit)</label>
                      <input 
                        name="currentPrice"
                        type="text"
                        defaultValue={editingAsset ? formatNumber(editingAsset.currentPrice) : ''}
                        onFocus={handleInputFocus}
                        placeholder="0"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Buying Date</label>
                      <input 
                        name="buyDate"
                        type="date"
                        defaultValue={editingAsset?.buyDate}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Note</label>
                      <textarea 
                        name="note"
                        defaultValue={editingAsset?.note}
                        placeholder="Add any additional details..."
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none h-24"
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-2 px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? 'Saving...' : (editingAsset ? 'Save Changes' : 'Add Asset')}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Change Passcode Modal */}
      <AnimatePresence>
        {isPasscodeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPasscodeModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-bold text-slate-900">Change Passcode</h3>
                  <button 
                    onClick={() => setIsPasscodeModalOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <Plus className="w-6 h-6 rotate-45 text-slate-400" />
                  </button>
                </div>

                <form onSubmit={handleChangePasscode} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">New Passcode</label>
                    <input 
                      type="password"
                      value={newPasscode}
                      onChange={(e) => setNewPasscode(e.target.value)}
                      placeholder="Enter new secret code"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      autoFocus
                    />
                    <p className="text-xs text-slate-400 mt-2">
                      Warning: This will update the passcode for all your current assets. Make sure you remember it!
                    </p>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsPasscodeModalOpen(false)}
                      className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
                    >
                      Update
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-slate-200 mt-12">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 opacity-50">
            <Wallet className="w-5 h-5" />
            <span className="text-sm font-bold tracking-tight">Asset Tracker</span>
          </div>
          <div className="text-sm text-slate-400">
            © {new Date().getFullYear()} Asset Tracker Portfolio Manager. All rights reserved.
          </div>
          <div className="flex items-center gap-6 text-sm font-medium text-slate-400">
            <a href="#" className="hover:text-emerald-600 transition-colors">Privacy</a>
            <a href="#" className="hover:text-emerald-600 transition-colors">Terms</a>
            <a href="#" className="hover:text-emerald-600 transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}