import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const form = formidable({
    uploadDir: './public/uploads',
    keepExtensions: true,
  });

  try {
    const [fields, files] = await form.parse(req);
    const uploadedFile = files.file[0];

    // בדיקה אם הקובץ הוא PDF
    if (uploadedFile.mimetype !== 'application/pdf') {
      fs.unlinkSync(uploadedFile.filepath); // מחיקת הקובץ אם הוא לא PDF
      return res.status(400).json({ message: 'Only PDF files are allowed' });
    }

    const newFileName = uploadedFile.newFilename;

    res.status(200).json({
      message: 'File uploaded successfully!',
      filename: uploadedFile.originalFilename,
      newFilename: newFileName,
      filepath: `/uploads/${newFileName}`,
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ message: 'Upload failed', error: error.message });
  }
}
