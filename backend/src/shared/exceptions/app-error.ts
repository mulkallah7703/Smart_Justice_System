import { HttpException, HttpStatus } from '@nestjs/common';

export class AppError extends HttpException {
  readonly code: string;
  readonly clientMessage: string;
  readonly messageAr: string;

  constructor(
    code: string,
    message: string,
    messageAr: string,
    status: HttpStatus,
  ) {
    super(
      {
        code,
        message,
        messageAr,
      },
      status,
    );
    this.code = code;
    this.clientMessage = message;
    this.messageAr = messageAr;
  }
}
