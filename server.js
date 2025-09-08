import express from 'express';
import formidable from 'formidable';
import fs from 'fs-extra';
import path from 'path';
import fetch from 'node-fetch';
import crypto from 'crypto';

const app = express();
const port = 3000;
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

// Create the uploads directory if it doesn't exist
fs.ensureDirSync(UPLOADS_DIR);

// Serve static files from the 'public' directory
app.use(express.static('public'));
app.use(express.json());

// Set up the routes
app.get('/api/list', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const allFiles = await fs.readdir(UPLOADS_DIR);

    const files = allFiles.map(filename => ({
        filename: filename,
        url: `/uploads/${filename}`,
    }));

    const totalFiles = files.length;
    const totalPages = Math.ceil(totalFiles / limit);

    const startIndex = (page - 1) * limit;
    const paginatedFiles = files.slice(startIndex, startIndex + limit);

    res.status(200).json({
      files: paginatedFiles,
      pagination: {
        currentPage: page,
        totalPages,
        totalFiles,
        hasMore: page < totalPages
      }
    });
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ message: 'Failed to list files', error: error.message });
  }
});

app.post('/api/upload', (req, res) => {
    const form = formidable({});

    form.parse(req, async (err, fields, files) => {
      if (err) {
        return res.status(500).json({ message: 'Upload failed', error: err.message });
      }

      const uploadedFile = files.file[0];

      if (uploadedFile.mimetype !== 'application/pdf') {
        return res.status(400).json({ message: 'Only PDF files are allowed' });
      }

      try {
        const filePath = path.join(UPLOADS_DIR, uploadedFile.originalFilename);
        await fs.move(uploadedFile.filepath, filePath, { overwrite: true });

        res.status(200).json({
          message: 'File uploaded successfully!',
          filename: uploadedFile.originalFilename,
          filepath: `/uploads/${uploadedFile.originalFilename}`
        });
      } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ message: 'Upload failed', error: error.message });
      }
    });
});

app.delete('/api/delete', async (req, res) => {
  const { filename } = req.query;

  if (!filename) {
    return res.status(400).json({ message: 'Filename parameter is required' });
  }

  const filePath = path.join(UPLOADS_DIR, filename);

  try {
    console.log('Attempting to delete file:', filePath);
    await fs.unlink(filePath);
    console.log('Delete successful');
    res.status(200).json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Detailed error:', error);
    res.status(500).json({
      message: 'Failed to delete file',
      error: error.message,
      filename: filename
    });
  }
});

app.get('/api/download', (req, res) => {
    const { filename } = req.query;

    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    const decodedFilename = decodeURIComponent(filename);
    const sanitizedFilename = path.basename(decodedFilename);
    const filePath = path.join(UPLOADS_DIR, sanitizedFilename);

    try {
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      const stat = fs.statSync(filePath);
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(sanitizedFilename)}`);

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error('Error downloading file:', error);
      res.status(500).json({ error: 'Failed to download file' });
    }
});

app.post('/api/stream', async (req, res) => {
  const { fileUrl } = req.body;
  const WORKER_URL = 'https://red-violet-ac4b.sns6733229.workers.dev';

  if (!fileUrl) {
    console.error('DEBUG: fileUrl is missing in the request body');
    return res.status(400).json({ error: 'fileUrl is required in the request body' });
  }
  
  console.log(`DEBUG: Received request to stream file from: ${fileUrl}`);
  
  try {
    const workerStreamUrl = `${WORKER_URL}?url=${encodeURIComponent(fileUrl)}`;
    console.log(`DEBUG: Sending request to Worker at: ${workerStreamUrl}`);
    
    const response = await fetch(workerStreamUrl, {
      method: 'get',
    });
    
    console.log(`DEBUG: Received response from Worker with status: ${response.status}`);

    if (!response.ok) {
      console.error(`DEBUG: Response from Worker was not OK. Status: ${response.status}, StatusText: ${response.statusText}`);
      throw new Error(`Failed to stream file from Worker: ${response.status} ${response.statusText}`);
    }

    // קריאת כל הזרם אל בופר
    const buffer = await response.buffer();
    console.log(`DEBUG: Successfully read ${buffer.length} bytes into buffer.`);

    // חישוב חשיש (SHA-256) של הבופר
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    console.log(`DEBUG: SHA-256 Hash of received buffer: ${hash}`);

    // קבלת שם הקובץ מהכותרות שהתקבלו
    const filenameFromHeader = response.headers.get('content-disposition');
    let filename = 'downloaded_file.pdf';
    if (filenameFromHeader) {
      const match = filenameFromHeader.match(/filename\*?=(?:UTF-8'')?([^;]+)/i);
      if (match && match.length > 1) {
        filename = decodeURIComponent(match[1]);
      }
    }
    console.log(`DEBUG: Final filename from Worker: ${filename}`);

    // הגדרת כותרות התגובה עבור הדפדפן
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

    // שמירת הקובץ לבדיקה מקומית
    const tempFilePath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(tempFilePath, buffer);
    console.log(`DEBUG: File saved to ${tempFilePath} for local verification.`);

    res.send(buffer);

  } catch (error) {
    console.error('--- STREAMING ERROR ---');
    console.error('Error Message:', error.message);
    console.error('--- END OF ERROR DETAILS ---');

    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream the file via proxy.' });
    }
  }
});


app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
