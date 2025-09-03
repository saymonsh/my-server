import { del } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ message: 'URL parameter is required' });
  }

  try {
    console.log('Attempting to delete URL:', url); // לוג חדש
    await del(url);
    console.log('Delete successful'); // לוג חדש
    res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Detailed error:', error); // לוג חדש ומפורט יותר
    res.status(500).json({ 
      message: 'Failed to delete file', 
      error: error.message,
      url: url  // מוסיף את ה-URL לתשובת השגיאה
    });
  }
}
