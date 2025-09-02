import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

// הגדרת Vercel כדי לאפשר העלאת קבצים גדולים
export const config = {
  api: {
    bodyParser: false, // חשוב מאוד לכבות את ה-bodyParser המובנה של Vercel
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'רק שיטת POST נתמכת' });
  }

  const form = formidable({ 
    uploadDir: './public/uploads', // נגדיר תיקייה לשמירת קבצים שהועלו
    keepExtensions: true, // שמירת סיומת הקובץ המקורית
  });

  try {
    const [fields, files] = await form.parse(req);
    const uploadedFile = files.file[0]; // קבלת הקובץ שהועלה (השם file הוא השם של שדה ה-input בטופס)

    // אם ההעלאה הצליחה
    res.status(200).json({
      message: 'הקובץ הועלה בהצלחה!',
      filename: uploadedFile.newFilename,
      filepath: `/uploads/${uploadedFile.newFilename}`,
    });
  } catch (error) {
    console.error('שגיאה בהעלאת הקובץ:', error);
    res.status(500).json({ message: 'העלאה נכשלה', error: error.message });
  }
}
