import { ScrapedItem, TargetSite } from "../types";

export const fetchSiteData = async (siteUrl: TargetSite): Promise<ScrapedItem[]> => {
  try {
    // Call our own internal API endpoint
    // When deployed on Vercel, /api/scrape maps to the api/scrape.ts function
    const response = await fetch('/api/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ siteUrl }),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || "Failed to fetch data");
    }

    return result.data;

  } catch (error) {
    console.error("Scraping error:", error);
    throw new Error("Failed to scrape data. Please try again.");
  }
};