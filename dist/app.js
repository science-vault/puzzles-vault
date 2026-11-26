const $ = name => document.getElementById(name);
const labels = { area:'Learning area', subject:'Subject', years:'Year', strand:'Strand', topic:'Topic', type:'Resource type', collection:'Collection' };
const fields = Object.keys(labels);
const collator = new Intl.Collator('en-AU', {numeric:true,sensitivity:'base'});
const menus = new Map(fields.map(field => {
  const label = document.createElement('label');
  label.textContent = labels[field];
  const menu = document.createElement('select');
  label.append(menu);
  $('filters').append(label);
  return [field, menu];
}));
let catalogue = [];
let page = 1;
const values = (row, field) => [row[field]].flat().map(String);
const norm = value => String(value).toLowerCase().normalize('NFKD').replace(/\p{M}|['’]/gu,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
function match(row, text, terms) {
  const title = ' ' + norm(row.title) + ' ';
  const topic = ' ' + norm(row.topic) + ' ';
  const other = ' ' + norm([row.strand,row.area,row.subject,row.collection,...row.keywords].join(' ')) + ' ';
  const scores = terms.map(term => title.includes(' '+term+' ') ? 8 : topic.includes(' '+term+' ') ? 5 : other.includes(' '+term+' ') ? 2 : 0);
  if (scores.includes(0)) return -1;
  return scores.reduce((sum, score) => sum + score, 0) + (text && title.includes(' '+text+' ') ? 20 : 0);
}
function card(row) {
  const article = document.createElement('article');
  const meta = document.createElement('p');
  meta.className = 'meta';
  meta.textContent = (row.years.length === 1 ? 'Year ' : 'Years ') + row.years.join(', ') + ' · ' + row.subject + ' · ' + row.type;
  const title = document.createElement('h2');
  title.textContent = row.title;
  const topic = document.createElement('p');
  topic.className = 'topic';
  topic.textContent = row.topic;
  const actions = document.createElement('div');
  actions.className = 'actions';
  const answerLinks = row.answerPages?.length
    ? row.answerPages.map(page => [row.answerPages.length > 1 ? 'Answers p. '+page : 'Answers', row.answer+'#page='+page])
    : row.answer ? [['Answers', row.answer]] : [];
  for (const [name, href] of [['Open puzzle', row.file], ...answerLinks]) {
    const link = document.createElement('a');
    link.textContent = name;
    link.setAttribute('aria-label', name+' for '+row.title);
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener';
    actions.append(link);
  }
  if (row.preview) {
    const preview = document.createElement('a');
    preview.className = 'preview';
    preview.href = row.file;
    preview.target = '_blank';
    preview.rel = 'noopener';
    preview.setAttribute('aria-label', 'Open '+row.title+' PDF');
    const image = document.createElement('img');
    image.src = row.preview;
    image.alt = 'First page of '+row.title;
    image.width = row.previewWidth;
    image.height = row.previewHeight;
    image.loading = 'lazy';
    image.decoding = 'async';
    preview.append(image);
    article.append(preview);
  }
  article.append(meta,title,topic,actions);
  return article;
}
function comparePuzzles(a, b) {
  const titleOrder = () => collator.compare(a.title, b.title);
  if ($('sort').value === 'title') return titleOrder();
  return a.years[0] - b.years[0] || collator.compare(a.subject, b.subject)
    || collator.compare(a.strand, b.strand) || collator.compare(a.topic, b.topic) || titleOrder();
}
function render() {
  let results = catalogue;
  for (const [field, menu] of menus) {
    const previous = menu.value;
    const options = [...new Set(results.flatMap(row=>values(row,field)))].sort(collator.compare);
    menu.replaceChildren(new Option('All', ''), ...options.map(value=>new Option(field==='years'?'Year '+value:value,value)));
    if (options.includes(previous)) {
      menu.value = previous;
      results = results.filter(row=>values(row,field).includes(previous));
    }
  }
  const query = $('query').value;
  const years = [...query.matchAll(/\b(?:yr|year)\s*(\d{1,2})\b/gi)].map(m=>Number(m[1]));
  const text = norm(query.replace(/\b(?:yr|year)\s*\d{1,2}\b/gi,''));
  const terms = text.split(' ').filter(term=>term && !['and','of','the','a','in','on','for'].includes(term));
  const rows = results.filter(row=>years.every(y=>row.years.includes(y)))
    .map(row=>({row,score:match(row,text,terms)}))
    .filter(result=>result.score>=0)
    .sort((a,b)=>b.score-a.score || comparePuzzles(a.row,b.row)).map(result=>result.row);
  const size=Number($('size').value);
  const pages=Math.max(1,Math.ceil(rows.length/size));
  page=Math.min(page,pages);
  const start=(page-1)*size;
  $('results').replaceChildren(...rows.slice(start,start+size).map(card));
  $('status').textContent = rows.length ? 'Showing '+(start+1)+'–'+Math.min(start+size,rows.length)+' of '+rows.length+' puzzles' : 'No puzzles match your search and filters.';
  $('pages').hidden=pages===1;
  $('page').textContent=page+' of '+pages;
  $('prev').disabled=page===1;
  $('next').disabled=page===pages;
}
function resetPage(){ page=1; render(); }
for (const menu of menus.values()) menu.addEventListener('change',resetPage);
$('query').addEventListener('input',resetPage);
$('size').addEventListener('change',resetPage);
$('sort').addEventListener('change',resetPage);
$('clear').addEventListener('click',()=>{ $('query').value=''; for(const menu of menus.values()) menu.value=''; resetPage(); });
for(const [id,delta] of [['prev',-1],['next',1]]) $(id).addEventListener('click',()=>{ page+=delta;render();$('status').scrollIntoView({block:'nearest'}); });
try {
  const response=await fetch('catalogue.json');
  if(!response.ok) throw Error('Catalogue returned '+response.status);
  catalogue=await response.json();
  render();
} catch(error) {
  $('status').textContent='The puzzle catalogue could not load. Refresh to try again.';
  console.error(error);
}
