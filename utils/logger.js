const { createLogger, transports, format } = require('winston');

const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [
    new transports.Console(),
    // Bounded at 10 MB x 5 files = 50 MB ceiling. Previously unbounded, which
    // meant the disk filled until the process died.
    // tailable: true keeps logs/app.log as the *current* file (older data rolls
    // into app1.log, app2.log...), so anything already tailing that exact path
    // continues to work unchanged.
    new transports.File({
      filename: 'logs/app.log',
      maxsize:  10 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
    }),
  ],
});

module.exports = logger;
