const getDocument = async (req, res, s3, bucket, logger) => {
    try {
        const { filename } = req.params;
        const { download } = req.query;
        
        logger.info(`GET /api/doc/${filename} download=${download}`);
        
        // Ищем документ по всем группам
        const groups = ['res72', 'res73', 'res74', 'res75', 'res76', 'pirs1'];
        let documentKey = null;
        
        for (const group of groups) {
            const key = `${group}/documents/${filename}`;
            try {
                await s3.headObject({ Bucket: bucket, Key: key }).promise();
                documentKey = key;
                break;
            } catch {
                continue;
            }
        }
        
        if (!documentKey) {
            res.status(404).json({ error: 'Document not found' });
            return;
        }
        
        const params = {
            Bucket: bucket,
            Key: documentKey
        };
        
        const data = await s3.getObject(params).promise();
        
        // Определяем Content-Type
        const contentType = getContentType(filename);
        
        res.set('Content-Type', contentType);
        
        if (download === 'true') {
            res.set('Content-Disposition', `attachment; filename="${filename}"`);
        }
        
        res.send(data.Body);
        
        logger.info(`Served document: ${filename}`);
        
    } catch (error) {
        logger.error('Error in getDocument:', error);
        res.status(500).json({ error: error.message });
    }
};

const listDocuments = async (req, res, s3, bucket, logger) => {
    try {
        const { prefix = '' } = req.params;
        
        logger.info(`GET /api/docs/list prefix=${prefix}`);
        
        const groups = ['res72', 'res73', 'res74', 'res75', 'res76', 'pirs1'];
        const allDocuments = [];
        
        for (const group of groups) {
            const searchPrefix = `${group}/documents/${prefix}`;
            
            const params = {
                Bucket: bucket,
                Prefix: searchPrefix
            };
            
            const data = await s3.listObjectsV2(params).promise();
            
            for (const item of data.Contents || []) {
                const filename = item.Key.split('/').pop();
                allDocuments.push({
                    filename,
                    group,
                    key: item.Key,
                    size: item.Size,
                    lastModified: item.LastModified
                });
            }
        }
        
        res.json({
            count: allDocuments.length,
            documents: allDocuments
        });
        
    } catch (error) {
        logger.error('Error in listDocuments:', error);
        res.status(500).json({ error: error.message });
    }
};

const getContentType = (filename) => {
    const ext = filename.toLowerCase().split('.').pop();
    const types = {
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'txt': 'text/plain',
        'csv': 'text/csv'
    };
    return types[ext] || 'application/octet-stream';
};

module.exports = {
    getDocument,
    listDocuments
};