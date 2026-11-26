const hubOrigins = new Set([
  'https://science-vault-resource-hub.jjdcruz27.chatgpt.site',
  'https://science-vault.github.io',
]);
const origin = new URL(location.href).searchParams.get('hub');

if (window.parent !== window && hubOrigins.has(origin)) {
  try {
    const response = await fetch('catalogue.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error('Catalogue unavailable');
    const catalogue = await response.json();
    if (!Array.isArray(catalogue)) throw new Error('Invalid catalogue');
    window.parent.postMessage({ type: 'puzzles-vault-count', count: catalogue.length }, origin);
  } catch {
    window.parent.postMessage({ type: 'puzzles-vault-count', count: null }, origin);
  }
}
