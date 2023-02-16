/* eslint-disable prettier/prettier */
/* eslint-disable no-plusplus */
/* eslint-disable security/detect-non-literal-fs-filename */
/* eslint-disable no-console */
// import { Blob, Buffer } from 'buffer';
const { Blob, Buffer } = require('buffer');
const fs = require('fs');

const fsPromises = fs.promises;
const path = require('path');
// const { mkdir, open, unlink, writeFile } = require('fs').promises;
// import { join, dirname } from 'path';
// import { fileURLToPath } from 'url';

const pathf = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
const AWS = require('aws-sdk');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

ffmpeg.setFfmpegPath(pathf);
const saveToAWs = async (file, fileName) => {
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: `${fileName}`,
    Body: fs.createReadStream(file),
  };
  s3.upload(params, function (s3Err, data) {
    if (s3Err) throw s3Err;
    console.log(`File uploaded successfully at ${data.Location}`);
  });
};

const rmDir = async (dirPath, removeSelf) => {
  try {
    const files = fs.readdirSync(dirPath);
    if (files.length > 0)
      for (let i = 0; i < files.length; i++) {
        const filePath = dirPath + files[i];
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
          console.log('Deleted');
        } else {
          console.log('Not Done');
          rmDir(filePath);
        }
      }
    if (removeSelf) fs.rmdirSync(dirPath);
    else console.log('Directory is now empty');
  } catch (e) {
    return e;
  }
};

const saveData = async (data, videoName) => {
  const videoPath = path.join(__dirname, '../video');

  const dirPath = `${videoPath}/`;

  const fileName = `${videoName}-${Date.now()}.mp4`;
  const tempFilePath = `${dirPath}/temp-${fileName}`;
  const finalFilePath = `${dirPath}/${fileName}`;

  let fileHandle;

  try {
    fileHandle = await fsPromises.open(dirPath);
  } catch (error) {
    await fsPromises.mkdir(dirPath);
  } finally {
    if (fileHandle) {
      fileHandle.close();
    }
  }

  try {
    const videoBlob = new Blob(data, {
      type: 'video/webm',
    });
    const videoBuffer = Buffer.from(await videoBlob.arrayBuffer());

    await fsPromises.writeFile(tempFilePath, videoBuffer);

    ffmpeg(tempFilePath)
      .outputOptions(['-c:v libvpx-vp9', '-r 5', '-crf 20', '-b:v 0', '-vf scale=1200:720', '-f mp4', '-preset ultrafast'])
      .on('end', async () => {
        console.log(`*** File ${fileName} created`);
        await saveToAWs(finalFilePath, fileName);
        setTimeout(async () => {
          rmDir(dirPath);
        }, 2000);
      })
      .save(finalFilePath, dirPath);
  } catch (e) {
    console.log('*** saveData', e);
  }
};
module.exports = saveData;
