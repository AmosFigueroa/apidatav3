import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini Client (Server-side only)
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export default async function handler(request: Request) {
  // CORS Headers to allow other websites to use this API
  const headers = {
    'Access-Control-Allow-Origin': '*', // Allows access from any website
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests (OPTIONS)
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405, 
      headers 
    });
  }

  try {
    const body = await request.json();
    const siteUrl = body.siteUrl;

    if (!siteUrl) {
      return new Response(JSON.stringify({ error: 'siteUrl is required' }), { 
        status: 400, 
        headers 
      });
    }

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
    
    // Normalize data
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

    return new Response(JSON.stringify({ 
      success: true, 
      data: cleanedData,
      timestamp: new Date().toISOString()
    }), { 
      status: 200, 
      headers 
    });

  } catch (error: any) {
    console.error("API Error:", error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message || "Internal Server Error" 
    }), { 
      status: 500, 
      headers 
    });
  }
}