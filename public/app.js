// Minimal vanilla-JS client. All server calls go through api(); UI pieces are small functions.
const $ = (id) => document.getElementById(id);
const state = { token: sessionStorage.getItem('token'), user: null, providers: [], selectedStart: null };

async function api(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body && { 'Content-Type': 'application/json' }),
      ...(state.token && { Authorization: `Bearer ${state.token}` }),
      ...headers,
    },
    body: body && JSON.stringify(body),
  });
  const data = res.status === 204 ? null : await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? 'Request failed');
  return data;
}

function show(el, text, isError = false) {
  el.innerHTML = '';
  const div = document.createElement('div');
  div.className = isError ? 'msg err' : 'msg';
  div.textContent = text;
  el.append(div);
}

async function loadSlots() {
  state.selectedStart = null;
  const box = $('slots');
  box.innerHTML = '';
  if (!$('provider').value || !$('date').value) return;
  try {
    const slots = await api(`/providers/${$('provider').value}/slots?date=${$('date').value}`);
    if (!slots.length) box.textContent = 'No availability on this day.';
    for (const s of slots) {
      const b = document.createElement('button');
      b.textContent = s.start;
      b.disabled = !s.available;
      b.onclick = () => {
        state.selectedStart = s.start;
        box.querySelectorAll('button').forEach((x) => x.classList.remove('selected'));
        b.classList.add('selected');
      };
      box.append(b);
    }
  } catch (e) {
    box.textContent = e.message;
  }
}

async function book() {
  if (!state.selectedStart) return show($('bookMsg'), 'Pick a time slot first.', true);
  try {
    const appt = await api('/appointments', {
      method: 'POST',
      body: {
        providerId: $('provider').value,
        date: $('date').value,
        start: state.selectedStart,
        attendeeName: $('name').value,
        contactEmail: $('email').value,
      },
    });
    const guestInfo = state.user ? '' : ` Save these to cancel later. ID: ${appt.id}  Manage code: ${appt.manageToken}`;
    show($('bookMsg'), `Booked ${appt.date} at ${appt.start} for ${appt.attendeeName}.${guestInfo}`);
    await Promise.all([loadSlots(), loadMine()]);
  } catch (e) {
    show($('bookMsg'), e.message, true);
    loadSlots();
  }
}

async function loadMine() {
  $('mine').hidden = !state.user;
  if (!state.user) return;
  const list = await api('/appointments?status=booked');
  const box = $('list');
  box.innerHTML = list.length ? '' : 'Nothing booked yet.';
  for (const a of list) {
    const row = document.createElement('div');
    row.className = 'row';
    const provider = state.providers.find((p) => p.id === a.providerId);
    const label = document.createElement('span');
    label.textContent = `${a.date} ${a.start} · ${a.attendeeName} · ${provider?.name ?? ''}`;
    const cancel = document.createElement('button');
    cancel.className = 'secondary';
    cancel.textContent = 'Cancel';
    cancel.onclick = async () => {
      await api(`/appointments/${a.id}`, { method: 'DELETE' });
      await Promise.all([loadMine(), loadSlots()]);
    };
    row.append(label, cancel);
    box.append(row);
  }
}

async function cancelGuest() {
  try {
    await api(`/appointments/${$('apptId').value.trim()}`, {
      method: 'DELETE',
      headers: { 'X-Manage-Token': $('token').value.trim() },
    });
    show($('guestMsg'), 'Appointment cancelled.');
    loadSlots();
  } catch (e) {
    show($('guestMsg'), e.message, true);
  }
}

async function refreshUser() {
  try {
    state.user = state.token ? (await api('/auth/me')).user : null;
  } catch {
    state.user = null;
  }
  if (!state.user) {
    state.token = null;
    sessionStorage.removeItem('token');
  }
  $('who').textContent = state.user ? `Signed in as ${state.user.name}` : 'Booking as guest';
  $('logout').hidden = !state.user;
  if (state.user && !$('name').value) $('name').value = state.user.name;
  if (state.user && !$('email').value) $('email').value = state.user.email;
  await loadMine();
}

async function auth(kind) {
  try {
    if (kind === 'register') {
      await api('/auth/register', {
        method: 'POST',
        body: { name: $('aName').value, email: $('aEmail').value, password: $('aPass').value },
      });
    }
    const out = await api('/auth/login', { method: 'POST', body: { email: $('aEmail').value, password: $('aPass').value } });
    state.token = out.token;
    sessionStorage.setItem('token', out.token);
    show($('accMsg'), 'Signed in.');
    await refreshUser();
  } catch (e) {
    show($('accMsg'), e.message, true);
  }
}

async function init() {
  $('date').min = new Date().toISOString().slice(0, 10);
  $('date').value = $('date').min;
  state.providers = await api('/providers');
  $('provider').innerHTML = state.providers.map((p) => `<option value="${p.id}"></option>`).join('');
  [...$('provider').options].forEach((o, i) => (o.textContent = `${state.providers[i].name} (${state.providers[i].title})`));
  $('provider').onchange = $('date').onchange = loadSlots;
  $('confirm').onclick = book;
  $('cancelGuest').onclick = cancelGuest;
  $('register').onclick = () => auth('register');
  $('login').onclick = () => auth('login');
  $('logout').onclick = async () => {
    await api('/auth/logout', { method: 'POST' });
    state.token = null;
    sessionStorage.removeItem('token');
    refreshUser();
  };
  await refreshUser();
  await loadSlots();
}

init().catch((e) => show($('bookMsg'), e.message, true));
