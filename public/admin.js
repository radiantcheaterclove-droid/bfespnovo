(function(){
var isA=false,ADM={},BL=[];
var st=document.createElement('style');st.textContent='.ab{background:var(--red);color:#fff;font:800 11px "Barlow Condensed";letter-spacing:.12em;padding:1px 6px;margin-left:8px;border-radius:2px}.adm .m b{padding-right:54px}.admbtn{margin-left:auto}.lg{border-bottom:1px solid var(--line);padding:8px 0;font-size:14px;word-break:break-word}.lg small{display:block;color:var(--mute)}';document.head.appendChild(st);
function P(p,b){return fetch('/adm/'+p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(Object.assign({name:me,token:tok},b||{}))}).then(function(r){return r.json().then(function(d){return{s:r.status,d:d}})}).catch(function(){return{s:0,d:{}}})}
var _api=api;api=async function(p,b){var r=await _api(p,b);if(p==='blacklist'&&!b&&r&&Array.isArray(r.d))BL=r.d.slice().sort(function(a,c){return c.ts-a.ts});return r};
var _tag=tag;tag=function(k,id){_tag(k,id);var d=els[k];if(isA&&d&&id&&!d.querySelector('.del'))mkdel(d,id)};
var _d2=delMsg;delMsg=async function(id){if(!isA)return _d2(id);if(!confirm('Apagar esta mensagem para todos (admin)?'))return;var r=await P('del',{id:id});if(r.s===200)gone(id);else alert(r.d.error||'Não consegui apagar.')};
async function admDelBl(id){if(!confirm('Remover da blacklist (admin)?'))return;var r=await P('del',{id:id});if(r.s===200)load();else alert(r.d.error||'Não consegui remover.')}
function admBl(){if(!isA)return;var f=document.querySelectorAll('#list .fi');if(f.length!==BL.length)return;f.forEach(function(el,i){if(el.querySelector('.del'))return;var x=h('button','del','remover');x.type='button';x.onclick=function(){admDelBl(BL[i].id)};el.appendChild(x)})}
new MutationObserver(admBl).observe($('#list'),{childList:true});
function bd(d){if(!d||d.dataset.ab)return;var b=d.querySelector('b');if(b&&b.firstChild&&ADM[b.firstChild.textContent.toLowerCase()]){d.dataset.ab=1;b.appendChild(h('span','ab','ADMIN'))}}
var _a3=add;add=function(m){_a3(m);bd(els[m.cid||m.id])};
function refresh(){fetch('/adm/list').then(function(r){return r.json()}).then(function(d){ADM={};d.names.forEach(function(n){ADM[n]=1});document.querySelectorAll('#msgs .m').forEach(bd)}).catch(function(){})}
var btn=h('button','btn ghost admbtn','Admin'),dg=document.createElement('dialog');btn.type='button';$('#gate').appendChild(btn);
dg.innerHTML='<form method="dialog"><h3>Admin</h3><div id="adc"></div><div class="row"><button class="btn ghost">Fechar</button></div></form>';document.body.appendChild(dg);
function setA(v){isA=v;document.body.classList.toggle('adm',v);btn.textContent=v?'Admin · registro':'Admin';if(v){Object.keys(byId).forEach(function(id){mkdel(byId[id],id)});admBl()}}
function login(){var c=$('#adc');c.textContent='';var l=h('label','','Senha de admin'),i=document.createElement('input');i.type='password';i.autocomplete='off';l.appendChild(i);var e=h('small',''),g=h('button','btn','Entrar');g.type='button';
 g.onclick=async function(){var r=await P('login',{pass:i.value});if(r.s===200&&r.d.admin){setA(true);refresh();log()}else e.textContent=r.d.error||'Erro'};
 i.onkeydown=function(k){if(k.key==='Enter'){k.preventDefault();g.onclick()}};c.append(l,g,e)}
async function log(){var c=$('#adc');c.textContent='Carregando registro…';var r=await P('log');c.textContent='';c.appendChild(h('small','','Últimas moderações (o que cada admin apagou):'));
 if(r.s!==200||!r.d.length){c.appendChild(h('div','lg','Nenhuma ainda.'));return}
 r.d.forEach(function(e){var d=h('div','lg',e.by+' apagou '+e.kind+' de '+e.owner+': '+e.text);d.appendChild(h('small','',fmt(e.ts)));c.appendChild(d)})}
btn.onclick=function(){if(!me){$('#nm').focus();return}dg.showModal();if(isA)log();else login()};
if(me)P('me').then(function(r){if(r.d&&r.d.admin)setA(true)});
refresh();setInterval(refresh,30000);
})();
