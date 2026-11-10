(() => {
 const sidebar=document.querySelector('.sidebar');
 const panel=document.getElementById('sidebar-panel');
 const toggle=document.getElementById('mobile-nav-toggle');
 const backdrop=document.getElementById('mobile-nav-backdrop');
 const page=document.querySelector('.page');
 const mobile=matchMedia('(max-width:900px)');
 let opened=false;
 function setOpen(value,returnFocus=true){
  opened=mobile.matches&&value;
  sidebar.classList.toggle('is-menu-open',opened);
  document.body.classList.toggle('mobile-menu-open',opened);
  toggle.setAttribute('aria-expanded',String(opened));
  toggle.setAttribute('aria-label',opened?'关闭菜单':'打开菜单');
  backdrop.hidden=!opened;
  panel.inert=mobile.matches&&!opened;
  page.inert=opened;
  document.getElementById('back-to-top').inert=opened;
  if(opened){
   sidebar.setAttribute('role','dialog');sidebar.setAttribute('aria-modal','true');sidebar.setAttribute('aria-label','导航菜单');
   (panel.querySelector('.nav-link.active')||toggle).focus({preventScroll:true});
  }else{
   sidebar.removeAttribute('role');sidebar.removeAttribute('aria-modal');sidebar.removeAttribute('aria-label');
   if(returnFocus&&mobile.matches)toggle.focus({preventScroll:true});
  }
 }
 toggle.addEventListener('click',()=>setOpen(!opened));
 backdrop.addEventListener('click',()=>setOpen(false));
 sidebar.addEventListener('click',event=>{
  if(opened&&event.target.closest('[data-view],#edit-preferences,a[href="#method"],.brand,#author-support-button'))setOpen(false);
 });
 document.getElementById('preferences-form').addEventListener('submit',()=>setOpen(false,false));
 document.addEventListener('keydown',event=>{
  if(!opened)return;
  if(event.key==='Escape'){event.preventDefault();setOpen(false);return;}
  if(event.key==='Tab'){
   const focusable=[...sidebar.querySelectorAll('a[href],button:not([disabled]),[tabindex="0"]')].filter(el=>el.getClientRects().length&&!el.closest('[hidden]'));
   const first=focusable[0],last=focusable.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
 });
 mobile.addEventListener('change',()=>setOpen(false,false));
 setOpen(false,false);
})();
