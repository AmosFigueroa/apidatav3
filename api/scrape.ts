import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Standard Node.js Serverless Handler for Vercel
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

    const isYoutube = siteUrl.includes('youtube.com') || siteUrl.includes('youtu.be');

    // 2. Robust Prompt Engineering
    let prompt = '';

    if (isYoutube) {
      prompt = `
        Use Google Search to find information about this YouTube link: ${siteUrl}
        
        If it's a Channel: List the 6 most recent videos.
        If it's a Playlist: List the first 6 videos.
        If it's a Video: Return details for that video.

        For every video found, return:
        - title: The video title.
        - url: The YouTube watch URL.
        - quality: Duration or 'HD'.
        - image: Thumbnail URL.
      `;
    } else {
      prompt = `
        Use Google Search to find the **latest updated anime episodes or movies** currently listed on ${siteUrl}.
        
        Search specifically for query: "site:${siteUrl} latest episodes" or "site:${siteUrl} new releases".
        
        Return a list of the top 8 distinct items found.
        For each item, strictly extract:
        - title: The full title of the anime/movie (including Episode number).
        - url: The link to the episode/movie page on the site.
        - quality: The episode number (e.g. "Ep 12") or quality (e.g. "HD").
        - image: A relevant thumbnail URL from the search result.
      `;
    }

    // 3. Call Gemini with Safety Settings Disabled (Crucial for Anime content)
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-latest', // Using 2.5 Flash for better Search Grounding tool support
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        // Disable safety filters to prevent blocking anime/action content
        safetySettings: [
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
        ],
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              url: { type: Type.STRING },
              quality: { type: Type.STRING },
              image: { type: Type.STRING, nullable: true },
              videoUrl: { type: Type.STRING, nullable: true },
              embedUrl: { type: Type.STRING, nullable: true }
            },
            required: ['title', 'url']
          }
        }
      }
    });

    // 4. Robust JSON Parsing (Fixing the "Extraction Failed" crash)
    let jsonText = response.text || "[]";
    
    // Remove Markdown code fences if present (Gemini often adds these)
    jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();

    let parsedData = [];
    try {
      parsedData = JSON.parse(jsonText);
    } catch (e) {
      console.error("JSON Parsing Failed. Raw Text:", jsonText);
      // Attempt to salvage if it's a single object instead of array
      if (jsonText.startsWith('{')) {
         try { parsedData = [JSON.parse(jsonText)]; } catch(err) {}
      }
    }
    
    // 5. Data Post-Processing
    const cleanedData = Array.isArray(parsedData) ? parsedData.map((item: any) => {
      let finalEmbedUrl = item.embedUrl;
      let finalImage = item.image;
      const isYT = item.url?.includes('youtube.com') || item.url?.includes('youtu.be');

      // Enhanced YouTube Processing
      if (isYT && item.url) {
        try {
          let videoId = null;
          if (item.url.includes('v=')) {
            videoId = item.url.split('v=')[1]?.split('&')[0];
          } else if (item.url.includes('youtu.be/')) {
            videoId = item.url.split('youtu.be/')[1]?.split('?')[0];
          }

          if (videoId) {
            finalEmbedUrl = `https://www.youtube.com/embed/${videoId}`;
            if (!finalImage || finalImage.includes('default')) {
              finalImage = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
            }
          }
        } catch (e) {}
      }

      return {
        title: item.title || "Unknown Title",
        url: item.url || siteUrl,
        quality: item.quality || 'N/A',
        image: finalImage || 'https://placehold.co/600x400/1e293b/475569?text=No+Image',
        videoUrl: isYT ? item.url : null, // Only return videoUrl if it's YouTube, others are unsafe/invalid usually
        embedUrl: finalEmbedUrl || null,
        source: isYT ? 'YouTube' : new URL(siteUrl).hostname,
        uploadedAt: new Date().toISOString()
      };
    }) : [];

    if (cleanedData.length === 0) {
       // Log warning but return success empty to prevent UI crash
       console.warn("No data extracted.");
    }

    return res.status(200).json({ 
      success: true, 
      data: cleanedData,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("API Critical Error:", error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || "Internal Server Error" 
    });
  }
}