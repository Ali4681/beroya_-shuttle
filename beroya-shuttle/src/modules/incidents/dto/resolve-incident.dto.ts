import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResolveIncidentDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  resolutionNotes!: string;
}
