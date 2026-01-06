export interface ScrapedItem {
  title: string;
  url: string;
  image?: string;
  quality?: string; // e.g., "HD", "1080p", "Episode 12", "4K"
  videoUrl?: string; // Direct link to mp4 or stream
  embedUrl?: string; // Iframe embed source
  uploadedAt?: string;
  source: string;
}

export enum TargetSite {
  KURAMANIME = 'https://v9.kuramanime.tel/',
  SAMEHADAKU = 'https://samehadaku.care/',
  MOVIEBOX = 'https://moviebox.ph/',
  YOUTUBE = 'https://www.youtube.com/'
}

export interface ApiResponse {
  success: boolean;
  data: ScrapedItem[];
  timestamp: string;
  source: string;
  message?: string;
}