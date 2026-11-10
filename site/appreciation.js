const supportButton = document.getElementById('author-support-button');
const supportDialog = document.getElementById('author-support-dialog');
const dialogClover = supportButton.querySelector('.support-clover').cloneNode(true);
supportDialog.querySelector('h2').prepend(dialogClover);
let supportOpening = false;
supportButton.addEventListener('click', () => {
  if (supportOpening || supportDialog.open) return;
  supportOpening = true;
  supportButton.classList.add('is-active');
  const delay = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180;
  setTimeout(() => {
    supportDialog.showModal();
    supportButton.setAttribute('aria-expanded', 'true');
    supportOpening = false;
  }, delay);
});
supportDialog.addEventListener('close', () => {
  supportButton.classList.remove('is-active');
  supportButton.setAttribute('aria-expanded', 'false');
});
supportDialog.querySelector('.appreciation-close').addEventListener('click', () => supportDialog.close());
supportDialog.addEventListener('click', event => {
  if (event.target !== supportDialog) return;
  const box = supportDialog.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) supportDialog.close();
});
