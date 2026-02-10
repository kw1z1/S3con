// Конфигурация для S3-совместимого хранилища TimeWeb Cloud
const s3Config = {
    endpoint: 'https://s3.twcstorage.ru',
    region: 'ru-1',
    credentials: {
        accessKeyId: '38LYWQY3EF84ULC05YJV',
        secretAccessKey: 'deHmVHJpbcvXKEnMTmA0D78LJhGF02HmhDIqCiJD'
    },
    bucket: '431095bc-299191f4-2138-4051-ab7c-53dee0f6866b',
    // Пути для мониторинга (ЗАМЕНИТЬ НА F:/ для разработки!)
    watchPaths: [
        'F:\\imagestorage\\place\\72',
        'F:\\imagestorage\\place\\73',
        'F:\\imagestorage\\place\\74',
        'F:\\imagestorage\\place\\75',
        'F:\\imagestorage\\place\\76',
        'F:\\imagestorage\\place\\pirs1'
        // В продакшене заменить на E:
    ],
    // Максимальное количество файлов для пакетной загрузки
    uploadBatchSize: 10
};

// Конфигурация логгера (development - подробные логи, production - только важное)
const logConfig = {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug', // 'debug' для разработки
    logDirectory: './logs',
    logFilePrefix: 's3-server'
};

module.exports = { s3Config, logConfig };