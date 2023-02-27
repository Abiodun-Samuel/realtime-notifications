/* eslint-disable global-require */
/* eslint-disable security/detect-non-literal-fs-filename */
/* eslint-disable no-console */
// eslint-disable-next-line security/detect-child-process
const { spawn } = require('child_process');
const async = require('async');
const AWS = require('aws-sdk');
const path = require('path');

AWS.config.update({
  accessKeyId: 'YOUR_ACCESS_KEY_ID',
  secretAccessKey: 'YOUR_SECRET_ACCESS_KEY',
  region: 'YOUR_BUCKET_REGION',
});

const s3 = new AWS.S3();
const bucketName = 'YOUR_BUCKET_NAME';

// function to compress a single video file using FFmpeg
function compressVideo(inputPath, outputPath, callback) {
  const ffmpeg = spawn('ffmpeg', [
    '-i',
    inputPath,
    '-codec:v',
    'libx264',
    '-crf',
    '23',
    '-preset',
    'medium',
    '-codec:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    '+faststart',
    '-vf',
    'scale=-2:720',
    outputPath,
  ]);

  ffmpeg.on('error', (err) => {
    console.error(err);
    callback(err);
  });

  ffmpeg.on('exit', (code, signal) => {
    if (code === 0) {
      callback(null);
    } else {
      const error = new Error(`FFmpeg process exited with code ${code} and signal ${signal}`);
      console.error(error);
      callback(error);
    }
  });
}

// function to upload a file to S3
function uploadToS3(filePath, key, callback) {
  const fileStream = require('fs').createReadStream(filePath);
  const uploadParams = { Bucket: bucketName, Key: key, Body: fileStream };
  s3.upload(uploadParams, (err, data) => {
    if (err) {
      console.error(err);
      callback(err);
    } else {
      console.log(`Uploaded ${filePath} to ${data.Location}`);
      callback(null, data.Location);
    }
  });
}

// function to compress and upload a video file to S3
function compressAndUploadVideo(inputPath, outputPath, callback) {
  const compressedPath = `${outputPath}.compressed.mp4`;
  compressVideo(inputPath, compressedPath, (err) => {
    if (err) {
      callback(err);
    } else {
      const key = path.basename(compressedPath);
      uploadToS3(compressedPath, key, callback);
    }
  });
}

// function to handle multiple users simultaneously
function handleUserRequest(inputPath, callback) {
  const outputPath = `output/${path.basename(inputPath)}`;
  compressAndUploadVideo(inputPath, outputPath, callback);
}

// example usage
const inputPaths = ['/path/to/video1.mp4', '/path/to/video2.mp4', '/path/to/video3.mp4'];

async.each(inputPaths, handleUserRequest, (err) => {
  if (err) {
    console.error('Error compressing and uploading videos:', err);
  } else {
    console.log('All videos compressed and uploaded successfully!');
  }
});
