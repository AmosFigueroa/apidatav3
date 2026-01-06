import * as cheerio from 'cheerio';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  try {
    const { siteUrl } = req.body || {};
    if (!siteUrl) return res.status(400).json({ error: 'siteUrl is required.' });

    // Headers tailored for video streaming sites
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
      'Referer': siteUrl
    };

    const response = await fetch(siteUrl, { headers });
    if (!response.ok && response.status !== 403) throw new Error(`HTTP Error: ${response.status}`);
    
    // Cloudflare check
    if (response.status === 403) throw new Error("BLOCKED: Site has anti-bot protection. Try using a proxy or check if the site allows scraping.");

    const html = await response.text();
    const $ = cheerio.load(html);
    let scrapedData: any[] = [];
    const siteDomain = new URL(siteUrl).hostname;

    // --- 1. YOUTUBE ADVANCED PARSER (Channel/Video Lists) ---
    if (siteUrl.includes('youtube.com')) {
      // 1. Try meta tags first (for single video)
      const isSingleVideo = siteUrl.includes('/watch');
      if (isSingleVideo) {
         scrapedData.push({
            title: $('meta[name="title"]').attr('content') || $('title').text().replace(' - YouTube', ''),
            url: siteUrl,
            image: $('meta[property="og:image"]').attr('content'),
            quality: 'HD',
            source: 'YouTube',
            type: 'video'
         });
      }

      // 2. Try parsing ytInitialData (For Channels/Playlists)
      // This is crucial because YouTube loads channel lists via JS, not static HTML.
      const scriptTag = $('script').filter((i, el) => {
        return ($(el).html() || '').includes('var ytInitialData =');
      }).first().html();

      if (scriptTag) {
        try {
          const jsonStr = scriptTag.split('var ytInitialData =')[1].split(';')[0];
          const ytData = JSON.parse(jsonStr);
          
          // Traverse the massive YT JSON object
          // Paths vary based on page type (Home vs Videos tab)
          const tabs = ytData.contents?.twoColumnBrowseResultsRenderer?.tabs;
          if (tabs) {
            // Usually the second tab is 'Videos' if on channel home, or first if on /videos
            let contentItems = [];
            
            // Try to find the tab that has 'richGridRenderer' or 'sectionListRenderer'
            tabs.forEach((tab: any) => {
               const richGrid = tab?.tabRenderer?.content?.richGridRenderer;
               if (richGrid) {
                 richGrid.contents?.forEach((c: any) => {
                   if (c.richItemRenderer?.content?.videoRenderer) {
                     contentItems.push(c.richItemRenderer.content.videoRenderer);
                   }
                 });
               }
            });

            contentItems.forEach((v: any) => {
               const videoId = v.videoId;
               const title = v.title?.runs?.[0]?.text || v.title?.simpleText;
               const thumb = v.thumbnail?.thumbnails?.[0]?.url; // use smallest or largest
               const viewCount = v.viewCountText?.simpleText;
               
               if (videoId && title) {
                 // Get higher res thumbnail
                 const highResThumb = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
                 scrapedData.push({
                   title: title,
                   url: `https://www.youtube.com/watch?v=${videoId}`,
                   image: highResThumb,
                   quality: viewCount || 'YT',
                   source: 'YouTube Channel',
                   type: 'card'
                 });
               }
            });
          }
        } catch (e) {
          console.error("Failed to parse ytInitialData", e);
        }
      }
    }

    // --- 2. BSTATION (BILIBILI) SPECIFIC PARSER ---
    else if (siteUrl.includes('bilibili.tv')) {
      // Bstation uses classes like .bstar-video-card
      $('.bstar-video-card, .video-card-list .video-card').each((i, el) => {
         const linkEl = $(el).find('a').first();
         const link = linkEl.attr('href');
         const title = $(el).find('.bstar-video-card__title-text, .title').text().trim();
         const img = $(el).find('img').attr('src') || $(el).find('img').attr('data-src');
         const views = $(el).find('.bstar-video-card__desc').text().trim();

         if (link && title) {
           scrapedData.push({
             title,
             url: link.startsWith('http') ? link : `https://www.bilibili.tv${link}`,
             image: img || '',
             quality: views || 'Bstation',
             source: 'Bstation',
             type: 'card'
           });
         }
      });
      
      // Fallback: Check for __NEXT_DATA__ if static scraping failed
      if (scrapedData.length === 0) {
        const script = $('#__NEXT_DATA__').html();
        if (script) {
          try {
            const json = JSON.parse(script);
            // Attempt to find list in typical Next.js props structure (highly variable)
            // This is a "Best Effort" attempt
            const queries = json.props?.pageProps?.dehydratedState?.queries;
            if (Array.isArray(queries)) {
               queries.forEach((q: any) => {
                 if (q?.state?.data?.list) {
                   q.state.data.list.forEach((item: any) => {
                     if (item.title && item.link) {
                       scrapedData.push({
                         title: item.title,
                         url: item.link,
                         image: item.cover,
                         quality: 'API',
                         source: 'Bstation',
                         type: 'card'
                       });
                     }
                   });
                 }
               });
            }
          } catch(e) {}
        }
      }
    }

    // --- 3. OTHER DISTRIBUTORS (Kuramanime/Samehadaku) ---
    else if (siteUrl.includes('kuramanime')) {
      $('.product__item, .anime-card').each((i, el) => {
        const title = $(el).find('h5 a, .title').text().trim();
        const link = $(el).find('a').attr('href');
        const img = $(el).find('.product__item__pic').attr('data-setbg') || $(el).find('img').attr('src');
        if (title && link) scrapedData.push({ title, url: link, image: img, quality: 'Sub', source: 'Kuramanime', type: 'card' });
      });
    }
    else if (siteUrl.includes('samehadaku')) {
      $('.post-show ul li, article').each((i, el) => {
        const title = $(el).find('.entry-title').text().trim();
        const link = $(el).find('a').attr('href');
        const img = $(el).find('img').attr('src');
        if (title && link) scrapedData.push({ title, url: link, image: img, quality: 'Sub', source: 'Samehadaku', type: 'card' });
      });
    }

    // --- 4. UNIVERSAL FALLBACK (Greedy) ---
    // Runs if nothing specific was found
    if (scrapedData.length === 0) {
      $('a').each((i, el) => {
        const link = $(el).attr('href');
        if (!link || link.length < 5 || link.startsWith('javascript')) return;
        
        const img = $(el).find('img');
        if (img.length > 0) {
           const imgSrc = img.attr('src') || img.attr('data-src');
           let title = $(el).text().trim() || $(el).find('img').attr('alt');
           
           if (imgSrc && title && title.length > 3) {
             const fullUrl = link.startsWith('http') ? link : new URL(link, siteUrl).href;
             const fullImg = imgSrc.startsWith('http') ? imgSrc : new URL(imgSrc, siteUrl).href;
             
             if (!scrapedData.find(x => x.url === fullUrl)) {
                scrapedData.push({
                  title, url: fullUrl, image: fullImg, quality: 'Detected', source: siteDomain, type: 'card'
                });
             }
           }
        }
      });
    }

    // Fix URLs and Image Paths
    const finalData = scrapedData.map(item => ({
      ...item,
      url: item.url.startsWith('http') ? item.url : new URL(item.url, siteUrl).href,
      image: item.image ? (item.image.startsWith('http') ? item.image : new URL(item.image, siteUrl).href) : 'https://placehold.co/600x400/1e293b/475569?text=No+Image',
      uploadedAt: new Date().toISOString()
    }));

    return res.status(200).json({ 
      success: true, 
      count: finalData.length,
      data: finalData,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("Scraper Error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}