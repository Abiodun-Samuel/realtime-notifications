/* eslint-disable no-console */
/* eslint-disable no-unused-vars */
const express = require('express');
const helmet = require('helmet');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const compression = require('compression');
const cors = require('cors');
const passport = require('passport');
const httpStatus = require('http-status');
const { Server } = require('socket.io');
const { createServer } = require('http');
// const axios = require('axios');

const config = require('./config/config');
const morgan = require('./config/morgan');
const { jwtStrategy } = require('./config/passport');
const { authLimiter } = require('./middlewares/rateLimiter');
const routes = require('./routes/v1');
const { errorConverter, errorHandler } = require('./middlewares/error');
const ApiError = require('./utils/ApiError');
const { addUser, getUser, deleteUser, getUsers, getAllUsers } = require('./events/users');

// const Api = axios.create({
//   baseURL: 'https://staging.gettonote.com/api/v1/',
//   withCredentials: false,
//   headers: {
//     Accept: 'application/json',
//     'Content-type': 'application/json',
//     'Access-Control-Allow-Origin': 'true',
//   },
// });

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:8080', 'https://tonote-video-signing.netlify.app'],
    methods: ['*'],
  },
});

if (config.env !== 'test') {
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);
}

// set security HTTP headers
app.use(helmet());

// parse json request body
app.use(express.json());

// parse urlencoded request body
app.use(express.urlencoded({ extended: true }));

// sanitize request data
app.use(xss());
app.use(mongoSanitize());

// gzip compression
app.use(compression());

// enable cors
const corsOption = {
  origin: '*',
  methods: '*',
  preflightContinue: false,
  optionsSuccessStatus: 204,
};
app.use(cors(corsOption));
app.options('*', cors(corsOption));

// jwt authentication
app.use(passport.initialize());
passport.use('jwt', jwtStrategy);

// limit repeated failed requests to auth endpoints
if (config.env === 'production') {
  app.use('/v1/auth', authLimiter);
}

// v1 api routes
app.get('/', (req, res) => {
  res.status(200).json({ message: 'ToNote Notification App' });
});
app.use('/v1', routes);

// send back a 404 error for any unknown api request
app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, 'Not found'));
});

// convert error to ApiError, if needed
app.use(errorConverter);

// handle error
app.use(errorHandler);

io.use((socket, next) => {
  const { username } = socket.handshake.auth;
  if (!username) {
    return next(new Error('invalid username'));
  }
  if (username) {
    // find existing session
    // const session = sessionStore.findSession(sessionID);
    // if (session) {
    // eslint-disable-next-line no-param-reassign
    socket.username = username;
    //  socket.userID = session.userID;
    //  socket.username = session.username;
    return next();
    // }
  }
  //   const username = socket.handshake.auth.username;
  //   if (!username) {
  //     return next(new Error("invalid username"));
  //   }
  //   // create new session
  //   socket.sessionID = randomId();
  //   socket.userID = randomId();
  //   socket.username = username;
  //   next();
});

// socket.broadcast.emit('notary-send-tools', data);
io.on('connection', (socket) => {
  socket.on('notary-session-join', ({ room }) => {
    const { user, error } = addUser(socket.id, socket.username, room);
    // if (error) return callback(error);
    if (user) {
      socket.join(room);
      const newUser = getUser(user.name);
      console.log({ newUser });
      socket.to(newUser.room).emit('join_message', {
        message: `${newUser.name} has joined the notary session.`,
      });
      // socket.broadcast.emit('join_message', 'newUser data');
    } else {
      const existUser = getUser(socket.username);
      console.log({ existUser });
      socket.to(existUser.room).emit('join_message', {
        message: `${existUser.name} is already in the notary session.`,
      });
    }
    // socket.broadcast.emit('join_message', 'existng User data');
  });

  socket.on('notary-send-tools', (data) => {
    // const response = await axios({
    //   method: 'GET',
    //   url: `https://staging.gettonote.com/api/v1/user-document-resource-tool/${data.id}`,
    //   headers: {
    //     withCredentials: false,
    //     Accept: 'application/json',
    //     'Content-type': 'application/json',
    //     'Access-Control-Allow-Origin': 'true',
    //     Authorization: `Bearer ${data.token}`,
    //   },
    //   // data: {},
    // });
    const user = getUser(socket.username);
    socket.to(user.room).emit('notary-send-tools', data);
  });

  socket.on('notary-edit-tools', (data) => {
    // const response = await axios({
    //   method: 'GET',
    //   url: `https://staging.gettonote.com/api/v1/user-document-resource-tool/${data.id}`,
    //   headers: {
    //     withCredentials: false,
    //     Accept: 'application/json',
    //     'Content-type': 'application/json',
    //     'Access-Control-Allow-Origin': 'true',
    //     Authorization: `Bearer ${data.token}`,
    //   },
    //   // data: {},
    // });
    const user = getUser(socket.username);
    socket.to(user.room).emit('notary-edit-tools', data);
  });

  socket.on('notary-complete-session', () => {
    const user = getUser(socket.username);
    socket.to(user.room).emit('notary-complete-session');
  });

  socket.on('notary-delete-tools', (data) => {
    const user = getUser(socket.username);
    socket.to(user.room).emit('notary-delete-tools', data);
  });

  socket.on('notary-available', (data) => {
    const user = getUser(socket.username);
    socket.to(user.room).emit('notary-available', data);
  });

  socket.on('notary-cancel-session', () => {
    const user = getUser(socket.username);
    socket.to(user.room).emit('notary-cancel-session');
  });

  socket.on('disconnect', (reason) => {
    if (reason === 'io server disconnect') {
      socket.connect();
    }
  });
});

module.exports = app;
module.exports = httpServer;
