// email.js — assemble contact addresses at runtime to reduce harvesting
(function () {
  var u = 'davidcarltonadams', d = 'gmail.com', addr = u + '@' + d;

  var fe = document.getElementById('footer-email');
  if (fe) { fe.href = 'mailto:' + addr; fe.textContent = addr; }

  var ce = document.getElementById('contact-email');
  if (ce) { ce.href = 'mailto:' + addr; ce.textContent = addr; }

  var le = document.getElementById('lessons-email');
  if (le) { le.href = 'mailto:' + addr + '?subject=Private%20Lesson%20Inquiry'; }
}());
