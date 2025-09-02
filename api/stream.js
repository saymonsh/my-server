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

    // --- לוגיקה משודרגת לקביעת שם הקובץ עם דיבוג ---
    console.log("DEBUG FILENAME: Starting filename detection.");
    console.log("DEBUG FILENAME: All headers from source:", JSON.stringify(response.headers, null, 2));

    let fileName = 'downloaded_file'; // שם קובץ ברירת מחדל
    const disposition = response.headers['content-disposition'];
    console.log(`DEBUG FILENAME: Found Content-Disposition header: ${disposition}`);
    
    if (disposition) {
      const filenameMatch = disposition.match(/filename="(.+?)"/i); // Case-insensitive match
      if (filenameMatch && filenameMatch.length > 1) {
        fileName = filenameMatch[1];
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
    } else {
      console.error('Error Message:', error.message);
    }
    console.error('--- END OF ERROR DETAILS ---');
    
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream the file.' });
    }
  }
}
