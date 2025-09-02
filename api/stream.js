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

    // --- לוגיקה משודרגת לקביעת שם הקובץ ---
    let fileName = 'downloaded-file'; // שם קובץ ברירת מחדל
    const disposition = response.headers['content-disposition'];
    
    if (disposition) {
      const filenameMatch = disposition.match(/filename="(.+?)"/);
      if (filenameMatch && filenameMatch.length > 1) {
        fileName = filenameMatch[1];
      }
    } else {
      // אם אין Header, חוזרים לשיטה הישנה של ניתוח ה-URL
      const parsedUrl = new url.URL(fileUrl);
      fileName = path.basename(parsedUrl.pathname) || fileName;
    }
    // -----------------------------------------
    
    const totalSize = response.headers['content-length'];
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Filename', encodeURIComponent(fileName));
    res.setHeader('X-Filesize', totalSize || 0);
    
    await new Promise((resolve, reject) => {
      const dataStream = response.data;

      dataStream.on('data', chunk => res.write(chunk));
      
      dataStream.on('end', () => {
        res.end();
        resolve();
      });

      dataStream.on('error', (err) => {
        console.error('Stream pipe error:', err);
        reject(err);
      });
    });

  } catch (error) {
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
