import { list } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { blobs } = await list();
    
    // Calculate total pages
    const totalFiles = blobs.length;
    const totalPages = Math.ceil(totalFiles / limit);
    
    // Get paginated results
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedBlobs = blobs.slice(startIndex, endIndex);

    const files = paginatedBlobs.map(blob => ({
      filename: blob.pathname,
      url: blob.url,
      uploadedAt: blob.uploadedAt,
      size: blob.size
    }));

    res.status(200).json({
      files,
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
}
