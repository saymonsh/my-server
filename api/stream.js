import axios from 'axios';
import url from 'url';
import path from 'path';

export default async function handler(req, res) {
  // We expect the URL to be a query parameter, e.g., /api/stream?url=...
  const { fileUrl } = req.query;

  if (!fileUrl) {
    return res.status(400).send('Missing "url" query parameter');
  }

  try {
    const decodedUrl = decodeURIComponent(fileUrl);

    const response = await axios({
      method: 'get',
      url: decodedUrl,
      responseType: 'stream',
      headers: {
        'User-Agent': 'Make/production'
      }
    });

    // --- לוגיקה לקביעת שם הקובץ (נשארת זהה) ---
    let fileName = 'downloaded-file.dat';
    const disposition = response.headers['content-disposition'];
    
    if (disposition) {
      const filenameMatch = disposition.match(/filename=(.*)/i);
      if (filenameMatch && filenameMatch[1]) {
        fileName = filenameMatch[1].replace(/"/g, '').trim();
      }
    } else {
      const parsedUrl = new url.URL(decodedUrl);
      fileName = path.basename(parsedUrl.pathname) || fileName;
    }
    
    // --- השינוי המרכזי: הגדרת כותרת התגובה ---
    // This header tells the browser to treat the response as a download
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    
    // We can also pass the content type from the source
    if (response.headers['content-type']) {
        res.setHeader('Content-Type', response.headers['content-type']);
    }

    // Stream the file content back to the browser
    response.data.pipe(res);

  } catch (error) {
    console.error('--- AXIOS ERROR DETAILS ---');
    if (error.response) {
      console.error('Status:', error.response.status);
    } else {
      console.error('Error Message:', error.message);
    }
    
    res.status(500).send(`Failed to stream the file. Error: ${error.message}`);
  }
}
