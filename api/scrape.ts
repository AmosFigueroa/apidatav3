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
        You are an API that extracts video metadata.
        Use Google Search to find information about this YouTube link: ${siteUrl}
        
        Task:
        1. Identify if it is a single video, a playlist, or a channel.
        2. Extract the video details found.
        3. If it is a playlist or channel, list the 6 most recent/relevant videos.
        
        Strictly return a raw JSON Array. Do not use Markdown formatting.
      `;
    } else {
      prompt = `
        You are an API that extracts anime/movie metadata.
        Use Google Search to find the **latest updated anime episodes or movies** currently listed on ${siteUrl}.
        
        Query to run: "site:${siteUrl} latest episodes" or "site:${siteUrl} new releases".
        
        Strictly return a raw JSON Array of the top 8 items. Do not use Markdown formatting.
      `;
    }

    // 3. Call Gemini (Using gemini-2.0-flash-exp for best Search/JSON performance)
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp', 
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
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

    // 4. Robust JSON Parsing (Regex Extraction)
    let jsonText = response.text || "[]";
    
    // Logic: Find the first '[' and the last ']' to ignore any conversational filler text
    const jsonMatch = jsonText.match(/\[.*\]/s);
    if (jsonMatch) {
        jsonText = jsonMatch[0];
    }

    let parsedData = [];
    try {
      parsedData = JSON.parse(jsonText);
    } catch (e) {
      console.error("JSON Parsing Failed. Raw Text:", jsonText);
      // Fallback: try to parse as single object if array fails
      if (jsonText.trim().startsWith('{')) {
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
          // Extract ID from v= or direct path
          if (item.url.includes('v=')) {
            videoId = item.url.split('v=')[1]?.split('&')[0];
          } else if (item.url.includes('youtu.be/')) {
            videoId = item.url.split('youtu.be/')[1]?.split('?')[0];
          }

          if (videoId) {
            finalEmbedUrl = `https://www.youtube.com/embed/${videoId}`;
            // Force high quality thumbnail for YouTube if generic image returned
            if (!finalImage || !finalImage.includes('ytimg')) {
              finalImage = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
            }
          }
        } catch (e) {}
      }

      return {
        title: item.title || "Unknown Title",
        url: item.url || siteUrl,
        quality: item.quality || 'HD',
        image: finalImage || 'https://placehold.co/600x400/1e293b/475569?text=No+Image',
        videoUrl: isYT ? item.url : null,
        embedUrl: finalEmbedUrl || null,
        source: isYT ? 'YouTube' : new URL(siteUrl).hostname,
        uploadedAt: new Date().toISOString()
      };
    }) : [];

    if (cleanedData.length === 0) {
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