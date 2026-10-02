(function(){
var VRE=/^\[\[vid:([\w-]{1,40})\]\]$/,CH=4194304,MAX=40*1048576;
var st=document.createElement('style');st.textContent='.m video{display:block;width:100%;max-width:420px;max-height:300px;border-radius:6px;margin-top:6px;background:#000}.m .pg{display:block;margin-top:4px;color:#ffd0d3}';document.head.appendChild(st);
function vel(d,src,vid){var v=d.querySelector('video');if(!v){v=document.createElement('video');v.controls=true;v.preload='metadata';v.playsInline=true;v.src=src;v.onloadedmetadata=function(){if(d.classList.contains('me'))box.scrollTop=box.scrollHeight};d.appendChild(v)}if(vid)v.dataset.vid=vid}
var _add=add;
add=function(m){var k=m.cid||m.id,x=m.text&&VRE.exec(m.text),vid=x?x[1]:m.vid;if(x)m=Object.assign({},m,{text:''});
 _add(m);var d=els[k];if(d&&(vid||m.vsrc))vel(d,m.vsrc||'/vid/get?id='+vid,vid)};
var _dm=delMsg;
delMsg=async function(id){var d=byId[id],v=d&&d.querySelector('video'),vid=v&&v.dataset.vid;await _dm(id);
 if(vid&&!byId[id])fetch('/vid/del',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({vid:vid,name:me,token:tok})}).catch(function(){})};
async function send(f){
 if(!me){$('#nm').focus();return}
 if(demo){alert('Vídeo só funciona no site publicado no Netlify.');return}
 if(f.size>MAX){alert('O vídeo pode ter no máximo 40 MB.');return}
 var id='v'+Math.random().toString(36).slice(2,12)+Date.now().toString(36),n=Math.ceil(f.size/CH),cid=Math.random().toString(36).slice(2),H={'x-name':encodeURIComponent(me),'x-token':tok};
 add({cid:cid,name:me,text:'',vsrc:URL.createObjectURL(f)});
 var d=els[cid],pg=document.createElement('small');pg.className='pg';pg.textContent='Enviando… 0%';d.appendChild(pg);
 async function up(url,body){for(var t=0;t<3;t++){try{var r=await fetch(url,{method:'POST',headers:H,body:body});if(r.ok)return;if(r.status<500){var e=await r.json().catch(function(){return{}});throw new Error(e.error||'Erro '+r.status)}}catch(x){if(!(x instanceof TypeError))throw x}await new Promise(function(s){setTimeout(s,900*(t+1))})}throw new Error('A conexão falhou durante o envio.')}
 try{
  for(var i=0;i<n;i++){await up('/vid/up?id='+id+'&n='+i,f.slice(i*CH,(i+1)*CH));pg.textContent='Enviando… '+Math.round((i+1)/n*100)+'%'}
  await up('/vid/done?id='+id+'&n='+n+'&size='+f.size);
  var rc=await api('chat',{cid:cid,name:me,text:'[[vid:'+id+']]'});if(rc.s!==200)throw new Error('Não consegui postar o vídeo.');
  pg.remove();tag(cid,rc.d.id);d.querySelector('video').dataset.vid=id;
 }catch(e){pg.textContent='Falhou: '+e.message;setTimeout(function(){d.remove()},4000)}}
var fl=$('#fl'),old=fl.onchange;fl.accept='image/*,video/mp4,.mp4';$('#pk').textContent='Mídia';$('#pk').title='Enviar imagem ou vídeo MP4';
fl.onchange=function(){var f=this.files[0];if(f&&(f.type==='video/mp4'||/\.mp4$/i.test(f.name))){this.value='';send(f);return}return old.call(this)};
})();
