// import { createConnection, getRepository, IsNull, Not } from 'typeorm';
import http from 'http';
import { Server } from 'socket.io';
import app from './app';
// import socketHander from './helpers/socket';
// import ormConfig from './utils/secrets';
import User from './entities/User.postgres';
// import { createAdapter } from '@socket.io/redis-adapter';
// import { Emitter } from '@socket.io/redis-emitter';
// import { createClient } from 'redis';

// createConnection({ ...ormConfig })
//   .then(async () => {
//     console.log('connected to pg');
//     const users = await getRepository(User).find({ where: { socketId: Not(IsNull()) } });

//     users.forEach(async (user) => {
//       user.socketId = null;
//       await getRepository(User).save(user);
//     });
//   })
//   .catch((e) => console.log(e));

const port = process.env.PORT || 5000;
console.log('express app port: ', app.get('port'));

const server = http.createServer(app);

// const pubClient = createClient({ url: process.env.REDIS_HOST });
// const subClient = pubClient.duplicate();

// Socker instance creation
// Promise.all([pubClient.connect(), subClient.connect()])
//   .then(() => {
//     console.log('************ Redis client connected!!!! ****************');

//     const io = new Server(server, {
//       adapter: createAdapter(pubClient, subClient),
//       cors: { origin: '*' }
//     });
//     // io.listen(process.env.SOCKET_PORT);
//     const emitter = new Emitter(pubClient);
//     socketHander.creationIOHandler(io, emitter);
//   })
//   .catch((onRejected) => {
//     console.log('Redis Initialization Error: ', onRejected);
//   });

server.listen(port, () => console.log(`Listening to PORT: ${port}`));
