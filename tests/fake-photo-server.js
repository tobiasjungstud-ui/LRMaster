/*
 * A stand-in for the Openverse and Pexels APIs, for tests/audit.js: the photo
 * fetcher is run against it, so its licence filter, its credits and the
 * manifest it writes can be checked without the internet.
 */
'use strict';
const http = require('node:http');

// a real (tiny) JPEG: the fetcher keeps only files that are JPEGs
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
const port = Number(process.argv[2]);
const base = `http://127.0.0.1:${port}`;

const server = http.createServer((req, res) => {
  const u = new URL(req.url, base);
  const json = (code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (u.pathname === '/ready') return json(200, { ok: true });
  if (u.pathname === '/v1/images/') {
    const q = u.searchParams.get('q');
    return json(200, { results: [
      { id: 'cc0-' + q.length, title: 'Open picture', creator: 'Ada Free', license: 'cc0', license_version: '1.0', source: 'wikimedia', url: base + '/img/good.jpg', thumbnail: base + '/img/good.jpg', foreign_landing_url: 'https://example.org/cc0', width: 1200, height: 800 },
      { id: 'nc-' + q.length, title: 'Fine for class, not for sale', creator: 'Nia Class', license: 'by-nc', license_version: '2.0', source: 'flickr', url: base + '/img/good.jpg', foreign_landing_url: 'https://example.org/nc', width: 1200, height: 800 },
      { id: 'nd-' + q.length, title: 'May not be cropped', creator: 'No Body', license: 'by-nd', license_version: '4.0', source: 'flickr', url: base + '/img/good.jpg', width: 1200, height: 800 },
      { id: 'by-' + q.length, title: 'Credit needed', creator: 'Ben Credit', license: 'by', license_version: '4.0', source: 'flickr', url: base + '/img/huge.jpg', thumbnail: base + '/img/good.jpg', foreign_landing_url: 'https://example.org/by', width: 4000, height: 3000 },
      { id: 'html-' + q.length, title: 'Not an image', creator: 'Broken', license: 'cc0', source: 'flickr', url: base + '/img/notjpeg.jpg', width: 800, height: 600 },
    ] });
  }
  if (u.pathname === '/v1/search') {
    if (req.headers.authorization !== 'test-key') return json(401, { error: 'no key' });
    const q = u.searchParams.get('query');
    return json(200, { photos: [1, 2, 3].map(i => ({ id: 1000 * q.length + i, width: 1200, height: 800, url: 'https://www.pexels.com/photo/' + i, photographer: 'Pia Stock ' + i, alt: 'a portrait', src: { large: base + '/img/good.jpg', medium: base + '/img/good.jpg' } })) });
  }
  if (u.pathname === '/img/good.jpg') { res.writeHead(200, { 'content-type': 'image/jpeg' }); return res.end(JPEG); }
  if (u.pathname === '/img/notjpeg.jpg') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end('<html>blocked</html>'); }
  res.writeHead(404); res.end('no');
});
server.listen(port, '127.0.0.1');
