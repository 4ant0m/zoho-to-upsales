/**
 * Created by 4ant0m on 3/8/19.
 */
const winston = require('winston');

class Logger {
    constructor (data) {
        let self = this;
        this.context = data.context;
        this.path = data.path || '/../logs.log'

        let customLevels = {
            levels: {
                error: 0,
                info: 1,
                action: 2,
                success: 3
            },
            colors: {
                error: "red",
                info: "cyan",
                action: "yellow",
                success: "bold white greenBG"
            }
        };

        let logger = winston.createLogger({
            levels: customLevels.levels,
            transports: [new winston.transports.Console(
                {
                    level: "success",
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.json(),
                        winston.format.timestamp(),
                        winston.format.printf(info => {
                            return `${info.timestamp} ${info.level} [${self.context}]: ${self.getPrettyObject(info.message)}`
                        })
                    ), colorize: true
                }),
                new winston.transports.File({
                    level: "action",
                    filename: `${__dirname}${self.path}`
                })]
        })

        winston.addColors(customLevels.colors)
        return logger
    }

     getPrettyObject (object) {
        return JSON.stringify(object, ``, 2)
    }
}

module.exports = Logger
