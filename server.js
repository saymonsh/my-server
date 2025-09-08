import express from 'express';
import formidable from 'formidable';
import fs from 'fs-extra';
import path from 'path';
import fetch from 'node-fetch'; // שימוש ב-node-fetch

const app = express();
const port = 3000;
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

// Create the uploads directory if it doesn't exist
fs.ensureDirSync(UPLOADS_DIR);

// Serve static files from the 'public' directory
app.use(express.static('public'));
app.use(express.json());

// קונפיגורציה של כותרות שמתחזות לדפדפן
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
  'DNT': '1', // Do Not Track
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
};

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
  if (!fileUrl) {
    return res.status(400).json({ error: 'fileUrl is required in the request body' });
  }

  try {
    const response = await fetch(fileUrl, {
      method: 'get',
      headers: BROWSER_HEADERS,
      retries: 3,
      retryDelay: 1000,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
    }

    let fileName = path.basename(new URL(fileUrl).pathname) || 'downloaded_file';
    const disposition = response.headers.get('content-disposition');

    if (disposition) {
      const filenameMatch = disposition.match(/filename\*?=(?:UTF-8'')?([^;]+)/i);
      if (filenameMatch && filenameMatch.length > 1) {
        fileName = decodeURIComponent(filenameMatch[1]);
      }
    }

    const totalSize = response.headers.get('content-length');

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Filename', encodeURIComponent(fileName));
    res.setHeader('X-Filesize', totalSize || 0);

    // הזרמת הנתונים
    response.body.pipe(res);

  } catch (error) {
    console.error('--- FETCH ERROR DETAILS ---');
    console.error('Error Message:', error.message);
    console.error('--- END OF ERROR DETAILS ---');

    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream the file.' });
    }
  }
});


app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
