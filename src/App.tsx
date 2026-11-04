import { createMemo, createSignal, For, Show, onMount } from 'solid-js';
import { useLocale, type Preference } from './locale';
import { formatMoney, parseMoney, splitBill, type BillItem, type Participant } from './core';

type Stage = 'bill' | 'people' | 'split';
type Candidate = { id: string; name: string; quantity: number; unitCents: number };
const STORAGE_KEY = 'plunz-split-draft-v1';
const newId = () => crypto.randomUUID();
const moneyInput = (cents: number) => (cents / 100).toFixed(2);

async function preparePhoto(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare this photo.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) throw new Error('Could not prepare this photo.');
    return new File([blob], 'receipt.jpg', { type: 'image/jpeg' });
  } finally { bitmap.close(); }
}

export default function App() {
  const { preference, t, changeLanguage } = useLocale();
  const [stage, setStage] = createSignal<Stage>('bill');
  const [billName, setBillName] = createSignal('');
  const [receiptTotal, setReceiptTotal] = createSignal('');
  const [items, setItems] = createSignal<BillItem[]>([]);
  const [people, setPeople] = createSignal<Participant[]>([]);
  const [candidates, setCandidates] = createSignal<Candidate[]>([]);
  const [scanBusy, setScanBusy] = createSignal(false);
  const [scanError, setScanError] = createSignal('');
  const [scanWarnings, setScanWarnings] = createSignal<string[]>([]);
  const [copyStatus, setCopyStatus] = createSignal('');
  const [storageAvailable, setStorageAvailable] = createSignal(true);
  const [loaded, setLoaded] = createSignal(false);
  const totals = createMemo(() => splitBill(items(), people()));
  const totalMismatch = createMemo(() => receiptTotal().trim() !== '' && parseMoney(receiptTotal()) !== totals().totalCents);
  const isComplete = createMemo(() => items().length > 0 && people().length > 0 && totals().unassigned.length === 0 && !totalMismatch());

  onMount(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { billName?: unknown; receiptTotal?: unknown; items?: unknown; people?: unknown; savedAt?: unknown };
        if (typeof saved.savedAt === 'number' && Date.now() - saved.savedAt < 7 * 24 * 60 * 60 * 1000 && Array.isArray(saved.items) && Array.isArray(saved.people)) {
          setBillName(typeof saved.billName === 'string' ? saved.billName : '');
          setReceiptTotal(typeof saved.receiptTotal === 'string' ? saved.receiptTotal : '');
          setItems(saved.items.filter(isBillItem));
          setPeople(saved.people.filter(isParticipant));
        } else localStorage.removeItem(STORAGE_KEY);
      }
    } catch { setStorageAvailable(false); }
    setLoaded(true);
  });

  const persist = () => {
    if (!loaded()) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ billName: billName(), receiptTotal: receiptTotal(), items: items(), people: people(), savedAt: Date.now() })); setStorageAvailable(true); }
    catch { setStorageAvailable(false); }
  };
  const updateName = (value: string) => { setBillName(value); persist(); };
  const updateReceiptTotal = (value: string) => { setReceiptTotal(value); persist(); };
  const updateItems = (next: BillItem[]) => { setItems(next); persist(); };
  const updatePeople = (next: Participant[]) => { setPeople(next); persist(); };
  const patchItem = (id: string, patch: Partial<BillItem>) => updateItems(items().map(item => item.id === id ? { ...item, ...patch } : item));
  const patchPerson = (id: string, name: string) => updatePeople(people().map(person => person.id === id ? { ...person, name } : person));
  const addItem = () => updateItems([...items(), { id: newId(), name: '', quantity: 1, unitCents: 0, assignedTo: [] }]);
  const addPerson = () => updatePeople([...people(), { id: newId(), name: '' }]);
  const removePerson = (id: string) => { updatePeople(people().filter(person => person.id !== id)); updateItems(items().map(item => ({ ...item, assignedTo: item.assignedTo.filter(personId => personId !== id) }))); };
  const toggle = (item: BillItem, personId: string) => patchItem(item.id, { assignedTo: item.assignedTo.includes(personId) ? item.assignedTo.filter(id => id !== personId) : [...item.assignedTo, personId] });
  const toggleAll = (item: BillItem) => patchItem(item.id, { assignedTo: item.assignedTo.length === people().length ? [] : people().map(person => person.id) });
  const clear = () => {
    if (!confirm(t('Start a new bill? This will remove the current draft from this device.'))) return;
    setBillName(''); setReceiptTotal(''); setItems([]); setPeople([]); setCandidates([]); setStage('bill');
    try { localStorage.removeItem(STORAGE_KEY); } catch { setStorageAvailable(false); }
  };
  const scan = async (file?: File) => {
    if (!file) return;
    setScanError(''); setScanWarnings([]);
    if (!navigator.onLine) { setScanError('You are offline. Connect to scan a receipt, or enter items manually.'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setScanError('Choose a receipt photo in JPG, PNG, or WebP format.'); return; }
    setScanBusy(true);
    try {
      const photo = await preparePhoto(file);
      if (photo.size > 4 * 1024 * 1024) throw new Error('This photo is too large after preparation. Try a smaller image.');
      const form = new FormData(); form.append('image', photo);
      const response = await fetch('/api/scan', { method: 'POST', body: form });
      const data = await response.json() as { items?: Array<{ name: string; quantity: number; unitCents: number }>; warnings?: string[]; error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not read this photo.');
      const valid = (data.items ?? []).filter(row => typeof row.name === 'string' && row.name.trim() && Number.isInteger(row.quantity) && row.quantity > 0 && Number.isInteger(row.unitCents) && row.unitCents >= 0);
      if (!valid.length) throw new Error('No items were found. Try a clearer photo or add them manually.');
      setCandidates(valid.map(row => ({ ...row, id: newId() }))); setScanWarnings(data.warnings ?? []);
    } catch (error) { setScanError(error instanceof Error ? error.message : 'Could not read this photo.'); }
    finally { setScanBusy(false); }
  };
  const addCandidates = () => {
    const clean = candidates().filter(row => row.name.trim() && Number.isInteger(row.quantity) && row.quantity > 0 && Number.isInteger(row.unitCents) && row.unitCents >= 0);
    if (clean.length !== candidates().length || clean.length === 0) { setScanError('Correct or remove invalid rows before adding them.'); return; }
    updateItems([...items(), ...clean.map(row => ({ id: newId(), name: row.name.trim(), quantity: row.quantity, unitCents: row.unitCents, assignedTo: [] }))]);
    setCandidates([]); setScanError('');
  };
  const copy = async () => {
    if (!isComplete()) return;
    const lines = [`${billName().trim() || t('Split bill')} — ${formatMoney(totals().totalCents)}`, '', ...people().map(person => `${person.name.trim() || t('Person')}: ${formatMoney(totals().totals[person.id] ?? 0)}`)];
    try { await navigator.clipboard.writeText(lines.join('\n')); setCopyStatus('Copied to clipboard.'); }
    catch { setCopyStatus('Copy is unavailable in this browser.'); }
  };

  return <div class="app-shell">
    <a class="skip-link" href="#main">{t('Skip to content')}</a>
    <header class="topbar"><a href="https://www.plu.nz/" class="brand" aria-label={t('PLUNZ home')}><svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="#0f0f0f"/><path d="M32 6 21 23h8v9h6v-9h8Z" fill="#f6b6ab"/><path d="m32 58 11-17h-8v-9h-6v9h-8Z" fill="#89b4fa"/><path d="M6 32 23 21v8h9v6h-9v8Z" fill="#a6e3a1"/><path d="m58 32-17 11v-8h-9v-6h9v-8Z" fill="#f38ba8"/></svg><span>PLUNZ<span class="brand-dot">.</span></span></a><span class="product-tag">SPLIT / 01</span><label class="language-control"><span>{t('Language')}</span><select aria-label={t('Language')} value={preference()} onChange={event => changeLanguage(event.currentTarget.value as Preference)}><option value="system">{t('System language')}</option><option value="en">English</option><option value="pt">Português</option><option value="es">Español</option></select></label></header>
    <main id="main" class="main-content">
      <div class="intro"><div class="eyebrow"><span class="eyebrow-line"/>{t('THE SIMPLE BILL SPLITTER')}</div><h1>{t('Split the bill.')}<br/><em>{t('Keep it fair.')}</em></h1><p>{t('Scan a receipt or enter items, add your people, and see exactly who owes what. No account needed.')}</p></div>
      <div class="progress" aria-label={t('Steps')}><span classList={{ active: stage() === 'bill' }}>01 <b>{t('Bill')}</b></span><span classList={{ active: stage() === 'people' }}>02 <b>{t('People')}</b></span><span classList={{ active: stage() === 'split' }}>03 <b>{t('Split')}</b></span></div>

      <Show when={stage() === 'bill'}><section class="workspace" aria-labelledby="bill-heading">
        <div class="section-head"><div><p class="section-kicker">{t('STEP 01 / YOUR BILL')}</p><h2 id="bill-heading">{t('What’s on the bill?')}</h2></div><span class="step-badge">01</span></div>
        <label class="field-label" for="bill-name">{t('Bill name')} <span>{t('optional')}</span></label><input id="bill-name" class="text-input" type="text" maxlength="80" placeholder={t('Dinner with friends')} value={billName()} onInput={e => updateName(e.currentTarget.value)} />
        <div class="scan-panel"><div class="scan-icon" aria-hidden="true">▣</div><div class="scan-copy"><h3>{t('Digitize a receipt')}</h3><p>{t('Take a photo and AI will suggest the items. You review every amount before it joins the bill.')}</p></div><div class="scan-actions"><label class="scan-button" classList={{ busy: scanBusy() }}>{t('Take photo')}<input class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={scanBusy()} onChange={e => { void scan(e.currentTarget.files?.[0]); e.currentTarget.value = ''; }} /></label><label class="scan-button" classList={{ busy: scanBusy() }}>{t('Choose from gallery')}<input class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={scanBusy()} onChange={e => { void scan(e.currentTarget.files?.[0]); e.currentTarget.value = ''; }} /></label><Show when={scanBusy()}><span class="scan-progress" role="status">{t('Reading receipt…')}</span></Show></div><p class="privacy-note">{t('Your photo is sent to Cloudflare AI for this request. Split does not save it. Enter items manually if you prefer.')}</p></div>
        <Show when={scanError()}><p role="alert" class="alert">{t(scanError())}</p></Show>
        <Show when={candidates().length > 0}><div class="review-panel"><div class="review-head"><div><p class="section-kicker">{t('AI SUGGESTIONS')}</p><h3>{t('Review before adding')}</h3></div><span>{candidates().length} {t('Items').toLowerCase()}</span></div><p class="subtle">{t('Check names, quantities, and prices against your receipt. AI can make mistakes.')}</p><For each={scanWarnings()}>{warning => <p class="warning">{t(warning)}</p>}</For><For each={candidates()}>{candidate => <div class="item-card candidate-card"><div class="item-card-top"><span class="item-index">{t('SUGGESTED ITEM')}</span><button class="text-button danger" type="button" onClick={() => setCandidates(candidates().filter(row => row.id !== candidate.id))}>{t('Remove')}</button></div><div class="item-fields"><label>{t('Name')}<input class="text-input" value={candidate.name} onInput={e => setCandidates(candidates().map(row => row.id === candidate.id ? { ...row, name: e.currentTarget.value } : row))} /></label><label>{t('Qty')}<input class="text-input" type="number" min="1" step="1" value={candidate.quantity} onInput={e => setCandidates(candidates().map(row => row.id === candidate.id ? { ...row, quantity: Number(e.currentTarget.value) } : row))} /></label><label>{t('Unit price')}<input class="text-input" type="text" inputmode="decimal" value={moneyInput(candidate.unitCents)} onChange={e => { const cents = parseMoney(e.currentTarget.value); if (cents !== null) setCandidates(candidates().map(row => row.id === candidate.id ? { ...row, unitCents: cents } : row)); }} /></label></div></div>}</For><div class="review-actions"><button type="button" class="secondary-button" onClick={() => setCandidates([])}>{t('Cancel')}</button><button type="button" class="primary-button" onClick={addCandidates}>{t('Add reviewed items')} <span aria-hidden="true">→</span></button></div></div></Show>
        <div class="list-header"><h3>{t('Items')} <span>{items().length}</span></h3><span>{t('QUANTITY × UNIT PRICE')}</span></div>
        <For each={items()}>{(item, index) => <div class="item-card"><div class="item-card-top"><span class="item-index">{t('ITEM')} {String(index() + 1).padStart(2,'0')}</span><button type="button" class="text-button danger" aria-label={`${t('Remove')} ${item.name || `${t('ITEM')} ${index() + 1}`}`} onClick={() => updateItems(items().filter(row => row.id !== item.id))}>{t('Remove')}</button></div><div class="item-fields"><label>{t('Name')}<input class="text-input" type="text" maxlength="120" placeholder={t('e.g. Pizza')} value={item.name} onInput={e => patchItem(item.id, { name: e.currentTarget.value })} /></label><label>{t('Qty')}<input class="text-input" type="number" min="1" max="999" step="1" value={item.quantity} onChange={e => patchItem(item.id, { quantity: Math.max(1, Math.min(999, Math.trunc(Number(e.currentTarget.value) || 1))) })} /></label><label>{t('Unit price')}<input class="text-input" type="text" inputmode="decimal" value={moneyInput(item.unitCents)} onChange={e => { const cents = parseMoney(e.currentTarget.value); if (cents !== null) patchItem(item.id, { unitCents: cents }); else e.currentTarget.value = moneyInput(item.unitCents); }} /></label></div><div class="item-subtotal">{t('Subtotal')} <strong>{formatMoney(item.quantity * item.unitCents)}</strong></div></div>}</For>
        <button type="button" class="add-button" onClick={addItem}><span aria-hidden="true">+</span> {t('Add an item')}</button><div class="total-row"><span>{t('Bill total')}</span><strong>{formatMoney(totals().totalCents)}</strong></div><label class="field-label receipt-total-label" for="receipt-total">{t('Printed receipt total')} <span>{t('optional check')}</span></label><input id="receipt-total" class="text-input" type="text" inputmode="decimal" placeholder={t('e.g. 23.10')} value={receiptTotal()} onInput={e => updateReceiptTotal(e.currentTarget.value)} /><Show when={totalMismatch()}><p class="warning" role="status">{t('The entered items do not match the printed receipt total. Check for missing fees, taxes, or misread prices.')}</p></Show>
      </section></Show>

      <Show when={stage() === 'people'}><section class="workspace" aria-labelledby="people-heading"><div class="section-head"><div><p class="section-kicker">{t('STEP 02 / THE TABLE')}</p><h2 id="people-heading">{t('Who’s sharing?')}</h2></div><span class="step-badge">02</span></div><p class="subtle">{t('Add each person who owes part of the bill. Names stay on this device.')}</p><For each={people()}>{(person, index) => <div class="person-row"><span class="person-number">{String(index()+1).padStart(2,'0')}</span><label class="sr-only" for={`person-${person.id}`}>{t('Person')} {index()+1} {t('Name')}</label><input id={`person-${person.id}`} class="text-input" type="text" maxlength="60" placeholder={`${t('Person')} ${index()+1}`} value={person.name} onInput={e => patchPerson(person.id, e.currentTarget.value)} /><button class="text-button danger" type="button" aria-label={`${t('Remove')} ${person.name || `${t('Person')} ${index()+1}`}`} onClick={() => removePerson(person.id)}>{t('Remove')}</button></div>}</For><button type="button" class="add-button" onClick={addPerson}><span aria-hidden="true">+</span> {t('Add a person')}</button><div class="hint-card"><span aria-hidden="true">↗</span><p>{t('Shared items can be assigned to several people. We divide every item evenly and keep the total exact to the cent.')}</p></div></section></Show>

      <Show when={stage() === 'split'}><section class="workspace" aria-labelledby="split-heading"><div class="section-head"><div><p class="section-kicker">{t('STEP 03 / THE SPLIT')}</p><h2 id="split-heading">{t('Who had what?')}</h2></div><span class="step-badge">03</span></div><p class="subtle">{t('Choose everyone who shared each item. Use “Everyone” for a common item.')}</p><For each={items()}>{(item, index) => <div class="assignment-card"><div class="assignment-head"><div><span class="item-index">{t('ITEM')} {String(index()+1).padStart(2,'0')}</span><h3>{item.name || `${t('ITEM')} ${index()+1}`}</h3><p>{item.quantity} × {formatMoney(item.unitCents)} <b>{formatMoney(item.quantity * item.unitCents)}</b></p></div><button type="button" class="everyone-button" aria-pressed={item.assignedTo.length === people().length} onClick={() => toggleAll(item)}>{t('Everyone')}</button></div><div class="person-chips"><For each={people()}>{person => <button type="button" class="person-chip" classList={{ selected: item.assignedTo.includes(person.id) }} aria-pressed={item.assignedTo.includes(person.id)} onClick={() => toggle(item, person.id)}><span aria-hidden="true">{item.assignedTo.includes(person.id) ? '✓' : '+'}</span>{person.name.trim() || t('Unnamed')}</button>}</For></div></div>}</For><div class="result-panel"><div class="result-title"><span>{t('THE RESULT')}</span><strong>{formatMoney(totals().totalCents)}</strong></div><Show when={!isComplete()}><p class="incomplete" role="status">{totalMismatch() ? t('The bill does not match the printed receipt total. Check the items before sharing.') : `${totals().unassigned.length} ${totals().unassigned.length === 1 ? t('item still needs') : t('items still need')} ${t('a person. Assign every item to finish the split.')}`}</p></Show><For each={people()}>{person => <div class="result-person"><span>{person.name.trim() || t('Unnamed')}</span><strong>{formatMoney(totals().totals[person.id] ?? 0)}</strong></div>}</For><Show when={isComplete()}><p class="reconciled">✓ {t('Every cent is accounted for.')}</p><button type="button" class="copy-button" onClick={() => void copy()}>{t('Copy result')} <span aria-hidden="true">↗</span></button><p class="copy-status" role="status">{t(copyStatus())}</p></Show></div></section></Show>
      <div class="footer-note"><span>{t('PRIVATE BY DEFAULT')}</span><p>{t('Your bill stays on this device for up to seven days. The photo is only sent when you request AI scanning. Once installed, manual bill splitting works offline.')}</p><Show when={!storageAvailable()}><p role="status">{t('This browser could not save your draft. Keep this page open until you finish.')}</p></Show><button type="button" class="text-button" onClick={clear}>{t('Start a new bill')}</button></div>
      <div class="install-note"><span>{t('KEEP SPLIT HANDY')}</span><p>{t('Add Split to your phone’s home screen from your browser’s menu. On iPhone in Safari, use Share → Add to Home Screen.')}</p></div>
    </main>
    <nav class="bottom-nav" aria-label={t('Bill steps')}><button type="button" classList={{ active: stage() === 'bill' }} aria-current={stage() === 'bill' ? 'step' : undefined} onClick={() => setStage('bill')}><span>01</span> {t('Bill')}</button><button type="button" classList={{ active: stage() === 'people' }} aria-current={stage() === 'people' ? 'step' : undefined} onClick={() => setStage('people')}><span>02</span> {t('People')}</button><button type="button" classList={{ active: stage() === 'split' }} aria-current={stage() === 'split' ? 'step' : undefined} onClick={() => setStage('split')}><span>03</span> {t('Split')}</button></nav>
  </div>;
}

function isBillItem(value: unknown): value is BillItem {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string' && typeof row.name === 'string' && Number.isInteger(row.quantity) && Number(row.quantity) > 0 && Number.isInteger(row.unitCents) && Number(row.unitCents) >= 0 && Array.isArray(row.assignedTo) && row.assignedTo.every(id => typeof id === 'string');
}
function isParticipant(value: unknown): value is Participant {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string' && typeof row.name === 'string';
}
