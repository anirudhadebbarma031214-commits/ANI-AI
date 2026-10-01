(() => {
"use strict";

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const KEY = "ani_ai_v1";
const defaultState = {
  chats: [],
  activeId: null,
  settings: {
    endpoint: "",
    apiKey: "",
    model: "",
    dark: true,
    animations: true
  }
};
let state = loadState();
let generating = false;
let abortController = null;
let pendingFileText = "";

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    return saved ? {...defaultState, ...saved, settings:{...defaultState.settings,...saved.settings}} : {...defaultState, settings:{...defaultState.settings}};
  } catch { return {...defaultState, settings:{...defaultState.settings}}; }
}
function saveState() { localStorage.setItem(KEY, JSON.stringify(state)); }
function id() { return crypto.randomUUID ? crypto.randomUUID() : Date.now()+"-"+Math.random().toString(16).slice(2); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function toast(text) {
  const el = $("#toast"); el.textContent = text; el.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 2200);
}
function currentChat() { return state.chats.find(c => c.id === state.activeId); }
function createChat(title="New chat") {
  const chat = {id:id(), title, created:Date.now(), updated:Date.now(), messages:[]};
  state.chats.unshift(chat); state.activeId = chat.id; saveState(); renderAll();
  return chat;
}
function ensureChat() { return currentChat() || createChat(); }
function titleFrom(text) {
  const t = text.trim().replace(/\s+/g," ");
  return t.length > 34 ? t.slice(0,34)+"…" : (t || "New chat");
}
function renderChatList() {
  const list = $("#chatList");
  if (!state.chats.length) { list.innerHTML = '<div class="muted" style="padding:10px">No chats yet.</div>'; return; }
  list.innerHTML = state.chats.map(c => `
    <div class="chat-item ${c.id===state.activeId?'active':''}" data-chat="${c.id}">
      <span>◌</span><span class="chat-name">${escapeHtml(c.title)}</span>
      <button class="chat-more" data-menu="${c.id}" title="Chat options">•••</button>
    </div>`).join("");
  $$(".chat-item").forEach(el => el.addEventListener("click", e => {
    if (e.target.closest(".chat-more")) return;
    state.activeId = el.dataset.chat; saveState(); renderAll(); closeSidebar();
  }));
  $$(".chat-more").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation(); showChatMenu(b.dataset.menu, e.clientX, e.clientY);
  }));
}
function renderMessages() {
  const chat = currentChat();
  const welcome = $("#welcome"), messages = $("#messages");
  if (!chat || !chat.messages.length) {
    welcome.classList.remove("hidden"); messages.innerHTML = "";
    $("#topTitle").textContent = "ANI AI"; return;
  }
  welcome.classList.add("hidden");
  $("#topTitle").textContent = chat.title;
  messages.innerHTML = chat.messages.map((m,i) => messageHtml(m,i)).join("");
  bindMessageTools();
}
function messageHtml(m,i) {
  if (m.role === "user") return `<article class="message user" data-index="${i}">
    <div class="bubble">${renderMarkdown(m.content)}</div><div class="message-avatar">U</div></article>`;
  return `<article class="message ai" data-index="${i}">
    <div class="message-avatar">A</div><div><div class="bubble">${renderMarkdown(m.content || '<div class="typing"><i></i><i></i><i></i></div>')}</div>
    ${m.content ? `<div class="message-tools">
      <button class="tool-btn" data-copy-msg="${i}">Copy</button>
      <button class="tool-btn" data-regen="${i}">Regenerate</button>
    </div>` : ""}</div></article>`;
}
function renderMarkdown(src) {
  if (!src) return "";
  // Lightweight markdown renderer: safe escaping first, then controlled formatting.
  let s = escapeHtml(src.replace(/\r\n/g,"\n"));
  const blocks = [];
  s = s.replace(/```([\w+-]*)\n?([\s\S]*?)```/g, (_,lang,code) => {
    const n = blocks.length; blocks.push({lang:lang||"code",code});
    return `@@CODE${n}@@`;
  });
  s = s.replace(/^### (.*)$/gm,"<h3>$1</h3>").replace(/^## (.*)$/gm,"<h2>$1</h2>").replace(/^# (.*)$/gm,"<h1>$1</h1>");
  s = s.replace(/^\s*[-*] (.*)$/gm,"<li>$1</li>").replace(/(<li>.*<\/li>\n?)+/g,m=>`<ul>${m}</ul>`);
  s = s.replace(/^\s*\d+\.\s(.*)$/gm,"<li>$1</li>");
  s = s.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/__(.+?)__/g,"<strong>$1</strong>");
  s = s.replace(/`([^`\n]+)`/g,'<code class="inline">$1</code>');
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  s = s.split("\n\n").map(p => /^<(h[1-3]|ul|ol|div|@@CODE)/.test(p.trim()) ? p : `<p>${p.replace(/\n/g,"<br>")}</p>`).join("");
  blocks.forEach((b,n) => {
    const safeCode = b.code;
    s = s.replace(`@@CODE${n}@@`, `<div class="code-wrap"><div class="code-head"><span>${escapeHtml(b.lang)}</span><button class="code-copy" data-copy-code="${n}">Copy code</button></div><pre>${safeCode}</pre></div>`);
  });
  // Code placeholders are stored in the rendered DOM by attribute below; clipboard uses decoded text.
  return s;
}
function bindMessageTools() {
  $$("[data-copy-msg]").forEach(b => b.addEventListener("click", () => {
    const m = currentChat()?.messages[+b.dataset.copyMsg]; if (!m) return;
    copyText(m.content); toast("Response copied");
  }));
  $$("[data-regen]").forEach(b => b.addEventListener("click", () => regenerate(+b.dataset.regen)));
  $$(".code-copy").forEach(b => b.addEventListener("click", () => {
    const wrap = b.closest(".code-wrap"), code = wrap.querySelector("pre").textContent;
    copyText(code); toast("Code copied");
  }));
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); } catch {
    const ta=document.createElement("textarea"); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
  }
}
function renderAll() { renderChatList(); renderMessages(); }
function addMessage(role, content) {
  const chat = ensureChat(); chat.messages.push({role,content,ts:Date.now()}); chat.updated=Date.now();
  if (role==="user" && chat.messages.filter(m=>m.role==="user").length===1) chat.title=titleFrom(content);
  saveState(); renderAll(); scrollToBottom();
}
function scrollToBottom() { requestAnimationFrame(()=>$("#chatView").scrollTop=$("#chatView").scrollHeight); }
function autoResize() {
  const el=$("#messageInput"); el.style.height="auto"; el.style.height=Math.min(el.scrollHeight,170)+"px";
}
function showPanel(name) {
  $("#panelLayer").classList.remove("hidden");
  $$(".panel").forEach(p=>p.classList.add("hidden"));
  $(`#${name}Panel`).classList.remove("hidden");
  if(name==="settings") loadSettingsUI();
  if(name==="history") renderHistory();
}
function closePanels(){ $("#panelLayer").classList.add("hidden"); }
function loadSettingsUI() {
  $("#apiEndpoint").value=state.settings.endpoint; $("#apiKey").value=state.settings.apiKey;
  $("#modelName").value=state.settings.model; $("#darkMode").checked=state.settings.dark; $("#animations").checked=state.settings.animations;
}
function saveSettingsUI() {
  state.settings.endpoint=$("#apiEndpoint").value.trim(); state.settings.apiKey=$("#apiKey").value.trim();
  state.settings.model=$("#modelName").value.trim(); state.settings.dark=$("#darkMode").checked; state.settings.animations=$("#animations").checked;
  saveState(); applySettings();
}
function applySettings() {
  document.body.classList.toggle("no-animations", !state.settings.animations);
  document.documentElement.dataset.theme=state.settings.dark?"dark":"dark"; // ANI AI is intentionally dark-first.
}
function renderHistory() {
  const body=$("#historyBody");
  if(!state.chats.length){body.innerHTML='<p class="muted">No conversations yet.</p>';return;}
  body.innerHTML=state.chats.map(c=>`<div class="status-item"><strong>${escapeHtml(c.title)}</strong><small>${c.messages.length} message${c.messages.length===1?"":"s"} · ${new Date(c.updated).toLocaleString()}</small><div class="history-actions"><button data-open="${c.id}">Open</button><button data-rename="${c.id}">Rename</button><button data-delete="${c.id}">Delete</button></div></div>`).join("");
  $$("[data-open]").forEach(b=>b.onclick=()=>{state.activeId=b.dataset.open;saveState();renderAll();closePanels();});
  $$("[data-rename]").forEach(b=>b.onclick=()=>renameChat(b.dataset.rename));
  $$("[data-delete]").forEach(b=>b.onclick=()=>deleteChat(b.dataset.delete));
}
function renameChat(cid){
  const c=state.chats.find(x=>x.id===cid); if(!c)return;
  const n=prompt("Rename chat:",c.title); if(n&&n.trim()){c.title=n.trim().slice(0,60);c.updated=Date.now();saveState();renderAll();renderHistory();}
}
function deleteChat(cid){
  if(!confirm("Delete this chat?"))return;
  state.chats=state.chats.filter(c=>c.id!==cid); if(state.activeId===cid)state.activeId=state.chats[0]?.id||null;
  saveState();renderAll();renderHistory();toast("Chat deleted");
}
function showChatMenu(cid,x,y){
  const menu=$("#contextMenu"); menu.innerHTML=`<button data-cm="rename">Rename</button><button data-cm="clear">Clear conversation</button><button data-cm="delete">Delete</button>`;
  menu.style.left=Math.min(x,innerWidth-160)+"px"; menu.style.top=Math.min(y,innerHeight-130)+"px"; menu.classList.remove("hidden");
  menu.onclick=e=>{const a=e.target.dataset.cm; if(!a)return; menu.classList.add("hidden"); if(a==="rename")renameChat(cid); if(a==="clear"){const c=state.chats.find(x=>x.id===cid);if(c&&confirm("Clear all messages in this chat?")){c.messages=[];saveState();renderAll();}} if(a==="delete")deleteChat(cid);};
}
function closeSidebar(){$("#sidebar").classList.remove("open")}
function setGenerating(on){
  generating=on; $("#stopBar").classList.toggle("hidden",!on); $("#sendBtn").disabled=on;
}
function getApiConfig(){
  const endpoint=state.settings.endpoint.trim(), key=state.settings.apiKey.trim(), model=state.settings.model.trim();
  if(!endpoint || !key || !model) throw new Error("Open Settings and enter an API endpoint, API key, and model.");
  return {endpoint,key,model};
}
async function requestAI(messages, signal) {
  const {endpoint,key,model}=getApiConfig();
  const res=await fetch(endpoint,{method:"POST",signal,headers:{"Content-Type":"application/json","Authorization":"Bearer "+key},body:JSON.stringify({model,messages,temperature:0.7,stream:false})});
  const text=await res.text();
  let data; try{data=JSON.parse(text)}catch{throw new Error(`Provider returned HTTP ${res.status}.`)}
  if(!res.ok) throw new Error(data.error?.message || data.message || `Provider returned HTTP ${res.status}.`);
  const content=data.choices?.[0]?.message?.content;
  if(typeof content!=="string") throw new Error("The provider response did not contain choices[0].message.content.");
  return content;
}
async function sendMessage(text){
  text=text.trim(); if(!text||generating)return;
  const chat=ensureChat();
  if(pendingFileText){text += `\n\n[Attached file]\n${pendingFileText}`;pendingFileText="";toast("Attachment added");}
  addMessage("user",text);
  chat.messages.push({role:"assistant",content:""}); chat.updated=Date.now(); saveState(); renderMessages(); scrollToBottom();
  setGenerating(true);
  abortController=new AbortController();
  try{
    const apiMessages=chat.messages.filter(m=>m.role==="user"||m.role==="assistant").filter(m=>m.content).map(m=>({role:m.role,content:m.content}));
    const answer=await requestAI(apiMessages,abortController.signal);
    chat.messages[chat.messages.length-1].content=answer; chat.updated=Date.now(); saveState(); renderMessages(); scrollToBottom();
  }catch(err){
    chat.messages.pop();
    saveState(); renderMessages();
    if(err.name!=="AbortError") toast(err.message);
    else toast("Generation stopped");
  }finally{setGenerating(false);abortController=null;}
}
async function regenerate(index){
  const chat=currentChat(); if(!chat||generating)return;
  if(index!==chat.messages.length-1 || chat.messages[index].role!=="assistant"){toast("Regenerate the latest response only.");return;}
  chat.messages.pop(); saveState(); renderMessages();
  const lastUser=[...chat.messages].reverse().find(m=>m.role==="user"); if(!lastUser)return;
  await sendMessageRegenerate(chat);
}
async function sendMessageRegenerate(chat){
  chat.messages.push({role:"assistant",content:""});saveState();renderMessages();scrollToBottom();setGenerating(true);abortController=new AbortController();
  try{
    const msgs=chat.messages.slice(0,-1).filter(m=>m.content).map(m=>({role:m.role,content:m.content}));
    const answer=await requestAI(msgs,abortController.signal);chat.messages.at(-1).content=answer;chat.updated=Date.now();saveState();renderMessages();scrollToBottom();
  }catch(err){chat.messages.pop();saveState();renderMessages();if(err.name!=="AbortError")toast(err.message);else toast("Generation stopped");}
  finally{setGenerating(false);abortController=null;}
}
async function testApi(){
  saveSettingsUI(); const status=$("#apiStatus"); status.className="status";status.textContent="Testing…";
  try{const answer=await requestAI([{role:"user",content:"Reply with exactly: ANI AI connection OK"}],new AbortController().signal);status.className="status ok";status.textContent="Connected: "+answer.slice(0,100);}
  catch(e){status.className="status error";status.textContent=e.message;}
}
function exportChats(){
  const blob=new Blob([JSON.stringify({app:"ANI AI",version:1,exportedAt:new Date().toISOString(),chats:state.chats},null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="ani-ai-chats.json";a.click();URL.revokeObjectURL(a.href);toast("Chats exported");
}
function importChats(file){
  const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!Array.isArray(d.chats))throw 0;state.chats=d.chats;state.activeId=state.chats[0]?.id||null;saveState();renderAll();toast("Chats imported");}catch{toast("Invalid ANI AI export file");}};r.readAsText(file);
}
function makeParticles(){
  const box=$("#particles"), count=window.innerWidth<700?18:35;
  for(let i=0;i<count;i++){const p=document.createElement("span");p.className="particle";p.style.left=Math.random()*100+"%";p.style.top=(50+Math.random()*55)+"%";p.style.animationDelay=(-Math.random()*8)+"s";p.style.animationDuration=(6+Math.random()*7)+"s";box.appendChild(p);}
}
function setupMic(){
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SpeechRecognition){toast("Voice input is not supported in this browser.");return;}
  const r=new SpeechRecognition();r.lang=navigator.language||"en-US";r.interimResults=true;
  r.onstart=()=>toast("Listening…");r.onresult=e=>{$("#messageInput").value=[...e.results].map(x=>x[0].transcript).join("");autoResize();};
  r.onerror=()=>toast("Microphone input failed.");r.onend=()=>{};
  r.start();
}
function attachFile(file){
  if(!file)return;const r=new FileReader();r.onload=()=>{pendingFileText=String(r.result).slice(0,30000);toast(`Attached ${file.name}`);};r.onerror=()=>toast("Could not read that file.");r.readAsText(file);
}
document.addEventListener("DOMContentLoaded",()=>{
  makeParticles();applySettings();
  setTimeout(()=>$("#bootScreen").classList.add("done"),1250);
  if(!state.chats.length) createChat();
  renderAll();

  $("#newChatBtn").onclick=()=>{createChat();$("#messageInput").focus();};
  $("#brandBtn").onclick=()=>{createChat();};
  $("#menuBtn").onclick=()=>$("#sidebar").classList.add("open");
  $("#closeSidebar").onclick=closeSidebar;
  $("#sidebarBackdrop").onclick=closeSidebar;
  $("#composer").onsubmit=e=>{e.preventDefault();sendMessage($("#messageInput").value);$("#messageInput").value="";autoResize();};
  $("#messageInput").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("#composer").requestSubmit();}});
  $("#messageInput").addEventListener("input",autoResize);
  $("#stopBtn").onclick=()=>abortController?.abort();
  $("#micBtn").onclick=setupMic;
  $("#attachBtn").onclick=()=>$("#fileInput").click();
  $("#fileInput").onchange=e=>attachFile(e.target.files[0]);
  $("#testApiBtn").onclick=testApi;
  $("#exportBtn").onclick=exportChats;
  $("#importBtn").onclick=()=>$("#importFile").click();
  $("#importFile").onchange=e=>e.target.files[0]&&importChats(e.target.files[0]);
  $("#clearAllBtn").onclick=()=>{if(confirm("Delete every saved chat? This cannot be undone.")){state.chats=[];state.activeId=null;saveState();createChat();closePanels();toast("All chats cleared");}};
  $("#darkMode").onchange=saveSettingsUI;$("#animations").onchange=saveSettingsUI;
  $$("[data-panel]").forEach(b=>b.onclick=()=>showPanel(b.dataset.panel));
  $$("[data-close-panel]").forEach(b=>b.onclick=closePanels);
  $("#panelLayer").addEventListener("click",e=>{if(e.target.hasAttribute("data-close-panel"))closePanels();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){closePanels();$("#contextMenu").classList.add("hidden");}});
  document.addEventListener("click",e=>{if(!e.target.closest("#contextMenu"))$("#contextMenu").classList.add("hidden");});
  $$(".suggestions button").forEach(b=>b.onclick=()=>{$("#messageInput").value=b.dataset.prompt;autoResize();$("#messageInput").focus();});
  $("#chatView").addEventListener("scroll",()=>{$("#scrollBottom").style.display=$("#chatView").scrollTop<$("#chatView").scrollHeight-900?"grid":"none";});
  $("#scrollBottom").onclick=scrollToBottom;
});
})();