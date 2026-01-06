export interface ScrapedItem {
  title: string;
  url: string;
  image?: string;
  quality?: string; // e.g., "HD", "1080p", "Episode 12", "4K"
  videoUrl?: string; // Direct link to mp4 or stream
  embedUrl?: string; // Iframe embed source
  uploadedAt?: string;
  source: string;
  type: 'video' | 'card' | 'link'; // New field for filtering
}

export enum TargetSite {
  MUSE_ID = 'https://www.youtube.com/@MuseIndonesia/videos',
  ANIONE_ID = 'https://www.youtube.com/@AniOneIndonesia/videos',
  TROPICS_ID = 'https://www.youtube.com/@TropicsAnimeAsia/videos', // As requested
  BSTATION = 'https://www.bilibili.tv/id',
  KURAMANIME = 'https://v9.kuramanime.tel/',
  SAMEHADAKU = 'https://samehadaku.care/'
}

export interface ApiResponse {
  success: boolean;
  data: ScrapedItem[];
  timestamp: string;
  source: string;
  message?: string;
}