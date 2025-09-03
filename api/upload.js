import formidable from 'formidable';

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

    // קריאת תוכן הקובץ
    const fileData = await fetch(uploadedFile.filepath)
      .then(res => res.blob());

    // העלאה ל-Blob Storage
    const response = await fetch(
      `https://api.vercel.com/v1/blobs/${process.env.VERCEL_BLOB_STORE_ID}`, 
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${process.env.VERCEL_BLOB_TOKEN}`,
          'Content-Type': uploadedFile.mimetype
        },
        body: fileData
      }
    );

    const { url } = await response.json();

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
