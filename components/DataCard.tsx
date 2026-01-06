import React from 'react';
import { ScrapedItem } from '../types';
import { ExternalLink, Play, Copy, Video, FileVideo } from 'lucide-react';

interface DataCardProps {
  item: ScrapedItem;
}

export const DataCard: React.FC<DataCardProps> = ({ item }) => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert(`Copied: ${text}`);
  };

  const isVideoType = item.type === 'video';

  return (
    <div className={`group relative bg-slate-800 rounded-xl overflow-hidden border transition-all duration-300 hover:shadow-lg flex flex-col h-full ${isVideoType ? 'border-blue-500/50 shadow-blue-500/10' : 'border-slate-700 hover:border-blue-500'}`}>
      {/* Image Aspect Ratio Container */}
      <div className="aspect-[16/9] w-full overflow-hidden bg-slate-900 relative">
        {item.image ? (
          <img 
            src={item.image} 
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-80 group-hover:opacity-100"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://placehold.co/600x400/1e293b/475569?text=No+Preview';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-800">
             <Video className="text-slate-600" size={32} />
          </div>
        )}
        
        {/* Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-90" />
        
        {/* Type Badge */}
        <div className={`absolute top-2 right-2 text-xs font-bold px-2 py-1 rounded shadow-md z-10 uppercase ${isVideoType ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>
          {item.type || item.quality}
        </div>

        {/* Play Icon Overlay */}
        <a href={item.url} target="_blank" rel="noreferrer" className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="bg-white/20 backdrop-blur-sm p-3 rounded-full border border-white/30 hover:scale-110 transition-transform">
            <Play className="text-white fill-white" size={24} />
          </div>
        </a>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-grow">
        <h3 className="text-white font-semibold text-sm leading-tight line-clamp-2 mb-2 group-hover:text-blue-400 transition-colors min-h-[2.5rem]" title={item.title}>
          {item.title}
        </h3>
        
        <div className="mt-auto space-y-2">
          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            {item.videoUrl || item.embedUrl ? (
               <button 
                onClick={() => copyToClipboard(item.videoUrl || item.embedUrl || '')}
                className="flex items-center justify-center gap-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 py-1.5 rounded hover:bg-emerald-500/20 transition-colors"
                title="Copy Direct Video URL"
               >
                 <Copy size={12} /> {item.embedUrl ? 'Embed' : 'Source'}
               </button>
            ) : (
               <button 
                onClick={() => copyToClipboard(JSON.stringify(item))}
                className="flex items-center justify-center gap-1.5 text-xs font-medium bg-slate-700/30 text-slate-400 border border-slate-700 py-1.5 rounded hover:bg-slate-700 hover:text-white transition-colors">
                 <Copy size={12} /> JSON
               </button>
            )}

            <a 
              href={item.url} 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 py-1.5 rounded hover:bg-blue-500/20 transition-colors"
            >
              <ExternalLink size={12} /> Open
            </a>
          </div>
          
          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-700/50">
             <span className='uppercase'>{item.source}</span>
          </div>
        </div>
      </div>
    </div>
  );
};