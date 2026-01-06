import React, { useState, useEffect } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';

export const ApiDocs: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const exampleCode = `
// REAL Production Usage
// You can use this URL in ANY other website or app.

async function fetchAnimeData() {
  const response = await fetch('${origin || 'https://your-app.vercel.app'}/api/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      siteUrl: 'https://v9.kuramanime.tel/'
    })
  });
  
  const { data } = await response.json();
  console.log(data);
}
  `.trim();

  const handleCopy = () => {
    navigator.clipboard.writeText(exampleCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-12 bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 bg-slate-950">
        <div className="flex items-center gap-2">
          <Terminal size={18} className="text-blue-500" />
          <h2 className="font-semibold text-slate-200">Public API Endpoint</h2>
        </div>
        <button 
          onClick={handleCopy}
          className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
        >
          {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy Integration Code'}
        </button>
      </div>
      
      <div className="p-6">
        <p className="text-slate-400 mb-4 text-sm">
          This application exposes a public REST API. You can use the endpoint below to fetch anime/movie data from external applications.
          <br/>
          <span className="text-green-400 text-xs font-mono mt-1 block">Status: Production Ready • CORS Enabled (Access-Control-Allow-Origin: *)</span>
        </p>
        
        <div className="grid grid-cols-1 gap-6">
          <div>
            <pre className="font-mono text-xs bg-slate-950 p-4 rounded-lg overflow-x-auto text-blue-100 border border-slate-800">
              <code>{exampleCode}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};