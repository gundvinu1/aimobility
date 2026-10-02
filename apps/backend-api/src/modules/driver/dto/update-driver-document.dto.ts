import { PartialType } from '@nestjs/swagger';
import { CreateDriverDocumentDto } from './create-driver-document.dto';

export class UpdateDriverDocumentDto extends PartialType(CreateDriverDocumentDto) {}
