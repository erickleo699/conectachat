'use strict';

const STORAGE_KEY = 'conectachat-v1';
const COLORS = [ ['#d9eee5','#176b54'], ['#e6ddfa','#6847a5'], ['#ffe5d4','#a6532a'], ['#dce8ff','#345f9b'], ['#f8dce8','#a03d6a'], ['#f3edc9','#82731f'] ];
const starterData = {
  profile: { name: 'Erick', status: 'Disponível para conversar', theme: 'light' },
  nextId: 4,
  chats: [
    { id: 1, name: 'João Silva', isGroup: false, status: 'online agora', unread: 2, color: 0, messages: [
      { id: 101, from: 'them', text: 'Fala! Tudo certo?', time: '09:40' },
      { id: 102, from: 'me', text: 'Tudo sim! E com você?', time: '09:41', read: true },
      { id: 103, from: 'them', text: 'Tudo ótimo. Você terminou o projeto?', time: '09:42' }
    ]},
    { id: 2, name: 'Maria Oliveira', isGroup: false, status: 'vista por último hoje às 10:12', unread: 0, color: 1, messages: [
      { id: 201, from: 'them', text: 'Oi, Erick! 😊', time: '10:02' },
      { id: 202, from: 'me', text: 'Oi, Maria! Como você está?', time: '10:03', read: true },
      { id: 203, from: 'them', text: 'Estou bem! Gostei da ideia do aplicativo.', time: '10:12' }
    ]},
    { id: 3, name: 'Turma DSI16', isGroup: true, status: 'grupo · 18 participantes', unread: 5, color: 2, messages: [
      { id: 301, from: 'them', author: 'Ana', text: 'Pessoal, não esqueçam de colocar os requisitos no trabalho.', time: 'Ontem' },
      { id: 302, from: 'me', text: 'Beleza! Vou revisar tudo hoje.', time: 'Ontem', read: true },
      { id: 303, from: 'them', author: 'Lucas', text: 'Alguém já publicou o projeto no GitHub?', time: 'Ontem' }
    ]}
  ]
};
let state = loadState();
let activeChatId = state.chats[0]?.id ?? null;
let activeFilter = 'all';
let searchTerm = '';
let toastTimer;
let replyTimer;

