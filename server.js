const express = require('express');
const cors = require('cors');
const { s3Config, logConfig } = require('./env/s3-config');
const { createLogger } = require('./functions/logger');
const imageService = require('./functions/image-service');
const documentService = require('./functions/document-service');
const { startFileLoader, checkS3Connection, getStorageStats } = require('./functions/file-loader');

// Инициализация
const app = express();
const PORT = process.env.PORT || 5050;
const logger = createLogger(logConfig);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('web'));

// Глобальная переменная для хранения ссылки на S3 клиент (инициализируется в file-loader)
let s3Client = null;

// Инициализация подключения к S3
(async () => {
    try {
        s3Client = await checkS3Connection(s3Config);
        logger.info('S3 connection verified successfully');
        
        // Получение статистики хранилища
        const stats = await getStorageStats(s3Client, s3Config.bucket);
        logger.info(`Storage stats: ${stats.objects} objects, ${stats.size} bytes`);
        
        // Запуск фонового загрузчика файлов
        startFileLoader(s3Client, s3Config, logger);
        logger.info('File loader service started');
    } catch (error) {
        logger.error('Failed to initialize S3 connection:', error);
        process.exit(1);
    }
})();

// Маршруты API
// Image service routes
app.get('/api/img/:group/:fromDate?/:toDate?', (req, res) => {
    imageService.getImagesByGroup(req, res, s3Client, s3Config.bucket, logger);
});

app.get('/api/img/wagon/:wagonNumber/:limit?', (req, res) => {
    imageService.getImagesByWagon(req, res, s3Client, s3Config.bucket, logger);
});

app.get('/api/img/latest/:limit?', (req, res) => {
    imageService.getLatestImages(req, res, s3Client, s3Config.bucket, logger);
});

// Document service routes
app.get('/api/doc/:filename', (req, res) => {
    documentService.getDocument(req, res, s3Client, s3Config.bucket, logger);
});

app.get('/api/docs/list/:prefix?', (req, res) => {
    documentService.listDocuments(req, res, s3Client, s3Config.bucket, logger);
});

// Health check route
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'S3 Storage Server',
        s3Connected: !!s3Client
    });
});

// Маршрут для отдачи изображений (добавить после других маршрутов)
app.get('/api/img/view/:key', async (req, res) => {
    try {
        const imageKey = decodeURIComponent(req.params.key);
        
        const params = {
            Bucket: s3Config.bucket,
            Key: imageKey
        };
        
        const data = await s3Client.getObject(params).promise();
        
        // Определяем Content-Type
        const ext = imageKey.toLowerCase().split('.').pop();
        const contentType = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif'
        }[ext] || 'application/octet-stream';
        
        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'public, max-age=86400');
        res.send(data.Body);
        
        logger.debug(`Served image: ${imageKey}`);
        
    } catch (error) {
        logger.error(`Error serving image:`, error);
        res.status(404).json({ error: 'Image not found' });
    }
});

// Запуск сервера
app.listen(PORT, () => {
    logger.info(`Server started on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Экспорт для тестирования
module.exports = { app, s3Client };