/* RIDEON V5 production bridge: Supabase Auth/DB + demo payments + live GPS tracking. */
(() => {
  const state = { supabase: null, user: null, profile: null, config: null, authMode: 'signin', watchId: null, customerWatchId: null, idleBound: false, trackingRequestId: null, trackingMap: null, mechanicMarker: null, customerMarker: null, trackingChannel: null, workshopMap: null, workshopMarkers: [], rescueMap: null, customerLocation: null, idleTimer: null, lastActivity: 0, securityInterval: null, loggingOut: false, idleGeneration: 0 };
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const rupiah = (n) => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n || 0);
  const toast = (m) => window.toast ? window.toast(m) : alert(m);

  function injectUI(){
    const login = document.createElement('div');
    state.authMode = 'signin';
    login.id='productionAuth';
    login.innerHTML=`<div class="prod-auth-card"><div class="brand"><div class="logo">R</div><div>RIDEON</div></div><div class="tagline" style="margin:5px 0 20px">YOUR RIDE. ALWAYS ON.</div><h2 id="authTitle">Sign in to RIDEON</h2><p class="muted" id="authSub">Use your real account. Your account, bookings, vehicles and orders are stored securely.</p><div class="field"><label>Full name (for new account)</label><input id="authName" placeholder="Your full name"></div><div class="field"><label>Email</label><input id="authEmail" type="email" autocomplete="email" placeholder="you@example.com"></div><div class="field"><label>Password</label><input id="authPassword" type="password" autocomplete="current-password" placeholder="Minimum 6 characters"></div><button class="btn primary" id="authSubmit" style="width:100%">Sign in</button><button class="btn ghost" id="authToggle" style="width:100%;margin-top:8px">Create a new account</button><div class="muted tiny" id="authMsg" style="margin-top:12px"></div></div>`;
    document.body.appendChild(login);
    const style=document.createElement('style'); style.textContent=`#productionAuth{position:fixed;inset:0;background:#06100ddd;backdrop-filter:blur(12px);display:grid;place-items:center;padding:20px;z-index:100}.prod-auth-card{width:min(460px,100%);background:#10211b;border:1px solid #29453b;border-radius:24px;padding:28px;box-shadow:0 30px 100px #0009}.prod-auth-card .brand{padding:0}.prod-auth-card .logo{display:grid}.prod-auth-card .field{margin-top:12px}.prod-auth-card .tagline{font-size:9px;letter-spacing:1.25px;color:#9aafa5}.prod-auth-card h2{margin:4px 0 8px}.prod-auth-card input{background:#081410;border:1px solid #29453b;color:#f3f7f4;border-radius:11px;padding:12px;width:100%}body.auth-loading main,body.auth-loading .sidebar,body.auth-loading .mobilebar{visibility:hidden}.prod-live{border:1px solid #29453b;background:#0b1915;border-radius:15px;padding:14px;margin-top:14px}.live-map{height:320px;border-radius:14px;overflow:hidden;border:1px solid #29453b;background:#10231c}.live-badge{display:inline-flex;gap:7px;align-items:center;border-radius:999px;padding:5px 9px;background:#20372b;color:#c5f36a;font-size:10px;font-weight:850}.live-dot{width:7px;height:7px;border-radius:50%;background:#c5f36a;box-shadow:0 0 0 4px #c5f36a22}`; document.head.appendChild(style);
    document.body.classList.add('auth-loading');
    $('#authToggle').onclick=()=>{
      state.authMode = state.authMode === 'signin' ? 'signup' : 'signin';
      const signup = state.authMode === 'signup';
      $('#authTitle').textContent = signup ? 'Create your RIDEON account' : 'Sign in to RIDEON';
      $('#authSub').textContent = signup ? 'Create an account to store your data permanently.' : 'Use your real account. Your account, bookings, vehicles and orders are stored securely.';
      $('#authSubmit').textContent = signup ? 'Sign up' : 'Sign in';
      $('#authToggle').textContent = signup ? 'I already have an account' : 'Create a new account';
      $('#authName').parentElement.style.display = signup ? 'grid' : 'none';
      $('#authMsg').textContent = '';
    };
    $('#authName').parentElement.style.display='none';
    $('#authSubmit').onclick=authSubmit;
  }

  async function authSubmit(){
    const email=$('#authEmail').value.trim(), password=$('#authPassword').value, name=$('#authName').value.trim();
    const signup = state.authMode === 'signup';
    if(!email || !password){ $('#authMsg').textContent='Email and password are required.'; return; }
    if(signup && password.length < 6){ $('#authMsg').textContent='Password must be at least 6 characters.'; return; }
    $('#authSubmit').disabled=true;
    $('#authMsg').textContent='Processing…';
    try{
      let result;
      if(signup){
        result=await state.supabase.auth.signUp({
          email,
          password,
          options:{data:{full_name:name||'RIDEON Rider'}}
        });
      }else{
        result=await state.supabase.auth.signInWithPassword({email,password});
      }
      if(result.error){
        $('#authMsg').textContent=result.error.message;
        return;
      }
      if(signup && !result.data.session){
        $('#authMsg').textContent='Account created. Check your email to confirm, then sign in.';
        return;
      }
      if(result.data.session){
        $('#authMsg').textContent='Success. Loading your RIDEON account…';
        await handleSession(result.data.session);
      }
    }catch(e){
      console.error('RIDEON auth error:',e);
      $('#authMsg').textContent=e?.message || 'Authentication failed. Please try again.';
    }finally{
      $('#authSubmit').disabled=false;
    }
  }

  async function loadProfile(){
    const fallbackName=state.user.user_metadata?.full_name||state.user.user_metadata?.name||'RIDEON Rider';
    const {data,error}=await state.supabase.from('profiles').select('*').eq('id',state.user.id).single();
    if(error){
      console.error(error);
      state.profile={full_name:fallbackName,email:state.user.email||'',phone:'',role:'customer'};
    }else{
      state.profile=data;
    }
    const profileData=state.profile||{};
    const name=profileData.full_name||fallbackName;
    const avatar=(name.trim()[0]||'R').toUpperCase();
    const firstName=name.trim().split(/\s+/)[0]||'Rider';
    document.querySelectorAll('.profile strong').forEach(x=>x.textContent=name);
    document.querySelectorAll('.profile small').forEach(x=>x.textContent=`${profileData.role||'customer'} · ${state.user.email}`);
    document.querySelectorAll('.avatar').forEach(x=>x.textContent=avatar);
    if($('#welcomeName')) $('#welcomeName').textContent=name;
    const homeTitle=$('#pageTitle');
    if(homeTitle && document.querySelector('#home.page.active')) homeTitle.innerHTML=`Welcome back, <span id="welcomeName">${esc(name)}</span>.`;
    if($('#profileName')) $('#profileName').value=name;
    if($('#profileEmail')) $('#profileEmail').value=state.user.email||'';
    if($('#profilePhone')) $('#profilePhone').value=profileData.phone||'';
    if($('#roleBadge')) $('#roleBadge').textContent=profileData.role||'customer';
    const opsBtn=document.querySelector('[data-page="ops"]'); if(opsBtn) opsBtn.style.display=['mechanic','workshop','admin'].includes(profileData.role)?'flex':'none';
    if(profileData.role==='mechanic') renderMechanicPanel();
    if(['workshop','admin'].includes(profileData.role)) renderStaffDispatchPanel();
  }


  const IDLE_LIMIT_MS = 5 * 60 * 1000;
  const IDLE_CHECK_MS = 1000;
  function touchActivity(){
    if(!state.user || state.loggingOut) return;
    state.lastActivity=Date.now();
    try{ sessionStorage.setItem('rideon_last_activity', String(state.lastActivity)); }catch(e){}
    armIdleTimer();
  }
  function armIdleTimer(){
    if(!state.user || state.loggingOut) return;
    if(state.idleTimer) clearTimeout(state.idleTimer);
    const generation=++state.idleGeneration;
    state.idleTimer=setTimeout(async()=>{
      if(generation!==state.idleGeneration || !state.user || state.loggingOut) return;
      await performLogout('Sesi berakhir karena 5 menit tidak aktif. Silakan login kembali.');
    }, IDLE_LIMIT_MS);
  }
  async function enforceIdleLogout(){
    if(!state.user || state.loggingOut) return;
    let last=state.lastActivity;
    try{ last=Number(sessionStorage.getItem('rideon_last_activity'))||last; }catch(e){}
    if(last && Date.now()-last >= IDLE_LIMIT_MS){
      await performLogout('Sesi berakhir karena 5 menit tidak aktif. Silakan login kembali.');
    }
  }
  function startIdleSecurity(){
    stopIdleSecurity();
    state.idleBound=true;
    ['pointerdown','keydown','touchstart','scroll','mousemove','click'].forEach(ev=>window.addEventListener(ev,touchActivity,{passive:true}));
    document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') enforceIdleLogout(); });
    state.lastActivity=Date.now();
    try{ sessionStorage.setItem('rideon_last_activity', String(state.lastActivity)); }catch(e){}
    armIdleTimer();
    state.securityInterval=setInterval(enforceIdleLogout, IDLE_CHECK_MS);
  }
  function stopIdleSecurity(){
    if(state.securityInterval) clearInterval(state.securityInterval);
    state.securityInterval=null;
    if(state.idleTimer) clearTimeout(state.idleTimer);
    state.idleTimer=null;
    state.idleGeneration++;
    state.idleBound=false;
    ['pointerdown','keydown','touchstart','scroll','mousemove','click'].forEach(ev=>window.removeEventListener(ev,touchActivity));
    try{ sessionStorage.removeItem('rideon_last_activity'); }catch(e){}
  }

  async function performLogout(message='Anda telah keluar dari akun RIDEON.'){
    if(state.loggingOut) return;
    state.loggingOut=true;
    stopIdleSecurity();
    try{ if(state.customerWatchId!==null && navigator.geolocation) navigator.geolocation.clearWatch(state.customerWatchId); }catch(e){}
    try{ if(state.watchId!==null && navigator.geolocation) navigator.geolocation.clearWatch(state.watchId); }catch(e){}
    state.customerWatchId=null; state.watchId=null;
    try{ if(state.supabase) await state.supabase.auth.signOut({scope:'local'}); }catch(e){ console.error('RIDEON sign out error:',e); }
    try{
      Object.keys(localStorage).filter(k=>/^sb-.*-auth-token$/.test(k)).forEach(k=>localStorage.removeItem(k));
      localStorage.removeItem('rideon_session');
      sessionStorage.clear();
    }catch(e){}
    state.user=null; state.profile=null;
    const auth=$('#productionAuth'); if(auth) auth.style.display='grid';
    document.documentElement.classList.add('rideon-auth-boot');
    document.body.classList.add('auth-loading');
    const msg=$('#authMsg'); if(msg) msg.textContent=message;
    // Do not reload through the demo app; keep the auth gate in control.
    state.authMode='signin';
    if($('#authTitle')) $('#authTitle').textContent='Sign in to RIDEON';
    if($('#authSubmit')) $('#authSubmit').textContent='Sign in';
    if($('#authToggle')) $('#authToggle').textContent='Create a new account';
    if($('#authName')) $('#authName').parentElement.style.display='none';
    state.loggingOut=false;
  }
  window.RIDEON_LOGOUT=()=>performLogout();

  function addLogout(){
    const side=document.querySelector('.side-bottom');
    if(side && !$('#logoutBtn')){
      const b=document.createElement('button');
      b.id='logoutBtn';
      b.className='btn danger';
      b.style.width='100%';
      b.style.marginTop='10px';
      b.textContent='↪ Log out';
      b.title='Log out of your RIDEON account';
      b.onclick=(e)=>{e.preventDefault();e.stopPropagation();window.RIDEON_LOGOUT();};
      side.appendChild(b);
    }
    const accountLogout=$('#accountLogoutBtn');
    if(accountLogout){ accountLogout.onclick=(e)=>{e.preventDefault();e.stopPropagation();window.RIDEON_LOGOUT();}; accountLogout.disabled=false; }
  }

  async function handleSession(session){
    state.user=session?.user||null;
    if(!state.user){ stopIdleSecurity(); document.documentElement.classList.add('rideon-auth-boot'); document.body.classList.add('auth-loading'); const auth=$('#productionAuth'); if(auth) auth.style.display='grid'; return; }
    let lastActivity=0;
    try{ lastActivity=Number(sessionStorage.getItem('rideon_last_activity'))||0; }catch(e){}
    if(lastActivity && Date.now()-lastActivity >= IDLE_LIMIT_MS){ await performLogout(); return; }
    document.documentElement.classList.remove('rideon-auth-boot'); document.body.classList.remove('auth-loading'); $('#productionAuth').style.display='none';
    await loadProfile(); addLogout();
    startIdleSecurity();
    await refreshOrders();
    await renderConsultHistory();
    await hydrateActiveRoadside();
    await renderSupportInbox();
  }

  async function refreshOrders(){
    const {data,error}=await state.supabase.from('orders').select('*').order('created_at',{ascending:false}).limit(50);
    if(error){console.warn(error);return;}
    const body=$('#ordersTable'); if(!body)return;
    if(!data?.length){body.innerHTML='<tr><td colspan="6" class="empty">No orders yet.</td></tr>';return;}
    body.innerHTML=data.map(o=>`<tr><td>${esc(o.id.slice(0,8))}</td><td>${esc(o.kind)}</td><td>${esc(o.description)}</td><td>${new Date(o.created_at).toLocaleString('id-ID')}</td><td><span class="pill ${o.payment_status==='paid'?'':'amber'}">${esc(o.payment_status==='paid'?'demo-paid':o.payment_status)}</span></td><td>${o.payment_status!=='paid'?`<button class="btn small primary" data-pay="${o.id}">Mark demo paid</button>`:''}</td></tr>`).join('');
    body.querySelectorAll('[data-pay]').forEach(b=>b.onclick=()=>payOrder(b.dataset.pay));
  }

  async function createOrder(kind, referenceId, description, amount){
    const {data,error}=await state.supabase.from('orders').insert({customer_id:state.user.id,kind,reference_id:referenceId,description,amount_idr:amount}).select().single();
    if(error) throw error; return data;
  }

  async function payOrder(orderId){
    try{
      const {data,error}=await state.supabase.from('orders').update({payment_status:'paid',payment_type:'demo'}).eq('id',orderId).eq('customer_id',state.user.id).select().single();
      if(error) throw error;
      toast('Demo payment recorded. No real money was charged.');
      await refreshOrders();
      return data;
    }catch(e){toast(e.message)}
  }

  async function onBookingSubmit(form){
    const bike=$('#bookBike').value, service=$('#bookType').value, date=$('#bookDate').value, time=$('#bookTime').value, notes=$('#bookNotes').value;
    if(!date)return;
    const scheduled=`${date}T${time.split('–')[0]}:00+07:00`;
    let vehicleId=null;
    try{
      const {data:v}=await state.supabase.from('vehicles').select('*').eq('owner_id',state.user.id).order('created_at',{ascending:true}).limit(1);
      if(v?.[0]) vehicleId=v[0].id;
      else { const parts=bike.split(' '); const brand=parts[0]||'Other'; const model=parts.slice(1).join(' ')||bike; const {data:nv}=await state.supabase.from('vehicles').insert({owner_id:state.user.id,brand,model}).select().single(); vehicleId=nv?.id||null; }
      const {data:b,error}=await state.supabase.from('bookings').insert({customer_id:state.user.id,vehicle_id:vehicleId,service_type:service,scheduled_at:scheduled,notes,status:'pending'}).select().single();
      if(error)throw error;
      const prices={'Periodic service':100000,'Oil change':75000,'Brake inspection':50000,'Electrical diagnosis':75000,'Tire / puncture repair':50000,'Other repair':100000};
      const order=await createOrder('service',b.id,`${service} · ${bike}`,prices[service]||100000);
      toast(`Booking ${b.id.slice(0,8)} dibuat. Demo payment tersedia.`); await refreshOrders();
    }catch(e){toast(e.message)}
  }

  window.checkout=async function(){
    try{
      const saved=JSON.parse(localStorage.getItem('rideonStartupDemo')||'{}');
      const cart=Array.isArray(saved.cart)?saved.cart:[];
      if(!cart.length)return toast('Cart is empty.');
      const total=cart.reduce((sum,p)=>sum+(Number(p.price)||0)*(Number(p.qty)||0),0);
      const names=cart.map(p=>`${p.name} × ${p.qty}`).join(', ');
      const order=await createOrder('parts',null,names,total);
      saved.cart=[]; localStorage.setItem('rideonStartupDemo',JSON.stringify(saved));
      closeModal?.(); updateCartCount?.(); await refreshOrders(); go?.('orders');
      toast('Parts order created. No real payment is required.');
    }catch(e){toast(e.message)}
  };

  window.requestRescue=async function(){
    if(!state.user){toast('Please sign in first.');return;}
    const issue=$('#rescueIssue').value, phone=$('#rescuePhone').value.trim(), address=$('#rescueLocation').value.trim();
    if(!phone){toast('Masukkan nomor kontak terlebih dahulu.');return;}
    let lat=null,lng=null,accuracy_m=null;
    try{
      const pos=await captureRescuePosition(false);
      lat=pos.coords.latitude;lng=pos.coords.longitude;accuracy_m=pos.coords.accuracy;
    }catch(e){ if(!address){toast('Izinkan GPS atau isi lokasi/landmark secara manual.');return;} }
    const {data,error}=await state.supabase.from('roadside_requests').insert({customer_id:state.user.id,issue,phone,address_text:address,lat,lng,accuracy_m}).select().single();
    if(error){toast(error.message);return;}
    state.trackingRequestId=data.id;
    const order=await createOrder('roadside',data.id,'Roadside assistance',35000);
    $('#rescueStatus').textContent='Request sent'; $('#rescueStatus').className='pill';
    $('#locationHint').textContent=lat?`GPS terkunci: ${lat.toFixed(5)}, ${lng.toFixed(5)} ±${Math.round(accuracy_m)}m`:'Lokasi teks tersimpan.';
    $('#rescueSteps').innerHTML='<div class="step active"><div class="step-dot">✓</div><div><strong>Permintaan diterima</strong><small>Referensi: '+data.id.slice(0,8)+'</small></div></div><div class="step"><div class="step-dot">2</div><div><strong>Menunggu mekanik ditugaskan</strong><small>Workshop dapat melihat lokasi GPS yang kamu kirim.</small></div></div><div class="step"><div class="step-dot">3</div><div><strong>Live tracking</strong><small>Posisi mekanik muncul setelah mekanik mengaktifkan GPS.</small></div></div>';
    toast('Permintaan roadside terkirim.');
    subscribeToTracking(data.id); renderLiveTracking(data.id);
    if(lat && navigator.geolocation && state.customerWatchId===null){
      state.customerWatchId=navigator.geolocation.watchPosition(async p=>{
        state.customerLocation={lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy};
        initRescueMap(p.coords.latitude,p.coords.longitude);
        await state.supabase.from('roadside_requests').update({lat:p.coords.latitude,lng:p.coords.longitude,accuracy_m:p.coords.accuracy}).eq('id',data.id).eq('customer_id',state.user.id);
      },()=>{}, {enableHighAccuracy:true,maximumAge:3000,timeout:15000});
    }
  };

  async function findNearbyWorkshops(){
    const host=document.querySelector('#workshopList');
    const mapHost=document.querySelector('#workshopMap');
    const setHost=(html)=>{if(host)host.innerHTML=html;};
    if(!navigator.geolocation){setHost('<div class="empty">Browser ini tidak mendukung GPS.</div>');return;}
    setHost('<div class="empty">Mencari bengkel terdekat…</div>');
    try{
      const pos=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:10000,maximumAge:60000}));
      const lat=pos.coords.latitude,lng=pos.coords.longitude;
      if(!window.L){setHost('<div class="empty">Peta belum siap. Muat ulang halaman dan coba lagi.</div>');return;}
      if(state.workshopMap) state.workshopMap.remove();
      state.workshopMap=L.map('workshopMap').setView([lat,lng],14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(state.workshopMap);
      L.marker([lat,lng]).addTo(state.workshopMap).bindPopup('Lokasi Anda').openPopup();
      state.workshopMarkers=[];
      const query=`[out:json][timeout:12];(node[shop=motorcycle](around:7000,${lat},${lng});way[shop=motorcycle](around:7000,${lat},${lng});node[shop=car_repair](around:7000,${lat},${lng});way[shop=car_repair](around:7000,${lat},${lng}););out center tags;`;
      const resp=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'text/plain'},body:query});
      if(!resp.ok) throw new Error('Pencarian bengkel tidak tersedia saat ini.');
      const json=await resp.json();
      const items=(json.elements||[]).map(x=>{const a=x.lat??x.center?.lat,b=x.lon??x.center?.lon,t=x.tags||{};if(a==null||b==null)return null;const d=haversineKm(lat,lng,a,b);const name=t.name||'Bengkel motor terdekat';const hours=t.opening_hours||'';let status='Jam buka tidak tersedia',cls='status-unknown';if(hours){const low=hours.toLowerCase();if(/24\/7|24 hours|00:00-24:00/.test(low)){status='Buka 24 jam';cls='status-open';}else{status='Jam buka tersedia';cls='status-open';}}return {name,lat:a,lng:b,distance:d,hours,status,cls};}).filter(Boolean).sort((a,b)=>a.distance-b.distance).slice(0,10);
      if(!items.length){setHost('<div class="empty">Belum menemukan bengkel terdekat dari data peta.</div>');state.workshopMap.invalidateSize();return;}
      items.forEach(w=>{const m=L.marker([w.lat,w.lng]).addTo(state.workshopMap).bindPopup(`<strong>${esc(w.name)}</strong><br>${w.distance.toFixed(1)} km dari Anda`);state.workshopMarkers.push(m);});
      setHost(items.map(w=>`<div class="workshop-item"><div><strong>${esc(w.name)}</strong><div class="meta">${w.distance.toFixed(1)} km · <span class="${w.cls}">${esc(w.status)}</span></div></div><button class="btn small" type="button" onclick="window.open('https://www.openstreetmap.org/?mlat=${w.lat}&mlon=${w.lng}#map=18/${w.lat}/${w.lng}','_blank')">Map</button></div>`).join('');
      state.workshopMap.invalidateSize();
    }catch(e){
      console.error('findNearbyWorkshops:',e);
      setHost(`<div class="empty">${esc(e.message||'Gagal mencari bengkel. Izinkan GPS lalu coba lagi.')}</div>`);
    }
  }
  function haversineKm(lat1,lon1,lat2,lon2){const R=6371,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180,a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(a));}

  window.findNearbyWorkshops=findNearbyWorkshops;
  window.useMyLocation=async function(){
    const hint=$('#locationHint');
    if(hint)hint.textContent='Meminta izin GPS…';
    try{ await captureRescuePosition(false); toast('Lokasi GPS berhasil diambil.'); }
    catch(e){ if(hint)hint.textContent='Izin lokasi tidak diberikan. Masukkan lokasi manual.'; toast('GPS tidak tersedia atau izin ditolak.'); }
  };

  async function hydrateActiveRoadside(){
    const {data}=await state.supabase.from('roadside_requests').select('*').eq('customer_id',state.user.id).in('status',['requested','accepted','en_route','arrived','in_service']).order('created_at',{ascending:false}).limit(1);
    if(data?.[0]){ subscribeToTracking(data[0].id); renderLiveTracking(data[0].id); }
  }

  async function renderLiveTracking(requestId){
    const host=$('#liveTrackingHost'); if(!host)return;
    const {data:r}=await state.supabase.from('roadside_requests').select('*,profiles:assigned_mechanic_id(full_name,phone)').eq('id',requestId).single();
    host.innerHTML=`<div class="prod-live"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><div class="eyebrow">Live roadside tracking</div><h3 style="margin:5px 0">${esc(r?.profiles?.full_name||'Waiting for mechanic')}</h3></div><span class="live-badge"><span class="live-dot"></span>${esc(r?.status||'requested')}</span></div><div id="liveMap" class="live-map" style="margin-top:12px"></div><div class="row"><div><strong>Request</strong><div class="muted tiny">${requestId.slice(0,8)}</div></div><div class="right"><strong id="liveEta">Waiting</strong><div class="muted tiny" id="liveCoords">Waiting for GPS</div></div></div></div>`;
    if(window.L){ state.trackingMap=L.map('liveMap').setView([r?.lat||-7.42,r?.lng||109.23],14); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(state.trackingMap); if(r?.lat&&r?.lng){state.customerMarker=L.marker([r.lat,r.lng]).addTo(state.trackingMap).bindPopup('Your location').openPopup();} }
  }

  function subscribeToTracking(requestId){
    if(state.trackingChannel) state.supabase.removeChannel(state.trackingChannel);
    state.trackingRequestId=requestId;
    state.trackingChannel=state.supabase.channel(`rideon-tracking-${requestId}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'mechanic_locations',filter:`roadside_request_id=eq.${requestId}`},payload=>updateMechanicMarker(payload.new)).subscribe();
  }
  function updateMechanicMarker(loc){
    if(!state.trackingMap || !window.L)return;
    const p=[loc.lat,loc.lng];
    if(!state.mechanicMarker) state.mechanicMarker=L.marker(p).addTo(state.trackingMap).bindPopup('RIDEON Mechanic'); else state.mechanicMarker.setLatLng(p);
    state.trackingMap.panTo(p,{animate:true});
    const c=$('#liveCoords'); if(c)c.textContent=`${Number(loc.lat).toFixed(5)}, ${Number(loc.lng).toFixed(5)} ±${Math.round(loc.accuracy_m||0)}m`;
  }

  async function renderStaffDispatchPanel(){
    const ops=$('#ops'); if(!ops || $('#staffDispatchPanel'))return;
    const div=document.createElement('div'); div.id='staffDispatchPanel'; div.className='card'; div.style.marginTop='16px';
    div.innerHTML=`<div class="eyebrow">Live dispatch</div><h2 style="margin-top:6px">Assign roadside mechanic</h2><p class="muted">Assign an authenticated mechanic to an active roadside request. The mechanic can then start GPS sharing from their account.</p><div class="grid g2"><div class="field"><label>Roadside request</label><select id="dispatchRequest"></select></div><div class="field"><label>Mechanic</label><select id="dispatchMechanic"></select></div></div><button class="btn primary" id="assignMechanic">Assign & notify</button><div id="dispatchMsg" class="muted tiny" style="margin-top:10px"></div>`;
    ops.appendChild(div);
    const [{data:reqs,error:re},{data:mechs,error:me}] = await Promise.all([
      state.supabase.from('roadside_requests').select('id,issue,status,created_at').in('status',['requested','accepted','en_route','arrived','in_service']).order('created_at',{ascending:false}),
      state.supabase.from('profiles').select('id,full_name,phone').eq('role','mechanic').order('full_name')
    ]);
    if(re||me){$('#dispatchMsg').textContent=(re||me).message;return;}
    $('#dispatchRequest').innerHTML=(reqs||[]).map(r=>`<option value="${r.id}">${r.id.slice(0,8)} · ${esc(r.issue)} · ${esc(r.status)}</option>`).join('')||'<option value="">No active requests</option>';
    $('#dispatchMechanic').innerHTML=(mechs||[]).map(m=>`<option value="${m.id}">${esc(m.full_name)}${m.phone?' · '+esc(m.phone):''}</option>`).join('')||'<option value="">No mechanic accounts</option>';
    $('#assignMechanic').onclick=async()=>{
      const requestId=$('#dispatchRequest').value, mechanicId=$('#dispatchMechanic').value; if(!requestId||!mechanicId)return;
      const {error}=await state.supabase.from('roadside_requests').update({assigned_mechanic_id:mechanicId,status:'accepted'}).eq('id',requestId);
      $('#dispatchMsg').textContent=error?error.message:'Mechanic assigned. Ask them to start live GPS sharing.';
    };
  }

  function renderMechanicPanel(){
    const ops=$('#ops'); if(!ops || $('#mechanicPanel'))return;
    const div=document.createElement('div'); div.id='mechanicPanel'; div.className='card'; div.style.marginTop='16px'; div.innerHTML=`<div class="eyebrow">Mechanic mode</div><h2 style="margin-top:6px">Live GPS sharing</h2><p class="muted">Enter the assigned roadside request ID. The customer's RIDEON screen will receive your location in real time while sharing is active.</p><div class="grid g2"><div class="field"><label>Roadside request ID</label><input id="mechanicRequestId" placeholder="UUID from the assigned job"></div><div class="form-actions" style="align-items:end"><button class="btn primary" id="startGps">Start live tracking</button><button class="btn danger" id="stopGps">Stop</button></div></div><div id="mechanicGpsStatus" class="muted tiny"></div>`; ops.appendChild(div);
    $('#startGps').onclick=startMechanicTracking; $('#stopGps').onclick=stopMechanicTracking;
  }
  async function startMechanicTracking(){
    const requestId=$('#mechanicRequestId').value.trim(); if(!requestId)return toast('Enter a roadside request ID.');
    const {data:req,error}=await state.supabase.from('roadside_requests').select('id,assigned_mechanic_id').eq('id',requestId).single();
    if(error||!req||req.assigned_mechanic_id!==state.user.id)return toast('This request is not assigned to your mechanic account.');
    if(!navigator.geolocation)return toast('GPS is not supported by this browser.');
    stopMechanicTracking();
    state.watchId=navigator.geolocation.watchPosition(async pos=>{
      const {error:e}=await state.supabase.from('mechanic_locations').insert({roadside_request_id:requestId,mechanic_id:state.user.id,lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy_m:pos.coords.accuracy});
      if(e) console.warn(e); else {$('#mechanicGpsStatus').textContent=`Live: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)} ±${Math.round(pos.coords.accuracy)}m`;}
    },err=>$('#mechanicGpsStatus').textContent=`GPS error: ${err.message}`,{enableHighAccuracy:true,maximumAge:3000,timeout:15000});
    await state.supabase.from('roadside_requests').update({status:'en_route'}).eq('id',requestId).eq('assigned_mechanic_id',state.user.id);
  }
  function stopMechanicTracking(){ if(state.watchId!==null){navigator.geolocation.clearWatch(state.watchId);state.watchId=null;} if($('#mechanicGpsStatus'))$('#mechanicGpsStatus').textContent='GPS sharing stopped.'; }


  async function renderConsultHistory(){
    const host=$('#consultHistory'); if(!host||!state.user)return;
    const {data,error}=await state.supabase.from('support_messages').select('*').eq('customer_id',state.user.id).order('created_at',{ascending:false}).limit(10);
    if(error){host.innerHTML='<div class="empty">Riwayat konsultasi belum tersedia.</div>';return;}
    if(!data?.length){host.innerHTML='<div class="empty">Belum ada konsultasi.</div>';return;}
    host.innerHTML=data.map(x=>{
      const status=x.status==='resolved'?'Selesai':x.status==='in_progress'?'Sedang ditangani':'Menunggu CS';
      return `<div class="row"><div><strong>${esc(x.category)}</strong><div class="muted tiny">${new Date(x.created_at).toLocaleString('id-ID')} · ${status}</div><div class="muted tiny">${esc(x.message)}</div>${x.staff_reply?`<div style="margin-top:6px"><span class="pill">Balasan CS</span><div class="muted tiny">${esc(x.staff_reply)}</div></div>`:''}</div><span class="pill ${x.status==='resolved'?'':'amber'}">${status}</span></div>`;
    }).join('');
  }
  async function submitConsultation(e){
    e.preventDefault();
    if(!state.user){toast('Silakan login terlebih dahulu.');return;}
    const payload={customer_id:state.user.id,motorcycle:$('#consultBike').value,category:$('#consultCategory').value,message:$('#consultText').value.trim(),urgency:$('#consultUrgency').value};
    if(!payload.message)return;
    const {error}=await state.supabase.from('support_messages').insert(payload);
    if(error){toast(error.message);return;}
    e.target.reset(); await renderConsultHistory(); toast('Konsultasi terkirim ke Customer Service RIDEON.');
  }
  async function renderSupportInbox(){
    const ops=$('#ops'); if(!ops || !['mechanic','workshop','admin'].includes(state.profile?.role) || $('#supportInbox'))return;
    const div=document.createElement('div'); div.id='supportInbox'; div.className='card'; div.style.marginTop='16px';
    div.innerHTML=`<div class="eyebrow">Customer service</div><h2 style="margin-top:6px">Consultation inbox</h2><div id="supportInboxBody" class="table-wrap"><div class="empty">Loading…</div></div>`;
    ops.appendChild(div);
    const {data,error}=await state.supabase.from('support_messages').select('*,profiles:customer_id(full_name,phone)').order('created_at',{ascending:false}).limit(50);
    const body=$('#supportInboxBody');
    if(error){body.innerHTML=`<div class="empty">${esc(error.message)}</div>`;return;}
    body.innerHTML=(data||[]).map(x=>`<div class="row" style="align-items:flex-start"><div><strong>${esc(x.profiles?.full_name||'Customer')}</strong><div class="muted tiny">${new Date(x.created_at).toLocaleString('id-ID')} · ${esc(x.category)} · ${esc(x.urgency)}</div><div style="margin-top:5px">${esc(x.message)}</div>${x.staff_reply?`<div class="muted tiny" style="margin-top:5px">Balasan: ${esc(x.staff_reply)}</div>`:''}</div><div style="min-width:170px"><select data-support-status="${x.id}" style="width:100%;background:#081410;border:1px solid #29453b;color:#f3f7f4;border-radius:9px;padding:7px"><option value="new" ${x.status==='new'?'selected':''}>Menunggu</option><option value="in_progress" ${x.status==='in_progress'?'selected':''}>Sedang ditangani</option><option value="resolved" ${x.status==='resolved'?'selected':''}>Selesai</option></select><textarea data-support-reply="${x.id}" placeholder="Balasan CS" style="width:100%;margin-top:6px;min-height:55px;background:#081410;border:1px solid #29453b;color:#f3f7f4;border-radius:9px;padding:7px">${esc(x.staff_reply||'')}</textarea><button class="btn small primary" data-support-save="${x.id}" style="margin-top:6px">Simpan</button></div></div>`).join('')||'<div class="empty">Belum ada konsultasi.</div>';
    body.querySelectorAll('[data-support-save]').forEach(b=>b.onclick=async()=>{
      const id=b.dataset.supportSave, status=body.querySelector(`[data-support-status="${id}"]`).value, staff_reply=body.querySelector(`[data-support-reply="${id}"]`).value.trim();
      const {error:e}=await state.supabase.from('support_messages').update({status,staff_reply}).eq('id',id);
      if(e)toast(e.message);else{toast('Balasan CS tersimpan.');renderSupportInbox();}
    });
  }

  function bindProduction(){
    document.addEventListener('submit',e=>{
      if(e.target?.id==='bookingForm'){e.preventDefault();e.stopImmediatePropagation();onBookingSubmit(e.target);}
      if(e.target?.id==='profileForm'){e.preventDefault();e.stopImmediatePropagation();saveProfile();}
      if(e.target?.id==='consultForm'){e.preventDefault();e.stopImmediatePropagation();submitConsultation(e.target);}
    },true);
    document.addEventListener('click',e=>{
      const btn=e.target.closest('[data-page]');
      if(!btn)return;
      if(btn.dataset.page==='booking') setTimeout(()=>{findNearbyWorkshops(); if(state.workshopMap)state.workshopMap.invalidateSize();},250);
      if(btn.dataset.page==='rescue') setTimeout(()=>{if(state.rescueMap)state.rescueMap.invalidateSize();},250);
      if(btn.dataset.page==='consult') setTimeout(renderConsultHistory,50);
    },true);
    const host=document.querySelector('#rescue .grid.g2 > div:last-child'); if(host && !$('#liveTrackingHost')){const d=document.createElement('div');d.id='liveTrackingHost';host.appendChild(d);}
  }
  async function saveProfile(){ const full_name=$('#profileName').value.trim(), phone=$('#profilePhone').value.trim(); const {error}=await state.supabase.from('profiles').update({full_name,phone}).eq('id',state.user.id); if(error)toast(error.message);else{toast('Profile saved.');loadProfile();} }

  async function init(){
    injectUI();
    try{
      if(!window.supabase){throw new Error('Supabase browser library did not load.');}
      let cfgResp=await fetch('/api/config',{cache:'no-store'});
      let cfg={};
      try{ cfg=await cfgResp.json(); }catch(e){}
      if(!cfg.supabaseUrl || !cfg.supabaseAnonKey){
        const healthResp=await fetch('/api/health',{cache:'no-store'});
        try{ cfg=await healthResp.json(); }catch(e){}
      }
      if(!cfg.supabaseUrl || !cfg.supabaseAnonKey){throw new Error(cfg.error||'Supabase configuration is unavailable. Check /api/config and Vercel environment variables.');}
      state.config=cfg;
      try{ sessionStorage.removeItem('rideon_last_activity'); }catch(e){}
      document.documentElement.classList.add('rideon-auth-boot');
      state.supabase=window.supabase.createClient(state.config.supabaseUrl,state.config.supabaseAnonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'rideon-auth-v8'}});
      bindProduction();
      state.supabase.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>handleSession(session),0)});
      await handleSession(null);
    }catch(e){ document.documentElement.classList.remove('rideon-auth-boot'); document.body.classList.remove('auth-loading'); const auth=$('#productionAuth'); if(auth) auth.style.display='grid'; const msg=$('#authMsg'); if(msg) msg.textContent=`Setup required: ${e.message}`; console.error(e); }
  }
  window.addEventListener('DOMContentLoaded',init);
})();
