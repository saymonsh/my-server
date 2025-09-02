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
        'User-Agent': 'Make/production'
      }
    });

    const parsedUrl = new url.URL(fileUrl);
    const fileName = path.basename(parsedUrl.pathname) || 'downloaded-file';
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Filename', encodeURIComponent(fileName));
    
    // --- קוד הזרמה משופר ויציב ---
    // עוטפים את כל תהליך ההזרמה ב-Promise כדי שהפונקציה תחכה לסיומו
    await new Promise((resolve, reject) => {
      const dataStream = response.data;

      // מאזינים לאירוע 'data': כל פעם שמגיע חלק מהקובץ, כותבים אותו לתגובה
      dataStream.on('data', chunk => res.write(chunk));
      
      // מאזינים לאירוע 'end': כשהקובץ הסתיים, סוגרים את התגובה
      dataStream.on('end', () => {
        res.end();
        resolve();
      });

      // מאזינים לאירוע 'error': אם יש שגיאה במהלך ההזרמה
      dataStream.on('error', (err) => {
        console.error('Stream pipe error:', err);
        reject(err);
      });
    });

  } catch (error) {
    // קוד לטיפול בשגיאות שנשאר כמו קודם
    console.error('--- AXIOS ERROR DETAILS ---');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
    } else {
      console.error('Error Message:', error.message);
    }
    console.error('--- END OF ERROR DETAILS ---');
    
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream the file.' });
    }
  }
}
