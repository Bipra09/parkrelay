const byId = id => document.getElementById(id);
const yen = amount => '¥' + amount.toLocaleString();
async function request(path, body) {
  const res = await fetch(path, body ? {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)} : {});
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}
function list(id, lines) {
  byId(id).replaceChildren(...lines.map(line => {
    const li = document.createElement('li');
    li.textContent = line;
    return li;
  }));
}
async function refresh() {
  const {spots, active, recent, rates} = await request('/api/garage');
  byId('capacity').textContent = (spots.length - active.length) + ' of ' + spots.length + ' spaces available. Cars ' + yen(rates.car) + '/hr · motorcycles ' + yen(rates.motorcycle) + '/hr.';
  list('spots', spots.map(spot => {
    const ticket = active.find(t => t.spot === spot.id);
    return spot.id + ' · ' + (ticket ? ticket.plate + ' · ' + ticket.id : 'Available');
  }));
  list('history', recent.map(t => t.plate + ' · ' + t.hours + ' billed hr · ' + yen(t.fee)));
}
for (const action of ['entry','exit']) {
  byId(action).onsubmit = async event => {
    event.preventDefault();
    const button = event.target.querySelector('button');
    button.disabled = true;
    try {
      const ticket = await request('/api/' + action, Object.fromEntries(new FormData(event.target)));
      byId('status').textContent = action === 'entry' ? 'Assigned ' + ticket.spot + ' · Ticket ' + ticket.id : 'Checkout complete · ' + yen(ticket.fee);
      if (action === 'entry') byId('exit').elements.ticket.value = ticket.id;
      event.target.reset();
      await refresh();
    } catch (error) { byId('status').textContent = error.message; }
    finally { button.disabled = false; }
  };
}
refresh().catch(error => { byId('status').textContent = error.message; });
