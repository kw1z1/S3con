const AWS = require('aws-sdk');
const fs = require('fs').promises;
const path = require('path');
const chokidar = require('chokidar');

let uploadQueue = [];
let isUploading = false;

// Инициализация S3 клиента
const initS3Client = (config) => {
    return new AWS.S3({
        endpoint: config.endpoint,
        region: config.region,
        credentials: config.credentials,
        s3ForcePathStyle: true,
        signatureVersion: 'v4'
    });
};

// Проверка подключения к S3
const checkS3Connection = async (config) => {
    const s3 = initS3Client(config);
    try {
        await s3.headBucket({ Bucket: config.bucket }).promise();
        return s3;
    } catch (error) {
        throw new Error(`S3 connection failed: ${error.message}`);
    }
};

// Получение статистики хранилища
const getStorageStats = async (s3, bucket) => {
    try {
        const data = await s3.listObjectsV2({ Bucket: bucket }).promise();
        const totalSize = data.Contents.reduce((sum, obj) => sum + (obj.Size || 0), 0);
        return {
            objects: data.KeyCount,
            size: totalSize
        };
    } catch (error) {
        return { objects: 0, size: 0 };
    }
};

// Загрузка файла в S3
const uploadToS3 = async (s3, bucket, filePath, s3Key, logger) => {
    const fileContent = await fs.readFile(filePath);
    
    const params = {
        Bucket: bucket,
        Key: s3Key,
        Body: fileContent,
        ContentType: getContentType(filePath)
    };

    await s3.putObject(params).promise();
    logger.debug(`Uploaded: ${s3Key}`);
};

// Определение Content-Type
const getContentType = (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const types = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.json': 'application/json',
        '.pdf': 'application/pdf',
        '.txt': 'text/plain'
    };
    return types[ext] || 'application/octet-stream';
};

// Обработка пары файлов (изображение + аннотация)
const processFilePair = async (s3, config, imagePath, annotationPath, logger) => {
    try {
        // Чтение аннотации
        const annotationContent = await fs.readFile(annotationPath, 'utf8');
        const annotation = JSON.parse(annotationContent);
        
        // Определяем группу из аннотации
        const group = annotation.group || 'unknown';
        const wagonNumber = annotation.detections?.wagon_number || null;
        const timestamp = annotation.timestamp || new Date().toISOString();
        
        // Формируем S3 ключи
        const imageName = path.basename(imagePath);
        const annotationName = path.basename(annotationPath);
        
        const imageKey = `${group}/images/${imageName}`;
        const annotationKey = `${group}/annotations/${annotationName}`;
        
        // Загружаем оба файла
        await Promise.all([
            uploadToS3(s3, config.bucket, imagePath, imageKey, logger),
            uploadToS3(s3, config.bucket, annotationPath, annotationKey, logger)
        ]);
        
        // Удаляем локальные файлы после успешной загрузки
        await Promise.all([
            fs.unlink(imagePath),
            fs.unlink(annotationPath)
        ]);
        
        logger.info(`Processed: ${imageName} -> ${group} ${wagonNumber ? `(wagon: ${wagonNumber})` : ''}`);
        
        return {
            success: true,
            group,
            wagonNumber,
            imageKey,
            annotationKey,
            timestamp
        };
        
    } catch (error) {
        logger.error(`Error processing ${imagePath}:`, error.message);
        return { success: false, error: error.message };
    }
};

// Пакетная загрузка
const processUploadBatch = async (s3, config, batch, logger) => {
    const results = [];
    for (const item of batch) {
        const result = await processFilePair(s3, config, item.imagePath, item.annotationPath, logger);
        results.push(result);
    }
    return results;
};

// Запуск загрузчика файлов
const startFileLoader = (s3, config, logger) => {
    const watcher = chokidar.watch(config.watchPaths, {
        ignored: /(^|[\/\\])\../, // игнорировать скрытые файлы
        persistent: true,
        ignoreInitial: true,
        depth: 2
    });

    // Обработчик новых файлов
    watcher.on('add', async (filePath) => {
        if (path.extname(filePath).toLowerCase() === '.json') {
            // Это аннотация - ищем соответствующее изображение
            const imagePath = filePath.replace('.json', '.jpg');
            try {
                await fs.access(imagePath);
                
                // Добавляем в очередь
                uploadQueue.push({ imagePath, annotationPath: filePath });
                logger.debug(`Added to queue: ${path.basename(imagePath)}`);
                
                // Запускаем обработку очереди, если не активна
                if (!isUploading && uploadQueue.length >= config.uploadBatchSize) {
                    processQueue(s3, config, logger);
                }
            } catch {
                // Изображение не найдено - игнорируем
                logger.debug(`No image found for annotation: ${path.basename(filePath)}`);
            }
        }
    });

    // Периодическая обработка очереди (на случай, если очередь не заполняется до batchSize)
    setInterval(() => {
        if (!isUploading && uploadQueue.length > 0) {
            processQueue(s3, config, logger);
        }
    }, 30000); // Каждые 30 секунд

    logger.info(`File loader watching paths: ${config.watchPaths.join(', ')}`);
};

// Обработка очереди
const processQueue = async (s3, config, logger) => {
    if (isUploading || uploadQueue.length === 0) return;
    
    isUploading = true;
    const batch = uploadQueue.splice(0, Math.min(config.uploadBatchSize, uploadQueue.length));
    
    try {
        logger.info(`Processing batch of ${batch.length} files`);
        const results = await processUploadBatch(s3, config, batch, logger);
        
        const successCount = results.filter(r => r.success).length;
        logger.info(`Batch completed: ${successCount}/${batch.length} successful`);
        
    } catch (error) {
        logger.error('Error processing batch:', error);
    } finally {
        isUploading = false;
        
        // Если в очереди еще есть файлы, обрабатываем следующий пакет
        if (uploadQueue.length >= config.uploadBatchSize) {
            processQueue(s3, config, logger);
        }
    }
};

module.exports = {
    initS3Client,
    checkS3Connection,
    getStorageStats,
    startFileLoader,
    uploadToS3
};