const $ = (selector) => document.querySelector(selector);
const els = {
  app: $('#appShell'), chatList: $('#chatList'), search: $('#searchInput'), clearSearch: $('#clearSearch'),
  messages: $('#messages'), headerAvatar: $('#headerAvatar'), headerName: $('#headerName'), headerStatus: $('#headerStatus'),
  messageForm: $('#messageForm'), messageInput: $('#messageInput'), typing: $('#typingIndicator'),
  sidebarUserName: $('#sidebarUserName'), profileAvatar: $('#profileAvatar'), toast: $('#toast'),
  profileModal: $('#profileModal'), newChatModal: $('#newChatModal'), infoModal: $('#infoModal'),
  chatSearchBar: $('#chatSearchBar'), chatSearchInput: $('#chatSearchInput')
};

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return structuredClone(starterData);
    const parsed = JSON.parse(saved);
    if (!parsed || !Array.isArray(parsed.chats) || !parsed.profile) return structuredClone(starterData);
    return parsed;
  } catch (error) {
    return structuredClone(starterData);
  }
}
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (error) { showToast('Não foi possível salvar no navegador.'); }
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || '?';
}
function colorFor(chat) { return COLORS[chat.color % COLORS.length]; }
function avatarHTML(chat, extraClass = '') {
  const [bg, fg] = colorFor(chat);
  return `<div class="avatar ${extraClass}" style="--avatar-bg:${bg};--avatar-color:${fg}">${escapeHTML(initials(chat.name))}</div>`;
}
function getActiveChat() { return state.chats.find(chat => chat.id === activeChatId) || null; }
function lastMessage(chat) { return chat.messages[chat.messages.length - 1] || null; }
function lastTime(chat) { return lastMessage(chat)?.time || ''; }
function previewText(chat) {
  const last = lastMessage(chat);
  if (!last) return 'Nenhuma mensagem ainda';
  return `${last.from === 'me' ? 'Você: ' : ''}${last.text}`;
}
function filteredChats() {
  return [...state.chats].filter(chat => {
    const matchesSearch = `${chat.name} ${previewText(chat)}`.toLocaleLowerCase('pt-BR').includes(searchTerm.toLocaleLowerCase('pt-BR'));
    const matchesFilter = activeFilter === 'all' || (activeFilter === 'unread' && chat.unread > 0) || (activeFilter === 'groups' && chat.isGroup);
    return matchesSearch && matchesFilter;
  }).sort((a,b) => (lastMessage(b)?.id || b.id) - (lastMessage(a)?.id || a.id));
}
function renderChatList() {
  const chats = filteredChats();
  els.chatList.innerHTML = '';
  if (!chats.length) {
    els.chatList.innerHTML = `<div class="no-results">Nenhuma conversa encontrada.<br>Experimente outra pesquisa.</div>`;
    return;
  }
  chats.forEach(chat => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `chat-item${chat.id === activeChatId ? ' active' : ''}`;
    button.dataset.chatId = chat.id;
    button.innerHTML = `${avatarHTML(chat)}<span class="chat-details"><span class="chat-line"><span class="chat-name">${escapeHTML(chat.name)}</span><span class="chat-time">${escapeHTML(lastTime(chat))}</span></span><span class="chat-line"><span class="chat-preview">${escapeHTML(previewText(chat))}</span><span class="chat-badges">${chat.isGroup ? '<span class="group-badge">GRUPO</span>' : ''}${chat.unread ? `<span class="unread-badge">${chat.unread}</span>` : ''}</span></span></span>`;
    button.addEventListener('click', () => selectChat(chat.id));
    els.chatList.appendChild(button);
  });
}
function renderHeader() {
  const chat = getActiveChat();
  if (!chat) return;
  const [bg, fg] = colorFor(chat);
  els.headerAvatar.textContent = initials(chat.name);
  els.headerAvatar.style.setProperty('--avatar-bg', bg);
  els.headerAvatar.style.setProperty('--avatar-color', fg);
  els.headerName.textContent = chat.name;
  els.headerStatus.textContent = chat.status || (chat.isGroup ? 'grupo' : 'disponível');
}
function renderMessages(searchWithin = '') {
  const chat = getActiveChat();
  els.messages.innerHTML = '';
  if (!chat) {
    els.messages.innerHTML = '<div class="empty-chat"><strong>Bem-vindo ao ConectaChat</strong>Crie uma conversa para começar.</div>';
    return;
  }
  const term = searchWithin.trim().toLocaleLowerCase('pt-BR');
  const messages = chat.messages.filter(message => !term || message.text.toLocaleLowerCase('pt-BR').includes(term));
  if (!messages.length) {
    els.messages.innerHTML = `<div class="empty-chat"><strong>${term ? 'Nenhuma mensagem encontrada' : 'Ainda não há mensagens'}</strong>${term ? 'Tente pesquisar por outra palavra.' : 'Envie uma mensagem para iniciar a conversa.'}</div>`;
    return;
  }
  const day = document.createElement('div'); day.className = 'day-separator'; day.textContent = 'Mensagens da conversa'; els.messages.appendChild(day);
  messages.forEach(message => {
    const row = document.createElement('article');
    row.className = `message-row ${message.from === 'me' ? 'mine' : 'theirs'}`;
    row.innerHTML = `${message.from !== 'me' && message.author && chat.isGroup ? `<span class="message-author">${escapeHTML(message.author)}</span>` : ''}<div class="message-bubble">${escapeHTML(message.text).replace(/\n/g,'<br>')}<div class="message-meta"><span>${escapeHTML(message.time)}</span>${message.from === 'me' ? `<span class="read-mark" aria-label="${message.read ? 'Lida' : 'Enviada'}">${message.read ? '✓✓' : '✓'}</span>` : ''}</div></div>`;
    els.messages.appendChild(row);
  });
  if (!term) els.messages.scrollTop = els.messages.scrollHeight;
}
function renderAll() {
  document.body.classList.toggle('dark', state.profile.theme === 'dark');
  els.sidebarUserName.textContent = state.profile.name || 'Usuário';
  els.profileAvatar.textContent = initials(state.profile.name || 'U');
  renderChatList(); renderHeader(); renderMessages();
  if (window.innerWidth <= 760 && !activeChatId) els.app.classList.remove('chat-open');
}
function selectChat(id) {
  activeChatId = id;
  const chat = getActiveChat();
  if (chat) chat.unread = 0;
  els.app.classList.add('chat-open');
  els.chatSearchBar.classList.add('hidden');
  els.chatSearchInput.value = '';
  renderAll(); saveState();
  els.messageInput.focus();
}
function currentTime() { return new Intl.DateTimeFormat('pt-BR', {hour:'2-digit',minute:'2-digit'}).format(new Date()); }
function addMessage(chat, message) {
  chat.messages.push({ id: Date.now() + Math.floor(Math.random()*1000), time: currentTime(), ...message });
  saveState(); renderChatList(); renderMessages();
}
function showToast(message) {
  els.toast.textContent = message; els.toast.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2600);
}
function openModal(id) { $(`#${id}`).classList.remove('hidden'); }
function closeModal(id) { $(`#${id}`).classList.add('hidden'); }
function createChat(name, isGroup) {
  const normalized = name.trim();
  if (!normalized) return;
  const existing = state.chats.find(chat => chat.name.toLocaleLowerCase('pt-BR') === normalized.toLocaleLowerCase('pt-BR'));
  if (existing) { closeModal('newChatModal'); selectChat(existing.id); showToast('Essa conversa já existe.'); return; }
  const chat = { id: state.nextId++, name: normalized, isGroup, status: isGroup ? 'grupo · novo grupo' : 'nova conversa', unread: 0, color: state.chats.length % COLORS.length, messages: [] };
  state.chats.push(chat); activeChatId = chat.id; saveState(); closeModal('newChatModal'); renderAll();
  els.app.classList.add('chat-open'); els.messageInput.focus(); showToast('Conversa criada!');
}

