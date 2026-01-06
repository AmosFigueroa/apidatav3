import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Standard Node.js Serverless Handler for Vercel
export default async function handler(req: any, res: any) {
  // 1. Setup CORS (Crucial for external access)
  res.setHeader('Access-Control-Allow-Origin', '*'); 
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
    const { siteUrl } = req.body || {};

    if (!siteUrl) {
      return res.status(400).json({ error: 'siteUrl is required in the request body.' });
    }

    const isYoutube = siteUrl.includes('youtube.com') || siteUrl.includes('youtu.be');

    // 4. Construct Prompt based on Source
    let prompt = '';

    if (isYoutube) {
      prompt = `
        Access the provided YouTube URL: ${siteUrl} using Google Search.
        
        Task:
        1. Identify if the URL is a specific **Video**, a **Channel**, or a **Playlist**.
        2. **If Channel**: Navigate to the "Videos" section/tab and retrieve the 8 most recent video uploads.
        3. **If Playlist**: Retrieve the first 8 videos listed in the playlist.
        4. **If Single Video**: Retrieve details for just that video.

        Extract strictly for each video found:
        - **title**: Video title.
        - **url**: Full YouTube watch URL (e.g. https://www.youtube.com/watch?v=ID).
        - **quality**: The video duration (e.g. "10:05") OR quality label (e.g. "4K", "HD").
        - **image**: The thumbnail URL.
        
        Return purely JSON data.
      `;
    } else {
      prompt = `
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
    }

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
      try {
        parsedData = JSON.parse(jsonText);
      } catch (e) {
        console.error("JSON Parse Error", e);
      }
    }
    
    // 5. Data Normalization & YouTube Post-Processing
    const cleanedData = parsedData.map((item: any) => {
      let finalEmbedUrl = item.embedUrl;
      let finalImage = item.image;
      
      // Post-processing for YouTube to ensure valid Embeds and Images
      if (isYoutube && item.url) {
        try {
          // Robust ID extraction for various YT URL formats
          let videoId = null;
          if (item.url.includes('v=')) {
            videoId = item.url.split('v=')[1]?.split('&')[0];
          } else if (item.url.includes('youtu.be/')) {
            videoId = item.url.split('youtu.be/')[1]?.split('?')[0];
          }

          if (videoId) {
            // Force construct the embed URL for reliability
            finalEmbedUrl = `https://www.youtube.com/embed/${videoId}`;
            // If image is missing or default, use high-res YT thumb
            if (!finalImage || finalImage.includes('default.jpg')) {
              finalImage = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
            }
          }
        } catch (e) {
          // Fallback to original data if parsing fails
        }
      }

      return {
        title: item.title || "Untitled",
        url: item.url || siteUrl,
        quality: item.quality || 'HD',
        image: finalImage || `https://i.ytimg.com/vi/default/hqdefault.jpg`,
        videoUrl: item.videoUrl || item.url, // For YT, watch link is the videoUrl
        embedUrl: finalEmbedUrl || null,
        source: isYoutube ? 'YouTube' : siteUrl,
        uploadedAt: new Date().toISOString()
      };
    });

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