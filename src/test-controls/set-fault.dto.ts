import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class SetFaultDto {
  @IsIn(['off', 'error', 'delay'])
  mode!: 'off' | 'error' | 'delay';

  /** HTTP status used in `error` mode; must be a client/server error code. */
  @IsOptional()
  @IsInt()
  @Min(400)
  @Max(599)
  httpStatus?: number;

  /** Delay used in `delay` mode, bounded to 10 seconds. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  delayMs?: number;
}
