const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '../../logs');

// Create logs directory if it doesn't exist
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

const getTimestamp = () => {
  return new Date().toISOString();
};

const formatLog = (level, message, data = null) => {
  const timestamp = getTimestamp();
  const logEntry = {
    timestamp,
    level,
    message,
    ...(data && { data })
  };
  return JSON.stringify(logEntry);
};

const writeLog = (level, message, data) => {
  const isDev = process.env.NODE_ENV !== 'production';
  const logText = formatLog(level, message, data);

  // Console output (always in dev, errors always in prod)
  if (isDev || level === LOG_LEVELS.ERROR) {
    const prefix = `[${getTimestamp()}] [${level}]`;
    console.log(prefix, message, data || '');
  }

  // File output (always)
  const logFile = path.join(logsDir, 'app.log');
  try {
    fs.appendFileSync(logFile, logText + '\n');
  } catch (err) {
    console.error('Failed to write log:', err.message);
  }

  // Separate error log file
  if (level === LOG_LEVELS.ERROR) {
    const errorFile = path.join(logsDir, 'error.log');
    try {
      fs.appendFileSync(errorFile, logText + '\n');
    } catch (err) {
      console.error('Failed to write error log:', err.message);
    }
  }
};

const logger = {
  error: (message, data) => writeLog(LOG_LEVELS.ERROR, message, data),
  warn: (message, data) => writeLog(LOG_LEVELS.WARN, message, data),
  info: (message, data) => writeLog(LOG_LEVELS.INFO, message, data),
  debug: (message, data) => process.env.NODE_ENV === 'development' && writeLog(LOG_LEVELS.DEBUG, message, data)
};

module.exports = logger;
