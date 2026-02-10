const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const createLogger = (config) => {
    const format = winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, stack }) => {
            return `${timestamp} [${level.toUpperCase()}] ${message} ${stack || ''}`;
        })
    );

    const transports = [
        new DailyRotateFile({
            filename: `${config.logDirectory}/${config.logFilePrefix}-%DATE%.log`,
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
            level: config.level
        }),
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                format
            ),
            level: config.level
        })
    ];

    return winston.createLogger({
        level: config.level,
        format: format,
        transports: transports,
        exitOnError: false
    });
};

module.exports = { createLogger };