import { list } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { blobs } = await list();
    
    const files = blobs.map(blob => ({
      filename: blob.pathname,
      url: blob.url
    }));

    res.status(200).json(files);
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ message: 'Failed to list files', error: error.message });
  }
}
