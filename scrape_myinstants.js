const https = require('https');

https.get('https://www.myinstants.com/en/search/?name=tiktok', (resp) => {
  let data = '';
  resp.on('data', (chunk) => { data += chunk; });
  resp.on('end', () => {
    const regex = /<button type="button" class="tiny button shadow" onclick="play\('([^']+)'/g;
    let m;
    while ((m = regex.exec(data)) !== null) {
      console.log('https://www.myinstants.com' + m[1]);
    }
  });
}).on("error", (err) => {
  console.log("Error: " + err.message);
});
