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
const saveData = require('./utils/saveData');

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

// socket events
// const socketByUser = {};
const dataChunks = {};

io.use((socket, next) => {
  const { username, token, sessionRoom, sessionTitle } = socket.handshake.auth;

  if (!username && !token) {
    return next(new Error('Invalid user details'));
  }
  if (username && token) {
    socket.username = username;
    socket.token = token;
    socket.sessionRoom = sessionRoom;
    socket.sessionTitle = sessionTitle;
    return next();
  }
});

io.on('connection', (socket) => {
  const userName = socket.username;
  socket.emit('connected', `${userName} User connected`);

  const room = socket.sessionRoom;
  const videoFile = socket.sessionTitle;
  // const userToken = socket.token;
  if (room) {
    socket.join(room);
    io.in(room).emit(events.JOIN_ROOM_MESSAGE, {
      message: `Name:${socket.username} has joined the notary session, Room:${room}`,
    });
  }
  socket.on('owner_complete_session', () => {
    io.in(room).emit('owner_complete_session');
  });
  socket.on('owner_cancelled_session', () => {
    io.in(room).emit('owner_cancelled_session');
  });
  socket.on('NOTARY_AVAILABLE', (data) => {
    socket.to(room).emit('NOTARY_AVAILABLE', data);
  });
  socket.on(events.NOTARY_SEND_TOOLS, (data) => {
    socket.to(room).emit(events.NOTARY_SEND_TOOLS, data);
  });
  socket.on(events.DOC_OWNER_INVITE_PARTICIPANTS, (data) => {
    socket.to(room).emit(events.DOC_OWNER_INVITE_PARTICIPANTS, data);
  });
  socket.on(events.USER_LEAVE_COMPLETED_SESSION, (data) => {
    socket.to(room).emit(events.USER_LEAVE_COMPLETED_SESSION, data);
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
  socket.on(events.NOTARY_NEW_REQUEST, (data) => {
    io.emit(events.NOTARY_NEW_REQUEST, data);
  });
  socket.on(events.NOTARY_ACCEPT_REQUEST, (data) => {
    io.emit(events.NOTARY_ACCEPT_REQUEST, data);
  });
  socket.on(events.NOTARY_REJECT_REQUEST, (data) => {
    io.emit(events.NOTARY_REJECT_REQUEST, data);
  });
  socket.on(events.NOTARY_CANCEL_REQUEST, (data) => {
    io.emit(events.NOTARY_CANCEL_REQUEST, data);
  });

  // Update this lines
  socket.on('play_sound', () => {
    // socket.to(room).emit("play_sound");
    io.in(room).emit('play_sound');
  });
  socket.on('stop_recording', () => {
    io.in(room).emit('stop_recording');
  });
  socket.on('show_recording_notice', () => {
    // socket.to(room).emit("show_recording_notice");
    io.in(room).emit('show_recording_notice');
  });

  // socket.on('play_sound', () => {
  //   io.in(room).emit('play_sound', 'music is playing');
  // });

  // socket.on('stop_recording', () => {
  //   io.in(room).emit('stop_recording');
  // });
  // socket.on('show_recording_notice', () => {
  //   socket.to(room).emit('show_recording_notice');
  // });

  // socket.on('recording_stopped_sound', () => {
  //   io.in(room).emit('recording_stopped_sound');
  // });

  // socket.on('screenData:start', ({ data, videoName }) => {
  //   console.log(dataChunks);
  //   if (dataChunks[videoName]) {
  //     dataChunks[videoName].push(data);
  //   } else {
  //     dataChunks[videoName] = [data];
  //   }
  // });
  socket.on('screenData:start', ({ data, username }) => {
    console.log('Processing:', dataChunks);
    if (dataChunks[username]) {
      dataChunks[username].push(data);
    } else {
      dataChunks[username] = [data];
    }
  });

  // socket.on('screenData:end', (videoName) => {
  //   if (dataChunks[videoName] && dataChunks[videoName].length) {
  //     saveData(dataChunks[videoName], videoName);
  //     dataChunks[videoName] = [];
  //   }
  // });
  socket.on('screenData:end', ({ username }) => {
    // console.log("filename:", videoName)
    if (dataChunks[username] && dataChunks[username].length) {
      saveData(dataChunks[username], username);
      dataChunks[username] = [];
    }
  });

  socket.on('disconnect', (reason) => {
    if (dataChunks[videoFile] && dataChunks[videoFile].length) {
      saveData(dataChunks[videoFile], videoFile);
      dataChunks[videoFile] = [];
    }
    if (reason === 'io server disconnect') {
      socket.connect();
    }
  });
});

module.exports = app;
module.exports = httpServer;
