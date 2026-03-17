const https = require('https');

const token = process.env.EXPO_TOKEN;
const data = JSON.stringify({
  accountName: 'kmjyz44',
  projectName: 'handyhub',
  privacy: 'unlisted'
});

const options = {
  hostname: 'api.expo.dev',
  path: '/v2/projects',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Response:', body);
    const result = JSON.parse(body);
    if (result.data && result.data.project) {
      console.log('\nProject ID:', result.data.project.id);
    }
  });
});

req.on('error', (error) => console.error('Error:', error));
req.write(data);
req.end();
