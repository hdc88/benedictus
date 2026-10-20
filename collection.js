// =========================================================
// BENEDICTUS - RACCOLTA E LIBRETTO
// =========================================================
// Una raccolta è un elenco ordinato di elementi:
//   - brano  { type: 'chant', gabc }
//   - testo  { type: 'text', title, text }   (rubriche, versetti, istruzioni)
//   - interruzione di pagina { type: 'break' }
// Si salva come file .benedictus (JSON) e viene impaginata come libretto
// con frontespizio, indice, testatine, margini speculari e imposizione.

var COLLECTION_STORAGE_KEY = 'benedictus.collection.v1';

var collection = {
    title: '',
    subtitle: '',
    editor: '',
    items: [],
    activeId: null
};

var librettoSettings = {
    frontispiece: true,
    blankAfterFront: true,
    toc: true,
    tocOrder: 'collection',      // 'collection' | 'alpha'
    newPagePerPiece: false,
    runningHeads: true,
    mirrored: true
};

var collectionDirty = false;
var collectionPreviewMode = 'piece';   // 'piece' | 'libretto'
var pristineEditorValue = null;        // il brano d'esempio iniziale
var collectionSaveTimer = null;
var lastCollectionRender = null;

function newItemId() {
    return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function findItem(id) {
    for (var i = 0; i < collection.items.length; i++) {
        if (collection.items[i].id === id) return collection.items[i];
    }
    return null;
}

function escapeHtml(s) {
    return $('<div>').text(s == null ? '' : String(s)).html();
}

// ---------------------------------------------------------
// Etichette
// ---------------------------------------------------------

function chantTitle(gabc) {
    var doc = parseGabc(gabc || '');
    var name = headerGet(doc, 'name');
    if (name) return name;
    var words = extractTextFromGabc(gabc || '').replace(/\n/g, ' ').split(/\s+/).filter(Boolean);
    if (!words.length) return 'Brano senza titolo';
    var t = words.slice(0, 5).join(' ').replace(/[,;:.]+$/, '');
    // "UT queant" → "Ut queant"
    t = t.charAt(0) + t.slice(1).replace(/^\S+/, function(w) { return w.toLowerCase(); });
    return t + (words.length > 5 ? '…' : '');
}

function itemLabel(item) {
    if (item.type === 'chant') return chantTitle(item.gabc);
    if (item.type === 'text') {
        if (item.title) return item.title;
        var w = (item.text || '').replace(/^>\s*/, '').split(/\s+/).filter(Boolean);
        return w.length ? w.slice(0, 6).join(' ') + (w.length > 6 ? '…' : '') : 'Testo';
    }
    return 'Interruzione di pagina';
}

function itemKind(item) {
    if (item.type === 'chant') {
        var doc = parseGabc(item.gabc || '');
        var part = headerGet(doc, 'office-part');
        var mode = headerGet(doc, 'mode');
        return [part, mode ? modeToRoman(mode) : ''].filter(Boolean).join(' · ') || 'Brano';
    }
    if (item.type === 'text') return 'Testo';
    return '';
}

// ---------------------------------------------------------
// Persistenza
// ---------------------------------------------------------

function collectionToJSON() {
    return {
        format: 'benedictus-collection',
        version: 1,
        title: collection.title,
        subtitle: collection.subtitle,
        editor: collection.editor,
        libretto: librettoSettings,
        layout: {
            paper: userSettings.paper,
            orientation: userSettings.orientation,
            marginTop: userSettings.marginTop,
            marginBottom: userSettings.marginBottom,
            marginLeft: userSettings.marginLeft,
            marginRight: userSettings.marginRight,
            scale: userSettings.scale,
            spacing: userSettings.spacing,
            lineSpacing: userSettings.lineSpacing,
            lyricSize: userSettings.lyricSize,
            titleSize: userSettings.titleSize,
            fontFamily: userSettings.fontFamily,
            custosStyle: userSettings.custosStyle,
            minimaStems: userSettings.minimaStems,
            staffColor: userSettings.staffColor,
            rubricColor: userSettings.rubricColor
        },
        items: collection.items.map(function(it) {
            var o = { type: it.type };
            if (it.type === 'chant') o.gabc = it.gabc;
            if (it.type === 'text') { o.title = it.title || ''; o.text = it.text || ''; }
            return o;
        })
    };
}

function collectionFromJSON(data, applyLayout) {
    if (!data || data.format !== 'benedictus-collection' || !Array.isArray(data.items)) {
        throw new Error('Il file non è una raccolta Benedictus valida.');
    }
    collection.title = data.title || '';
    collection.subtitle = data.subtitle || '';
    collection.editor = data.editor || '';
    collection.activeId = null;
    collection.items = data.items.filter(function(it) {
        return it && (it.type === 'chant' || it.type === 'text' || it.type === 'break');
    }).map(function(it) {
        return { id: newItemId(), type: it.type, gabc: it.gabc || '', title: it.title || '', text: it.text || '' };
    });
    if (data.libretto) $.extend(librettoSettings, data.libretto);
    if (applyLayout && data.layout) applyLayoutSettings(data.layout);
}

// Applica le impostazioni di pagina salvate nella raccolta anche ai controlli
function applyLayoutSettings(l) {
    var map = [
        ['paper', '#paper-size'], ['orientation', '#paper-orientation'],
        ['marginTop', '#margin-top'], ['marginBottom', '#margin-bottom'],
        ['marginLeft', '#margin-left'], ['marginRight', '#margin-right'],
        ['scale', '#scaleSlider', '#scaleVal', 1], ['spacing', '#spacingSlider', '#spacingVal', 1],
        ['lineSpacing', '#lineSpacingSlider', '#lineSpacingVal', 2],
        ['lyricSize', '#lyricSizeSlider', '#lyricSizeVal'], ['titleSize', '#titleSizeSlider', '#titleSizeVal'],
        ['fontFamily', '#text-font'], ['custosStyle', '#custos-style'], ['minimaStems', '#minima-stems'],
        ['staffColor', '#inputStaffColor'], ['rubricColor', '#inputRubricColor']
    ];
    map.forEach(function(m) {
        if (l[m[0]] === undefined || l[m[0]] === null) return;
        if (m[0] === 'fontFamily' && !FONT_FAMILIES[l.fontFamily]) return;
        userSettings[m[0]] = l[m[0]];
        $(m[1]).val(l[m[0]]);
        if (m[2]) $(m[2]).text(m[3] !== undefined ? Number(l[m[0]]).toFixed(m[3]) : l[m[0]]);
    });
}

function syncLibrettoControls() {
    $('#lib-front').prop('checked', librettoSettings.frontispiece);
    $('#lib-blank').prop('checked', librettoSettings.blankAfterFront);
    $('#lib-toc').prop('checked', librettoSettings.toc);
    $('#lib-toc-order').val(librettoSettings.tocOrder);
    $('#lib-newpage').prop('checked', librettoSettings.newPagePerPiece);
    $('#lib-heads').prop('checked', librettoSettings.runningHeads);
    $('#lib-mirrored').prop('checked', librettoSettings.mirrored);
    $('#coll-title').val(collection.title);
    $('#coll-subtitle').val(collection.subtitle);
    $('#coll-editor').val(collection.editor);
}

function markCollectionChanged() {
    collectionDirty = true;
    clearTimeout(collectionSaveTimer);
    collectionSaveTimer = setTimeout(function() {
        try {
            var data = collectionToJSON();
            data.activeIndex = collection.items.indexOf(findItem(collection.activeId));
            localStorage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(data));
        } catch (e) { /* archiviazione non disponibile: nessun autosalvataggio */ }
    }, 600);
}

