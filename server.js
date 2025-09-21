import express from 'express';
import formidable from 'formidable';
import fs from 'fs-extra';
import path from 'path';
import fetch from 'node-fetch';
import crypto from 'crypto';
import expressWs from 'express-ws';
import * as pty from 'node-pty';
import os from 'os';

const app = express();
const port = 3000;
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

// מפעיל את התמיכה ב-WebSockets
expressWs(app);

// הגדרת סוג הטרמינל לפי מערכת ההפעלה
const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';

// Create the uploads directory if it doesn't exist
fs.ensureDirSync(UPLOADS_DIR);

// Serve static files from the 'public' directory
app.use(express.static('public'));
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

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
    const form = formidable({ maxFileSize: 500 * 1024 * 1024 });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error('Error uploading file:', err);
        return res.status(500).json({ message: 'Upload failed', error: err.message });
      }

      const uploadedFile = files.file[0];

      try {
        const filePath = path.join(UPLOADS_DIR, uploadedFile.originalFilename);
        await fs.move(uploadedFile.filepath, filePath, { overwrite: true });
        console.log('file upload successful');

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

app.all('/api/download', async (req, res) => {
    if (req.method === 'GET') {
        // טיפול בהורדה מה-UI (קובץ מקומי)
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
          console.error('Error downloading local file:', error);
          res.status(500).json({ error: 'Failed to download file' });
        }
    } else if (req.method === 'POST') {
        // טיפול בהורדה חיצונית (קריאה ל-stream)
        const { fileUrl } = req.body;

        if (!fileUrl) {
            return res.status(400).json({ error: 'fileUrl is required in the request body' });
        }
        
        try {
            const response = await fetch(`http://localhost:${port}/api/stream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileUrl }),
            });

            if (!response.ok) {
                throw new Error(`Failed to stream file: ${response.status} ${response.statusText}`);
            }

            // העברת הכותרות והזרם מהתגובה הפנימית לתגובה החיצונית
            for (const [key, value] of response.headers.entries()) {
                res.setHeader(key, value);
            }

            response.body.pipe(res);

        } catch (error) {
            console.error('Error during internal file streaming:', error);
            res.status(500).json({ error: 'Failed to download file via stream API' });
        }
    } else {
        res.status(405).json({ message: 'Method Not Allowed' });
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

    const buffer = await response.buffer();
    console.log(`DEBUG: Successfully read ${buffer.length} bytes into buffer.`);

    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    console.log(`DEBUG: SHA-256 Hash of received buffer: ${hash}`);

    const filenameFromHeader = response.headers.get('content-disposition');
    let filename = 'downloaded_file.pdf';
    if (filenameFromHeader) {
      const match = filenameFromHeader.match(/filename\*?=(?:UTF-8'')?([^;]+)/i);
      if (match && match.length > 1) {
        filename = decodeURIComponent(match[1]);
      }
    }
    console.log(`DEBUG: Final filename from Worker: ${filename}`);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

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
