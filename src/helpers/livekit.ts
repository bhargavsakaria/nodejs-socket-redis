import { AccessToken } from 'livekit-server-sdk';
import { livekitTTL } from '../utils/constants';

export const liveKitAccessToken = (participant_username: string, room_name: string) => {
  let at = new AccessToken(process.env['LIVEKIT_API_KEY'], process.env['LIVEKIT_API_SECRET'], {
    ttl: livekitTTL,
    identity: participant_username
  });
  at.addGrant({ roomJoin: true, room: room_name });

  let token = at.toJwt();

  return token;
};
