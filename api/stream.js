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

    // --- דיבוג 1: הדפסת גודל הקובץ ---
    const totalSize = response.headers['content-length'];
    console.log(`File connection successful. Total size: ${totalSize ? (totalSize / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown'}`);

    const parsedUrl = new url.URL(fileUrl);
    const fileName = path.basename(parsedUrl.pathname) || 'downloaded-file';
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Filename', encodeURIComponent(fileName));
    
    let bytesStreamed = 0;
    let megabytesStreamed = 0;
    console.log('Starting stream...');
    
    await new Promise((resolve, reject) => {
      const dataStream = response.data;

      dataStream.on('data', chunk => {
        bytesStreamed += chunk.length;
        // --- דיבוג 2: הדפסת התקדמות ההזרמה ---
        if (bytesStreamed >= (megabytesStreamed + 1) * 1024 * 1024) {
          megabytesStreamed++;
          console.log(`... Streamed ${megabytesStreamed} MB`);
        }
        res.write(chunk);
      });
      
      dataStream.on('end', () => {
        console.log(`Stream finished. Total bytes streamed: ${(bytesStreamed / 1024 / 1024).toFixed(2)} MB`);
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
    } else {
      console.error('Error Message:', error.message);
    }
    console.error('--- END OF ERROR DETAILS ---');
    
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream the file.' });
    }
  }
}
