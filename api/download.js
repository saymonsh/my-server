import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  const { filename } = req.query;
  
  if (!filename) {
    return res.status(400).json({ error: 'Filename is required' });
  }

  // Sanitize filename to prevent directory traversal
  const sanitizedFilename = path.basename(filename);
  const filePath = path.join(process.cwd(), 'public', 'uploads', sanitizedFilename);

  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Set headers for file download
    const stat = fs.statSync(filePath);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${sanitizedFilename}`);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
}
