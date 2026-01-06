import * as cheerio from 'cheerio';

export default async function handler(req: any, res: any) {
  // 1. Setup CORS
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { siteUrl } = req.body || {};
    if (!siteUrl) {
      return res.status(400).json({ error: 'siteUrl is required.' });
    }

    // Headers to mimic a real browser to avoid some basic bot detection
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Referer': 'https://www.google.com/'
    };

    const response = await fetch(siteUrl, { headers });
    
    if (!response.ok) {
      // Handle 403 Forbidden (Cloudflare) or other errors
      if (response.status === 403) {
        throw new Error("Access Denied (403). The site is protecting against automated access.");
      }
      throw new Error(`Failed to fetch site: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    let scrapedData: any[] = [];

    // --- STRATEGY: Domain Specific Parsing ---

    if (siteUrl.includes('youtube.com') || siteUrl.includes('youtu.be')) {
      // YouTube Scraping (Parsing meta tags and initial data)
      // 1. Single Video Metadata
      const title = $('meta[name="title"]').attr('content') || $('title').text();
      const description = $('meta[name="description"]').attr('content');
      const image = $('meta[property="og:image"]').attr('content');
      const url = $('link[rel="canonical"]').attr('href') || siteUrl;
      const isVideo = siteUrl.includes('/watch');

      if (isVideo) {
        // Single Video Result
        const videoId = url.split('v=')[1]?.split('&')[0] || url.split('youtu.be/')[1];
        scrapedData.push({
          title: title.replace(' - YouTube', ''),
          url: url,
          image: image,
          quality: 'HD',
          videoUrl: url,
          embedUrl: videoId ? `https://www.youtube.com/embed/${videoId}` : null,
          source: 'YouTube'
        });
      }
      
      // 2. Playlist/Channel Attempts (Simple extraction from scripts/html)
      // Note: YouTube obfuscates classes. We look for patterns in scripts or reliable meta tags.
      // This is limited without an API key or heavy Puppeteer usage.
    } 
    else if (siteUrl.includes('kuramanime')) {
      // Kuramanime Logic
      // Usually grid items. Selectors might need adjustment if site theme changes.
      $('.product__item, .anime-card, article').each((i, el) => {
        if (i > 11) return; // Limit to 12
        const title = $(el).find('h4, h3, .title').text().trim();
        const link = $(el).find('a').attr('href');
        const img = $(el).find('img').attr('data-setbg') || $(el).find('img').attr('src');
        const ep = $(el).find('.ep').text().trim();
        
        if (title && link) {
          scrapedData.push({
            title,
            url: link.startsWith('http') ? link : new URL(link, siteUrl).href,
            image: img,
            quality: ep || 'Sub',
            source: 'Kuramanime'
          });
        }
      });
    } 
    else if (siteUrl.includes('samehadaku')) {
      // Samehadaku Logic
      $('.post-show ul li, .animepost, article').each((i, el) => {
        if (i > 11) return;
        const title = $(el).find('.entry-title, .title').text().trim();
        const link = $(el).find('a').attr('href');
        const img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');
        const ep = $(el).find('.dtla .ep, .episode').text().trim();

        if (title && link) {
          scrapedData.push({
            title,
            url: link,
            image: img,
            quality: ep || 'Sub',
            source: 'Samehadaku'
          });
        }
      });
    }
    else {
      // --- GENERIC FALLBACK (MovieBox etc) ---
      // Look for common "card" patterns: An <a> tag containing an <img> and some text
      $('a').each((i, el) => {
        if (scrapedData.length >= 12) return;
        
        const link = $(el).attr('href');
        if (!link || link === '#' || link === '/') return;

        const img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');
        // Find title text either inside the anchor or in a sibling/child container
        let title = $(el).find('h1, h2, h3, h4, .title, .caption').text().trim();
        if (!title) title = $(el).text().trim();

        // Heuristic: If it has an image and title and link, it's likely a content card
        if (img && title && title.length > 3 && title.length < 100 && !img.includes('logo') && !img.includes('icon')) {
           // Avoid duplicate URLs
           if (!scrapedData.find(item => item.url === link)) {
             scrapedData.push({
               title,
               url: link.startsWith('http') ? link : new URL(link, siteUrl).href,
               image: img.startsWith('http') ? img : new URL(img, siteUrl).href,
               quality: 'N/A',
               source: new URL(siteUrl).hostname
             });
           }
        }
      });
    }

    // Clean up data
    const finalData = scrapedData.map(item => ({
      ...item,
      image: item.image || 'https://placehold.co/600x400/1e293b/475569?text=No+Image',
      uploadedAt: new Date().toISOString()
    }));

    if (finalData.length === 0) {
      // If parsing specific logic failed, try extracting OpenGraph data as a last resort (for single pages)
      const ogTitle = $('meta[property="og:title"]').attr('content');
      const ogUrl = $('meta[property="og:url"]').attr('content');
      const ogImage = $('meta[property="og:image"]').attr('content');
      
      if (ogTitle && ogUrl) {
         finalData.push({
            title: ogTitle,
            url: ogUrl,
            image: ogImage,
            quality: 'Page',
            source: new URL(siteUrl).hostname,
            uploadedAt: new Date().toISOString()
         });
      } else {
        throw new Error("Could not detect any video or episode content on this page. The site structure may have changed.");
      }
    }

    return res.status(200).json({ 
      success: true, 
      data: finalData,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("Scraper Error:", error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || "Internal Server Error" 
    });
  }
}