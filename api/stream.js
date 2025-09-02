import axios from 'axios';
import url from 'url';
import path from 'path';

// Vercel Serverless Function format
export default async function handler(req, res) {
  // ודא שהבקשה היא מסוג POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const { fileUrl } = req.body;

  if (!fileUrl) {
    return res.status(400).json({ error: 'fileUrl is required in the request body' });
  }

  try {
    // בקשה לקבל את הקובץ בתור Stream (צינור נתונים)
    const response = await axios({
      method: 'get',
      url: fileUrl,
      responseType: 'stream' // המפתח ליעילות בזיכרון
    });

    // קביעת שם הקובץ וההדרים לתגובה
    const parsedUrl = new url.URL(fileUrl);
    const fileName = path.basename(parsedUrl.pathname) || 'downloaded-file';
    
    // חשוב: הגדרת ה-Headers לפני שליחת הנתונים
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Filename', encodeURIComponent(fileName));
    
    // הקסם: חיבור ה"צינור" הנכנס של ההורדה ישירות ל"צינור" היוצא של התגובה
    response.data.pipe(res);

  } catch (error) {
    console.error('Streaming error:', error.message);
    // שלח תגובת שגיאה בפורמט JSON
    res.status(500).json({ error: 'Failed to stream the file.' });
  }
}
