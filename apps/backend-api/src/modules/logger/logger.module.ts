import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get('NODE_ENV') === 'production';
        return {
          pinoHttp: {
            level: isProduction ? 'info' : 'debug',
            transport: isProduction
              ? undefined
              : {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    singleLine: false,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                  },
                },
            customProps: () => ({
              context: 'HTTP',
              service: 'ai-mos-backend',
            }),
            customSuccessMessage: (req, res) =>
              `${req.method} ${req.url} ${res.statusCode}`,
            customErrorMessage: (req, res, error) =>
              `${req.method} ${req.url} ${res.statusCode} - ${error.message}`,
          },
        };
      },
    }),
  ],
  exports: [LoggerModule],
})
export class AppLoggerModule {}