function restoreCollectionFromStorage() {
    try {
        var raw = localStorage.getItem(COLLECTION_STORAGE_KEY);
        if (!raw) return false;
        var data = JSON.parse(raw);
        if (!data.items || !data.items.length) return false;
        collectionFromJSON(data, false);
        return true;
    } catch (e) {
        return false;
    }
}

function saveCollectionFile() {
    if (!collection.items.length) {
        alert('La raccolta è vuota.');
        return;
    }
    var json = JSON.stringify(collectionToJSON(), null, 2);
    downloadBlob(new Blob([json], { type: 'application/json;charset=utf-8' }), collectionBaseName() + '.benedictus');
    collectionDirty = false;
}

function openCollectionFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function() {
        try {
            var data = JSON.parse(String(reader.result));
            if (collection.items.length && collectionDirty &&
                !confirm('Aprire "' + file.name + '"? La raccolta attuale non salvata verrà sostituita.')) return;
            collectionFromJSON(data, true);
            collectionDirty = false;
            markCollectionChanged();
            collectionDirty = false;
            syncLibrettoControls();
            renderCollectionList();
            $('#collection-panel').prop('open', true);
            updatePreview();
        } catch (e) {
            alert('Impossibile aprire la raccolta: ' + e.message);
        }
    };
    reader.readAsText(file, 'UTF-8');
}

function collectionBaseName() {
    var name = collection.title || 'raccolta';
    var slug = name.normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[æÆ]/g, 'ae').replace(/[œŒ]/g, 'oe')
        .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
    return slug || 'raccolta';
}

// ---------------------------------------------------------
// Editor <-> brano attivo
// ---------------------------------------------------------

function collectionOnEditorChange(src) {
    var item = findItem(collection.activeId);
    if (!item || item.type !== 'chant' || item.gabc === src) return;
    item.gabc = src;
    markCollectionChanged();
    refreshItemRow(item);
}

function editorHasUnsavedStandalone() {
    if (collection.activeId) return false;
    var src = $('#editor').val();
    if (!src.trim() || src === pristineEditorValue) return false;
    return !collection.items.some(function(it) { return it.type === 'chant' && it.gabc === src; });
}

function confirmLeaveStandalone() {
    if (!editorHasUnsavedStandalone()) return true;
    return confirm('Il brano nell\'editor non fa parte della raccolta e verrà sostituito.\n' +
                   'Usa "+ Brano corrente" per aggiungerlo. Continuare comunque?');
}

function openItemInEditor(id) {
    var item = findItem(id);
    if (!item) return;
    if (item.type === 'text') { showTextItemModal(item); return; }
    if (item.type !== 'chant') return;
    if (collection.activeId === id) return;
    if (!confirmLeaveStandalone()) return;
    collection.activeId = id;
    $('#editor').val(item.gabc);
    lastRender = null;
    renderCollectionList();
    updatePreview();
    var ed = document.getElementById('editor');
    if (ed && ed.scrollIntoView) ed.scrollIntoView({ block: 'nearest' });
}

// ---------------------------------------------------------
// Operazioni sulla raccolta
// ---------------------------------------------------------

function addItem(item, activate) {
    item.id = item.id || newItemId();
    // inserisce dopo l'elemento attivo, altrimenti in coda
    var active = findItem(collection.activeId);
    var idx = active ? collection.items.indexOf(active) + 1 : collection.items.length;
    collection.items.splice(idx, 0, item);
    if (activate) collection.activeId = item.id;
    markCollectionChanged();
    renderCollectionList();
    return item;
}

