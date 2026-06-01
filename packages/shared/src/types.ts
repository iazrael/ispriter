/** CSS background-position 中的位置值（支持 px 和百分比） */
export type PositionValue = number | string;

/** 输出单位 */
export type OutputUnit = 'px' | 'rem';

/** 图片格式 */
export type ImageFormat = 'png' | 'webp';

/** 错误码 */
export type ErrorCode =
  | 'CONFIG_INVALID'
  | 'CSS_PARSE_ERROR'
  | 'IMAGE_READ_ERROR'
  | 'IMAGE_NOT_FOUND'
  | 'PACK_ERROR'
  | 'OUTPUT_ERROR';
