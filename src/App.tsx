import { createMemo, createSignal, For, Show, onSettled } from 'solid-js';
import { Button, Theme } from '@plunz/storybook';
import { useLocale, type Preference } from './locale';
import { formatMoney, moneyFromDigits, splitBill, type BillItem, type Participant } from './core';

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
  const [items, setItems] = createSignal<BillItem[]>([]);
  const [people, setPeople] = createSignal<Participant[]>([]);
  const [candidates, setCandidates] = createSignal<Candidate[]>([]);
  const [scanBusy, setScanBusy] = createSignal(false);
  const [scanError, setScanError] = createSignal('');
  const [scanWarnings, setScanWarnings] = createSignal<string[]>([]);
  const [copyStatus, setCopyStatus] = createSignal('');
  const [storageAvailable, setStorageAvailable] = createSignal(true);
  const totals = createMemo(() => splitBill(items(), people()));
  const isComplete = createMemo(() => items().length > 0 && people().length > 0 && totals().unassigned.length === 0);

  // The draft as last changed. A signal write shows on the next flush, so
  // every change is built from and saved through this copy, never from a
  // signal read right after writing it.
  const draft: { items: BillItem[]; people: Participant[] } = { items: [], people: [] };
  let loaded = false;

  onSettled(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { items?: unknown; people?: unknown; savedAt?: unknown };
        if (typeof saved.savedAt === 'number' && Date.now() - saved.savedAt < 7 * 24 * 60 * 60 * 1000 && Array.isArray(saved.items) && Array.isArray(saved.people)) {
          setRows(saved.items.filter(isBillItem));
          setParticipants(saved.people.filter(isParticipant));
        } else localStorage.removeItem(STORAGE_KEY);
      }
    } catch { setStorageAvailable(false); }
    loaded = true;
  });

  const setRows = (next: BillItem[]) => { draft.items = next; setItems(next); };
  const setParticipants = (next: Participant[]) => { draft.people = next; setPeople(next); };
  const persist = () => {
    if (!loaded) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...draft, savedAt: Date.now() })); setStorageAvailable(true); }
    catch { setStorageAvailable(false); }
  };
  const updateItems = (next: BillItem[]) => { setRows(next); persist(); };
  const updatePeople = (next: Participant[]) => { setParticipants(next); persist(); };
  const patchItem = (id: string, patch: Partial<BillItem>) => updateItems(draft.items.map(item => item.id === id ? { ...item, ...patch } : item));
  const patchPerson = (id: string, name: string) => updatePeople(draft.people.map(person => person.id === id ? { ...person, name } : person));
  const addItem = () => updateItems([...draft.items, { id: newId(), name: '', quantity: 1, unitCents: 0, assignedTo: [] }]);
  const addPerson = () => updatePeople([...draft.people, { id: newId(), name: '' }]);
  const removePerson = (id: string) => { updatePeople(draft.people.filter(person => person.id !== id)); updateItems(draft.items.map(item => ({ ...item, assignedTo: item.assignedTo.filter(personId => personId !== id) }))); };
  const current = (item: BillItem) => draft.items.find(row => row.id === item.id) ?? item;
  const toggle = (item: BillItem, personId: string) => { const assigned = current(item).assignedTo; patchItem(item.id, { assignedTo: assigned.includes(personId) ? assigned.filter(id => id !== personId) : [...assigned, personId] }); };
  const toggleAll = (item: BillItem) => patchItem(item.id, { assignedTo: current(item).assignedTo.length === draft.people.length ? [] : draft.people.map(person => person.id) });
  const clear = () => {
    if (!confirm(t('Start a new bill? This will remove the current draft from this device.'))) return;
    setRows([]); setParticipants([]); setCandidates([]); setStage('bill');
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
    updateItems([...draft.items, ...clean.map(row => ({ id: newId(), name: row.name.trim(), quantity: row.quantity, unitCents: row.unitCents, assignedTo: [] }))]);
    setCandidates([]); setScanError('');
  };
  const copy = async () => {
    if (!isComplete()) return;
    const lines = [`${t('Split bill')} — ${formatMoney(totals().totalCents)}`, '', ...people().map(person => `${person.name.trim() || t('Person')}: ${formatMoney(totals().totals[person.id] ?? 0)}`)];
    try { await navigator.clipboard.writeText(lines.join('\n')); setCopyStatus('Copied to clipboard.'); }
    catch { setCopyStatus('Copy is unavailable in this browser.'); }
  };

  return <Theme class="app-shell" accent="green" shape="square">
    <a class="skip-link" href="#main">{t('Skip to content')}</a>
    <header class="topbar"><a href="https://www.plu.nz/" class="brand" aria-label={t('PLUNZ home')}><svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="#0f0f0f"/><path d="M32 6 21 23h8v9h6v-9h8Z" fill="#f6b6ab"/><path d="m32 58 11-17h-8v-9h-6v9h-8Z" fill="#89b4fa"/><path d="M6 32 23 21v8h9v6h-9v8Z" fill="#a6e3a1"/><path d="m58 32-17 11v-8h-9v-6h9v-8Z" fill="#f38ba8"/></svg><span>PLUNZ<span class="brand-dot">.</span></span></a><span class="product-tag">SPLIT / 01</span><label class="language-control"><span>{t('Language')}</span><select aria-label={t('Language')} value={preference()} onChange={event => changeLanguage(event.currentTarget.value as Preference)}><option value="system">{t('System language')}</option><option value="en">English</option><option value="pt">Português</option><option value="es">Español</option></select></label></header>
    <main id="main" class="main-content">
      <Show when={stage() === 'bill'}><section class="workspace" aria-labelledby="bill-heading">
        <div class="section-head"><div><p class="section-kicker">{t('STEP 01 / YOUR BILL')}</p><h2 id="bill-heading">{t('What’s on the bill?')}</h2></div><button type="button" class="secondary-button new-bill-button" onClick={clear}>{t('New bill')}</button></div>
        <div class="scan-panel"><div class="scan-copy"><h3>{t('Digitize a receipt')}</h3></div><div class="scan-actions"><label class={["scan-button", { busy: scanBusy() }]}>{t('Take photo')}<input class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={scanBusy()} onChange={e => { void scan(e.currentTarget.files?.[0]); e.currentTarget.value = ''; }} /></label><label class={["scan-button", { busy: scanBusy() }]}>{t('Choose from gallery')}<input class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={scanBusy()} onChange={e => { void scan(e.currentTarget.files?.[0]); e.currentTarget.value = ''; }} /></label><Show when={scanBusy()}><span class="scan-progress" role="status">{t('Reading receipt…')}</span></Show></div><p class="privacy-note">{t('Your photo is sent to Google Gemini for scanning. Google may use it to improve its products.')}</p></div>
        <Show when={scanError()}><p role="alert" class="alert">{t(scanError())}</p></Show>
        <div class="list-header"><h3>{t('Items')} <span>{items().length + candidates().length}</span></h3><span>{t('QUANTITY × UNIT PRICE')}</span></div>
        <Show when={candidates().length > 0}><div class="review-panel"><p class="subtle">{t('Check names, quantities, and prices against your receipt. AI can make mistakes.')}</p><For each={scanWarnings()}>{warning => <p class="warning">{t(warning)}</p>}</For><For each={candidates()}>{candidate => <div class="item-card candidate-card"><div class="candidate-heading"><label class="candidate-name"><span class="sr-only">{t('Name')}</span><input class="text-input" value={candidate.name} onInput={e => setCandidates(rows => rows.map(row => row.id === candidate.id ? { ...row, name: e.currentTarget.value } : row))} /></label></div><div class="item-fields candidate-fields"><div class="quantity-field"><label for={`candidate-qty-${candidate.id}`}>{t('Qty')}</label><QuantityControl id={`candidate-qty-${candidate.id}`} value={candidate.quantity} onChange={quantity => setCandidates(rows => rows.map(row => row.id === candidate.id ? { ...row, quantity } : row))} increaseLabel={t('Increase quantity')} decreaseLabel={t('Decrease quantity')} /></div><label>{t('Unit price')}<input class="text-input" type="text" inputmode="numeric" value={moneyInput(candidate.unitCents)} onInput={e => { const cents = moneyFromDigits(e.currentTarget.value); if (cents !== null) { e.currentTarget.value = moneyInput(cents); setCandidates(rows => rows.map(row => row.id === candidate.id ? { ...row, unitCents: cents } : row)); } else e.currentTarget.value = moneyInput(candidate.unitCents); }} /></label><button class="remove-icon" type="button" aria-label={`${t('Remove')} ${candidate.name || t('Name')}`} onClick={() => setCandidates(rows => rows.filter(row => row.id !== candidate.id))}><TrashIcon /></button></div></div>}</For><div class="review-total"><span>{t('Bill total')}</span><strong>{formatMoney(totals().totalCents + candidates().reduce((sum, row) => sum + row.quantity * row.unitCents, 0))}</strong></div><div class="review-actions"><Button type="button" variant="outline" onClick={() => setCandidates([])}>{t('Cancel')}</Button><Button type="button" onClick={addCandidates}>{t('Add reviewed items')} <span aria-hidden="true">→</span></Button></div></div></Show>
        <For each={items()}>{(item, index) => <div class="item-card candidate-card"><div class="candidate-heading"><label class="candidate-name"><span class="sr-only">{t('Name')}</span><input class="text-input" type="text" maxlength="120" placeholder={t('e.g. Pizza')} value={item.name} onInput={e => patchItem(item.id, { name: e.currentTarget.value })} /></label></div><div class="item-fields candidate-fields"><div class="quantity-field"><label for={`item-qty-${item.id}`}>{t('Qty')}</label><QuantityControl id={`item-qty-${item.id}`} value={item.quantity} onChange={quantity => patchItem(item.id, { quantity })} increaseLabel={t('Increase quantity')} decreaseLabel={t('Decrease quantity')} /></div><label>{t('Unit price')}<input class="text-input" type="text" inputmode="numeric" value={moneyInput(item.unitCents)} onInput={e => { const cents = moneyFromDigits(e.currentTarget.value); if (cents !== null) { e.currentTarget.value = moneyInput(cents); patchItem(item.id, { unitCents: cents }); } else e.currentTarget.value = moneyInput(item.unitCents); }} /></label><button class="remove-icon" type="button" aria-label={`${t('Remove')} ${item.name || `${t('ITEM')} ${index() + 1}`}`} onClick={() => updateItems(draft.items.filter(row => row.id !== item.id))}><TrashIcon /></button></div></div>}</For>
        <button type="button" class="add-button" onClick={addItem}><span aria-hidden="true">+</span> {t('Add an item')}</button><Show when={candidates().length === 0}><div class="total-row"><span>{t('Bill total')}</span><strong>{formatMoney(totals().totalCents)}</strong></div></Show>
      </section></Show>

      <Show when={stage() === 'people'}><section class="workspace" aria-labelledby="people-heading"><div class="section-head"><div><p class="section-kicker">{t('STEP 02 / THE TABLE')}</p><h2 id="people-heading">{t('Who’s sharing?')}</h2></div><span class="step-badge">02</span></div><p class="subtle">{t('Add each person who owes part of the bill. Names stay on this device.')}</p><For each={people()}>{(person, index) => <div class="person-row"><span class="person-number">{String(index()+1).padStart(2,'0')}</span><label class="sr-only" for={`person-${person.id}`}>{t('Person')} {index()+1} {t('Name')}</label><input id={`person-${person.id}`} class="text-input" type="text" maxlength="60" placeholder={`${t('Person')} ${index()+1}`} value={person.name} onInput={e => patchPerson(person.id, e.currentTarget.value)} /><button class="text-button danger" type="button" aria-label={`${t('Remove')} ${person.name || `${t('Person')} ${index()+1}`}`} onClick={() => removePerson(person.id)}>{t('Remove')}</button></div>}</For><button type="button" class="add-button" onClick={addPerson}><span aria-hidden="true">+</span> {t('Add a person')}</button></section></Show>

      <Show when={stage() === 'split'}><section class="workspace" aria-labelledby="split-heading"><div class="section-head"><div><p class="section-kicker">{t('STEP 03 / THE SPLIT')}</p><h2 id="split-heading">{t('Who had what?')}</h2></div><span class="step-badge">03</span></div><p class="subtle">{t('Choose everyone who shared each item. Use “Everyone” for a common item.')}</p><For each={items()}>{(item, index) => <div class="assignment-card"><div class="assignment-head"><div><span class="item-index">{t('ITEM')} {String(index()+1).padStart(2,'0')}</span><h3>{item.name || `${t('ITEM')} ${index()+1}`}</h3><p>{item.quantity} × {formatMoney(item.unitCents)} <b>{formatMoney(item.quantity * item.unitCents)}</b></p></div><button type="button" class="everyone-button" aria-pressed={item.assignedTo.length === people().length ? "true" : "false"} onClick={() => toggleAll(item)}>{t('Everyone')}</button></div><div class="person-chips"><For each={people()}>{person => <button type="button" class={["person-chip", { selected: item.assignedTo.includes(person.id) }]} aria-pressed={item.assignedTo.includes(person.id) ? "true" : "false"} onClick={() => toggle(item, person.id)}><span aria-hidden="true">{item.assignedTo.includes(person.id) ? '✓' : '+'}</span>{person.name.trim() || t('Unnamed')}</button>}</For></div></div>}</For><div class="result-panel"><div class="result-title"><span>{t('THE RESULT')}</span><strong>{formatMoney(totals().totalCents)}</strong></div><Show when={!isComplete()}><p class="incomplete" role="status">{`${totals().unassigned.length} ${totals().unassigned.length === 1 ? t('item still needs') : t('items still need')} ${t('a person. Assign every item to finish the split.')}`}</p></Show><For each={people()}>{person => <div class="result-person"><span>{person.name.trim() || t('Unnamed')}</span><strong>{formatMoney(totals().totals[person.id] ?? 0)}</strong></div>}</For><Show when={isComplete()}><p class="reconciled">✓ {t('Every cent is accounted for.')}</p><Button type="button" class="copy-button" onClick={() => void copy()}>{t('Copy result')} <span aria-hidden="true">↗</span></Button><p class="copy-status" role="status">{t(copyStatus())}</p></Show></div></section></Show>
      <Show when={!storageAvailable()}><div class="footer-note"><p role="status">{t('This browser could not save your draft. Keep this page open until you finish.')}</p></div></Show>

    </main>
    <nav class="bottom-nav" aria-label={t('Bill steps')}><button type="button" class={{ active: stage() === 'bill' }} aria-current={stage() === 'bill' ? 'step' : undefined} onClick={() => setStage('bill')}><span>01</span> {t('Bill')}</button><button type="button" class={{ active: stage() === 'people' }} aria-current={stage() === 'people' ? 'step' : undefined} onClick={() => setStage('people')}><span>02</span> {t('People')}</button><button type="button" class={{ active: stage() === 'split' }} aria-current={stage() === 'split' ? 'step' : undefined} onClick={() => setStage('split')}><span>03</span> {t('Split')}</button></nav>
  </Theme>;
}

function TrashIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>;
}

function QuantityControl(props: { id: string; value: number; onChange: (value: number) => void; increaseLabel: string; decreaseLabel: string }) {
  const clamp = (value: number) => Math.max(1, Math.min(999, Math.trunc(value || 1)));
  return <div class="quantity-control">
    <button type="button" aria-label={props.decreaseLabel} disabled={props.value <= 1} onClick={() => props.onChange(clamp(props.value - 1))}>−</button>
    <input id={props.id} class="text-input" type="number" inputmode="numeric" min="1" max="999" step="1" value={props.value} onChange={event => { const value = clamp(Number(event.currentTarget.value)); event.currentTarget.value = String(value); props.onChange(value); }} />
    <button type="button" aria-label={props.increaseLabel} disabled={props.value >= 999} onClick={() => props.onChange(clamp(props.value + 1))}>+</button>
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
