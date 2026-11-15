const $ = selector => document.querySelector(selector);
const bySlug = new Map(catalogue.map(p => [p.slug, p]));
const categories = ['All', ...new Set(catalogue.map(p => p.category))];
const value = pennies => new Intl.NumberFormat('en-GB', {
  style: 'currency', currency: 'GBP', minimumFractionDigits: pennies % 100 ? 2 : 0
}).format(pennies / 100);
const imagePath = p => 'assets/' + p.slug + '.webp';
let category = 'All';
let timer;
let productTrigger;
const cartKey = 'vaelor.demo.basket.v1';
const cart = new Map();
try {
  const saved = JSON.parse(localStorage.getItem(cartKey) || '[]');
  for (const [key, qty] of saved) {
    const [slug,size] = key.split('/');
    const p = bySlug.get(slug);
    if (p && Number.isInteger(qty) && qty > 0 && qty <= 99 &&
        (p.sizes.length ? p.sizes.includes(size) : key === slug)) cart.set(key,qty);
  }
} catch { /* Browsing still works when storage is unavailable. */ }

function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function action(label, className, click) {
  const b = element('button',className,label);
  b.addEventListener('click',click);
  return b;
}
function photo(p,lazy = true) {
  const img = element('img','product-photo');
  img.src = imagePath(p);
  img.alt = '';
  if (lazy) img.loading = 'lazy';
  return img;
}
function productLink(p, className, label) {
  const a = element('a',className,label);
  a.href = '#product/' + p.slug;
  a.addEventListener('click',() => { productTrigger = a; });
  return a;
}
function renderProducts() {
  const q = $('#search').value.trim().toLowerCase();
  const found = catalogue.filter(p => (category === 'All' || p.category === category) &&
    (p.name + ' ' + p.category).toLowerCase().includes(q));
  const cards = found.map(p => {
    const article = element('article','product');
    const a = productLink(p,'photo');
    a.setAttribute('aria-label','View ' + p.name);
    a.append(photo(p));
    const info = element('div','product-info');
    info.append(productLink(p,'product-name',p.name),element('span','price',value(p.price)));
    const quick = p.sizes.length ? productLink(p,'quick','Choose size') :
      action('Add to bag','quick',() => changeQuantity(p.slug,1,true));
    article.append(a,info,quick);
    return article;
  });
  $('#products').replaceChildren(...cards);
  $('#result-count').textContent = found.length + (found.length === 1 ? ' piece' : ' pieces');
  $('#no-match').hidden = found.length !== 0;
}
function selectCategory(name) {
  category = name;
  for (const b of $('#filters').children) b.setAttribute('aria-pressed',String(b.textContent === name));
  renderProducts();
}
for (const name of categories) $('#filters').append(action(name,'filter',() => selectCategory(name)));
$('#search').addEventListener('input',renderProducts);
$('#reset').onclick = () => { $('#search').value = ''; selectCategory('All'); };

function setMenu(open) {
  $('#mobile-links').hidden = !open;
  $('#menu-button').setAttribute('aria-expanded',String(open));
  $('#menu-button').setAttribute('aria-label',open ? 'Close menu' : 'Open menu');
}
$('#menu-button').onclick = () => setMenu($('#mobile-links').hidden);
document.addEventListener('click', e => {
  if (e.target.closest('#mobile-links a') || !e.target.closest('header')) setMenu(false);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#mobile-links').hidden) { setMenu(false); $('#menu-button').focus(); }
});
matchMedia('(min-width:651px)').addEventListener('change',() => setMenu(false));
$('#find').onclick = () => {
  setMenu(false); $('#search').value = ''; selectCategory('All');
  $('#shop').scrollIntoView(); $('#search').focus({preventScroll:true});
};

function notify(message) {
  $('#toast').textContent = message;
  clearTimeout(timer);
  timer = setTimeout(() => { $('#toast').textContent = ''; },2000);
}
function changeQuantity(key,delta,showMessage = false) {
  const quantity = Math.min(99,(cart.get(key) || 0) + delta);
  if (quantity <= 0) cart.delete(key); else cart.set(key,quantity);
  try { localStorage.setItem(cartKey,JSON.stringify([...cart])); } catch {}
  renderCart();
  if (showMessage) notify('Added to your bag');
}
function renderCart() {
  let count = 0, subtotal = 0;
  const list = $('#cart-list');
  list.replaceChildren();
  for (const [key,qty] of cart) {
    const [slug,size] = key.split('/');
    const p = bySlug.get(slug);
    subtotal += p.price * qty; count += qty;
    const row = element('div','cart-row'), copy = element('div');
    const quantity = element('div','qty');
    const minus = action('−','',() => changeQuantity(key,-1));
    const plus = action('+','',() => changeQuantity(key,1));
    minus.setAttribute('aria-label','Remove one ' + p.name);
    plus.setAttribute('aria-label','Add one ' + p.name); plus.disabled = qty >= 99;
    quantity.append(minus,element('span','',qty),plus);
    copy.append(element('strong','',p.name),element('div','meta',(size ? 'UK '+size+' · ' : '') + value(p.price)),quantity);
    row.append(photo(p,false),copy,element('span','price',value(p.price * qty))); list.append(row);
  }
  if (!count) list.append(element('p','empty','Your bag is empty.'));
  $('#count').textContent = count;
  $('#subtotal').textContent = value(subtotal);
}
const detailDialog = $('#product-dialog'), bagDialog = $('#basket-dialog');
function openBag() {
  setMenu(false); if (detailDialog.open) closeProduct();
  if (!bagDialog.open) bagDialog.showModal();
}
$('#bag').onclick = openBag;
function openProduct(p) {
  const grid = element('div','detail-grid'), copy = element('div');
  const title = element('h2','',p.name); title.id = 'product-title';
  copy.append(element('p','kicker',p.category),title,element('p','',value(p.price)),element('p','',p.description));
  const size = element('select');
  if (p.sizes.length) {
    const label = element('label','','UK shoe size ');
    for (const s of p.sizes) size.add(new Option(s,s));
    label.append(size); copy.append(label);
  }
  copy.append(element('p','notice','Concept image and proposed price.'),
    action('Add to bag','button',() => {
      changeQuantity(p.slug + (p.sizes.length ? '/'+size.value : ''),1);
      openBag();
    }));
  const img = photo(p,false); img.alt = p.name + ' concept image';
  grid.append(img,copy); $('#detail').replaceChildren(grid);
  if (!detailDialog.open) detailDialog.showModal();
  detailDialog.scrollTop = 0;
}
function closeProduct() {
  if (detailDialog.open) detailDialog.close();
  if (location.hash.startsWith('#product/')) history.replaceState(null,'',location.pathname + location.search + '#shop');
  if (productTrigger?.isConnected) productTrigger.focus({preventScroll:true});
}
function route() {
  const slug = location.hash.startsWith('#product/') && location.hash.slice(9);
  if (bySlug.has(slug)) openProduct(bySlug.get(slug));
  else if (detailDialog.open) detailDialog.close();
}
detailDialog.querySelector('.close').onclick = closeProduct;
detailDialog.addEventListener('cancel',e => { e.preventDefault(); closeProduct(); });
bagDialog.querySelector('.close').onclick = () => bagDialog.close();
bagDialog.querySelector('.continue').onclick = () => bagDialog.close();
for (const d of [detailDialog,bagDialog]) d.addEventListener('click', e => {
  if (e.target !== d) return;
  const r = d.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
    d === detailDialog ? closeProduct() : d.close();
});
window.addEventListener('hashchange',route);
selectCategory('All'); renderCart(); route();
