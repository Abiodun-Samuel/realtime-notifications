/* eslint-disable no-param-reassign */
/* eslint-disable no-console */
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

const config = require('./config/config');
const morgan = require('./config/morgan');
const { jwtStrategy } = require('./config/passport');
const { authLimiter } = require('./middlewares/rateLimiter');
const routes = require('./routes/v1');
const { errorConverter, errorHandler } = require('./middlewares/error');
const ApiError = require('./utils/ApiError');
const events = require('./utils/constants');

const app = express();
const httpServer = createServer(app);
const corsOption = {
  origin: [config.url_1, config.url_2, config.url_3, config.url_4, config.url_5],
  methods: ['*'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  credentials: true,
  transports: ['websocket', 'polling'],
};

const io = new Server(httpServer, {
  cors: corsOption,
  allowEIO3: true,
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
  const { sessionRoom } = socket.handshake.auth;

  if (!username && !sessionRoom) {
    return next(new Error('invalid username and SessionRoom'));
  }
  if (username && sessionRoom) {
    socket.username = username;
    socket.sessionRoom = sessionRoom;
    return next();
  }
});

io.on('connection', (socket) => {
  const room = socket.sessionRoom;
  socket.join(room);

  io.in(room).emit(events.JOIN_ROOM_MESSAGE, {
    message: `Name:${socket.username} has joined the notary session, Room:${room}`,
  });
  socket.on(events.NOTARY_AVAILABLE, (data) => {
    socket.to(room).emit(events.NOTARY_AVAILABLE, data);
  });
  socket.on(events.NOTARY_SEND_TOOLS, (data) => {
    socket.to(room).emit(events.NOTARY_SEND_TOOLS, data);
  });
  socket.on(events.NOTARY_EDIT_TOOLS, (data) => {
    socket.to(room).emit(events.NOTARY_EDIT_TOOLS, data);
  });
  socket.on(events.NOTARY_DELETE_TOOLS, (data) => {
    socket.to(room).emit(events.NOTARY_DELETE_TOOLS, data);
  });
  socket.on(events.NOTARY_COMPLETE_SESSION, () => {
    socket.to(room).emit(events.NOTARY_COMPLETE_SESSION);
  });
  socket.on(events.NOTARY_CANCEL_SESSION, () => {
    socket.to(room).emit(events.NOTARY_CANCEL_SESSION);
  });
  socket.on(events.REMOVE, (data) => {
    socket.to(room).emit(events.REMOVE, data);
  });
  socket.on('disconnect', (reason) => {
    if (reason === 'io server disconnect') {
      socket.connect();
    }
  });
});

module.exports = app;
module.exports = httpServer;
