import React, { useState } from 'react';
import { TargetSite, ScrapedItem } from './types';
import { fetchSiteData } from './services/scraperService';
import { DataCard } from './components/DataCard';
import { ApiDocs } from './components/ApiDocs';
import { 
  Database, 
  RefreshCw, 
  Server, 
  Globe, 
  Search,
  AlertCircle
} from 'lucide-react';

const App: React.FC = () => {
  const [selectedSite, setSelectedSite] = useState<TargetSite>(TargetSite.KURAMANIME);
  const [data, setData] = useState<ScrapedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const handleFetch = async (site: TargetSite = selectedSite) => {
    setLoading(true);
    setError(null);
    setData([]);
    
    try {
      const result = await fetchSiteData(site);
      setData(result);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch on mount? No, let user initiate to save tokens, 
  // or fetch once. Let's let user initiate for better UX control.

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 pb-20">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Database className="text-white" size={20} />
              </div>
              <span className="font-bold text-xl tracking-tight text-white">ScraperAPI</span>
            </div>
            <div className="flex items-center gap-4">
               <span className="hidden md:flex items-center gap-2 text-xs text-green-400 bg-green-900/20 px-3 py-1 rounded-full border border-green-900/50">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  System Operational
               </span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        {/* Header Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            Universal Anime Data Extractor
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            A powerful, AI-driven interface to extract real-time streaming data from blocked websites using Gemini Search Grounding.
          </p>
        </div>

        {/* Control Panel */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 mb-8 shadow-2xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            
            {/* Site Selector */}
            <div className="flex flex-wrap justify-center gap-2">
              {Object.values(TargetSite).map((site) => {
                const isActive = selectedSite === site;
                let label = '';
                if (site.includes('kurama')) label = 'Kuramanime';
                else if (site.includes('sameha')) label = 'Samehadaku';
                else label = 'MovieBox';

                return (
                  <button
                    key={site}
                    onClick={() => setSelectedSite(site)}
                    className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                      isActive 
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25 ring-2 ring-blue-500/50' 
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-750 hover:text-white'
                    }`}
                  >
                    <Globe size={18} />
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Action Button */}
            <button
              onClick={() => handleFetch(selectedSite)}
              disabled={loading}
              className={`w-full md:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-bold text-white transition-all ${
                loading 
                  ? 'bg-slate-700 cursor-wait opacity-70' 
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-900/20'
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin" size={20} />
                  Extracting Data...
                </>
              ) : (
                <>
                  <Search size={20} />
                  Scrape Live Data
                </>
              )}
            </button>
          </div>
          
          {/* Status Bar */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between text-sm text-slate-500 border-t border-slate-800 pt-4">
             <div className="flex items-center gap-2">
               <Server size={14} />
               <span>Target: <span className="text-slate-300 font-mono">{selectedSite}</span></span>
             </div>
             {lastUpdated && (
               <span className="mt-2 sm:mt-0">Last Updated: {lastUpdated}</span>
             )}
          </div>
        </div>

        {/* Content Grid */}
        <div className="min-h-[400px]">
          {error && (
            <div className="bg-red-900/20 border border-red-500/50 text-red-200 p-6 rounded-xl flex items-center gap-4 animate-fade-in">
              <AlertCircle size={24} className="text-red-500" />
              <div>
                <h3 className="font-bold">Extraction Failed</h3>
                <p>{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && data.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
              <Search size={48} className="mb-4 opacity-20" />
              <p>Select a source and click "Scrape Live Data" to begin.</p>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {data.map((item, index) => (
              <DataCard key={index} item={item} />
            ))}
          </div>
        </div>

        {/* API Integration Section */}
        <ApiDocs />

      </main>
    </div>
  );
};

export default App;