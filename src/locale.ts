import { createEffect, createSignal, onCleanup } from 'solid-js';
import { readSharedPreference, writeSharedPreference } from './locale-preference';

export type Locale = 'en' | 'pt' | 'es';
export type Preference = Locale | 'system';
const key = 'plunz.split.locale';

export function detectLocale(tags: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages): Locale {
  const preferred = tags.length ? tags : typeof navigator === 'undefined' ? [] : [navigator.language];
  for (const tag of preferred) {
    const base = tag.trim().toLowerCase().split(/[-_]/)[0];
    if (base === 'en' || base === 'pt' || base === 'es') return base;
  }
  return 'en';
}

export function readPreference(): Preference {
  try { return readSharedPreference(localStorage, key); }
  catch { return 'system'; }
}
export function savePreference(value: Preference): void {
  try { writeSharedPreference(localStorage, key, value); }
  catch { /* Private browsing can disable storage. */ }
}

// English source strings are the fallback. Each product keeps its own wording.
export const translations: Record<string, readonly [string, string]> = {
  'Language': ['Idioma', 'Idioma'], 'System language': ['Idioma do sistema', 'Idioma del sistema'],
  'Skip to content': ['Pular para o conteúdo', 'Ir al contenido'], 'PLUNZ home': ['Página inicial da PLUNZ', 'Inicio de PLUNZ'],
  'THE SIMPLE BILL SPLITTER': ['DIVIDA A CONTA SEM COMPLICAÇÃO', 'DIVIDE LA CUENTA SIN COMPLICACIONES'],
  'Split the bill.': ['Divida a conta.', 'Divide la cuenta.'], 'Keep it fair.': ['Com justiça.', 'Con justicia.'],
  'Scan a receipt or enter items, add your people, and see exactly who owes what. No account needed.': ['Fotografe a conta ou adicione itens, escolha as pessoas e veja quanto cada uma deve. Sem cadastro.', 'Fotografía la cuenta o añade artículos, agrega a las personas y mira cuánto debe cada una. Sin registro.'],
  'Steps': ['Etapas', 'Pasos'], 'Bill': ['Conta', 'Cuenta'], 'People': ['Pessoas', 'Personas'], 'Split': ['Divisão', 'División'], 'Bill steps': ['Etapas da conta', 'Pasos de la cuenta'],
  'STEP 01 / YOUR BILL': ['ETAPA 01 / SUA CONTA', 'PASO 01 / TU CUENTA'], 'What’s on the bill?': ['O que tem na conta?', '¿Qué hay en la cuenta?'],
  'Bill name': ['Nome da conta', 'Nombre de la cuenta'], 'optional': ['opcional', 'opcional'], 'Dinner with friends': ['Jantar com amigos', 'Cena con amigos'],
  'Digitize a receipt': ['Digitalize uma conta', 'Digitaliza una cuenta'],
  'Take a photo and AI will suggest the items. You review every amount before it joins the bill.': ['Tire uma foto e a IA sugerirá os itens. Confira cada valor antes de adicioná-lo à conta.', 'Toma una foto y la IA sugerirá los artículos. Revisa cada importe antes de añadirlo a la cuenta.'],
  'Take photo': ['Tirar foto', 'Tomar foto'], 'Choose from gallery': ['Escolher da galeria', 'Elegir de la galería'], 'Reading receipt…': ['Lendo a conta…', 'Leyendo la cuenta…'],
  'Your photo is sent to Cloudflare AI for this request. Split does not save it. Enter items manually if you prefer.': ['Sua foto é enviada à IA da Cloudflare para esta solicitação. O Split não a salva. Se preferir, adicione os itens manualmente.', 'Tu foto se envía a la IA de Cloudflare para esta solicitud. Split no la guarda. Si prefieres, añade los artículos manualmente.'],
  'AI SUGGESTIONS': ['SUGESTÕES DA IA', 'SUGERENCIAS DE IA'], 'Review before adding': ['Confira antes de adicionar', 'Revisa antes de añadir'],
  'Check names, quantities, and prices against your receipt. AI can make mistakes.': ['Confira nomes, quantidades e preços na conta. A IA pode errar.', 'Comprueba nombres, cantidades y precios con la cuenta. La IA puede equivocarse.'],
  'SUGGESTED ITEM': ['ITEM SUGERIDO', 'ARTÍCULO SUGERIDO'], 'Remove': ['Remover', 'Quitar'], 'Name': ['Nome', 'Nombre'], 'Qty': ['Qtd.', 'Cant.'], 'Unit price': ['Preço unitário', 'Precio unitario'], 'Cancel': ['Cancelar', 'Cancelar'], 'Add reviewed items': ['Adicionar itens conferidos', 'Añadir artículos revisados'],
  'Items': ['Itens', 'Artículos'], 'QUANTITY × UNIT PRICE': ['QUANTIDADE × PREÇO UNITÁRIO', 'CANTIDAD × PRECIO UNITARIO'], 'ITEM': ['ITEM', 'ARTÍCULO'], 'e.g. Pizza': ['Ex.: pizza', 'P. ej., pizza'], 'Subtotal': ['Subtotal', 'Subtotal'], 'Add an item': ['Adicionar item', 'Añadir artículo'], 'Bill total': ['Total da conta', 'Total de la cuenta'], 'Printed receipt total': ['Total impresso na conta', 'Total impreso en la cuenta'], 'optional check': ['conferência opcional', 'comprobación opcional'], 'e.g. 23.10': ['Ex.: 23,10', 'P. ej., 23,10'],
  'The entered items do not match the printed receipt total. Check for missing fees, taxes, or misread prices.': ['Os itens não correspondem ao total impresso. Confira taxas, impostos ou preços lidos incorretamente.', 'Los artículos no coinciden con el total impreso. Comprueba cargos, impuestos o precios mal leídos.'],
  'STEP 02 / THE TABLE': ['ETAPA 02 / AS PESSOAS', 'PASO 02 / LA MESA'], 'Who’s sharing?': ['Quem vai dividir?', '¿Quién va a compartir?'], 'Add each person who owes part of the bill. Names stay on this device.': ['Adicione cada pessoa que participa da conta. Os nomes ficam neste dispositivo.', 'Añade a cada persona que participa en la cuenta. Los nombres permanecen en este dispositivo.'], 'Person': ['Pessoa', 'Persona'], 'Add a person': ['Adicionar pessoa', 'Añadir persona'], 'Shared items can be assigned to several people. We divide every item evenly and keep the total exact to the cent.': ['Itens compartilhados podem ser atribuídos a várias pessoas. Dividimos cada item igualmente e mantemos o total exato até o centavo.', 'Los artículos compartidos pueden asignarse a varias personas. Dividimos cada artículo por igual y mantenemos el total exacto hasta el céntimo.'],
  'STEP 03 / THE SPLIT': ['ETAPA 03 / A DIVISÃO', 'PASO 03 / LA DIVISIÓN'], 'Who had what?': ['Quem consumiu o quê?', '¿Quién consumió qué?'], 'Choose everyone who shared each item. Use “Everyone” for a common item.': ['Selecione quem compartilhou cada item. Use “Todos” para um item comum.', 'Elige a quienes compartieron cada artículo. Usa «Todos» para un artículo común.'], 'Everyone': ['Todos', 'Todos'], 'Unnamed': ['Sem nome', 'Sin nombre'], 'THE RESULT': ['O RESULTADO', 'EL RESULTADO'], 'The bill does not match the printed receipt total. Check the items before sharing.': ['A conta não corresponde ao total impresso. Confira os itens antes de compartilhar.', 'La cuenta no coincide con el total impreso. Revisa los artículos antes de compartir.'], 'Every cent is accounted for.': ['Todos os centavos foram distribuídos.', 'Cada céntimo está contabilizado.'], 'Copy result': ['Copiar resultado', 'Copiar resultado'],
  'PRIVATE BY DEFAULT': ['PRIVADO POR PADRÃO', 'PRIVADO POR DEFECTO'], 'Your bill stays on this device for up to seven days. The photo is only sent when you request AI scanning. Once installed, manual bill splitting works offline.': ['Sua conta fica neste dispositivo por até sete dias. A foto só é enviada quando você pede a leitura por IA. Depois de instalado, o app divide contas manualmente sem internet.', 'Tu cuenta permanece en este dispositivo hasta siete días. La foto solo se envía cuando solicitas la lectura por IA. Una vez instalada, la app permite dividir cuentas manualmente sin conexión.'], 'This browser could not save your draft. Keep this page open until you finish.': ['Este navegador não conseguiu salvar o rascunho. Mantenha a página aberta até terminar.', 'Este navegador no pudo guardar el borrador. Mantén la página abierta hasta terminar.'], 'Start a new bill': ['Começar outra conta', 'Empezar otra cuenta'], 'KEEP SPLIT HANDY': ['TENHA O SPLIT À MÃO', 'TEN SPLIT A MANO'], 'Add Split to your phone’s home screen from your browser’s menu. On iPhone in Safari, use Share → Add to Home Screen.': ['Adicione o Split à tela inicial pelo menu do navegador. No Safari do iPhone, use Compartilhar → Adicionar à Tela de Início.', 'Añade Split a la pantalla de inicio desde el menú del navegador. En Safari para iPhone, usa Compartir → Añadir a pantalla de inicio.'],
  'Start a new bill? This will remove the current draft from this device.': ['Começar outra conta? O rascunho atual será removido deste dispositivo.', '¿Empezar otra cuenta? Se eliminará el borrador actual de este dispositivo.'], 'You are offline. Connect to scan a receipt, or enter items manually.': ['Você está sem conexão. Conecte-se para ler a conta ou adicione os itens manualmente.', 'No tienes conexión. Conéctate para leer la cuenta o añade los artículos manualmente.'], 'Choose a receipt photo in JPG, PNG, or WebP format.': ['Escolha uma foto da conta em JPG, PNG ou WebP.', 'Elige una foto de la cuenta en formato JPG, PNG o WebP.'], 'Could not prepare this photo.': ['Não foi possível preparar a foto.', 'No se pudo preparar la foto.'], 'This photo is too large after preparation. Try a smaller image.': ['A foto ainda é grande demais. Tente uma imagem menor.', 'La foto sigue siendo demasiado grande. Prueba con una imagen más pequeña.'], 'Could not read this photo.': ['Não foi possível ler a foto.', 'No se pudo leer la foto.'], 'No items were found. Try a clearer photo or add them manually.': ['Nenhum item encontrado. Tente uma foto mais nítida ou adicione os itens manualmente.', 'No se encontraron artículos. Prueba con una foto más clara o añádelos manualmente.'], 'Correct or remove invalid rows before adding them.': ['Corrija ou remova as linhas inválidas antes de adicioná-las.', 'Corrige o elimina las filas no válidas antes de añadirlas.'], 'Copied to clipboard.': ['Copiado para a área de transferência.', 'Copiado al portapapeles.'], 'Copy is unavailable in this browser.': ['Não é possível copiar neste navegador.', 'No se puede copiar en este navegador.'], 'Split bill': ['Conta dividida', 'Cuenta dividida'], 'Copied result': ['Resultado copiado', 'Resultado copiado'], 'item still needs': ['item ainda precisa de', 'artículo aún necesita'], 'items still need': ['itens ainda precisam de', 'artículos aún necesitan'], 'a person. Assign every item to finish the split.': ['uma pessoa. Atribua todos os itens para concluir.', 'una persona. Asigna todos los artículos para terminar.'],
  'Too many scans. Please wait a minute or enter items manually.': ['Muitas leituras. Aguarde um minuto ou adicione os itens manualmente.', 'Demasiadas lecturas. Espera un minuto o añade los artículos manualmente.'], 'Upload an image.': ['Envie uma imagem.', 'Sube una imagen.'], 'Image must be smaller than 4 MB.': ['A imagem deve ter menos de 4 MB.', 'La imagen debe tener menos de 4 MB.'], 'Choose a receipt image.': ['Escolha uma imagem da conta.', 'Elige una imagen de la cuenta.'], 'Use a JPEG, PNG, or WebP image.': ['Use uma imagem JPEG, PNG ou WebP.', 'Usa una imagen JPEG, PNG o WebP.'], 'Could not read this receipt. Try another image or enter items manually.': ['Não foi possível ler a conta. Tente outra imagem ou adicione os itens manualmente.', 'No se pudo leer la cuenta. Prueba con otra imagen o añade los artículos manualmente.'],
  'Only the first 100 lines were read.': ['Apenas as primeiras 100 linhas foram lidas.', 'Solo se leyeron las primeras 100 líneas.'], 'No reliable items found. Enter the bill manually or try another image.': ['Nenhum item confiável encontrado. Adicione a conta manualmente ou tente outra imagem.', 'No se encontraron artículos fiables. Añade la cuenta manualmente o prueba con otra imagen.'],
};

