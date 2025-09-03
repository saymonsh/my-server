import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

// Configure external storage (example with local storage for development)
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

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
    uploadDir: UPLOAD_DIR,
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

    // שמירת הקובץ עם שם ייחודי
    const timestamp = Date.now();
    const newFileName = `${timestamp}-${uploadedFile.originalFilename}`;
    const newPath = path.join(UPLOAD_DIR, newFileName);
    
    // העברת הקובץ למיקום הסופי
    fs.renameSync(uploadedFile.filepath, newPath);

    // שמירת מידע על הקובץ (בהמשך נשמור במסד נתונים)
    const fileInfo = {
      originalName: uploadedFile.originalFilename,
      fileName: newFileName,
      path: `/uploads/${newFileName}`,
      size: uploadedFile.size,
      type: uploadedFile.mimetype,
      uploadedAt: new Date()
    };

    res.status(200).json({
      message: 'File uploaded successfully!',
      filename: fileInfo.originalName,
      filepath: fileInfo.path
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ message: 'Upload failed', error: error.message });
  }
}
