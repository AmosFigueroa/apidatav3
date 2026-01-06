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

    // Headers to mimic a real browser
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Referer': siteUrl
    };

    const response = await fetch(siteUrl, { headers });
    
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error("Access Denied (403). The site is protecting against automated access.");
      }
      throw new Error(`Failed to fetch site: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    let scrapedData: any[] = [];
    const siteDomain = new URL(siteUrl).hostname;

    // --- PHASE 1: DIRECT MEDIA EXTRACTION (Embedded Videos) ---
    // Extract ANY iframe or video tag found on the page (Greedy)
    $('iframe').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && !src.includes('facebook') && !src.includes('google') && !src.includes('analytics')) {
        scrapedData.push({
          title: `Embedded Video ${i + 1}`,
          url: src.startsWith('http') ? src : new URL(src, siteUrl).href,
          image: '',
          quality: 'Embed',
          embedUrl: src.startsWith('http') ? src : new URL(src, siteUrl).href,
          source: siteDomain,
          type: 'video'
        });
      }
    });

    $('video').each((i, el) => {
      const src = $(el).attr('src') || $(el).find('source').attr('src');
      const poster = $(el).attr('poster');
      if (src) {
        scrapedData.push({
          title: `Direct Video Player ${i + 1}`,
          url: src.startsWith('http') ? src : new URL(src, siteUrl).href,
          image: poster ? (poster.startsWith('http') ? poster : new URL(poster, siteUrl).href) : '',
          quality: 'Direct',
          videoUrl: src.startsWith('http') ? src : new URL(src, siteUrl).href,
          source: siteDomain,
          type: 'video'
        });
      }
    });

    // --- PHASE 2: CONTENT LIST EXTRACTION (Cards/Items) ---
    // No limits (remove i > 11 checks). Take everything.

    if (siteUrl.includes('youtube.com') || siteUrl.includes('youtu.be')) {
      // YouTube Logic
      const title = $('meta[name="title"]').attr('content') || $('title').text();
      const image = $('meta[property="og:image"]').attr('content');
      const url = $('link[rel="canonical"]').attr('href') || siteUrl;
      
      // Push main video metadata
      scrapedData.push({
        title: title.replace(' - YouTube', ''),
        url: url,
        image: image,
        quality: 'HD',
        videoUrl: url,
        source: 'YouTube',
        type: 'video' // It's the main video
      });

      // Try to find "Up Next" or Playlist items (Static HTML scan)
      // YouTube static HTML often contains "compactVideoRenderer" inside scripts, but simpler 
      // is scanning for 'a' tags with specific classes if available, or just generic video links
      $('a').each((i, el) => {
        const href = $(el).attr('href');
        const vidTitle = $(el).attr('title') || $(el).find('#video-title').text().trim() || $(el).find('h3').text().trim();
        
        if (href && href.includes('/watch?v=') && vidTitle) {
          const fullUrl = `https://www.youtube.com${href}`;
          // Avoid duplicates with main video
          if (fullUrl !== url) {
             scrapedData.push({
               title: vidTitle,
               url: fullUrl,
               image: `https://i.ytimg.com/vi/${href.split('v=')[1]?.split('&')[0]}/mqdefault.jpg`,
               quality: 'Rel',
               source: 'YouTube',
               type: 'card' // These are links to other videos
             });
          }
        }
      });
    } 
    else if (siteUrl.includes('kuramanime')) {
      // Select ALL items, not just the first 12
      $('.product__item, .anime-card, article, .sidebar-comment').each((i, el) => {
        const title = $(el).find('h4, h3, .title, h5').text().trim();
        const link = $(el).find('a').attr('href');
        const img = $(el).find('img').attr('data-setbg') || $(el).find('img').attr('src');
        const ep = $(el).find('.ep').text().trim();
        
        if (title && link) {
          scrapedData.push({
            title,
            url: link.startsWith('http') ? link : new URL(link, siteUrl).href,
            image: img,
            quality: ep || 'Sub',
            source: 'Kuramanime',
            type: 'card'
          });
        }
      });
    } 
    else if (siteUrl.includes('samehadaku')) {
      // Samehadaku: Get Home page items AND Widget items
      $('.post-show ul li, .animepost, article, .widget-post li').each((i, el) => {
        const title = $(el).find('.entry-title, .title, a').first().text().trim();
        const link = $(el).find('a').attr('href');
        const img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');
        const ep = $(el).find('.dtla .ep, .episode').text().trim();

        if (title && link) {
          scrapedData.push({
            title,
            url: link,
            image: img,
            quality: ep || 'Sub',
            source: 'Samehadaku',
            type: 'card'
          });
        }
      });
    }
    else {
      // --- GENERIC GREEDY FALLBACK ---
      // 1. Find anything that looks like a video link (.mp4, .mkv)
      $('a[href$=".mp4"], a[href$=".mkv"], a[href$=".m3u8"]').each((i, el) => {
         scrapedData.push({
            title: $(el).text().trim() || "Direct Video Link",
            url: $(el).attr('href') || "",
            image: '',
            quality: 'File',
            videoUrl: $(el).attr('href'),
            source: siteDomain,
            type: 'video'
         });
      });

      // 2. Find anything that looks like a card (Link with Image)
      $('a').each((i, el) => {
        const link = $(el).attr('href');
        if (!link || link === '#' || link === '/' || link.startsWith('javascript')) return;

        const img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');
        let title = $(el).find('h1, h2, h3, h4, .title, .caption, strong').text().trim();
        if (!title) title = $(el).attr('title') || "";
        if (!title) title = $(el).text().trim();

        // Relaxed Filtering: Just needs a Title, a Link, and an Image to be considered a "Card"
        if (img && title && title.length > 2 && !img.includes('logo') && !img.includes('icon')) {
           const fullUrl = link.startsWith('http') ? link : new URL(link, siteUrl).href;
           
           // Simple duplicate check
           if (!scrapedData.find(item => item.url === fullUrl)) {
             scrapedData.push({
               title,
               url: fullUrl,
               image: img.startsWith('http') ? img : new URL(img, siteUrl).href,
               quality: 'Item',
               source: siteDomain,
               type: 'card'
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
      // Last resort: Return Page Metadata if nothing else found
      const ogTitle = $('meta[property="og:title"]').attr('content');
      const ogUrl = $('meta[property="og:url"]').attr('content');
      if (ogTitle) {
         finalData.push({
            title: ogTitle,
            url: ogUrl || siteUrl,
            image: $('meta[property="og:image"]').attr('content'),
            quality: 'Page',
            source: siteDomain,
            type: 'link'
         });
      }
    }

    // Return EVERYTHING. No slice. No filtering. The frontend decides.
    return res.status(200).json({ 
      success: true, 
      count: finalData.length,
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