function addCurrentChant() {
    var src = $('#editor').val();
    if (!src.trim()) { alert('L\'editor è vuoto.'); return; }
    var active = findItem(collection.activeId);
    if (active && active.gabc === src) {
        if (!confirm('Questo brano è già nella raccolta. Aggiungerne una copia?')) return;
    }
    addItem({ type: 'chant', gabc: src }, true);
    updatePreview();
}

function addNewChant() {
    if (!confirmLeaveStandalone()) return;
    var tpl = 'name: Nuovo brano;\n%%\n(c4) ';
    addItem({ type: 'chant', gabc: tpl }, true);
    $('#editor').val(tpl).focus();
    lastRender = null;
    updatePreview();
}

function addPageBreak() {
    addItem({ type: 'break' }, false);
    if (collectionPreviewActive()) updatePreview();
}

function removeItem(id) {
    var item = findItem(id);
    if (!item) return;
    if (item.type !== 'break' && !confirm('Rimuovere "' + itemLabel(item) + '" dalla raccolta?')) return;
    collection.items.splice(collection.items.indexOf(item), 1);
    if (collection.activeId === id) collection.activeId = null;
    markCollectionChanged();
    renderCollectionList();
    if (collectionPreviewActive()) updatePreview();
}

function duplicateItem(id) {
    var item = findItem(id);
    if (!item) return;
    var copy = { type: item.type, gabc: item.gabc, title: item.title, text: item.text, id: newItemId() };
    collection.items.splice(collection.items.indexOf(item) + 1, 0, copy);
    markCollectionChanged();
    renderCollectionList();
    if (collectionPreviewActive()) updatePreview();
}

