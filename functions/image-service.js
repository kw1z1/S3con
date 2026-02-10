const getImagesByGroup = async (req, res, s3, bucket, logger) => {
    try {
        const { group } = req.params;
        const { fromDate, toDate } = req.query;
        
        logger.info(`GET /api/img/${group} from=${fromDate} to=${toDate}`);
        
        // Формируем префикс для поиска
        const prefix = `${group}/annotations/`;
        
        // Получаем список аннотаций
        const listParams = {
            Bucket: bucket,
            Prefix: prefix
        };
        
        const data = await s3.listObjectsV2(listParams).promise();
        
        // Фильтрация по дате и преобразование результатов
        const results = [];
        for (const item of data.Contents || []) {
            if (item.Key.endsWith('.json')) {
                try {
                    // Получаем аннотацию
                    const annotationData = await s3.getObject({
                        Bucket: bucket,
                        Key: item.Key
                    }).promise();
                    
                    const annotation = JSON.parse(annotationData.Body.toString('utf8'));
                    
                    // Фильтрация по дате
                    const itemDate = new Date(annotation.timestamp || annotation.server_timestamp);
                    if (fromDate && itemDate < new Date(fromDate)) continue;
                    if (toDate && itemDate > new Date(toDate)) continue;
                    
                    // Формируем ссылки
                    const imageKey = item.Key.replace('annotations/', 'images/').replace('.json', '.jpg');
                    const imageUrl = `${req.protocol}://${req.get('host')}/api/img/view/${encodeURIComponent(imageKey)}`;
                    
                    results.push({
                        group: annotation.group,
                        wagonNumber: annotation.detections?.wagon_number || null,
                        timestamp: annotation.timestamp,
                        filename: annotation.filename,
                        imageUrl,
                        annotation: annotation
                    });
                } catch (error) {
                    logger.warn(`Error processing ${item.Key}:`, error.message);
                }
            }
        }
        
        // Сортировка по времени (новые первыми)
        results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        res.json({
            count: results.length,
            group,
            fromDate,
            toDate,
            images: results
        });
        
    } catch (error) {
        logger.error('Error in getImagesByGroup:', error);
        res.status(500).json({ error: error.message });
    }
};

const getImagesByWagon = async (req, res, s3, bucket, logger) => {
    try {
        const { wagonNumber, limit = 100 } = req.params;
        const wagonNumbers = wagonNumber.split(',').map(n => n.trim());
        
        logger.info(`GET /api/img/wagon/${wagonNumber} limit=${limit}`);
        
        // Поиск по всем группам
        const groups = ['res72', 'res73', 'res74', 'res75', 'res76', 'pirs1'];
        const results = [];
        
        for (const group of groups) {
            const prefix = `${group}/annotations/`;
            
            const listParams = {
                Bucket: bucket,
                Prefix: prefix
            };
            
            const data = await s3.listObjectsV2(listParams).promise();
            
            for (const item of data.Contents || []) {
                if (item.Key.endsWith('.json')) {
                    try {
                        const annotationData = await s3.getObject({
                            Bucket: bucket,
                            Key: item.Key
                        }).promise();
                        
                        const annotation = JSON.parse(annotationData.Body.toString('utf8'));
                        
                        // Проверяем номер вагона
                        const currentWagon = annotation.detections?.wagon_number;
                        if (currentWagon && wagonNumbers.includes(currentWagon)) {
                            const imageKey = item.Key.replace('annotations/', 'images/').replace('.json', '.jpg');
                            const imageUrl = `${req.protocol}://${req.get('host')}/api/img/view/${encodeURIComponent(imageKey)}`;
                            
                            results.push({
                                group: annotation.group,
                                wagonNumber: currentWagon,
                                timestamp: annotation.timestamp,
                                filename: annotation.filename,
                                imageUrl,
                                annotation: annotation
                            });
                            
                            // Ограничение количества результатов
                            if (results.length >= limit) {
                                res.json({
                                    count: results.length,
                                    wagonNumbers,
                                    images: results
                                });
                                return;
                            }
                        }
                    } catch (error) {
                        logger.debug(`Error processing ${item.Key}:`, error.message);
                    }
                }
            }
        }
        
        // Сортировка по времени
        results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        res.json({
            count: results.length,
            wagonNumbers,
            images: results
        });
        
    } catch (error) {
        logger.error('Error in getImagesByWagon:', error);
        res.status(500).json({ error: error.message });
    }
};

const getLatestImages = async (req, res, s3, bucket, logger) => {
    try {
        const limit = parseInt(req.params.limit) || 50;
        
        logger.info(`GET /api/img/latest limit=${limit}`);
        
        // Поиск по всем группам
        const groups = ['res72', 'res73', 'res74', 'res75', 'res76', 'pirs1'];
        const allResults = [];
        
        for (const group of groups) {
            const prefix = `${group}/annotations/`;
            
            const listParams = {
                Bucket: bucket,
                Prefix: prefix,
                MaxKeys: 100 // Ограничиваем для каждой группы
            };
            
            const data = await s3.listObjectsV2(listParams).promise();
            
            for (const item of data.Contents || []) {
                if (item.Key.endsWith('.json')) {
                    try {
                        const annotationData = await s3.getObject({
                            Bucket: bucket,
                            Key: item.Key
                        }).promise();
                        
                        const annotation = JSON.parse(annotationData.Body.toString('utf8'));
                        
                        const imageKey = item.Key.replace('annotations/', 'images/').replace('.json', '.jpg');
                        const imageUrl = `${req.protocol}://${req.get('host')}/api/img/view/${encodeURIComponent(imageKey)}`;
                        
                        allResults.push({
                            timestamp: annotation.timestamp || annotation.server_timestamp,
                            group: annotation.group,
                            wagonNumber: annotation.detections?.wagon_number || null,
                            filename: annotation.filename,
                            imageUrl,
                            annotation: annotation
                        });
                    } catch (error) {
                        logger.debug(`Error processing ${item.Key}:`, error.message);
                    }
                }
            }
        }
        
        // Сортировка и ограничение
        allResults.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const latest = allResults.slice(0, limit);
        
        res.json({
            count: latest.length,
            images: latest
        });
        
    } catch (error) {
        logger.error('Error in getLatestImages:', error);
        res.status(500).json({ error: error.message });
    }
};

// Маршрут для отдачи самих изображений (добавить в server.js)
const getImageFile = async (req, res, s3, bucket, logger) => {
    try {
        const imageKey = decodeURIComponent(req.params.key);
        
        const params = {
            Bucket: bucket,
            Key: imageKey
        };
        
        const data = await s3.getObject(params).promise();
        
        // Определяем Content-Type
        const contentType = getContentType(imageKey);
        
        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'public, max-age=86400');
        res.send(data.Body);
        
        logger.debug(`Served image: ${imageKey}`);
        
    } catch (error) {
        logger.error(`Error serving image:`, error);
        res.status(404).json({ error: 'Image not found' });
    }
};

const getContentType = (filename) => {
    const ext = filename.toLowerCase().split('.').pop();
    const types = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif'
    };
    return types[ext] || 'application/octet-stream';
};

module.exports = {
    getImagesByGroup,
    getImagesByWagon,
    getLatestImages,
    getImageFile
};