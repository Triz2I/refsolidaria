

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const live = msg => { const r = $('#liveRegion'); if (r) { r.textContent = msg; } };

// Estado
const state = {
  estabelecimentos: [
    { id: 'padaria-alegria', nome: 'Padaria Alegria', pontos: 12, endereco: 'Rua das Flores, 120 - Centro, São Paulo', lat: -23.55, lng: -46.63 },
    { id: 'cantina-bom-sabor', nome: 'Cantina Bom Sabor', pontos: 7, endereco: 'Av. Brasil, 800 - Jardim, Rio de Janeiro', lat: -22.91, lng: -43.17 },
    { id: 'super-verde', nome: 'Supermercado Verde', pontos: 21, endereco: 'Rua Atlântica, 55 - Centro, Recife', lat: -8.05, lng: -34.90 }
  ],
  doacoes: [
    { id: crypto.randomUUID(), estId: 'padaria-alegria', tipo: 'Pães do dia', qtd: 20, validade: '17:00', janela: '15:00–17:00', endereco: 'Rua das Flores, 120 - SP', reservadoPor: null, status: 'disponível', lat: -23.55, lng: -46.63 },
    { id: crypto.randomUUID(), estId: 'cantina-bom-sabor', tipo: 'Marmitas (veg)', qtd: 12, validade: '20:00', janela: '18:00–20:00', endereco: 'Av. Brasil, 800 - RJ', reservadoPor: null, status: 'disponível', lat: -22.91, lng: -43.17 },
    { id: crypto.randomUUID(), estId: 'super-verde', tipo: 'Frutas variadas', qtd: 30, validade: '16:30', janela: '14:30–16:30', endereco: 'Rua Atlântica, 55 - PE', reservadoPor: null, status: 'disponível', lat: -8.05, lng: -34.90 }
  ],
  reservas: [],
  publicadas: [],
  conversas: {}, // {doacaoId: [{quem:'you'|'them', texto, ts}]}
  user: { id: 'beneficiario-demo', nome: 'Você' },
  plano: localStorage.getItem('plano') || 'free',
  a11y: JSON.parse(localStorage.getItem('a11y')||'{}')
};

// Utilidades
const byId = id => state.estabelecimentos.find(e => e.id===id);
const formatHora = () => new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
const haversine = (a, b) => {
  const toRad = x => x*Math.PI/180; const R = 6371;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
};

// Acessibilidade
function applyA11y() {
  const b = document.body; const a = state.a11y;
  b.classList.toggle('hc', !!a.contraste);
  b.classList.toggle('lg', !!a.fonte);
  b.classList.toggle('df', !!a.dislexia);
  if (a.animacoes) b.setAttribute('data-reduced-motion','true'); else b.removeAttribute('data-reduced-motion');
  $('#painelA11y').classList.toggle('open', !!a.open);
  $('#btnA11y').setAttribute('aria-expanded', !!a.open);
}
function saveA11y() { localStorage.setItem('a11y', JSON.stringify(state.a11y)); applyA11y(); }

// Renderizações
function renderStats() {
  $('#countDoacoes').textContent = state.doacoes.length;
  $('#countRefeicoes').textContent = state.doacoes.reduce((a,d)=>a+Number(d.qtd||0),0);
  $('#countEstabelecimentos').textContent = state.estabelecimentos.length;
}

