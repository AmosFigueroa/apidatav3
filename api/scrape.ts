import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Standard Node.js Serverless Handler for Vercel
export default async function handler(req: any, res: any) {
  // 1. Setup CORS (Crucial for external access)
  res.setHeader('Access-Control-Allow-Origin', '*'); // Allow any website to call this
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  // 2. Handle Preflight Requests (OPTIONS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 3. Validate Method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    // Vercel automatically parses JSON body if Content-Type is application/json
    const { siteUrl } = req.body || {};

    if (!siteUrl) {
      return res.status(400).json({ error: 'siteUrl is required in the request body.' });
    }

    // 4. Gemini Scraper Logic
    const prompt = `
      Access the website ${siteUrl} using Google Search.
      Find the absolute latest updated anime episodes or movies listed on the homepage or latest updates section.
      
      Extract the following strictly for each item:
      1. **Title**: The full title of the anime or movie.
      2. **Quality/Episode**: The specific Episode number (e.g., "Ep 12") or Quality (e.g., "1080p", "HD").
      3. **Post URL**: The direct link to the watch page on the site.
      4. **Video Source**: actively look for the **Video Streaming Link** (ends in .mp4, .m3u8) or the **Embed URL** (iframe src from servers like blogger, video servers, etc.) associated with this episode. If a direct video link isn't found, try to find the "Download" link.
      5. **Image**: The thumbnail URL.

      Return purely JSON data.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              url: { type: Type.STRING },
              quality: { type: Type.STRING },
              image: { type: Type.STRING, nullable: true },
              videoUrl: { type: Type.STRING, nullable: true, description: "Direct link to video file or stream" },
              embedUrl: { type: Type.STRING, nullable: true, description: "URL for the video player iframe" }
            },
            required: ['title', 'url']
          }
        }
      }
    });

    const jsonText = response.text;
    let parsedData = [];
    
    if (jsonText) {
      parsedData = JSON.parse(jsonText);
    }
    
    // 5. Data Normalization
    const cleanedData = parsedData.map((item: any) => ({
      title: item.title,
      url: item.url || siteUrl,
      quality: item.quality || 'Unknown',
      image: item.image || `https://picsum.photos/seed/${encodeURIComponent(item.title)}/300/450`,
      videoUrl: item.videoUrl || null,
      embedUrl: item.embedUrl || null,
      source: siteUrl,
      uploadedAt: new Date().toISOString()
    }));

    // 6. Return Success Response
    return res.status(200).json({ 
      success: true, 
      data: cleanedData,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("API Error:", error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || "Internal Server Error" 
    });
  }
}