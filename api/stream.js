import fetch from 'node-fetch';
import url from 'url';
import path from 'path';

// התקן את הספרייה node-fetch-retry
// npm install node-fetch-retry

// קונפיגורציה של כותרות שמתחזות לדפדפן
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
  'DNT': '1', // Do Not Track
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const { fileUrl } = req.body;
  if (!fileUrl) {
    return res.status(400).json({ error: 'fileUrl is required in the request body' });
  }

  try {
    const response = await fetch(fileUrl, {
      method: 'get',
      headers: BROWSER_HEADERS,
      retries: 3, // הגדרת ניסיונות חוזרים במקרה של כשל
      retryDelay: 1000, // השהייה של 1 שנייה בין ניסיונות
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }

    // --- לוגיקה משודרגת לקביעת שם הקובץ עם דיבוג ---
    console.log("DEBUG FILENAME: Starting filename detection.");
    console.log("DEBUG FILENAME: All headers from source:", JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));

    let fileName = 'downloaded_file'; // שם קובץ ברירת מחדל
    const disposition = response.headers.get('content-disposition');
    console.log(`DEBUG FILENAME: Found Content-Disposition header: ${disposition}`);
    
    if (disposition) {
      const filenameMatch = disposition.match(/filename\*?=(?:UTF-8'')?([^;]+)/i);
      if (filenameMatch && filenameMatch.length > 1) {
        fileName = decodeURIComponent(filenameMatch[1]);
        console.log(`DEBUG FILENAME: Extracted filename from Content-Disposition: ${fileName}`);
      } else {
        console.log("DEBUG FILENAME: Content-Disposition found, but couldn't extract filename from it.");
      }
    } else {
      console.log("DEBUG FILENAME: No Content-Disposition header found. Falling back to URL path.");
      const parsedUrl = new url.URL(fileUrl);
      fileName = path.basename(parsedUrl.pathname) || fileName;
      console.log(`DEBUG FILENAME: Extracted filename from URL path: ${fileName}`);
    }
    // -----------------------------------------
    
    console.log(`DEBUG FILENAME: Final filename to be sent: ${fileName}`);
    const totalSize = response.headers.get('content-length');
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Filename', encodeURIComponent(fileName));
    res.setHeader('X-Filesize', totalSize || 0);
    
    // הזרמת הנתונים ישירות לתגובה
    response.body.pipe(res);

  } catch (error) {
    console.error('--- FETCH ERROR DETAILS ---');
    console.error('Error Message:', error.message);
    console.error('--- END OF ERROR DETAILS ---');
    
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream the file.' });
    }
  }
}
