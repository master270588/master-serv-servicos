import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsIn, IsUUID } from 'class-validator';
export class DispatchOrderDto {
  @IsIn(['individual', 'simultaneous']) mode!: 'individual' | 'simultaneous';
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ArrayUnique() @IsUUID('all', { each: true })
  providerUserIds!: string[];
}
