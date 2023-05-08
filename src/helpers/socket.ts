import { Namespace, Server } from 'socket.io';
import AccessTokens from '../entities/AccessTokens.postgres';
import { Role, YesNo } from '../utils/constants';
import { HttpStatus } from '../typings/global/http-status.enum';
import { WebSocketError } from './mobApiError';
import jwt from 'jsonwebtoken';
import User from '../entities/User.postgres';
import { IncomingHttpHeaders } from 'http';
import { v4 as uuidV4 } from 'uuid';
import SocketRooms from '../entities/SocketRooms.postgres';
import firebase from './firebase';
import { liveKitAccessToken } from './livekit';
import CallHistory from '../entities/CallHistory.postgres';
import { getCustomRepository, getRepository, In, IsNull, Not } from 'typeorm';
import UserSettings from '../entities/UserSettings.postgres';
import { UserRepository } from '../repositories/user.repository';
import { SocketRoomRepository } from '../repositories/socketRoom.repository';
import { Emitter } from '@socket.io/redis-emitter';
import { DefaultEventsMap } from '@socket.io/redis-emitter/dist/typed-events';

const JWT_SECRET = process.env['JWT_SECRET'] as string;
class SocketModule {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  constructor() {}
  creationIOHandler(io: Server, emitter: Emitter<DefaultEventsMap>) {
    io.use(async (socket, next) => {
      // Auth token is required in order to process further logic.
      if (!socket.handshake.headers.authorization) {
        return next(new WebSocketError('Authorization token required', {}, HttpStatus.BAD_REQUEST));
      }

      let headers: IncomingHttpHeaders = socket.handshake.headers;
      let access_token = headers.authorization?.split(' ')[1];

      try {
        if (!access_token) throw { message: 'Unauthorized', code: HttpStatus.FORBIDDEN };

        const accessToken = await getRepository(AccessTokens).findOne({
          where: { token: access_token, isRevoked: YesNo.NO }
        });

        if (!accessToken) {
          throw { message: 'Invalid token for Socket Connection', code: HttpStatus.BAD_REQUEST };
        }

        let decoded = jwt.verify(access_token, JWT_SECRET) as Record<string, any>;

        const user = await getRepository(User).findOne(decoded.user_id);
        if (!user) {
          throw { message: 'Unauthorized', code: HttpStatus.FORBIDDEN };
        }

        socket.data = { user_id: user.id };

        user.socketId = socket.id;

        await getRepository(User).save(user);

        socket.emit('MY_ID', { socket_id: socket.id, user_id: user.id });

        next();
      } catch (error) {
        return next(
          new WebSocketError(
            // @ts-ignore
            error.message ?? 'Token could not be verified',
            // @ts-ignore
            error,
            // @ts-ignore
            error.code ?? HttpStatus.UNAUTHORIZED
          )
        );
      }
    });

    io.on('connection', async (socket) => {
      const mainNsp: Namespace = io.sockets.adapter.nsp;

      let allSockets = await io.allSockets();
      // when socket disconnects, it is removed from the onlineSockets array
      // and that user's socketId is set to empty string indicating that user is offline
      socket.on('disconnect', async () => {
        let user = await getRepository(User).findOne(socket.data.user_id);
        if (!user) {
          throw { message: 'Unauthorized', code: HttpStatus.FORBIDDEN };
        }
        if (user) {
          // removes disconnected socket from sockets collection array
          if (allSockets.has(socket.id)) {
            allSockets.delete(socket.id);
          }

          // SECTION #1: offline user's initiated room and ongoing call handling
          const deactivateSenderRooms = await getCustomRepository(SocketRoomRepository).deactiveSenderRooms(user.id);

          deactivateSenderRooms.answeredRooms.forEach((element) => {
            emitter.socketsLeave(element.room_id);
            emitter.to(element.receiverSocketId as string).emit('CALL_TERMINATED_RECEIVER');
          });

          deactivateSenderRooms.notAnsweredRooms.forEach((element) => {
            emitter.socketsLeave(element.room_id);
            emitter.to(element.receiverSocketId as string).emit('CALL_REJECTED_RECEIVER');
          });
          // SECTION #1 over

          // SECTION #2: offline user if joined any room and the call is ongoing
          // then other person in call will be notified either by CALL_TERMINATED_SENDER OR CALL_REJECTED_SENDER
          // depending on call's status
          const deativateReceiverRooms = await getCustomRepository(SocketRoomRepository).deativateReceiverRooms(
            user.id
          );

          deativateReceiverRooms.answeredRooms.forEach((element) => {
            emitter.socketsLeave(element.room_id);
            emitter.to(element.senderSocketId as string).emit('CALL_TERMINATED_SENDER');
          });

          deativateReceiverRooms.notAnsweredRooms.forEach((element) => {
            emitter.socketsLeave(element.room_id);
            emitter.to(element.senderSocketId as string).emit('CALL_REJECTED_SENDER');
          });
          // SECTION #2 over

          // user's socketId value set to null to indicate user is offline
          user.socketId = null;
          await getRepository(User).save(user);
        }

        // to deactivate active rooms after all sockets have left IO instance
        if (allSockets.size === 0) {
          await deactivateAllRooms();
        }
      });

      socket.on('CALL_USER', async (data) => {
        let { sender_id, receiver_id, signal_data, call_to } = data;

        let receiver = await getRepository(User).findOne(receiver_id);

        let sender = await getRepository(User).findOne(sender_id);

        // SECTION #3: Deactivating previously active socket rooms by this user(sender) and also removing such receivers from the found room itself
        let deactivePreviousSenderRooms = await getCustomRepository(SocketRoomRepository).deactiveSenderRooms(
          sender_id
        );

        deactivePreviousSenderRooms.answeredRooms.forEach((element) => {
          emitter.socketsLeave(element.room_id);
          emitter.to(element.receiverSocketId as string).emit('CALL_TERMINATED_RECEIVER');
        });

        deactivePreviousSenderRooms.notAnsweredRooms.forEach((element) => {
          emitter.socketsLeave(element.room_id);
          emitter.to(element.receiverSocketId as string).emit('CALL_REJECTED_RECEIVER');
        });
        // SECTION #3 over

        if (sender && sender.role === Role.SENIOR && sender.socketId && receiver_id === null) {
          switch (call_to) {
            case Role.NURSE:
              const nurses = await getCustomRepository(UserRepository).getAssignedNurses(sender_id);

              if (nurses) {
                let receiverUnavailable = 0;
                let receiverAvailable = 0;
                for (let index = 0; index < nurses.length; index++) {
                  let nurseCallingSomeone = await getCustomRepository(SocketRoomRepository).isUserCallingSomeone(
                    nurses[index].id
                  );
                  if (nurseCallingSomeone) {
                    receiverUnavailable++;
                    continue;
                  }

                  let someoneCalledNurseToARoom = await getCustomRepository(
                    SocketRoomRepository
                  ).isUserBeingCalledBySomeone(nurses[index].id);

                  if (someoneCalledNurseToARoom) {
                    receiverUnavailable++;
                    continue;
                  }

                  if (nurses[index].socketId === null) {
                    let accessToken = await getRepository(AccessTokens).findOne({
                      where: { userId: nurses[index].id, isRevoked: YesNo.NO }
                    });
                    if (accessToken && accessToken.deviceToken !== null) {
                      receiverAvailable++;
                      const randomRoomId = uuidV4();

                      emitter.in(socket.id).socketsJoin(randomRoomId);
                      // await socket.join(randomRoomId);

                      socket.emit('CALL_INITIATED_SENDER', {
                        signal_data,
                        randomRoomId,
                        call_to: call_to === null ? 0 : call_to
                      });

                      let room = await getRepository(SocketRooms).save({
                        room: randomRoomId,
                        senderId: sender_id,
                        receiverId: nurses[index].id,
                        isActive: YesNo.YES
                      });

                      if (room) {
                        const record = getRepository(CallHistory).create({
                          senderId: sender_id,
                          receiverId: nurses[index].id,
                          roomId: room.id
                        });

                        await getRepository(CallHistory).save(record);

                        firebase.sendNotification(accessToken.deviceToken, {
                          notification: {
                            title: `Saapuva videopuhelu...`
                          },
                          data: {
                            string_data: JSON.stringify({
                              call_to: call_to === null ? '' : call_to,
                              room_id: randomRoomId,
                              sender_id: sender_id,
                              sender_socket_id: socket.id,
                              receiver_id: nurses[index].id,
                              signal_data: signal_data,
                              db_room: room.id,
                              timestamp: new Date()
                            })
                          }
                        });
                      }
                    } else {
                      receiverUnavailable++;
                    }
                  } else {
                    receiverAvailable++;
                    const randomRoomId = uuidV4();

                    emitter.in(socket.id).socketsJoin(randomRoomId);
                    // await socket.join(randomRoomId);

                    emitter.in(nurses[index].socketId).socketsJoin(randomRoomId);

                    emitter.to(sender.socketId).emit('CALL_INITIATED_SENDER', {
                      signal_data,
                      room_id: randomRoomId,
                      call_to: call_to === null ? 0 : call_to
                    });

                    emitter.to(nurses[index].socketId).emit('CALL_INITIATED_RECEIVER', {
                      signal_data,
                      room_id: randomRoomId,
                      call_to: call_to === null ? 0 : call_to,
                      receiver_id: nurses[index].id
                    });

                    let receiverAccessToken = await getRepository(AccessTokens).findOne({
                      where: {
                        userId: nurses[index].id,
                        isRevoked: YesNo.NO
                      }
                    });

                    let room = await getRepository(SocketRooms).save({
                      room: randomRoomId,
                      senderId: sender_id,
                      receiverId: nurses[index].id
                    });

                    if (room) {
                      const record = getRepository(CallHistory).create({
                        senderId: sender_id,
                        receiverId: nurses[index].id,
                        roomId: room.id
                      });

                      await getRepository(CallHistory).save(record);

                      if (receiverAccessToken && receiverAccessToken.deviceToken !== null) {
                        firebase.sendNotification(receiverAccessToken.deviceToken, {
                          notification: {
                            title: `Saapuva videopuhelu...`
                          },
                          data: {
                            string_data: JSON.stringify({
                              call_to: call_to === null ? '' : call_to,
                              room_id: randomRoomId,
                              sender_id: sender_id,
                              sender_socket_id: socket.id,
                              receiver_id: nurses[index].id,
                              signal_data: signal_data,
                              db_room: room.id,
                              timestamp: new Date()
                            })
                          }
                        });
                      }
                    }
                  }
                }

                if (nurses.length === receiverUnavailable && receiverAvailable === 0) {
                  socket.emit('RECEIVER_UNAVAILABLE', (callback: (arg0: boolean) => void) => {
                    callback(false);
                  });
                  return;
                }
              } else {
                socket.emit('RECEIVER_UNAVAILABLE');
              }
              break;
            case Role.IT:
              let itSupportStaff = await getRepository(User)
                .createQueryBuilder('u')
                .select(['u.id AS id', 'u.socketId AS socketId'])
                .where(`role = ${Role.IT}`)
                .getRawMany();

              if (itSupportStaff) {
                let receiverUnavailable = 0;
                let receiverAvailable = 0;
                for (let index = 0; index < itSupportStaff.length; index++) {
                  let iTSupportCallingSomeone = await getCustomRepository(SocketRoomRepository).isUserCallingSomeone(
                    itSupportStaff[index].id
                  );

                  if (iTSupportCallingSomeone) {
                    receiverUnavailable++;
                    continue;
                  }

                  let somoneCallingItSupport = await getCustomRepository(
                    SocketRoomRepository
                  ).isUserBeingCalledBySomeone(itSupportStaff[index].id);

                  if (somoneCallingItSupport) {
                    receiverUnavailable++;
                    continue;
                  }

                  if (itSupportStaff[index].socketId === null) {
                    let accessToken = await getRepository(AccessTokens).findOne({
                      where: { userId: itSupportStaff[index].id, isRevoked: YesNo.NO }
                    });
                    if (accessToken && accessToken.deviceToken !== null) {
                      receiverAvailable++;
                      const randomRoomId = uuidV4();

                      let room = await getRepository(SocketRooms).save({
                        room: randomRoomId,
                        senderId: sender_id,
                        receiverId: itSupportStaff[index].id,
                        isActive: YesNo.YES
                      });

                      if (room) {
                        const record = getRepository(CallHistory).create({
                          senderId: sender_id,
                          receiverId: itSupportStaff[index].id,
                          roomId: room.id
                        });

                        await getRepository(CallHistory).save(record);

                        firebase.sendNotification(accessToken.deviceToken, {
                          notification: {
                            title: `Saapuva videopuhelu...`
                          },
                          data: {
                            string_data: JSON.stringify({
                              call_to: call_to === null ? '' : call_to,
                              room_id: randomRoomId,
                              sender_id: sender_id,
                              sender_socket_id: socket.id,
                              receiver_id: itSupportStaff[index].id,
                              signal_data: signal_data,
                              db_room: room.id,
                              timestamp: new Date()
                            })
                          }
                        });
                      }
                    } else {
                      receiverUnavailable++;
                    }
                  } else {
                    receiverAvailable++;
                    const randomRoomId = uuidV4();

                    emitter.in(socket.id).socketsJoin(randomRoomId);
                    // await socket.join(randomRoomId);

                    emitter.in(itSupportStaff[index].socketId).socketsJoin(randomRoomId);

                    emitter.to(sender.socketId).emit('CALL_INITIATED_SENDER', {
                      signal_data,
                      room_id: randomRoomId,
                      call_to: call_to === null ? 0 : call_to
                    });

                    emitter.to(itSupportStaff[index].socketId as string).emit('CALL_INITIATED_RECEIVER', {
                      signal_data,
                      room_id: randomRoomId,
                      call_to: call_to === null ? 0 : call_to,
                      receiver_id: itSupportStaff[index].id
                    });

                    let receiverAccessToken = await getRepository(AccessTokens).findOne({
                      where: {
                        userId: itSupportStaff[index].id,
                        isRevoked: YesNo.NO
                      }
                    });

                    let room = await getRepository(SocketRooms).save({
                      room: randomRoomId,
                      senderId: sender_id,
                      receiverId: itSupportStaff[index].id
                    });

                    const record = getRepository(CallHistory).create({
                      senderId: sender_id,
                      receiverId: itSupportStaff[index].id,
                      roomId: room.id
                    });

                    await getRepository(CallHistory).save(record);

                    if (receiverAccessToken && receiverAccessToken.deviceToken !== null) {
                      firebase.sendNotification(receiverAccessToken.deviceToken, {
                        notification: {
                          title: `Saapuva videopuhelu...`
                        },
                        data: {
                          string_data: JSON.stringify({
                            call_to: call_to === null ? '' : call_to,
                            room_id: randomRoomId,
                            sender_id: sender_id,
                            sender_socket_id: socket.id,
                            receiver_id: itSupportStaff[index].id,
                            signal_data: signal_data,
                            db_room: room.id,
                            timestamp: new Date()
                          })
                        }
                      });
                    }
                  }
                }

                if (itSupportStaff.length === receiverUnavailable && receiverAvailable === 0) {
                  socket.emit('RECEIVER_UNAVAILABLE', (callback: (arg0: boolean) => void) => {
                    callback(false);
                  });
                  return;
                }
              }
              break;
            case null:
              socket.emit('ERROR', 'Please provide receiver_id to connect to call');
              break;
          }
        } else if (sender && receiver && (call_to === null || call_to === undefined)) {
          let receiverLoggedIn = await getRepository(AccessTokens).findOne({
            where: { userId: receiver.id, isRevoked: YesNo.NO }
          });

          let isUserCallingSomeone = await getCustomRepository(SocketRoomRepository).isUserCallingSomeone(receiver_id);

          let isUserBeingCalledBySomeone = await getCustomRepository(SocketRoomRepository).isUserBeingCalledBySomeone(
            receiver_id
          );

          if (isUserCallingSomeone || isUserBeingCalledBySomeone) {
            socket.emit('RECEIVER_BUSY_IN_CALL', (callback: (arg0: boolean) => any) => callback(false));
            return;
          }

          if (!receiverLoggedIn) {
            socket.emit('RECEIVER_UNAVAILABLE', (callback: (arg0: boolean) => void) => {
              callback(false);
            });
            return;
          } else if (
            // if receiver has open socket connection
            !isUserCallingSomeone &&
            !isUserBeingCalledBySomeone &&
            receiver &&
            mainNsp.sockets.has(socket.id) &&
            sender &&
            sender.socketId === socket.id
          ) {
            switch (sender.role) {
              case Role.NURSE:
                let assignedStaffs = await getCustomRepository(UserRepository).getSeniorAssignedSupportStaff(
                  receiver_id
                );

                let assignedStaffMemberIds = assignedStaffs?.assignedStaffMembers.map((element) => {
                  return element.supportStaffId;
                });

                await getRepository(User)
                  .createQueryBuilder('u')
                  .leftJoinAndSelect('u.supportStaff', 'ss')
                  .where(
                    `ss.isNurse = ${YesNo.YES} AND u.id NOT IN (${sender_id}, ${receiver_id}) AND ss.id IN (${assignedStaffMemberIds})`
                  )
                  .select(['u.id'])
                  .getRawMany()
                  .then((nurses) => {
                    nurses.forEach(async (nurse) => {
                      let otherNurseCallHistory = await getRepository(CallHistory).findOne({
                        where: {
                          senderId: receiver_id,
                          receiverId: nurse.id
                        }
                      });

                      if (otherNurseCallHistory) {
                        otherNurseCallHistory.isAnswered = YesNo.NO;
                        otherNurseCallHistory.deletedForReceiver = new Date();
                        otherNurseCallHistory.deletedAt = new Date();
                        await getRepository(CallHistory).save(otherNurseCallHistory);
                      }
                    });
                  });
                break;
              case Role.IT:
                let itSupportStaffs = await getRepository(User).find({
                  where: { role: Role.IT, id: Not(sender_id) },
                  select: ['id', 'socketId']
                });

                itSupportStaffs.forEach(async (staff) => {
                  let otherITSupportCallHistory = await getRepository(CallHistory).findOne({
                    where: {
                      senderId: receiver_id,
                      receiverId: staff.id
                    }
                  });

                  if (otherITSupportCallHistory) {
                    otherITSupportCallHistory.isAnswered = YesNo.NO;
                    otherITSupportCallHistory.deletedForReceiver = new Date();
                    otherITSupportCallHistory.deletedAt = new Date();
                    await getRepository(CallHistory).save(otherITSupportCallHistory);
                  }
                });
                break;
            }

            const missedCallFromReceiver = await getRepository(CallHistory).find({
              where: {
                senderId: receiver_id,
                receiverId: sender_id
              }
            });

            if (missedCallFromReceiver) {
              missedCallFromReceiver.forEach(async (history) => {
                history.isAnswered = YesNo.YES;
                await getRepository(CallHistory).save(history);
              });
            }

            const randomRoomId = uuidV4();

            // sender joins random room
            emitter.in(socket.id).socketsJoin(randomRoomId);
            // await socket.join(randomRoomId);

            emitter.to(sender.socketId).emit('CALL_INITIATED_SENDER', {
              signal_data,
              room_id: randomRoomId,
              call_to: call_to === null ? 0 : call_to
            });

            // receiver found from io instance joins random room
            emitter.in(receiver.socketId as string).socketsJoin(randomRoomId);

            emitter.to(receiver.socketId as string).emit('CALL_INITIATED_RECEIVER', {
              signal_data,
              room_id: randomRoomId,
              call_to: call_to === null ? 0 : call_to,
              receiver_id
            });

            let receiverAccessToken = await getRepository(AccessTokens).findOne({
              where: {
                userId: receiver_id,
                isRevoked: YesNo.NO
              }
            });

            // room created in db
            let room = await getRepository(SocketRooms).save({
              room: randomRoomId,
              senderId: sender_id,
              receiverId: receiver_id
            });

            if (room) {
              const record = CallHistory.create({
                senderId: sender_id,
                receiverId: receiver_id,
                roomId: room.id
              });

              await getRepository(CallHistory).save(record);

              if (receiverAccessToken && receiverAccessToken.deviceToken !== null) {
                let auto_answer = 0;
                if (receiver.role === Role.SENIOR) {
                  const receiverSettings = await UserSettings.findOne({
                    where: {
                      userId: receiver.id
                    }
                  });

                  auto_answer = receiverSettings ? receiverSettings.autoAnswer : YesNo.NO;
                }

                firebase.sendNotification(receiverAccessToken.deviceToken, {
                  notification: {
                    title: `Saapuva videopuhelu...`
                  },
                  data: {
                    string_data: JSON.stringify({
                      auto_answer,
                      call_to: call_to === null ? '' : call_to,
                      room_id: randomRoomId,
                      sender_id: sender_id,
                      sender_socket_id: socket.id,
                      receiver_id,
                      signal_data: signal_data,
                      db_room: room.id,
                      timestamp: new Date()
                    })
                  }
                });
              }
            }
          } else {
            // if receiver does not have open socket connection on IO instance
            const accessToken = await getRepository(AccessTokens).findOne({
              where: {
                userId: receiver?.id,
                isRevoked: YesNo.NO
              }
            });

            if (accessToken && accessToken.deviceToken != null) {
              const missedCallFromReceiver = await getRepository(CallHistory).find({
                where: {
                  senderId: receiver_id,
                  receiverId: sender_id
                }
              });

              if (missedCallFromReceiver) {
                missedCallFromReceiver.forEach(async (history) => {
                  history.isAnswered = YesNo.YES;
                  await getRepository(CallHistory).save(history);
                });
              }

              const randomRoomId = uuidV4();

              emitter.in(socket.id).socketsJoin(randomRoomId);
              // await socket.join(randomRoomId);

              emitter.to(socket.id).emit('CALL_INITIATED_SENDER', {
                signal_data,
                room_id: randomRoomId,
                call_to: call_to === null ? 0 : call_to
              });

              let room = await getRepository(SocketRooms).save({
                room: randomRoomId,
                senderId: sender_id,
                receiverId: receiver_id,
                isActive: YesNo.YES
              });

              if (room) {
                const record = getRepository(CallHistory).create({
                  senderId: sender_id,
                  receiverId: receiver_id,
                  roomId: room.id
                });

                await getRepository(CallHistory).save(record);

                let auto_answer = 0;
                if (receiver.role === Role.SENIOR) {
                  const receiverSettings = await UserSettings.findOne({
                    where: {
                      userId: receiver.id
                    }
                  });

                  auto_answer = receiverSettings ? receiverSettings.autoAnswer : YesNo.NO;
                }

                firebase.sendNotification(accessToken.deviceToken, {
                  notification: {
                    title: `Saapuva videopuhelu...`
                  },
                  data: {
                    string_data: JSON.stringify({
                      auto_answer,
                      call_to: call_to === null ? '' : call_to,
                      room_id: randomRoomId,
                      sender_id: sender_id,
                      sender_socket_id: socket.id,
                      receiver_id,
                      signal_data: signal_data,
                      db_room: room.id,
                      timestamp: new Date()
                    })
                  }
                });
              }
            } else {
              socket.emit('RECEIVER_UNAVAILABLE', (callback: (arg0: boolean) => void) => {
                callback(false);
              });
            }
          }
        }
      });

      socket.on('CONNECT_TO_INBOUND_CALL', async (data) => {
        let { room_id, sender_id, sender_socket_id, receiver_id, db_room, signal_data, call_to } = data;

        let incomingCall = await getCustomRepository(SocketRoomRepository).incomingCall({
          id: db_room as number,
          room: room_id,
          senderId: sender_id as number,
          receiverId: receiver_id as number,
          isActive: YesNo.YES
        });

        if (incomingCall) {
          let receiver = await getRepository(User).findOne(receiver_id);
          let sender = await getRepository(User).findOne(sender_id as number);

          if (
            receiver &&
            receiver.socketId === socket.id &&
            sender &&
            sender.socketId === sender_socket_id &&
            allSockets.has(sender_socket_id)
          ) {
            await socket.join(room_id);

            emitter.to(socket.id).emit('CALL_INITIATED_RECEIVER', {
              signal_data,
              room_id,
              call_to: call_to === null ? 0 : call_to,
              receiver_id
            });
          } else if (!allSockets.has(sender_socket_id)) {
            socket.emit('NO_INBOUND_CALL');
          }
        } else {
          socket.emit('NO_INBOUND_CALL');
        }
      });

      socket.on('CALL_ANSWERED', async (data) => {
        let { room_id, sender_id, receiver_id, call_to } = data;

        let receiver = await getRepository(User).findOne(receiver_id);
        let sender = await getRepository(User).findOne(sender_id);

        if (sender && receiver) {
          if (sender.role === Role.SENIOR && (call_to === Role.NURSE || call_to === Role.IT)) {
            // Staff who didnt answer the call will be removed from the room they were added in and room from db will be deactivated too
            let deactivateOtherStaffRooms = await getCustomRepository(SocketRoomRepository).deativateOtherStaffRooms({
              where: {
                room: Not(room_id),
                senderId: sender_id,
                isActive: YesNo.YES,
                deletedAt: IsNull()
              }
            });

            deactivateOtherStaffRooms.notAnsweredRooms.forEach((element) => {
              emitter.socketsLeave(element.room_id);
              emitter.to(element.receiverSocketId as string).emit('CALL_TERMINATED_RECEIVER', data);
            });
          }
          let sender_livekit_token = liveKitAccessToken(sender.username, room_id);
          console.log(`>>>>>>>>>>>>>>>>>>>> sender_livekit_token: ${sender_livekit_token}`);

          let receiver_livekit_token = liveKitAccessToken(receiver.username, room_id);
          console.log(`>>>>>>>>>>>>>>>>>>>> receiver_livekit_token: ${receiver_livekit_token}`);

          emitter.to(sender.socketId as string).emit('CALL_ACCEPTED_SENDER', { ...data, sender_livekit_token });

          emitter.to(receiver.socketId as string).emit('CALL_ACCEPTED_RECEIVER', { ...data, receiver_livekit_token });
        }

        await getCustomRepository(SocketRoomRepository).changeAnsweredRoomStatus({
          where: {
            room: room_id,
            senderId: sender_id,
            receiverId: receiver_id,
            isActive: YesNo.YES,
            deletedAt: IsNull()
          }
        });
      });

      socket.on('CALL_REJECTED', async (data) => {
        let { room_id, sender_id, receiver_id, call_to } = data;

        let receiver = await getRepository(User).findOne(receiver_id);
        let sender = await getRepository(User).findOne(sender_id);

        // call is rejected from the senior's end and all the nurses/it_support will have a missed call from the senior.
        if (sender && receiver_id === null && call_to !== null) {
          switch (call_to) {
            case Role.NURSE:
              let assignedStaffs = await getCustomRepository(UserRepository).getSeniorAssignedSupportStaff(sender_id);

              let assignedStaffMemberIds = assignedStaffs?.assignedStaffMembers.map((element) => {
                return element.supportStaffId;
              });

              await getRepository(User)
                .createQueryBuilder('u')
                .leftJoinAndSelect('u.supportStaff', 'ss')
                .where(`ss.isNurse = ${YesNo.YES} AND u.id != ${sender_id} AND ss.id IN (${assignedStaffMemberIds})`)
                .select(['u.id, u.socketId'])
                .getRawMany()
                .then((nurses) => {
                  nurses.forEach(async (nurse) => {
                    const socketRoom = await getRepository(SocketRooms).findOne({
                      where: { senderId: sender_id, receiverId: nurse.id, isActive: YesNo.YES, deletedAt: IsNull() }
                    });

                    if (socketRoom) {
                      socketRoom.isActive = YesNo.NO;
                      socketRoom.deletedAt = new Date();

                      emitter.to(nurse.socketId as string).emit('CALL_REJECTED_RECEIVER', {
                        room_id: socketRoom.room,
                        sender_id,
                        receiver_id: socketRoom.receiverId
                      });

                      emitter.socketsLeave(socketRoom.room);

                      let roomCallHistory = await getRepository(CallHistory).findOne({
                        where: {
                          senderId: socketRoom.senderId,
                          receiverId: socketRoom.receiverId,
                          roomId: socketRoom.id
                        }
                      });
                      if (roomCallHistory) {
                        roomCallHistory.isAnswered = YesNo.NO;
                        roomCallHistory.isMissed = YesNo.YES;
                        await getRepository(CallHistory).save(roomCallHistory);
                      }
                      await getRepository(SocketRooms).save(socketRoom);
                    }

                    let receiver_missed_call_count = await CallHistory.count({
                      where: {
                        receiverId: nurse.id,
                        isAnswered: YesNo.NO,
                        isMissed: YesNo.YES,
                        deletedForReceiver: IsNull(),
                        deletedAt: IsNull()
                      }
                    });
                    emitter.to(nurse.socketId as string).emit('MISSED_CALL_COUNT', receiver_missed_call_count);
                  });

                  emitter.to(sender?.socketId as string).emit('CALL_REJECTED_SENDER', data);
                });
              break;
            case Role.IT:
              let itSupportStaffs = await getRepository(User).find({
                where: { role: Role.IT },
                select: ['id', 'socketId']
              });

              itSupportStaffs.forEach(async (staff) => {
                const socketRoom = await getRepository(SocketRooms).findOne({
                  where: { senderId: sender_id, receiverId: staff.id, isActive: YesNo.YES, deletedAt: IsNull() }
                });

                if (socketRoom) {
                  socketRoom.isActive = YesNo.NO;
                  socketRoom.deletedAt = new Date();

                  emitter.to(staff.socketId as string).emit('CALL_REJECTED_RECEIVER', {
                    room_id: socketRoom.room,
                    sender_id,
                    receiver_id: socketRoom.receiverId
                  });

                  emitter.socketsLeave(socketRoom.room);

                  let roomCallHistory = await getRepository(CallHistory).findOne({
                    where: {
                      senderId: socketRoom.senderId,
                      receiverId: socketRoom.receiverId,
                      roomId: socketRoom.id
                    }
                  });
                  if (roomCallHistory) {
                    roomCallHistory.isAnswered = YesNo.NO;
                    roomCallHistory.isMissed = YesNo.YES;
                    await getRepository(CallHistory).save(roomCallHistory);
                  }
                  await getRepository(SocketRooms).save(socketRoom);
                }

                let receiver_missed_call_count = await CallHistory.count({
                  where: {
                    receiverId: staff.id,
                    isAnswered: YesNo.NO,
                    isMissed: YesNo.YES,
                    deletedForReceiver: IsNull(),
                    deletedAt: IsNull()
                  }
                });
                emitter.to(staff.socketId as string).emit('MISSED_CALL_COUNT', receiver_missed_call_count);
              });

              emitter.to(sender?.socketId as string).emit('CALL_REJECTED_SENDER', data);
              break;
          }
        } else if (sender && receiver && call_to === null) {
          let room = await getRepository(SocketRooms).findOne({
            where: {
              room: room_id,
              senderId: sender_id,
              receiverId: receiver_id,
              isActive: YesNo.YES,
              deletedAt: IsNull()
            }
          });

          if (room) {
            room.isActive = YesNo.NO;
            room.deletedAt = new Date();
            await getRepository(SocketRooms).save(room);

            let roomCallHistory = await getRepository(CallHistory).findOne({
              where: { roomId: room.id, receiverId: receiver_id }
            });

            if (roomCallHistory) {
              roomCallHistory.isAnswered = YesNo.NO;
              roomCallHistory.isMissed = YesNo.YES;
              await getRepository(CallHistory).save(roomCallHistory);
            }
          }

          emitter.to(receiver.socketId as string).emit('CALL_REJECTED_RECEIVER', data);

          let receiver_missed_call_count = await CallHistory.count({
            where: {
              receiverId: receiver.id,
              isAnswered: YesNo.NO,
              isMissed: YesNo.YES,
              deletedForReceiver: IsNull(),
              deletedAt: IsNull()
            }
          });
          emitter.to(receiver.socketId as string).emit('MISSED_CALL_COUNT', receiver_missed_call_count);

          // Both sockets leave the room
          emitter.socketsLeave(room_id);
          switch (receiver.role) {
            case Role.NURSE:
              let assignedStaffs = await getRepository(User)
                .createQueryBuilder('u')
                .leftJoinAndSelect('u.assignedStaffMembers', 'asm')
                .where(`u.isSenior = true AND u.id = ${sender_id}`)
                .getOne();

              let assignedStaffMemberIds = assignedStaffs?.assignedStaffMembers.map((element) => {
                return element.supportStaffId;
              });

              let nursesInCallWithSender = await getRepository(User)
                .createQueryBuilder('u')
                .leftJoinAndSelect('u.supportStaff', 'ss')
                .where(
                  `ss.isNurse = ${YesNo.YES} AND u.id NOT IN (${sender_id}, ${receiver_id}) AND ss.id IN (${assignedStaffMemberIds})`
                )
                .select(['u.id, u.socketId'])
                .getRawMany();

              let nursesInSocketRooms = await getRepository(SocketRooms).find({
                where: {
                  senderId: sender_id,
                  receiverId: In(nursesInCallWithSender.map((nurse) => nurse.id)),
                  isActive: YesNo.YES,
                  deletedAt: IsNull()
                }
              });

              if (nursesInSocketRooms.length === 0) {
                emitter.to(sender.socketId as string).emit('CALL_REJECTED_SENDER', data);
              }
              break;
            case Role.IT:
              let itSupportStaffs = await getRepository(User).find({
                where: { role: Role.IT, id: Not(receiver_id) },
                select: ['id', 'socketId']
              });

              let itStaffInSocketRooms = await getRepository(SocketRooms).find({
                where: {
                  senderId: sender_id,
                  receiverId: In(itSupportStaffs.map((staff) => staff.id)),
                  isActive: YesNo.YES,
                  deletedAt: IsNull()
                }
              });

              if (itStaffInSocketRooms.length === 0) {
                emitter.to(sender.socketId as string).emit('CALL_REJECTED_SENDER', data);
              }
              break;
            case Role.MEMBER:
            case Role.SENIOR:
              emitter.to(sender.socketId as string).emit('CALL_REJECTED_SENDER', data);
              break;
          }
        }
      });

      socket.on('END_CALL', async (data) => {
        let { room_id, sender_id, receiver_id } = data;

        let receiver = await getRepository(User).findOne(receiver_id);
        let sender = await getRepository(User).findOne(sender_id);

        if (sender && receiver) {
          emitter.to(sender.socketId as string).emit('CALL_TERMINATED_SENDER', data);

          emitter.to(receiver.socketId as string).emit('CALL_TERMINATED_RECEIVER', data);

          // Both sockets leave the room
          emitter.socketsLeave(room_id);

          let sender_missed_call_count = await CallHistory.count({
            where: {
              receiverId: sender.id,
              isAnswered: YesNo.NO,
              isMissed: YesNo.YES,
              deletedForReceiver: IsNull(),
              deletedAt: IsNull()
            }
          });
          emitter.to(sender.socketId as string).emit('MISSED_CALL_COUNT', sender_missed_call_count);

          let receiver_missed_call_count = await CallHistory.count({
            where: {
              receiverId: receiver.id,
              isAnswered: YesNo.NO,
              isMissed: YesNo.YES,
              deletedForReceiver: IsNull(),
              deletedAt: IsNull()
            }
          });
          emitter.to(receiver.socketId as string).emit('MISSED_CALL_COUNT', receiver_missed_call_count);
        }

        const room = await getRepository(SocketRooms).findOne({
          where: {
            room: room_id,
            senderId: sender_id,
            receiverId: receiver_id,
            isActive: YesNo.YES,
            deletedAt: IsNull()
          }
        });

        if (room) {
          room.isActive = YesNo.NO;
          room.deletedAt = new Date();
          await getRepository(SocketRooms).save(room);
        }
      });

      socket.on('GET_MISSED_CALL_COUNT', async (user_id) => {
        const count = await CallHistory.count({
          where: {
            receiverId: user_id,
            isAnswered: YesNo.NO,
            isMissed: YesNo.YES,
            deletedForReceiver: IsNull(),
            deletedAt: IsNull()
          }
        });

        socket.emit('MISSED_CALL_COUNT', count);
      });

      socket.on('GET_AUTO_ANSWER_STATUS', async (user_id) => {
        const status = await UserSettings.findOne({
          where: {
            userId: user_id
          },
          select: ['autoAnswer']
        });

        socket.emit('AUTO_ANSWER', status ? status.autoAnswer : 0);
      });

      socket.on('CHECK_NURSE_SUPPORT', async (user_id) => {
        const assignedStaffs = await getRepository(User)
          .createQueryBuilder('u')
          .leftJoinAndSelect('u.assignedStaffMembers', 'asm')
          .where(`u.isSenior = true AND u.id = ${user_id}`)
          .getOne();

        if (assignedStaffs && assignedStaffs.assignedStaffMembers.length > 0) {
          socket.emit('NURSE_SUPPORT', true);
        } else socket.emit('NURSE_SUPPORT', false);
      });

      socket.on('CHECK_IT_SUPPORT', async (user_id) => {
        const user = await getCustomRepository(UserRepository).getUser({ id: user_id });

        const it_support = user.hasItSupport;

        socket.emit('IT_SUPPORT', it_support);
      });
    });
  }
}

export default new SocketModule();

const deactivateAllRooms = async () => {
  let socketRooms = await getRepository(SocketRooms).find({ where: { isActive: YesNo.YES } });
  socketRooms.forEach(async (room) => {
    let callHistories = await getRepository(CallHistory).find({ where: { roomId: room.id } });
    callHistories.forEach(async (record) => {
      record.isAnswered = YesNo.NO;
      await getRepository(CallHistory).save(record);
    });
    room.isActive = YesNo.NO;
    room.deletedAt = new Date();
    await getRepository(SocketRooms).save(room);
  });
};