function importGabcFilesIntoCollection(files) {
    files = Array.prototype.slice.call(files || []);
    if (!files.length) return;
    files.sort(function(a, b) { return a.name.localeCompare(b.name, 'it', { numeric: true }); });
    var reads = files.map(function(f) {
        return new Promise(function(resolve) {
            var r = new FileReader();
            r.onload = function() { resolve({ name: f.name, text: String(r.result) }); };
            r.onerror = function() { resolve(null); };
            r.readAsText(f, 'UTF-8');
        });
    });
    Promise.all(reads).then(function(list) {
        var n = 0;
        list.forEach(function(f) {
            if (!f) return;
            var text = f.text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
            // se manca il titolo, usa il nome del file
            var doc = parseGabc(text);
            if (doc.hasSeparator && !headerGet(doc, 'name')) {
                headerSet(doc, 'name', f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
                text = serializeGabc(doc);
            }
            collection.items.push({ id: newItemId(), type: 'chant', gabc: text });
            n++;
        });
        markCollectionChanged();
        renderCollectionList();
        $('#collection-panel').prop('open', true);
        if (collectionPreviewActive()) updatePreview();
        setStatus(n + (n === 1 ? ' brano importato' : ' brani importati') + ' nella raccolta.', false);
    });
}

function clearCollection() {
    if (!collection.items.length) return;
    if (!confirm('Svuotare la raccolta? Gli elementi non salvati in un file .benedictus andranno persi.')) return;
    collection.items = [];
    collection.activeId = null;
    markCollectionChanged();
    collectionDirty = false;
    renderCollectionList();
    if (collectionPreviewActive()) setCollectionPreviewMode('piece');
}

// ---------------------------------------------------------
// Elenco
// ---------------------------------------------------------

function rowHtml(item, idx) {
    var active = item.id === collection.activeId;
    var cls = 'coll-item coll-' + item.type + (active ? ' active' : '');
    var label = item.type === 'break' ? '— interruzione di pagina —' : escapeHtml(itemLabel(item));
    var actions = '';
    if (item.type !== 'break') {
        actions += '<button type="button" class="coll-btn" data-act="open" title="' +
                   (item.type === 'chant' ? 'Apri nell\'editor' : 'Modifica il testo') + '">✎</button>';
        actions += '<button type="button" class="coll-btn" data-act="dup" title="Duplica">⧉</button>';
    }
    actions += '<button type="button" class="coll-btn" data-act="del" title="Rimuovi">✕</button>';
    return '<li class="' + cls + '" data-id="' + item.id + '">' +
           '<span class="coll-handle" title="Trascina per riordinare">☰</span>' +
           '<span class="coll-num">' + (idx + 1) + '.</span>' +
           '<span class="coll-label">' + label + '</span>' +
           '<span class="coll-kind">' + escapeHtml(itemKind(item)) + '</span>' +
           '<span class="coll-actions">' + actions + '</span></li>';
}

function renderCollectionList() {
    var $list = $('#collection-list');
    if (!$list.length) return;
    if (!collection.items.length) {
        $list.html('<li class="coll-empty">La raccolta è vuota. Aggiungi il brano corrente, importa dei file .gabc o apri una raccolta salvata.</li>');
    } else {
        $list.html(collection.items.map(rowHtml).join(''));
    }
    var chants = collection.items.filter(function(i) { return i.type === 'chant'; }).length;
    $('#collection-count').text(collection.items.length ? '(' + chants + (chants === 1 ? ' brano' : ' brani') + ')' : '');
    $('#active-item-badge').toggle(!!collection.activeId)
        .text(collection.activeId ? 'Stai modificando: ' + itemLabel(findItem(collection.activeId)) + ' (raccolta)' : '');
}

function refreshItemRow(item) {
    var $row = $('#collection-list li[data-id="' + item.id + '"]');
    if (!$row.length) return;
    $row.find('.coll-label').text(itemLabel(item));
    $row.find('.coll-kind').text(itemKind(item));
    $('#active-item-badge').text('Stai modificando: ' + itemLabel(item) + ' (raccolta)');
}

// ---------------------------------------------------------
// Finestra per i blocchi di testo
// ---------------------------------------------------------

function showTextItemModal(item) {
    var isNew = !item;
    var modal = $(
        '<div class="bn-modal" role="dialog" aria-modal="true"><div class="bn-modal-box">' +
          '<h2>' + (isNew ? 'Aggiungi testo' : 'Modifica testo') + '</h2>' +
          '<p class="sub">Rubriche, versetti, letture o istruzioni da inserire nel libretto. ' +
          'Riga vuota = nuovo paragrafo. Un paragrafo che inizia con <code>&gt;</code> è una rubrica (rosso corsivo). ' +
          '<code>V/</code> e <code>R/</code> diventano ℣ e ℟.</p>' +
          '<label style="font-weight:600">Titolo (facoltativo, compare nell\'indice)</label>' +
          '<input type="text" id="txt-title" style="margin:4px 0 12px">' +
          '<textarea id="txt-body" spellcheck="false" style="min-height:240px"></textarea>' +
          '<div class="bn-modal-actions">' +
            '<button class="bn-btn" id="txt-cancel">Annulla</button>' +
            '<button class="bn-btn primary" id="txt-ok">' + (isNew ? 'Aggiungi' : 'Salva') + '</button>' +
          '</div></div></div>');
    modal.find('#txt-title').val(item ? item.title : '');
    modal.find('#txt-body').val(item ? item.text : '');
    function close() { modal.remove(); }
    modal.on('click', '#txt-cancel', close);
    modal.on('click', function(e) { if (e.target === modal[0]) close(); });
    modal.on('click', '#txt-ok', function() {
        var title = modal.find('#txt-title').val().trim();
        var text = modal.find('#txt-body').val().replace(/\s+$/, '');
        if (!title && !text.trim()) { close(); return; }
        if (isNew) {
            addItem({ type: 'text', title: title, text: text }, false);
        } else {
            item.title = title; item.text = text;
            markCollectionChanged();
            renderCollectionList();
        }
        close();
        if (collectionPreviewActive()) updatePreview();
    });
    $('body').append(modal);
    modal.find(isNew ? '#txt-title' : '#txt-body').focus();
}

// =========================================================
// RENDERING DEI BLOCCHI DI TESTO
// =========================================================

var textMeasureCtx = null;

function measureTextWidth(text, sizePx, italic, bold) {
    if (!textMeasureCtx) textMeasureCtx = document.createElement('canvas').getContext('2d');
    textMeasureCtx.font = (italic ? 'italic ' : '') + (bold ? 'bold ' : '') + sizePx + 'px ' + fontStack();
    return textMeasureCtx.measureText(text).width;
}

function wrapWords(text, maxWidth, sizePx, italic, bold) {
    var words = text.split(/\s+/).filter(Boolean);
    var lines = [], cur = '';
    words.forEach(function(w) {
        var test = cur ? cur + ' ' + w : w;
        if (!cur || measureTextWidth(test, sizePx, italic, bold) <= maxWidth) cur = test;
        else { lines.push(cur); cur = w; }
    });
    if (cur) lines.push(cur);
    return lines;
}

function normalizeLiturgicalSigns(s) {
    return s.replace(/\bV\/\.?/g, '℣.').replace(/\bR\/\.?/g, '℟.').replace(/(^|\s)\+(?=\s|$)/g, '$1✠');
}

// Testo con i segni ℣ ℟ ✠ * in rosso
function appendRichText(textEl, line, colors) {
    var parts = line.split(/([℣℟✠*†])/);
    parts.forEach(function(p) {
        if (!p) return;
        var ts = document.createElementNS(SVG_NS, 'tspan');
        if (/^[℣℟✠*†]$/.test(p)) ts.setAttribute('fill', colors.rubric);
        ts.textContent = p;
        textEl.appendChild(ts);
    });
}

function renderTextBlock(item, scheme, layoutWidth) {
    return loadFonts(userSettings.fontFamily).then(function() {
        var colors = schemeColors(scheme);
        var size = userSettings.lyricSize;
        var lineH = size * 1.32;
        var svg = document.createElementNS(SVG_NS, 'svg');
        var items = [];
        var y = 0;
        function addLine(build, top, bottom, keep) {
            var g = document.createElementNS(SVG_NS, 'g');
            build(g);
            g.setAttribute('data-bn-item', items.length);
            svg.appendChild(g);
            items.push({ type: keep ? 'titles' : 'line', keepWithNext: !!keep, el: g, top: top, bottom: bottom });
        }

        if (item.title) {
            var ts = userSettings.titleSize * 0.8;
            wrapWords(item.title, layoutWidth, ts).forEach(function(line, i, arr) {
                y += i === 0 ? ts : ts * 1.15;
                var yy = y;
                addLine(function(g) {
                    g.appendChild(svgText(layoutWidth / 2, yy, line, {
                        'text-anchor': 'middle', 'font-size': ts, fill: colors.ink
                    }));
                }, yy - ts * 0.85, yy + ts * 0.3, i === arr.length - 1);
            });
            y += ts * 0.55;
        }

        var paragraphs = (item.text || '').replace(/\r\n?/g, '\n').split(/\n\s*\n/);
        paragraphs.forEach(function(para, pIdx) {
            para = para.replace(/\s+$/, '');
            if (!para.trim()) return;
            var rubric = /^\s*>/.test(para);
            if (rubric) para = para.replace(/^\s*>\s?/, '').replace(/\n\s*>\s?/g, '\n');
            para = normalizeLiturgicalSigns(para);
            var fill = rubric ? colors.rubric : colors.ink;
            para.split('\n').forEach(function(rawLine) {
                wrapWords(rawLine, layoutWidth, size, rubric).forEach(function(line) {
                    y += (y === 0) ? size : lineH;
                    var yy = y;
                    addLine(function(g) {
                        var t = svgText(0, yy, '', { 'font-size': size, fill: fill });
                        if (rubric) {
                            t.setAttribute('font-style', 'italic');
                            t.textContent = line;
                        } else {
                            appendRichText(t, line, colors);
                        }
                        g.appendChild(t);
                    }, yy - size * 0.85, yy + size * 0.3, false);
                });
            });
            if (pIdx < paragraphs.length - 1) y += size * 0.45;
        });

        var top = items.length ? items[0].top : 0;
        var bottom = items.length ? items[items.length - 1].bottom : 0;
        return {
            svg: svg, scheme: scheme, colors: colors, items: items,
            bbox: { x: 0, y: top, width: layoutWidth, height: bottom - top },
            layoutWidth: layoutWidth, doc: null, lineCount: items.length
        };
    });
}

// =========================================================
// COMPOSIZIONE DEL LIBRETTO
// =========================================================

function collectionPreviewActive() {
    return collectionPreviewMode === 'libretto';
}

function pieceGapUnits() {
    return 24 + 7 * 2 * userSettings.lineSpacing;
}

function tocFontSize(geom) {
    return Math.max(11, Math.min(15, geom.width / 42));
}

function tocEntriesPerPage(geom, first) {
    var size = tocFontSize(geom);
    var lineH = size * 1.75;
    var head = first ? size * 4.2 : 0;
    return Math.max(1, Math.floor((geom.contentHeight - head) / lineH));
}

function countTocPages(geom, n) {
    if (!n) return 0;
    var first = tocEntriesPerPage(geom, true), rest = tocEntriesPerPage(geom, false);
    return n <= first ? 1 : 1 + Math.ceil((n - first) / rest);
}

// Rende tutti gli elementi in sequenza; i brani con errori vengono segnalati
function renderCollectionResults(scheme) {
    var geom = pageGeometry();
    var layoutWidth = geom.contentWidth / userSettings.scale;
    var results = [], errors = [];
    var chain = Promise.resolve();
    collection.items.forEach(function(item, idx) {
        chain = chain.then(function() {
            if (item.type === 'break') { results.push({ pageBreak: true, item: item }); return; }
            var p = item.type === 'chant'
                ? renderChant(item.gabc, scheme, layoutWidth)
                : renderTextBlock(item, scheme, layoutWidth);
            return p.then(function(r) {
                r.item = item;
                r.label = itemLabel(item);
                if (r.items.length) results.push(r);
            }, function(e) {
                errors.push((idx + 1) + '. ' + itemLabel(item) + ': ' + (e && e.message ? e.message : e));
            });
        });
    });
    return chain.then(function() { return { results: results, errors: errors, geom: geom }; });
}

function composeLibretto(rendered, scheme) {
    var geom = rendered.geom;
    var colors = schemeColors(scheme);
    var flow = paginateFlow(rendered.results, geom, {
        gap: pieceGapUnits(),
        newPagePerPiece: librettoSettings.newPagePerPiece
    });

    // pagina di inizio di ogni elemento (indice del flusso)
    var startPage = {};
    flow.forEach(function(page, pi) {
        page.slices.forEach(function(sl) {
            if (sl.items[0] === sl.result.items[0] && startPage[sl.result.item.id] === undefined) {
                startPage[sl.result.item.id] = pi;
            }
        });
    });

    var tocEntries = [];
    if (librettoSettings.toc) {
        rendered.results.forEach(function(r) {
            if (r.pageBreak) return;
            if (r.item.type === 'text' && !r.item.title) return;
            var abbr = '';
            if (r.item.type === 'chant') abbr = officePartAbbr(headerGet(parseGabc(r.item.gabc), 'office-part'));
            tocEntries.push({ id: r.item.id, label: r.label, abbr: abbr });
        });
        if (librettoSettings.tocOrder === 'alpha') {
            tocEntries.sort(function(a, b) { return a.label.localeCompare(b.label, 'it', { sensitivity: 'base' }); });
        }
    }

    var frontCount = librettoSettings.frontispiece ? (librettoSettings.blankAfterFront ? 2 : 1) : 0;
    var tocCount = countTocPages(geom, tocEntries.length);
    var offset = frontCount + tocCount;
    tocEntries.forEach(function(e) {
        e.page = startPage[e.id] !== undefined ? offset + startPage[e.id] + 1 : null;
    });

    var pages = [];   // { kind, svg }
    var mirrored = librettoSettings.mirrored;
    if (librettoSettings.frontispiece) {
        pages.push({ kind: 'Frontespizio', svg: buildFrontispiece(geom, colors) });
        if (librettoSettings.blankAfterFront) pages.push({ kind: 'Retro del frontespizio', svg: buildBlankPage(geom, colors), blank: true });
    }
    if (tocCount) {
        buildTocPages(geom, colors, tocEntries, pages.length, mirrored).forEach(function(svg) {
            pages.push({ kind: 'Indice', svg: svg });
        });
    }

    flow.forEach(function(page, pi) {
        var physical = offset + pi + 1;
        var first = page.slices[0];
        var startsHere = first.items[0] === first.result.items[0];
        var head = null;
        if (librettoSettings.runningHeads && !startsHere) {
            // verso: titolo della raccolta; recto: brano in corso
            var inProgress = first.result.item.type === 'chant' ? first.result.label
                           : (first.result.item.title || collection.title);
            head = (mirrored && physical % 2 === 0) ? (collection.title || inProgress) : inProgress;
        }
        pages.push({
            kind: 'Pagina ' + physical,
            svg: buildPageSvg(page, pi, flow.length, geom, {
                colors: colors, number: userSettings.pageNumbers ? physical : null,
                physical: physical, mirrored: mirrored, head: head
            })
        });
    });

    return { pages: pages, geom: geom, contentPages: flow.length, errors: rendered.errors };
}

function buildBlankPage(geom, colors) {
    var svg = createSvgRoot(geom.width, geom.height, '0 0 ' + geom.width + ' ' + geom.height);
    svg.setAttribute('class', 'bn-page');
    svg.appendChild(svgRect(0, 0, geom.width, geom.height, colors.background));
    return svg;
}

function buildFrontispiece(geom, colors) {
    var svg = buildBlankPage(geom, colors);
    var cx = geom.width / 2;
    var maxW = geom.contentWidth;
    var titleSize = Math.min(geom.width / 13, userSettings.titleSize * 1.5);
    var y = geom.height * 0.30;
    var title = collection.title || 'Raccolta';
    wrapWords(title, maxW, titleSize).forEach(function(line, i) {
        if (i) y += titleSize * 1.15;
        svg.appendChild(svgText(cx, y, line, { 'text-anchor': 'middle', 'font-size': titleSize, fill: colors.ink }));
    });
    // filetto rosso
    y += titleSize * 0.8;
    var rule = svgRect(cx - geom.contentWidth * 0.18, y, geom.contentWidth * 0.36, 1.2, colors.rubric);
    svg.appendChild(rule);
    if (collection.subtitle) {
        var subSize = titleSize * 0.48;
        y += subSize * 2;
        wrapWords(collection.subtitle, maxW, subSize, true).forEach(function(line, i) {
            if (i) y += subSize * 1.3;
            svg.appendChild(svgText(cx, y, line, {
                'text-anchor': 'middle', 'font-size': subSize, 'font-style': 'italic', fill: colors.ink
            }));
        });
    }
    if (collection.editor) {
        var edSize = titleSize * 0.4;
        var lines = collection.editor.split('\n').filter(function(l) { return l.trim(); });
        var ey = geom.height - geom.bottom - (lines.length - 1) * edSize * 1.4 - edSize;
        lines.forEach(function(l) {
            wrapWords(l, maxW, edSize).forEach(function(line) {
                svg.appendChild(svgText(cx, ey, line, { 'text-anchor': 'middle', 'font-size': edSize, fill: colors.ink }));
                ey += edSize * 1.4;
            });
        });
    }
    return svg;
}

function buildTocPages(geom, colors, entries, pagesBefore, mirrored) {
    var size = tocFontSize(geom);
    var lineH = size * 1.75;
    var svgs = [];
    var i = 0, pageIdx = 0;
    while (i < entries.length) {
        var physical = pagesBefore + pageIdx + 1;
        var svg = buildBlankPage(geom, colors);
        var left = pageLeftMargin(geom, physical, mirrored);
        var right = left + geom.contentWidth;
        var y = geom.top;
        if (pageIdx === 0) {
            y += size * 1.6;
            svg.appendChild(svgText(left + geom.contentWidth / 2, y, 'Indice', {
                'text-anchor': 'middle', 'font-size': size * 1.6, fill: colors.ink
            }));
            y += size * 2.6;
        } else {
            y += size;
        }
        var per = tocEntriesPerPage(geom, pageIdx === 0);
        for (var k = 0; k < per && i < entries.length; k++, i++) {
            var e = entries[i];
            var num = e.page ? String(e.page) : '–';
            var numW = measureTextWidth(num, size);
            var x = left;
            if (e.abbr) {
                svg.appendChild(svgText(x, y, e.abbr, {
                    'font-size': size * 0.85, 'font-style': 'italic', fill: colors.rubric
                }));
                x += Math.max(measureTextWidth(e.abbr, size * 0.85, true) + size * 0.5, size * 3.6);
            }
            var avail = right - numW - size * 1.5 - x;
            var label = e.label;
            if (measureTextWidth(label, size) > avail) {
                while (label.length > 3 && measureTextWidth(label + '…', size) > avail) label = label.slice(0, -1);
                label = label.replace(/\s+$/, '') + '…';
            }
            svg.appendChild(svgText(x, y, label, { 'font-size': size, fill: colors.ink }));
            // puntini di guida
            var x1 = x + measureTextWidth(label, size) + size * 0.4;
            var x2 = right - numW - size * 0.4;
            if (x2 > x1) {
                var dots = document.createElementNS(SVG_NS, 'line');
                dots.setAttribute('x1', x1); dots.setAttribute('x2', x2);
                dots.setAttribute('y1', y - size * 0.05); dots.setAttribute('y2', y - size * 0.05);
                dots.setAttribute('stroke', colors.ink);
                dots.setAttribute('stroke-width', 0.9);
                dots.setAttribute('stroke-dasharray', '0.9 3.6');
                svg.appendChild(dots);
            }
            svg.appendChild(svgText(right, y, num, { 'text-anchor': 'end', 'font-size': size, fill: colors.ink }));
            y += lineH;
        }
        // numero di pagina
        var outerRight = physical % 2 === 1 || !mirrored;
        var nx = mirrored ? (outerRight ? right : left) : geom.width / 2;
        var anchor = mirrored ? (outerRight ? 'end' : 'start') : 'middle';
        svg.appendChild(svgText(nx, geom.height - Math.max(geom.bottom / 2, 14), String(physical), {
            'text-anchor': anchor, 'font-size': Math.max(10, userSettings.lyricSize * 0.7), fill: colors.ink
        }));
        svgs.push(svg);
        pageIdx++;
    }
    return svgs;
}

// ---------------------------------------------------------
// Anteprima del libretto
// ---------------------------------------------------------

function updateCollectionPreview(token) {
    var container = document.getElementById('chant-preview');
    if (!collection.items.length) {
        container.className = 'clickable';
        container.innerHTML = '<p style="color:gray;">La raccolta è vuota: aggiungi dei brani per vedere il libretto.</p>';
        return;
    }
    renderCollectionResults('screen').then(function(rendered) {
        if (token !== renderToken) return;
        var out = composeLibretto(rendered, 'screen');
        lastCollectionRender = out;
        container.innerHTML = '';
        container.className = 'clickable page-mode';
        out.pages.forEach(function(p) {
            var sheet = document.createElement('div');
            sheet.className = 'page-sheet';
            sheet.style.maxWidth = out.geom.width + 'px';
            sheet.appendChild(p.svg);
            container.appendChild(sheet);
            var lbl = document.createElement('div');
            lbl.className = 'page-label';
            lbl.textContent = p.kind;
            container.appendChild(lbl);
        });
        var chants = collection.items.filter(function(i) { return i.type === 'chant'; }).length;
        $('#page-info').text('Libretto: ' + out.pages.length + ' pagine ' + userSettings.paper.toUpperCase());
        if (out.errors.length) {
            setStatus('Libretto: errori in ' + out.errors.join(' | '), true);
        } else if (!$('#gabc-status').hasClass('error')) {
            setStatus('✓ Libretto: ' + chants + (chants === 1 ? ' brano, ' : ' brani, ') + out.pages.length + ' pagine', false);
        }
    }).catch(function(e) {
        console.error(e);
        setStatus('Errore nel libretto: ' + (e.message || e), true);
    });
}

function setCollectionPreviewMode(mode) {
    collectionPreviewMode = mode;
    $('input[name="preview-mode"][value="' + mode + '"]').prop('checked', true);
    updatePreview();
}

// =========================================================
// ESPORTAZIONE DEL LIBRETTO
// =========================================================

function renderLibrettoForExport() {
    if (!collection.items.length) return Promise.reject(new Error('La raccolta è vuota.'));
    return renderCollectionResults('print').then(function(rendered) {
        if (rendered.errors.length &&
            !confirm('Alcuni brani contengono errori e verranno omessi:\n' + rendered.errors.join('\n') + '\n\nContinuare?')) {
            throw new Error('Esportazione annullata.');
        }
        return composeLibretto(rendered, 'print');
    });
}

function setLibrettoPdfProperties(pdf) {
    pdf.setProperties({
        title: collection.title || 'Libretto',
        subject: collection.subtitle || '',
        author: collection.editor ? collection.editor.split('\n')[0] : '',
        creator: 'Benedictus - GABC Chant Editor'
    });
}

// PDF con le pagine in ordine di lettura
function exportLibrettoPDF() {
    if (!pdfAvailable()) return;
    showBusy('Generazione del libretto…');
    var family = userSettings.fontFamily;
    Promise.all([renderLibrettoForExport(), loadFontData(family)]).then(function(r) {
        var out = r[0], geom = out.geom;
        var w = geom.wmm * PT_PER_MM, h = geom.hmm * PT_PER_MM;
        var pdf = newPdf(geom.wmm, geom.hmm);
        registerPdfFonts(pdf, family, r[1]);
        setLibrettoPdfProperties(pdf);
        var chain = Promise.resolve();
        out.pages.forEach(function(p, i) {
            chain = chain.then(function() {
                showBusy('Generazione del libretto… pagina ' + (i + 1) + ' di ' + out.pages.length);
                if (i > 0) pdf.addPage([w, h], w > h ? 'landscape' : 'portrait');
                return drawSvgOnPdf(pdf, p.svg, 0, 0, w, h);
            });
        });
        return chain.then(function() {
            pdf.save(collectionBaseName() + '.pdf');
            showBusy(null);
        });
    }).catch(function(e) {
        if (e && e.message === 'Esportazione annullata.') { showBusy(null); return; }
        exportError(e);
    });
}

// Ordine delle pagine per un fascicolo a punto metallico (pagine multiple di 4)
function bookletSheets(n) {
    var sheets = [];
    for (var s = 0; s < n / 4; s++) {
        sheets.push({ front: [n - 1 - 2 * s, 2 * s], back: [2 * s + 1, n - 2 - 2 * s] });
    }
    return sheets;
}

// PDF imposto: due pagine per facciata, da stampare fronte-retro (lato corto) e piegare
function exportLibrettoImposedPDF() {
    if (!pdfAvailable()) return;
    showBusy('Imposizione del libretto…');
    var family = userSettings.fontFamily;
    Promise.all([renderLibrettoForExport(), loadFontData(family)]).then(function(r) {
        var out = r[0], geom = out.geom;
        var pages = out.pages.map(function(p) { return p.svg; });
        while (pages.length % 4) pages.push(null);       // pagine bianche finali
        var w = geom.wmm * PT_PER_MM, h = geom.hmm * PT_PER_MM;
        var pdf = newPdf(geom.wmm * 2, geom.hmm);
        registerPdfFonts(pdf, family, r[1]);
        setLibrettoPdfProperties(pdf);
        var sides = [];
        bookletSheets(pages.length).forEach(function(sh) { sides.push(sh.front, sh.back); });
        var chain = Promise.resolve();
        sides.forEach(function(side, si) {
            chain = chain.then(function() {
                showBusy('Imposizione del libretto… facciata ' + (si + 1) + ' di ' + sides.length);
                if (si > 0) pdf.addPage([2 * w, h], 'landscape');
                var left = pages[side[0]], right = pages[side[1]];
                return Promise.resolve()
                    .then(function() { if (left) return drawSvgOnPdf(pdf, left.cloneNode(true), 0, 0, w, h); })
                    .then(function() { if (right) return drawSvgOnPdf(pdf, right.cloneNode(true), w, 0, w, h); });
            });
        });
        return chain.then(function() {
            pdf.save(collectionBaseName() + '-da-stampare.pdf');
            showBusy(null);
            alert('PDF pronto: ' + sides.length / 2 + (sides.length === 2 ? ' foglio' : ' fogli') +
                  '. Stampa fronte-retro con capovolgimento sul lato corto, poi piega a metà.');
        });
    }).catch(function(e) {
        if (e && e.message === 'Esportazione annullata.') { showBusy(null); return; }
        exportError(e);
    });
}

// =========================================================
// INIZIALIZZAZIONE
// =========================================================

$(function() {
    pristineEditorValue = $('#editor').val();

    if (restoreCollectionFromStorage()) {
        setStatus('Raccolta "' + (collection.title || 'senza titolo') + '" ripristinata (' + collection.items.length + ' elementi).', false);
    }
    syncLibrettoControls();
    renderCollectionList();

    // Metadati della raccolta
    $('#coll-title').on('input', function() { collection.title = $(this).val(); markCollectionChanged(); if (collectionPreviewActive()) schedulePreview(400); });
    $('#coll-subtitle').on('input', function() { collection.subtitle = $(this).val(); markCollectionChanged(); if (collectionPreviewActive()) schedulePreview(400); });
    $('#coll-editor').on('input', function() { collection.editor = $(this).val(); markCollectionChanged(); if (collectionPreviewActive()) schedulePreview(400); });

    // Pulsanti
    $('#coll-add-current').on('click', addCurrentChant);
    $('#coll-add-new').on('click', addNewChant);
    $('#coll-add-text').on('click', function() { showTextItemModal(null); });
    $('#coll-add-break').on('click', addPageBreak);
    $('#coll-import').on('click', function() { $('#collection-gabc-input').val('').trigger('click'); });
    $('#collection-gabc-input').on('change', function() { importGabcFilesIntoCollection(this.files); });
    $('#coll-open').on('click', function(e) { e.preventDefault(); $('#collection-file-input').val('').trigger('click'); });
    $('#collection-file-input').on('change', function() { openCollectionFile(this.files && this.files[0]); });
    $('#coll-save').on('click', function(e) { e.preventDefault(); saveCollectionFile(); });
    $('#coll-clear').on('click', function(e) { e.preventDefault(); clearCollection(); });
    $('#coll-detach').on('click', function(e) {
        e.preventDefault();
        collection.activeId = null;
        renderCollectionList();
    });

    // Elenco: apri, duplica, rimuovi
    $('#collection-list').on('click', '.coll-btn', function(e) {
        e.stopPropagation();
        var id = $(this).closest('li').data('id');
        var act = $(this).data('act');
        if (act === 'open') openItemInEditor(id);
        else if (act === 'dup') duplicateItem(id);
        else if (act === 'del') removeItem(id);
    });
    $('#collection-list').on('dblclick', '.coll-item', function() { openItemInEditor($(this).data('id')); });

    // Riordino per trascinamento
    if ($.fn.sortable) {
        $('#collection-list').sortable({
            handle: '.coll-handle',
            axis: 'y',
            items: '> li.coll-item',
            update: function() {
                var order = $('#collection-list > li.coll-item').map(function() { return $(this).data('id'); }).get();
                collection.items.sort(function(a, b) { return order.indexOf(a.id) - order.indexOf(b.id); });
                markCollectionChanged();
                renderCollectionList();
                if (collectionPreviewActive()) updatePreview();
            }
        });
    }

    // Anteprima: brano / libretto
    $('input[name="preview-mode"]').on('change', function() {
        if (this.checked) setCollectionPreviewMode(this.value);
    });

    // Opzioni del libretto
    [['#lib-front', 'frontispiece'], ['#lib-blank', 'blankAfterFront'], ['#lib-toc', 'toc'],
     ['#lib-newpage', 'newPagePerPiece'], ['#lib-heads', 'runningHeads'], ['#lib-mirrored', 'mirrored']].forEach(function(o) {
        $(o[0]).on('change', function() {
            librettoSettings[o[1]] = $(this).is(':checked');
            markCollectionChanged();
            if (collectionPreviewActive()) updatePreview();
        });
    });
    $('#lib-toc-order').on('change', function() {
        librettoSettings.tocOrder = $(this).val();
        markCollectionChanged();
        if (collectionPreviewActive()) updatePreview();
    });
    $('#export-libretto-pdf').on('click', exportLibrettoPDF);
    $('#export-libretto-imposed').on('click', exportLibrettoImposedPDF);

    // Avviso alla chiusura se la raccolta non è stata salvata su file
    $(window).on('beforeunload', function(e) {
        if (collectionDirty && collection.items.length) {
            e.preventDefault();
            return 'La raccolta non è stata salvata.';
        }
    });
});
