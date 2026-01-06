import React, { useState, useEffect } from 'react';
import { Copy, Check, Terminal, Filter, Code } from 'lucide-react';

export const ApiDocs: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const exampleCode = `
// 1. Define Types (Optional, for TypeScript)
interface ScrapedItem {
  title: string;
  url: string;
  image?: string;
  type: 'video' | 'card' | 'link'; // <--- KEY FIELD FOR FILTERING
  videoUrl?: string; // Direct link (mp4/m3u8)
  embedUrl?: string; // Iframe src
}

// 2. Fetch & Filter Function
async function fetchAndFilterData(targetUrl: string) {
  const response = await fetch('${origin || 'https://your-app.vercel.app'}/api/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ siteUrl: targetUrl })
  });
  
  const json = await response.json();
  const rawData: ScrapedItem[] = json.data;

  // --- FILTERING LOGIC ---
  
  // A. Get only Playable Videos (Iframes, MP4s)
  const videos = rawData.filter(item => item.type === 'video');
  
  // B. Get Content Cards (Episodes, Search Results)
  const episodes = rawData.filter(item => item.type === 'card');

  console.log(\`Found \${videos.length} videos and \${episodes.length} episodes.\`);
  return { videos, episodes };
}
  `.trim();

  const handleCopy = () => {
    navigator.clipboard.writeText(exampleCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-12 bg-slate-900 rounded-xl border border-slate-700 overflow-hidden mb-20">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-950">
        <div className="flex items-center gap-2">
          <Terminal size={18} className="text-blue-500" />
          <h2 className="font-semibold text-slate-200">Frontend Integration Guide</h2>
        </div>
        <button 
          onClick={handleCopy}
          className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy Integration Code'}
        </button>
      </div>
      
      <div className="p-6 space-y-6">
        <div className="flex items-start gap-4">
           <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 mt-1">
             <Filter size={20} />
           </div>
           <div>
             <h3 className="text-lg font-medium text-white mb-2">How to Filter Data</h3>
             <p className="text-slate-400 text-sm leading-relaxed">
               This API acts as a <strong>raw courier</strong>. It retrieves EVERYTHING found on the page. 
               Your frontend application must filter the data based on the <code>type</code> property:
             </p>
             <ul className="mt-3 space-y-2 text-sm text-slate-300">
               <li className="flex items-center gap-2">
                 <span className="px-2 py-0.5 rounded bg-red-900/50 text-red-300 text-xs border border-red-800">video</span>
                 Direct video players, iframe embeds, or MP4 links.
               </li>
               <li className="flex items-center gap-2">
                 <span className="px-2 py-0.5 rounded bg-blue-900/50 text-blue-300 text-xs border border-blue-800">card</span>
                 Anime episodes, movie posters, or search result items.
               </li>
               <li className="flex items-center gap-2">
                 <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-xs border border-slate-700">link</span>
                 Page metadata or generic links.
               </li>
             </ul>
           </div>
        </div>

        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg opacity-20 group-hover:opacity-30 transition duration-1000"></div>
          <pre className="relative font-mono text-xs bg-slate-950 p-4 rounded-lg overflow-x-auto text-blue-100 border border-slate-800 scrollbar-thin scrollbar-thumb-slate-700">
            <code>{exampleCode}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};