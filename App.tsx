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
  AlertCircle,
  Youtube,
  Link as LinkIcon
} from 'lucide-react';

const App: React.FC = () => {
  const [customUrl, setCustomUrl] = useState<string>(TargetSite.KURAMANIME);
  const [data, setData] = useState<ScrapedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const handleFetch = async () => {
    if (!customUrl) return;
    
    setLoading(true);
    setError(null);
    setData([]);
    
    try {
      // We pass the string directly, ignoring the enum type constraint in the service
      const result = await fetchSiteData(customUrl as any);
      setData(result);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handlePresetClick = (url: string) => {
    setCustomUrl(url);
  };

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
            Universal Data Extractor
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-lg">
            Extract real-time data from Anime sites, Movie portals, or YouTube Channels & Playlists using Gemini AI.
          </p>
        </div>

        {/* Control Panel */}
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 mb-8 shadow-2xl">
          
          {/* Input Section */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-400 mb-2">Target URL</label>
            <div className="flex gap-2">
              <div className="relative flex-grow">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <LinkIcon size={18} className="text-slate-500" />
                </div>
                <input
                  type="text"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="Paste URL (e.g., https://youtube.com/@ChannelName or https://v9.kuramanime.tel/)"
                  className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-slate-600 transition-all"
                />
              </div>
              
              {/* Action Button */}
              <button
                onClick={handleFetch}
                disabled={loading || !customUrl}
                className={`flex-shrink-0 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all ${
                  loading 
                    ? 'bg-slate-700 cursor-wait opacity-70' 
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-900/20'
                }`}
              >
                {loading ? (
                  <>
                    <RefreshCw className="animate-spin" size={20} />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Search size={20} />
                    Scrape
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 border-t border-slate-800 pt-6">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Quick Select:</span>
            <div className="flex flex-wrap gap-2">
              {Object.values(TargetSite).map((site) => {
                let label = '';
                let Icon = Globe;
                let colorClass = 'text-slate-400 hover:text-white hover:bg-slate-700';

                if (site.includes('kurama')) label = 'Kuramanime';
                else if (site.includes('sameha')) label = 'Samehadaku';
                else if (site.includes('movie')) label = 'MovieBox';
                else if (site.includes('youtube')) {
                  label = 'YouTube (General)';
                  Icon = Youtube;
                  colorClass = 'text-red-400 hover:text-red-100 hover:bg-red-900/20 border-red-900/30';
                }

                return (
                  <button
                    key={site}
                    onClick={() => handlePresetClick(site)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-slate-700 transition-all ${colorClass} ${customUrl === site ? 'bg-slate-800 border-slate-600' : 'bg-transparent'}`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          
          {/* Status Bar */}
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
             <div className="flex items-center gap-2">
               <Server size={12} />
               <span className="truncate max-w-[200px] md:max-w-md">Target: <span className="text-slate-300 font-mono">{customUrl}</span></span>
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
              <p>Enter a URL or select a source to begin scraping.</p>
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