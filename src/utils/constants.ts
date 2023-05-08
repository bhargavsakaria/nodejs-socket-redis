export enum YesNo {
  YES = 1,
  NO = 0
}

export enum Platform {
  IOS = 'ios',
  ANDROID = 'android'
}

export enum Role {
  ROOT = 'root',
  SENIOR = 'senior',
  MEMBER = 'member',
  NURSE = 'nurse',
  IT = 'it_support'
}

export type RoomAndSocketId = {
  room_id: string;
  receiverSocketId?: string | null;
  senderSocketId?: string | null;
};

export const relativeJWTExpiry = 604800;
export const seniorJWTExpiry = 3153600000;
export const SERVER_VERSION = '0.0.1';
export const dateFormat = 'DD.MM.YYYY';
export const timeFormat = 'hh:mm'; // :ss A
export const livekitTTL = 2700;

export interface IJSONB {
  [key: string]: any;
}

export interface JwtPayload {
  user_id: number;
  role: string;
}
export const FILE_LIMIT = 20000000;