els.messageForm.addEventListener('submit', event => {
  event.preventDefault();
  const text = els.messageInput.value.trim();
  const chat = getActiveChat();
  if (!text || !chat) { if (!chat) showToast('Selecione ou crie uma conversa primeiro.'); return; }
  addMessage(chat, { from: 'me', text, read: false });
  els.messageInput.value = ''; els.messageInput.style.height = 'auto';
  if (chat.isGroup) { showToast('Mensagem adicionada ao grupo de demonstração.'); return; }
  els.typing.classList.remove('hidden');
  clearTimeout(replyTimer);
  replyTimer = setTimeout(() => {
    els.typing.classList.add('hidden');
    const current = state.chats.find(item => item.id === chat.id);
    if (!current) return;
    const replies = ['Entendi! 😊', 'Boa ideia!', 'Legal, me conta mais.', 'Combinado! 👍', 'Certo, obrigado por avisar!'];
    const response = replies[Math.floor(Math.random() * replies.length)];
    current.messages.push({ id: Date.now(), from: 'them', text: response, time: currentTime() });
    if (activeChatId !== current.id) current.unread = (current.unread || 0) + 1;
    saveState(); renderChatList(); if (activeChatId === current.id) renderMessages();
  }, 1000 + Math.random()*900);
});
els.messageInput.addEventListener('input', () => { els.messageInput.style.height = 'auto'; els.messageInput.style.height = `${Math.min(els.messageInput.scrollHeight,130)}px`; });
els.messageInput.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); els.messageForm.requestSubmit(); } });
els.search.addEventListener('input', () => { searchTerm = els.search.value; els.clearSearch.style.display = searchTerm ? 'block' : 'none'; renderChatList(); });
els.clearSearch.addEventListener('click', () => { els.search.value = ''; searchTerm = ''; els.clearSearch.style.display = 'none'; renderChatList(); els.search.focus(); });
document.querySelectorAll('.filter').forEach(button => button.addEventListener('click', () => { activeFilter = button.dataset.filter; document.querySelectorAll('.filter').forEach(item => item.classList.toggle('active', item === button)); renderChatList(); }));
$('#newChatBtn').addEventListener('click', () => { $('#newContactName').value = ''; $('#newContactIsGroup').checked = false; openModal('newChatModal'); $('#newContactName').focus(); });
$('#welcomeNewChat').addEventListener('click', () => $('#newChatBtn').click());
$('#newChatForm').addEventListener('submit', event => { event.preventDefault(); createChat($('#newContactName').value, $('#newContactIsGroup').checked); });
$('#settingsBtn').addEventListener('click', () => { $('#profileName').value = state.profile.name || ''; $('#profileStatus').value = state.profile.status || ''; $('#themeSelect').value = state.profile.theme || 'light'; openModal('profileModal'); });
els.profileAvatar.addEventListener('click', () => $('#settingsBtn').click());
$('#profileForm').addEventListener('submit', event => { event.preventDefault(); state.profile.name = $('#profileName').value.trim() || 'Usuário'; state.profile.status = $('#profileStatus').value.trim() || 'Disponível'; state.profile.theme = $('#themeSelect').value; saveState(); renderAll(); closeModal('profileModal'); showToast('Perfil atualizado!'); });
$('#emojiBtn').addEventListener('click', () => { const emojis = ['😊','😂','❤️','👍','🎉','🙏','😎','✨']; const emoji = emojis[Math.floor(Math.random()*emojis.length)]; const start = els.messageInput.selectionStart; const end = els.messageInput.selectionEnd; const value = els.messageInput.value; els.messageInput.value = value.slice(0,start) + emoji + value.slice(end); els.messageInput.focus(); els.messageInput.setSelectionRange(start+emoji.length,start+emoji.length); });
$('#attachBtn').addEventListener('click', () => showToast('Anexos reais não estão disponíveis nesta versão de demonstração.'));
$('#searchInChatBtn').addEventListener('click', () => { els.chatSearchBar.classList.toggle('hidden'); if (!els.chatSearchBar.classList.contains('hidden')) els.chatSearchInput.focus(); else renderMessages(); });
$('#closeChatSearch').addEventListener('click', () => { els.chatSearchBar.classList.add('hidden'); els.chatSearchInput.value = ''; renderMessages(); });
els.chatSearchInput.addEventListener('input', () => renderMessages(els.chatSearchInput.value));
$('#chatInfoBtn').addEventListener('click', () => { const chat = getActiveChat(); if (!chat) return; $('#infoName').textContent = chat.name; $('#infoType').textContent = chat.isGroup ? `Grupo de demonstração · ${chat.messages.length} mensagens` : `Conversa individual · ${chat.messages.length} mensagens`; openModal('infoModal'); });
$('#backBtn').addEventListener('click', () => els.app.classList.remove('chat-open'));
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => closeModal(button.dataset.close)));
document.querySelectorAll('.modal-backdrop').forEach(backdrop => backdrop.addEventListener('click', event => { if (event.target === backdrop) backdrop.classList.add('hidden'); }));
document.addEventListener('keydown', event => { if (event.key === 'Escape') document.querySelectorAll('.modal-backdrop').forEach(modal => modal.classList.add('hidden')); });
window.addEventListener('resize', () => { if (window.innerWidth > 760) els.app.classList.remove('chat-open'); });

renderAll();
if (window.innerWidth <= 760) els.app.classList.remove('chat-open');
