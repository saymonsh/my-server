import axios from 'axios';
import url from 'url';
import path from 'path';

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
    const response = await axios({
      method: 'get',
      url: fileUrl,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
      }
    });

    const parsedUrl = new url.URL(fileUrl);
    const fileName = path.basename(parsedUrl.pathname) || 'downloaded-file';
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Filename', encodeURIComponent(fileName));
    
    response.data.pipe(res);

  } catch (error) {
    // --- קוד דיבוג משופר ---
    console.error('--- AXIOS ERROR DETAILS ---');
    if (error.response) {
      // הבקשה בוצעה והשרת הגיב עם סטטוס שגיאה
      console.error('Status:', error.response.status);
      console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('Data:', error.response.data); // זה החלק הכי חשוב, יכול להכיל HTML
    } else if (error.request) {
      // הבקשה בוצעה אך לא התקבלה תגובה
      console.error('Request:', error.request);
    } else {
      // שגיאה כללית
      console.error('Error Message:', error.message);
    }
    console.error('--- END OF ERROR DETAILS ---');
    
    res.status(500).json({ 
      error: 'Failed to stream the file. See Vercel logs for details.',
      status: error.response ? error.response.status : 'N/A' 
    });
  }
}
