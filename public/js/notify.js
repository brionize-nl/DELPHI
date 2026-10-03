function updateNotificationStatus() {
  const supported = 'Notification' in window && window.isSecureContext;
  $('#notification-status').textContent = supported ? ({default:'Meldingen nog niet toegestaan',granted:'Meldingen toegestaan',denied:'Meldingen geblokkeerd in browserinstellingen'}[Notification.permission]) : 'Meldingen worden niet ondersteund in deze browser';
  $('#btn-notifications').disabled = !supported || Notification.permission === 'denied';
}
$('#btn-notifications').addEventListener('click', async () => {
  try { if (Notification.permission !== 'granted') await Notification.requestPermission(); updateNotificationStatus(); }
  catch(e) { $('#notification-status').textContent=e.message; }
});
$('#notifications-enabled').checked = getSetting('notifications', 'on') === 'on';
$('#notifications-enabled').addEventListener('change',()=>setSetting('notifications',$('#notifications-enabled').checked?'on':'off'));
async function notifyCompletion(title, body, duration = 0, always = false) {
  if (!always && duration < 30000) return;
  if (!('Notification' in window) || Notification.permission !== 'granted' || getSetting('notifications','on') !== 'on') return;
  try {
    const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    const options={body,icon:'/icon-192.svg',tag:'delphi-'+title,data:{url:'/'}};
    if (registration?.active) await registration.showNotification('DELPHI — '+title,options);
    else new Notification('DELPHI — '+title,options);
  } catch(e) { logError('notify', e); $('#notification-status').textContent='Melding niet verstuurd: '+e.message; }
}
updateNotificationStatus();
