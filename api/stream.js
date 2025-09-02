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
      // Header שמזדהה בדיוק כמו הבקשה של Make.com
      headers: {
        'User-Agent': 'Make/production'
      }
    });

    const parsedUrl = new url.URL(fileUrl);
    const fileName = path.basename(parsedUrl.pathname) || 'downloaded-file';
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Filename', encodeURIComponent(fileName));
    
    response.data.pipe(res);

  } catch (error) {
    console.error('--- AXIOS ERROR DETAILS ---');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('Data:', error.response.data);
    } else if (error.request) {
      console.error('Request:', error.request);
    } else {
      console.error('Error Message:', error.message);
    }
    console.error('--- END OF ERROR DETAILS ---');
    
    res.status(500).json({ 
      error: 'Failed to stream the file. See Vercel logs for details.',
      status: error.response ? error.response.status : 'N/A' 
    });
  }
}
