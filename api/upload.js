import formidable from 'formidable';
import { put } from '@vercel/blob';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const form = formidable({});

  try {
    const [fields, files] = await form.parse(req);
    const uploadedFile = files.file[0];

    if (uploadedFile.mimetype !== 'application/pdf') {
      return res.status(400).json({ message: 'Only PDF files are allowed' });
    }

    // קריאת הקובץ כ-Buffer
    const fileBuffer = fs.readFileSync(uploadedFile.filepath);

    // העלאה ל-Blob Storage באמצעות @vercel/blob
    const { url } = await put(
      uploadedFile.originalFilename, // שם הקובץ לשמירה
      fileBuffer, // תוכן הקובץ כ-Buffer
      {
        access: 'public', // הרשאת גישה ציבורית
        contentType: uploadedFile.mimetype
      }
    );

    // מחיקת הקובץ הזמני
    fs.unlinkSync(uploadedFile.filepath);

    res.status(200).json({
      message: 'File uploaded successfully!',
      filename: uploadedFile.originalFilename,
      filepath: url // URL של הקובץ ב-Blob Storage
    });

  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ message: 'Upload failed', error: error.message });
  }
}
