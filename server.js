'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const file = process.env.PARKRELAY_DATA || path.join(__dirname, 'garage.json');
const rates = { car: 300, motorcycle: 150 };
const spots = [...Array.from({length: 10}, (_, i) => ({ id: 'C' + (i + 1), type: 'car' })),
  ...Array.from({length: 4}, (_, i) => ({ id: 'M' + (i + 1), type: 'motorcycle' }))];
let tickets = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
function commit(next) {
  fs.writeFileSync(file + '.tmp', JSON.stringify(next, null, 2), { mode: 0o600 });
  fs.renameSync(file + '.tmp', file);
  tickets = next;
}
function json(res, status, body) {
  res.writeHead(status, {'Content-Type': 'application/json', 'Cache-Control': 'no-store'});
  res.end(JSON.stringify(body));
}
const files = {'/': ['index.html','text/html'], '/style.css': ['style.css','text/css'], '/app.js': ['app.js','text/javascript']};
const server = http.createServer(async (req, res) => {
  try {
    const route = new URL(req.url, 'http://localhost').pathname;
    if (req.method === 'GET' && Object.hasOwn(files, route)) {
      const [name, type] = files[route];
      res.writeHead(200, {'Content-Type': type + '; charset=utf-8'});
      return res.end(fs.readFileSync(path.join(__dirname, 'public', name)));
    }
    if (route === '/api/garage' && req.method === 'GET') {
      return json(res, 200, { spots, active: tickets.filter(t => !t.exitedAt), recent: tickets.filter(t => t.exitedAt).sort((a,b) => b.exitedAt-a.exitedAt).slice(0,10), rates });
    }
    if (req.method !== 'POST' || !['/api/entry','/api/exit'].includes(route)) return json(res, 404, {error:'Route not found.'});
    if (req.headers['content-type']?.split(';')[0] !== 'application/json') return json(res, 415, {error:'Send JSON.'});
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 4096) return json(res, 413, {error:'Request too large.'});
    }
    let data;
    try { data = JSON.parse(body); } catch { return json(res, 400, {error:'Invalid JSON.'}); }
    if (!data || typeof data !== 'object') return json(res, 400, {error:'Expected an object.'});
    if (route === '/api/entry') {
      const plate = typeof data.plate === 'string' ? data.plate.trim().toUpperCase() : '';
      if (!/^[A-Z0-9 -]{2,12}$/.test(plate) || !/[A-Z0-9]/.test(plate) || !Object.hasOwn(rates, data.type)) return json(res, 400, {error:'Enter a valid plate and vehicle type.'});
      const active = tickets.filter(t => !t.exitedAt);
      if (active.some(t => t.plate === plate)) return json(res, 409, {error:'This plate already has an active ticket.'});
      const spot = spots.find(s => s.type === data.type && !active.some(t => t.spot === s.id));
      if (!spot) return json(res, 409, {error:'No space for this vehicle type.'});
      const ticket = {id:randomUUID(), plate, type:data.type, spot:spot.id, enteredAt:Date.now()};
      commit([...tickets, ticket]);
      return json(res, 201, ticket);
    }
    const ticket = tickets.find(t => t.id === data.ticket);
    if (!ticket) return json(res, 404, {error:'Ticket not found.'});
    if (ticket.exitedAt) return json(res, 200, ticket);
    const exitedAt = Date.now();
    const hours = Math.max(1, Math.ceil((exitedAt - ticket.enteredAt) / 3600000));
    const closed = {...ticket, exitedAt, hours, fee:hours * rates[ticket.type]};
    commit(tickets.map(t => t.id === ticket.id ? closed : t));
    return json(res, 200, closed);
  } catch (error) {
    console.error(error.message);
    if (!res.headersSent) json(res, 500, {error:'The garage could not complete the request.'});
    else res.end();
  }
});
server.listen(Number(process.env.PORT || 8032), '127.0.0.1');