export function useLocale() {
  const [preference, setPreference] = createSignal<Preference>(readPreference());
  const [systemLocale, setSystemLocale] = createSignal<Locale>(detectLocale());
  const locale = (): Locale => preference() === 'system' ? systemLocale() : preference() as Locale;
  const t = (english: string): string => {
    if (locale() === 'en') return english;
    const index = locale() === 'pt' ? 0 : 1;
    const line = /^Line (\d+) (needs manual review\.|could not be read reliably\.)$/.exec(english);
    if (line) return index === 0
      ? `Linha ${line[1]} ${line[2] === 'needs manual review.' ? 'precisa de revisão manual.' : 'não pôde ser lida com segurança.'}`
      : `La línea ${line[1]} ${line[2] === 'needs manual review.' ? 'necesita revisión manual.' : 'no se pudo leer de forma fiable.'}`;
    return translations[english]?.[index] || english;
  };
  const changeLanguage = (value: Preference) => { setPreference(value); savePreference(value); };
  const refreshSystem = () => setSystemLocale(detectLocale());
  const refreshPreference = () => setPreference(readPreference());
  window.addEventListener('languagechange', refreshSystem);
  window.addEventListener('focus', refreshPreference);
  window.addEventListener('pageshow', refreshPreference);
  onCleanup(() => {
    window.removeEventListener('languagechange', refreshSystem);
    window.removeEventListener('focus', refreshPreference);
    window.removeEventListener('pageshow', refreshPreference);
  });
  createEffect(() => {
    document.documentElement.lang = locale();
    document.querySelector('meta[name="description"]')?.setAttribute('content', t('Scan a receipt or enter items, add your people, and see exactly who owes what. No account needed.'));
  });
  return { locale, preference, t, changeLanguage };
}
