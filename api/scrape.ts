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

    // --- STRATEGY 1: ADVANCED HEADERS ---
    // Mimic a real Chrome browser to bypass basic protections
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br', // Important for some servers
      'Cache-Control': 'max-age=0',
      'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
      'Referer': new URL(siteUrl).origin + '/' // Trick: Referer is the site itself
    };

    const response = await fetch(siteUrl, { headers });
    
    // --- STRATEGY 2: CLOUDFLARE DETECTION ---
    if (!response.ok) {
      if (response.status === 403 || response.status === 503) {
        throw new Error(`BLOCKED: Website Protected (Cloudflare ${response.status}). Try opening the link in your browser first.`);
      }
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    
    // Check for "Just a moment..." Cloudflare interstitial hidden in 200 OK responses
    if (html.includes('cf-turnstile') || html.includes('Just a moment...') || html.includes('Enable JavaScript and cookies')) {
       throw new Error("BLOCKED: Cloudflare JS Challenge detected. Server-side scraping cannot bypass this.");
    }

    const $ = cheerio.load(html);
    let scrapedData: any[] = [];
    const siteDomain = new URL(siteUrl).hostname;

    // --- PHASE 1: MEDIA EXTRACTION (Videos/Iframes) ---
    $('iframe').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src');
      if (src && !src.includes('facebook') && !src.includes('google') && !src.includes('analytics') && !src.includes('ads')) {
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

    // --- PHASE 2: CONTENT EXTRACTION (Domain Specific + Universal Fallback) ---

    // 1. YouTube Specific
    if (siteUrl.includes('youtube.com') || siteUrl.includes('youtu.be')) {
      const title = $('meta[name="title"]').attr('content') || $('title').text();
      const image = $('meta[property="og:image"]').attr('content');
      const url = $('link[rel="canonical"]').attr('href') || siteUrl;
      
      scrapedData.push({
        title: title.replace(' - YouTube', ''),
        url: url,
        image: image,
        quality: 'HD',
        videoUrl: url,
        source: 'YouTube',
        type: 'video'
      });
    } 
    
    // 2. KNOWN SITES (Try specific selectors first)
    if (siteUrl.includes('kuramanime')) {
      $('.product__item, .anime-card, .sidebar-comment').each((i, el) => {
        const title = $(el).find('h5 a, h4 a, .title').text().trim();
        const link = $(el).find('a').attr('href');
        const img = $(el).find('.product__item__pic').attr('data-setbg') || $(el).find('img').attr('src');
        const ep = $(el).find('.ep').text().trim();
        if (title && link) {
           scrapedData.push({ title, url: link, image: img, quality: ep, source: 'Kuramanime', type: 'card' });
        }
      });
    }

    if (siteUrl.includes('samehadaku')) {
      $('.post-show ul li, article').each((i, el) => {
        const title = $(el).find('.entry-title').text().trim();
        const link = $(el).find('a').attr('href');
        const img = $(el).find('img').attr('src');
        const ep = $(el).find('.dtla .ep').text().trim();
        if (title && link) {
          scrapedData.push({ title, url: link, image: img, quality: ep, source: 'Samehadaku', type: 'card' });
        }
      });
    }

    // --- PHASE 3: UNIVERSAL FALLBACK (The "Sapu Jagat" Logic) ---
    // If we haven't found many items (or if it's an unknown site), use the greedy logic.
    // This finds ANY link that contains an image, which is 99% of how anime sites display lists.
    
    $('a').each((i, el) => {
      const link = $(el).attr('href');
      if (!link || link === '#' || link.startsWith('javascript') || link.startsWith('mailto')) return;

      const img = $(el).find('img');
      if (img.length > 0) {
         const imgSrc = img.attr('src') || img.attr('data-src') || img.attr('data-setbg');
         // Try to find a title inside the A tag, or right after the image
         let title = $(el).find('h1, h2, h3, h4, h5, .title, .caption, strong, span').text().trim();
         
         // If no title inside, maybe just the text of the link
         if (!title) title = $(el).text().trim();
         
         // Heuristic: Is this a content card?
         // - Has Image
         // - Has Title > 2 chars
         // - Image is not an icon/logo
         // - Link is not internal anchor
         if (imgSrc && title && title.length > 2 && !imgSrc.includes('logo') && !imgSrc.includes('icon') && !imgSrc.includes('avatar')) {
             
             const fullUrl = link.startsWith('http') ? link : new URL(link, siteUrl).href;
             const fullImg = imgSrc.startsWith('http') ? imgSrc : new URL(imgSrc, siteUrl).href;

             // Deduplicate
             if (!scrapedData.find(item => item.url === fullUrl)) {
                scrapedData.push({
                  title: title,
                  url: fullUrl,
                  image: fullImg,
                  quality: 'Detected',
                  source: siteDomain,
                  type: 'card'
                });
             }
         }
      }
    });

    // --- PHASE 4: CLEANUP & FIXES ---
    const finalData = scrapedData.map(item => ({
      ...item,
      // Fix relative URLs one last time just in case
      url: item.url.startsWith('http') ? item.url : new URL(item.url, siteUrl).href,
      image: item.image ? (item.image.startsWith('http') ? item.image : new URL(item.image, siteUrl).href) : 'https://placehold.co/600x400/1e293b/475569?text=No+Image',
      uploadedAt: new Date().toISOString()
    }));

    if (finalData.length === 0) {
      // Last resort: Page Meta
      const ogTitle = $('meta[property="og:title"]').attr('content');
      if (ogTitle) {
         finalData.push({
            title: ogTitle,
            url: siteUrl,
            image: $('meta[property="og:image"]').attr('content'),
            quality: 'Page',
            source: siteDomain,
            type: 'link'
         });
      } else {
         throw new Error("No data found. The site structure might be too complex or fully rendered by JavaScript.");
      }
    }

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