function renderDoacoes(lista = state.doacoes) {
  const ul = $('#listaDoacoes'); ul.innerHTML = '';
  const filtro = $('#filtroTexto').value.toLowerCase();
  const items = lista.filter(d => [d.tipo, d.endereco, byId(d.estId)?.nome].join(' ').toLowerCase().includes(filtro));
  if (!items.length) ul.innerHTML = '<li>Nenhuma doação encontrada.</li>';
  for (const d of items) {
    const est = byId(d.estId);
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="row">
        <strong>${d.tipo}</strong>
        <span class="badge">${d.qtd} un.</span>
      </div>
      <div class="row">
        <span>${est.nome} · ${d.endereco}</span>
        <span>Validade: ${d.validade} · Retirada: ${d.janela}</span>
      </div>
      <div class="row">
        <button class="btn ${d.status==='disponível'?'primary':'ghost'}" ${d.status!=='disponível'?'disabled':''} data-reservar="${d.id}">${d.status==='disponível'?'Reservar':'Indisponível'}</button>
        <small class="muted">Selo: empresa solidária</small>
      </div>`;
    ul.appendChild(li);
  }
}

function renderHistorico() {
  const r = $('#listaReservas'); r.innerHTML = '';
  for (const h of state.reservas) {
    const est = byId(h.estId);
    const li = document.createElement('li');
    li.innerHTML = `<div class="row"><strong>${h.tipo}</strong><span class="badge">${h.qtd} un.</span></div>
      <div class="row"><span>${est.nome} · ${h.endereco}</span><span>Status: ${h.status}</span></div>`;
    r.appendChild(li);
  }
  const p = $('#listaPublicadas'); p.innerHTML = '';
  for (const h of state.publicadas) {
    const est = byId(h.estId);
    const li = document.createElement('li');
    li.innerHTML = `<div class="row"><strong>${h.tipo}</strong><span class="badge">${h.qtd} un.</span></div>
      <div class="row"><span>${est.nome} · ${h.endereco}</span><span>Status: ${h.status}</span></div>`;
    p.appendChild(li);
  }
}

function renderRanking() {
  const ol = $('#listaRanking'); ol.innerHTML = '';
  const rank = [...state.estabelecimentos].sort((a,b)=>b.pontos - a.pontos);
  for (const e of rank) {
    const li = document.createElement('li');
    li.innerHTML = `<span><strong>${e.nome}</strong><br><small class="muted">${e.endereco}</small></span>
                    <span class="badge">${e.pontos} pts</span>`;
    ol.appendChild(li);
  }
}

// Mini mapa simples no canvas
function drawMap(userPos=null) {
  const c = $('#miniMapa'); if (!c) return; const ctx = c.getContext('2d');
  ctx.clearRect(0,0,c.width,c.height);
  // fundo
  ctx.fillStyle = '#0b1220'; ctx.fillRect(0,0,c.width,c.height);
  ctx.strokeStyle = '#233'; ctx.lineWidth = 1; for (let x=0;x<c.width;x+=50){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,c.height); ctx.stroke(); } for (let y=0;y<c.height;y+=50){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(c.width,y); ctx.stroke(); }
  // pontos (fake layout)
  const spots = [ [100,80], [320,160], [220,260] ];
  const colors = ['#22c55e','#22c55e','#22c55e'];
  spots.forEach(([x,y],i)=>{ ctx.beginPath(); ctx.fillStyle = colors[i]; ctx.arc(x,y,8,0,Math.PI*2); ctx.fill(); });
  // usuário
  if (userPos) { ctx.beginPath(); ctx.fillStyle = '#93c5fd'; ctx.arc(420,60,10,0,Math.PI*2); ctx.fill(); }
}

// Chat
function ensureConversation(doacaoId) {
  if (!state.conversas[doacaoId]) state.conversas[doacaoId] = [];
}
function renderConversations() {
  const sel = $('#selConversa');
  const options = Object.keys(state.conversas);
  sel.innerHTML = '';
  if (!options.length) { sel.innerHTML = '<option>Nenhuma conversa</option>'; $('#chatJanela').innerHTML=''; return; }
  for (const id of options) {
    const d = state.doacoes.find(x=>x.id===id) || state.publicadas.find(x=>x.id===id) || state.reservas.find(x=>x.id===id) || {};
    const est = byId(d.estId)||{nome:'Estabelecimento'};
    const opt = document.createElement('option');
    opt.value = id; opt.textContent = `${est.nome} — ${d?.tipo||'Conversa'}`;
    sel.appendChild(opt);
  }
  renderChat();
}
function renderChat() {
  const id = $('#selConversa').value; const box = $('#chatJanela'); box.innerHTML = '';
  const msgs = state.conversas[id]||[];
  for (const m of msgs) {
    const div = document.createElement('div');
    div.className = 'msg ' + (m.quem==='you'?'you':'them');
    div.textContent = `[${new Date(m.ts).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}] ${m.texto}`;
    box.appendChild(div);
  }
  box.scrollTop = box.scrollHeight;
}

// Eventos
function onSubmitDoacao(e){
  e.preventDefault();
  const fd = new FormData(e.target);
  const est = state.estabelecimentos[0]; // simulando usuário logado como padaria
  const d = {
    id: crypto.randomUUID(),
    estId: est.id,
    tipo: fd.get('tipo'),
    qtd: Number(fd.get('quantidade')),
    validade: fd.get('validade'),
    janela: fd.get('janela'),
    endereco: fd.get('endereco'),
    reservadoPor: null,
    status: 'disponível',
    lat: est.lat, lng: est.lng
  };
  state.doacoes.unshift(d); state.publicadas.unshift(d);
  live('Doação publicada com sucesso');
  $('#statusDoar').textContent = '✅ Doação publicada!';
  e.target.reset();
  renderDoacoes(); renderHistorico(); renderStats();
}

function onClickLista(e){
  const btn = e.target.closest('[data-reservar]'); if (!btn) return;
  const id = btn.getAttribute('data-reservar');
  const d = state.doacoes.find(x=>x.id===id);
  if (!d || d.status!=='disponível') return;
  d.status='reservado'; d.reservadoPor = state.user.id; state.reservas.unshift(d);
  // pontos p/ estabelecimento
  const est = byId(d.estId); est.pontos += 3;
  // cria conversa
  ensureConversation(d.id);
  state.conversas[d.id].push({quem:'you', texto:`Olá! Reservei "${d.tipo}". Posso retirar dentro da janela ${d.janela}?`, ts: Date.now()});
  // resposta automática
  setTimeout(()=>{ state.conversas[d.id].push({quem:'them', texto:'Olá! Está reservado no balcão. Traga um documento, por favor.', ts: Date.now()}); renderChat(); }, 500);

  live('Doação reservada');
  renderDoacoes(); renderHistorico(); renderRanking(); renderConversations();
}

function onChatSubmit(e){
  e.preventDefault(); const id = $('#selConversa').value; if (!state.conversas[id]) return;
  const txt = $('#chatMsg').value.trim(); if (!txt) return; $('#chatMsg').value='';
  state.conversas[id].push({quem:'you', texto: txt, ts: Date.now()});
  renderChat();
}

function wireNav(){
  $$('.nav-link').forEach(b=> {
    b.addEventListener('click', ()=>{
      const go = b.getAttribute('data-goto');
      if (go && $(go)) {
        $(go).scrollIntoView({behavior: 'smooth'});
        $$('.nav-link').forEach(x=> x.classList.remove('active'));
        b.classList.add('active');
      }
    });
  });
}

function setupA11y(){
  $('#btnA11y').addEventListener('click', ()=>{ state.a11y.open = !state.a11y.open; saveA11y(); });
  $('#toggleContraste').addEventListener('click', ()=>{ state.a11y.contraste = !state.a11y.contraste; saveA11y(); });
  $('#toggleFonte').addEventListener('click', ()=>{ state.a11y.fonte = !state.a11y.fonte; saveA11y(); });
  $('#toggleDislexia').addEventListener('click', ()=>{ state.a11y.dislexia = !state.a11y.dislexia; saveA11y(); });
  $('#toggleAnimacoes').addEventListener('click', ()=>{ state.a11y.animacoes = !state.a11y.animacoes; saveA11y(); });
  $('#resetA11y').addEventListener('click', ()=>{ state.a11y = {}; saveA11y(); });
  applyA11y();
}

// Localização (simples)
function localizar(){
  const status = $('#locStatus');
  if (!navigator.geolocation) { status.textContent = 'Geolocalização não suportada.'; return; }
  status.textContent = 'Obtendo localização...';
  navigator.geolocation.getCurrentPosition(pos=>{
    status.textContent = 'Localização obtida.';
    drawMap({lat: pos.coords.latitude, lng: pos.coords.longitude});
    // ordenar por distância (aproximação)
    const you = {lat: pos.coords.latitude, lng: pos.coords.longitude};
    const ordered = [...state.doacoes].sort((a,b)=>haversine(you,a)-haversine(you,b));
    renderDoacoes(ordered);
  }, err=>{ status.textContent = 'Não foi possível obter a localização.'; drawMap(null); });
}

// Assinatura (compra)
function openModal(){ $('#modalCompra').classList.add('open'); $('#modalCompra').setAttribute('aria-hidden','false'); }
function closeModal(){ $('#modalCompra').classList.remove('open'); $('#modalCompra').setAttribute('aria-hidden','true'); }
function confirmarCompra(){ state.plano = 'plus'; localStorage.setItem('plano','plus'); $('#statusPlano').textContent = '🎉 Assinatura ativada! Obrigado por apoiar a causa.'; live('Assinatura confirmada'); closeModal(); }

function wirePlanButtons(){
  $('#btnAssinar').addEventListener('click', openModal);
  $('#btnAssinarHeader').addEventListener('click', openModal);
  $('#confirmarCompra').addEventListener('click', confirmarCompra);
  $('#cancelarCompra').addEventListener('click', closeModal);
}

// Filtro de texto
$('#filtroTexto')?.addEventListener('input', ()=> renderDoacoes());

// Listeners globais
$('#formDoacao')?.addEventListener('submit', onSubmitDoacao);
$('#listaDoacoes')?.addEventListener('click', onClickLista);
$('#formChat')?.addEventListener('submit', onChatSubmit);
$('#selConversa')?.addEventListener('change', renderChat);
$('#btnLocalizar')?.addEventListener('click', localizar);

// Init
function init(){
  wireNav(); setupA11y(); wirePlanButtons(); drawMap(null);
  renderStats(); renderDoacoes(); renderHistorico(); renderRanking(); renderConversations();
}

document.addEventListener('DOMContentLoaded', init);
```

