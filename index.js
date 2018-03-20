const axios = require('axios');
const fs = require('fs');

/**
 * Size of each request in bytes
 */
const REQUEST_SIZE = 1048576

const args = process.argv.slice(2);

/**
 * Show usage docs if no arguments are given.
 */
if (! args.length) {
  console.log('Usage: node index.js [url] [output]');
  return;
}

const SOURCE_URL = args[0];
const OUTPUT_FILE = args[1] || SOURCE_URL.split('/').pop();

if (! SOURCE_URL) {
  throw new Error('Source URL is required');
}

if (fs.existsSync(OUTPUT_FILE)) {
  throw new Error('Output file already exists');
}

const file = fs.createWriteStream(OUTPUT_FILE, { autoClose: false });

/**
 * Make a request for a single chunk.
 *
 * @param  Array range - min and max for the Range header
 * @return Promise
 */
const getChunk = (range) => {
  return axios.get(SOURCE_URL, {
    responseType: 'stream',
    headers: {
      'Range': `bytes=${range[0]}-${range[1]}`
    }
  });
};

/**
 * Pipe the response into our write stream.
 *
 * Wrap up in a promise so we can wait for the pipe to
 * finish before closing the write stream.
 *
 * @param  Object response - the axios HTTP response object
 * @return Promise
 */
const streamToFile = (response) => {
  return new Promise((resolve, reject) => {
    response.data.pipe(file, { end: false });

    response.data.on('end', resolve);
    response.data.on('error', reject);
  });
};

/////////

console.log('Downloading file in 4 chunks');

const chunks = [
  getChunk([ 0, REQUEST_SIZE - 1 ]),
  getChunk([ REQUEST_SIZE, REQUEST_SIZE * 2 - 1 ]),
  getChunk([ REQUEST_SIZE * 2, REQUEST_SIZE * 3 - 1 ]),
  getChunk([ REQUEST_SIZE * 3, REQUEST_SIZE * 4 - 1 ]),
];

axios.all(chunks)
  .then((responses) => {
    return Promise.all(responses.map(streamToFile));
  })
  .then(() => {
    console.log('Finished!');
    file.end();
  })
  .catch((err) => {
    console.error(err)
  });

