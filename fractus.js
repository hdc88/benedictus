// =========================================================
// BENEDICTUS - CANTO FRATTO (cantus fractus)
// =========================================================
// Attivato dal campo d'intestazione  notation: fractus;
// Il file resta GABC valido: si riusano forme già esistenti, che in
// Benedictus vengono disegnate come figure mensurali.
//
//   g      brevis         (punctum quadratum)
//   gv     longa          (virga: quadrata con cauda)
//   G      semibrevis     (losanga isolata)
//   gs/Gs  minima         (losanga con cauda)
//   go/Go  semiminima     (losanga con cauda e cediglia)
//   g.     punctum additionis (mora)
//   <alt>C</alt>()  segno di mensura sul rigo: C, ¢ (o C|), O, O|, 3, C3, ¢3, 3/2
//
// Nel canto fratto ogni figura è una nota a sé: all'interno di un gruppo
// le note mensurali vengono separate automaticamente (non si formano
// neumi discendenti come nel climacus).

var FRACTUS_SIGN_RE = /^(C|¢|C\||O|O\||Φ|3|2|C3|¢3|C\|3|O3|3\/2|C2|¢2)$/;

function isFractusDoc(doc) {
    var n = (headerGet(doc, 'notation') || '').toLowerCase();
    return /fract|fratto|mensural/.test(n);
}

function isPitchLetter(ch) {
    return /[a-mA-M]/.test(ch);
}

// Scompone il contenuto di un gruppo di note in note singole
// (con alterazioni e modificatori), restituendo le posizioni d'inizio.
function fractusNoteStarts(inner) {
    var starts = [];
    var i = 0;
    while (i < inner.length) {
        var ch = inner[i];
        if (ch === '[') {                         // attributi [..] : da saltare
            var j = inner.indexOf(']', i);
            i = j < 0 ? inner.length : j + 1;
            continue;
        }
        if (isPitchLetter(ch)) {
            var next = inner[i + 1];
            if (next === 'x' || next === 'y' || next === '#') {
                // alterazione: appartiene alla nota successiva
                starts.push({ pos: i, accidental: true });
                i += 2;
                // la lettera della nota alterata (se presente) fa parte dello stesso inizio
                if (isPitchLetter(inner[i] || '')) i++;
                continue;
            }
            starts.push({ pos: i, accidental: false });
        }
        i++;
    }
    // modificatori di ciascuna nota = testo fino all'inizio successivo
    starts.forEach(function(s, k) {
        var end = k + 1 < starts.length ? starts[k + 1].pos : inner.length;
        var core = inner.slice(s.pos, end).replace(/^[a-mA-M][xy#]/, '');
        var letter = core.charAt(0);
        var mods = core.slice(1).replace(/\[[^\]]*\]/g, '');
        s.mensural = /[A-M]/.test(letter) || /[so]/.test(mods);
    });
    return starts;
}

// Inserisce "/" tra le note mensurali di uno stesso gruppo
function fractusPreprocess(body) {
    // spazio per i segni di mensura: <alt>C3</alt>() → note segnaposto (quilisma, poi nascoste)
    body = body.replace(/<alt>\s*([^<]*?)\s*<\/alt>\s*\(\s*\)/g, function(all, sign) {
        if (!FRACTUS_SIGN_RE.test(sign)) return all;
        var n = Math.max(2, Math.ceil(sign.replace('|', '').length * 1.4));
        var notes = [];
        for (var i = 0; i < n; i++) notes.push('hw');
        return '<alt>' + sign + '</alt>(' + notes.join('/') + ')';
    });
    return body.replace(/\(([^()]*)\)/g, function(all, inner) {
        if (/^\s*[cf]b?[1-5]\s*$/i.test(inner)) return all;            // chiave
        var starts = fractusNoteStarts(inner);
        if (starts.length < 2) return all;
        var out = '', last = 0;
        for (var k = 1; k < starts.length; k++) {
            var pos = starts[k].pos;
            var prevChar = inner.slice(0, pos).replace(/\s+$/, '').slice(-1);
            if ((starts[k].mensural || starts[k - 1].mensural) && prevChar !== '/' && prevChar !== '!' && prevChar !== '@') {
                out += inner.slice(last, pos) + '/';
                last = pos;
            }
        }
        out += inner.slice(last);
        return '(' + out + ')';
    });
}

// Glifo della losanga (punctum inclinatum) nelle <defs>, se manca
function ensureGlyphDef(svg, name) {
    if (svg.querySelector('[id="' + name + '"]')) return true;
    var glyph = exsurge.Glyphs && exsurge.Glyphs[name];
    var defs = svg.querySelector('defs');
    var sample = svg.querySelector('defs g.glyph');
    if (!glyph || !defs) return false;
    var g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('id', name);
    g.setAttribute('class', 'glyph');
    g.setAttribute('transform', sample ? sample.getAttribute('transform') : 'scale(0.07)');
    glyph.paths.forEach(function(p) {
        var path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('d', p.data);
        g.appendChild(path);
    });
    defs.appendChild(g);
    return true;
}

function setUseHref(use, href) {
    use.removeAttributeNS(XLINK_NS, 'href');
    use.removeAttribute('href');
    use.setAttributeNS(XLINK_NS, 'xlink:href', href);
    use.setAttribute('href', href);
}

// Disegna le figure mensurali sull'SVG già impaginato (agganciato al DOM).
// Si usa il modello di Exsurge: ogni nota conosce il proprio GABC e il proprio nodo SVG.
function applyFractus(svg, score, colors, staffInterval) {
    var si = staffInterval || 7;
    var stemW = Math.max(1, si * 0.16);
    var stemLen = si * 4;
    var hasRhombus = ensureGlyphDef(svg, 'PunctumInclinatum');

    // legature oblique: nota@nota (es. d@c, ds@c, dv@c); Exsurge può dividerle in due neumi
    var allNotes = [];
    (score.notations || []).forEach(function(nt) { (nt.notes || []).forEach(function(n) { allNotes.push(n); }); });
    var ligatureNotes = [];
    var body = score.bnEngineBody || '';
    for (var li = 0; li + 1 < allNotes.length; li++) {
        var info = ligatureInfo(body, allNotes[li].sourceIndex);
        if (!info) continue;
        drawObliqueLigature(allNotes[li], allNotes[li + 1], info.stem, colors, si, stemW, stemLen);
        ligatureNotes.push(allNotes[li], allNotes[li + 1]);
        li++;
    }

    (score.notations || []).forEach(function(nt) {
        var notes = nt.notes || [];
        if (!notes.length) return;

        // note segnaposto dei segni di mensura: si lascia solo il testo
        if (notes.every(function(n) { return /^[a-m]w/.test(n.sourceGabc || ''); })) {
            var g = notes[0].svgNode && notes[0].svgNode.parentNode;
            while (g && !(g.getAttribute('class') || '').match(/ChantNotationElement/)) g = g.parentNode;
            if (g) {
                Array.prototype.slice.call(g.childNodes).forEach(function(ch) {
                    if (ch.tagName !== 'text') ch.parentNode.removeChild(ch);
                });
            }
            return;
        }

        notes.forEach(function(note) {
            if (ligatureNotes.indexOf(note) >= 0) return;
            var gabc = (note.sourceGabc || '').replace(/\[[^\]]*\]/g, '');
            var core = gabc.replace(/^[a-mA-M][xy#]/, '');
            var mods = core.slice(1);
            var kind = /o/.test(mods) ? 'semiminima' : (/s/.test(mods) ? 'minima' : null);
            // losanga con cauda in giù: lettera maiuscola + v (es. Gv)
            var forceDown = false;
            if (!kind && /[A-M]/.test(core.charAt(0)) && /v/i.test(mods)) { kind = 'minima'; forceDown = true; }
            var use = note.svgNode;
            if (!kind || !use || !use.parentNode) return;

            if (hasRhombus) setUseHref(use, '#PunctumInclinatum');
            if (forceDown) {
                // Exsurge l'ha disegnata come virga: si toglie la cauda
                Array.prototype.slice.call(use.parentNode.querySelectorAll('rect.neumeLine')).forEach(function(r) {
                    if (use.parentNode.querySelectorAll('use').length === 1) r.parentNode.removeChild(r);
                });
            }
            var bb = use.getBBox();
            var cx = bb.x + bb.width / 2;
            // cauda in su (stampe veneziane, es. Graduale Giunta 1499-1500) oppure secondo l'altezza
            var up = forceDown ? false
                   : (userSettings.minimaStems === 'auto' ? !(note.staffPosition > 0) : true);
            var y0 = up ? bb.y + bb.height * 0.2 : bb.y + bb.height * 0.8;
            var y1 = up ? y0 - stemLen : y0 + stemLen;

            var parent = use.parentNode;
            var stem = document.createElementNS(SVG_NS, 'rect');
            stem.setAttribute('x', cx - stemW / 2);
            stem.setAttribute('y', Math.min(y0, y1));
            stem.setAttribute('width', stemW);
            stem.setAttribute('height', Math.abs(y1 - y0));
            stem.setAttribute('fill', colors.ink);
            stem.setAttribute('class', 'bn-fractus-stem');
            parent.appendChild(stem);

            if (kind === 'semiminima') {
                // codetta (uncus) all'estremità della cauda, verso destra
                var d = up ? 1 : -1;
                var fx = cx + stemW / 2;
                var flag = document.createElementNS(SVG_NS, 'path');
                flag.setAttribute('d',
                    'M' + (fx - stemW) + ',' + y1 +
                    ' L' + (fx + si * 0.95) + ',' + (y1 + d * si * 0.6) +
                    ' L' + (fx + si * 0.95) + ',' + (y1 + d * si * 1.1) +
                    ' L' + (fx - stemW) + ',' + (y1 + d * si * 0.55) + ' Z');
                flag.setAttribute('fill', colors.ink);
                flag.setAttribute('stroke', 'none');
                flag.setAttribute('class', 'bn-fractus-flag');
                parent.appendChild(flag);
            }
        });
    });

    // Segni di mensura: dal testo sopra il rigo al rigo stesso
    svg.querySelectorAll('text').forEach(function(t) {
        var cls = t.getAttribute('class') || '';
        if (cls.indexOf('aboveLinesText') < 0) return;
        var sign = t.textContent.trim();
        if (!FRACTUS_SIGN_RE.test(sign)) return;
        var cut = /¢|\|/.test(sign);
        var shown = sign.replace('¢', 'C').replace('|', '');
        var size = si * 5.4;
        while (t.firstChild) t.removeChild(t.firstChild);
        t.textContent = shown;
        t.setAttribute('x', 0);
        t.setAttribute('y', size * 0.33);
        t.setAttribute('text-anchor', 'start');
        t.style.fontSize = size + 'px';
        t.style.fontStyle = 'normal';
        t.style.fill = colors.ink;
        t.setAttribute('class', cls + ' bn-mensura');
        if (cut) {
            // taglio verticale del primo segno (C o O)
            var firstW = measureSignWidth(shown.charAt(0), size);
            var bar = document.createElementNS(SVG_NS, 'rect');
            bar.setAttribute('x', firstW * 0.55 - stemW / 2);
            bar.setAttribute('y', -si * 2.7);
            bar.setAttribute('width', stemW);
            bar.setAttribute('height', si * 5.4);
            bar.setAttribute('fill', colors.ink);
            bar.setAttribute('class', 'bn-fractus-stem');
            t.parentNode.appendChild(bar);
        }
    });
}

// Nel testo del motore: la nota in posizione idx è seguita da "@"? (con eventuali s / v)
function ligatureInfo(body, idx) {
    if (typeof idx !== 'number' || !isPitchLetter(body.charAt(idx))) return null;
    var mods = '';
    for (var k = idx + 1; k < body.length; k++) {
        var c = body.charAt(k);
        if (c === '@') return { stem: /s/.test(mods) ? 'up' : (/v/i.test(mods) ? 'down' : null) };
        if (isPitchLetter(c) || '/! ()['.indexOf(c) >= 0) return null;
        mods += c;
    }
    return null;
}

// Legatura obliqua: banda inclinata dalla prima alla seconda nota, lati verticali,
// cauda opzionale sul lato sinistro (in su = cum opposita proprietate)
function drawObliqueLigature(n1, n2, stem, colors, si, stemW, stemLen) {
    var u1 = n1.svgNode, u2 = n2.svgNode;
    if (!u1 || !u2 || !u1.parentNode) return;
    var parent = u1.parentNode;
    var b1 = u1.getBBox(), b2 = u2.getBBox();
    // se le due note stanno in gruppi diversi, si riporta la seconda nel sistema della prima
    if (u2.parentNode !== parent) {
        var m1 = parent.getCTM(), m2 = u2.parentNode.getCTM();
        if (m1 && m2) {
            var dx = (m2.e - m1.e) / (m1.a || 1), dy = (m2.f - m1.f) / (m1.d || 1);
            b2 = { x: b2.x + dx, y: b2.y + dy, width: b2.width, height: b2.height };
            u2.bnDy = dy;
        }
    }
    var y1 = parseFloat(u1.getAttribute('y')) || 0;
    var y2 = (parseFloat(u2.getAttribute('y')) || 0) + (u2.bnDy || 0);
    var t = si * 1.4;                          // spessore della banda (altezza di una nota quadrata)
    var x0 = Math.min(b1.x, b2.x);
    var x1 = Math.max(b1.x + b1.width, b2.x + b2.width);
    if (x1 - x0 < si * 2.2) x1 = x0 + si * 2.2;

    // via le due note e le linee del neuma di Exsurge (se il gruppo contiene solo la legatura)
    var others = Array.prototype.filter.call(parent.querySelectorAll('use'), function(u) { return u !== u1 && u !== u2; });
    if (!others.length) {
        Array.prototype.slice.call(parent.querySelectorAll('rect.neumeLine')).forEach(function(r) { r.parentNode.removeChild(r); });
    }
    parent.removeChild(u1);
    if (u2.parentNode) u2.parentNode.removeChild(u2);

    var band = document.createElementNS(SVG_NS, 'path');
    band.setAttribute('d',
        'M' + x0 + ',' + (y1 - t / 2) + ' L' + x1 + ',' + (y2 - t / 2) +
        ' L' + x1 + ',' + (y2 + t / 2) + ' L' + x0 + ',' + (y1 + t / 2) + ' Z');
    band.setAttribute('fill', colors.ink);
    band.setAttribute('stroke', 'none');
    band.setAttribute('class', 'bn-ligature');
    parent.appendChild(band);

    if (stem) {
        var r = document.createElementNS(SVG_NS, 'rect');
        var len = stemLen * 0.85;
        r.setAttribute('x', x0);
        r.setAttribute('y', stem === 'up' ? y1 - t / 2 - len : y1 + t / 2);
        r.setAttribute('width', stemW);
        r.setAttribute('height', len + t / 2);
        r.setAttribute('fill', colors.ink);
        r.setAttribute('class', 'bn-fractus-stem');
        parent.appendChild(r);
    }
}

// Custos obliquo delle stampe veneziane: piccola losanga con filetto diagonale
function applyCustosStyle(svg, colors) {
    if (userSettings.custosStyle !== 'obliquo') return;
    svg.querySelectorAll('use').forEach(function(u) {
        var href = u.getAttribute('href') || u.getAttributeNS(XLINK_NS, 'href') || '';
        if (!/Custos/.test(href)) return;
        var bb = u.getBBox();
        var cy = parseFloat(u.getAttribute('y')) || 0;
        var w = 3.4, h = 4.4;
        var cx = bb.x + w + 0.5;
        var head = document.createElementNS(SVG_NS, 'path');
        head.setAttribute('d', 'M' + (cx - w) + ',' + cy + ' L' + cx + ',' + (cy - h) + ' L' + (cx + w) + ',' + cy +
                               ' L' + cx + ',' + (cy + h) + ' Z');
        head.setAttribute('fill', colors.ink);
        head.setAttribute('stroke', 'none');
        var tail = document.createElementNS(SVG_NS, 'path');
        var x0 = cx + w * 0.6, y0 = cy - h * 0.4;
        tail.setAttribute('d', 'M' + x0 + ',' + y0 + ' L' + (x0 + 9) + ',' + (y0 - 22) +
                               ' L' + (x0 + 9.9) + ',' + (y0 - 21.6) + ' L' + (x0 + 0.9) + ',' + (y0 + 0.4) + ' Z');
        tail.setAttribute('fill', colors.ink);
        tail.setAttribute('stroke', 'none');
        head.setAttribute('class', 'bn-custos');
        tail.setAttribute('class', 'bn-custos');
        u.parentNode.insertBefore(head, u);
        u.parentNode.insertBefore(tail, u);
        u.parentNode.removeChild(u);
    });
}

var fractusMeasureCtx = null;
function measureSignWidth(text, size) {
    if (!fractusMeasureCtx) fractusMeasureCtx = document.createElement('canvas').getContext('2d');
    fractusMeasureCtx.font = size + 'px ' + fontStack();
    return fractusMeasureCtx.measureText(text).width;
}

// ---------------------------------------------------------
// Guida al canto fratto (per chi conosce già il GABC)
// ---------------------------------------------------------

// Esempio reale: Graduale, Venezia, Giunta 1499-1500, f. CCCL (Credo)
var FRACTUS_SOURCE_EXAMPLE =
    'name: Credo Cardinalis;\n' +
    'notation: fractus;\n' +
    'office-part: Credo;\n' +
    'manuscript: Graduale (Venezia, Giunta, 1499-1500);\n' +
    'manuscript-reference: f. CCCL;\n' +
    '%%\n' +
    '(c4) <alt>¢</alt>() PA(hv/hv)trem(dv/dv) om(hv)ni(G)po(F)ten(E!Ds!Es/ds@c)tem.(d/dv) (::)';

var FRACTUS_GUIDE_FIGURES = [
    { name: 'Longa', value: 'valore lungo', gabc: 'gv', ex: 'gv',
      gabcNote: 'È la virga: stessa scrittura, qui indica la longa.' },
    { name: 'Brevis', value: 'valore di base', gabc: 'g', ex: 'g',
      gabcNote: 'Il punctum quadratum, invariato.' },
    { name: 'Semibrevis', value: 'metà della brevis', gabc: 'G', ex: 'G',
      gabcNote: 'Maiuscola come il punctum inclinatum, ma resta una losanga isolata: non forma neumi discendenti.' },
    { name: 'Minima', value: 'metà della semibrevis', gabc: 'Gs', ex: 'Gs',
      gabcNote: 'La "s" (stropha) qui aggiunge la cauda. Vale anche gs.' },
    { name: 'Minima con cauda in giù', value: 'come la minima', gabc: 'Gv', ex: 'Gv',
      gabcNote: 'Maiuscola + "v": losanga con cauda discendente.' },
    { name: 'Semiminima', value: 'metà della minima', gabc: 'Go', ex: 'Go',
      gabcNote: 'La "o" (oriscus) qui aggiunge cauda e codetta. Vale anche go.' },
    { name: 'Punctum additionis', value: 'aumenta di metà', gabc: 'G.', ex: 'G.',
      gabcNote: 'È la mora; si può aggiungere a ogni figura: g. G. Gs.' }
];

var FRACTUS_GUIDE_PATTERNS = [
    { name: 'Semibreve puntata + minima', gabc: '(G.) (Gs)', ex: 'G.) (Gs' },
    { name: 'Due minime + semibreve', gabc: '(Hs) (Gs) (F)', ex: 'Hs) (Gs) (F' },
    { name: 'Longa finale', gabc: '(fv) (::)', ex: 'fv) (::' },
    { name: 'losanghe a contatto', gabc: '(G!H)', ex: 'G!H' },
    { name: 'losanghe separate nello stesso gruppo', gabc: '(GHI) = (G/H/I)', ex: 'GHI' },
    { name: 'Legatura di brevi', gabc: '(fg) (hg)', ex: 'fg) (hg' },
    { name: 'Legatura obliqua', gabc: '(d@c)', ex: 'd@c' },
    { name: 'Legatura obliqua, cauda in su a sinistra (cum opposita proprietate: due semibrevi)', gabc: '(ds@c)', ex: 'ds@c' },
    { name: 'Legatura obliqua, cauda in giù a sinistra', gabc: '(dv@c)', ex: 'dv@c' },
    { name: 'Segno di mensura sul rigo', gabc: '<alt>C3</alt>()', ex: '' , sign: 'C3' },
    { name: 'Segno tagliato', gabc: '<alt>¢</alt>()', ex: '', sign: '¢' }
];

function fractusGuideSnippet(ex, sign) {
    var body = '(c4) ' + (sign ? '<alt>' + sign + '</alt>() ' : '') + (ex ? '(' + ex + ')' : '');
    return 'notation: fractus;\ninitial-style: 0;\n%%\n' + body;
}

// Disegna gli esempi della guida uno dopo l'altro (senza titoli né annotazioni)
function renderFractusGuideExamples(modal) {
    var saved = {
        showTitle: userSettings.showTitle, showSubtitle: userSettings.showSubtitle,
        showOccasion: userSettings.showOccasion, showCommentary: userSettings.showCommentary,
        showSource: userSettings.showSource, allVersesToOneLine: userSettings.allVersesToOneLine
    };
    var cells = modal.find('[data-fractus-ex]').toArray();
    var chain = Promise.resolve();
    cells.forEach(function(cell) {
        chain = chain.then(function() {
            if (!document.body.contains(cell)) return;
            $.extend(userSettings, { showTitle: false, showSubtitle: false, showOccasion: false,
                                     showCommentary: false, showSource: false, allVersesToOneLine: false });
            var src = fractusGuideSnippet(cell.getAttribute('data-fractus-ex'), cell.getAttribute('data-sign'));
            return renderChant(src, 'screen', 400).then(function(r) {
                $.extend(userSettings, saved);
                // si ritaglia solo la parte con le note (senza testo sotto il rigo)
                var svg = buildCroppedSvg(r, 6);
                svg.removeAttribute('width');
                svg.removeAttribute('height');
                svg.style.height = '78px';
                svg.style.width = 'auto';
                svg.style.maxWidth = '100%';
                cell.innerHTML = '';
                cell.appendChild(svg);
                fitGuideSvgToNotes(svg);
            }, function() {
                $.extend(userSettings, saved);
                cell.textContent = '—';
            });
        });
    });
    return chain.then(function() { $.extend(userSettings, saved); });
}

// Restringe l'esempio alla sola zona delle note (il rigo è lungo quanto la riga)
function fitGuideSvgToNotes(svg) {
    var vb = svg.getAttribute('viewBox').split(/\s+/).map(parseFloat);
    var sr = svg.getBoundingClientRect();
    if (!sr.width) return;
    var minX = Infinity, maxX = -Infinity;
    svg.querySelectorAll('use, text, path, rect.dividerLine, rect.neumeLine, rect.bn-fractus-stem').forEach(function(el) {
        var r = el.getBoundingClientRect();
        if (!r.width && !r.height) return;
        minX = Math.min(minX, r.left);
        maxX = Math.max(maxX, r.right);
    });
    if (!isFinite(minX)) return;
    var k = vb[2] / sr.width;
    var x0 = vb[0] + (minX - sr.left) * k - 8;
    var x1 = vb[0] + (maxX - sr.left) * k + 14;
    svg.setAttribute('viewBox', x0 + ' ' + vb[1] + ' ' + (x1 - x0) + ' ' + vb[3]);
}

function showFractusGuide() {
    function code(s) { return '<code>' + escapeHtmlFr(s) + '</code>'; }
    var figRows = FRACTUS_GUIDE_FIGURES.map(function(f) {
        return '<tr><td><strong>' + f.name + '</strong><br><span class="fg-small">' + f.value + '</span></td>' +
               '<td>' + code('(' + f.gabc + ')') + '</td>' +
               '<td class="fg-ex" data-fractus-ex="' + escapeHtmlFr(f.ex) + '"></td>' +
               '<td class="fg-small">' + f.gabcNote + '</td></tr>';
    }).join('');
    var patRows = FRACTUS_GUIDE_PATTERNS.map(function(p) {
        return '<tr><td>' + p.name + '</td><td>' + code(p.gabc) + '</td>' +
               '<td class="fg-ex" data-fractus-ex="' + escapeHtmlFr(p.ex) + '"' +
               (p.sign ? ' data-sign="' + escapeHtmlFr(p.sign) + '"' : '') + '></td></tr>';
    }).join('');

    var html =
        '<div class="bn-modal" role="dialog" aria-modal="true"><div class="bn-modal-box fractus-guide">' +
        '<h2>Guida al canto fratto</h2>' +
        '<p class="sub">La sintassi è la stessa del GABC: cambia il significato di alcuni segni.</p>' +

        '<h3>1. Attivare la notazione</h3>' +
        '<p>Nel pannello <em>Intestazione</em> scegli <strong>Notazione</strong> e poi <strong>canto fratto</strong>, oppure scrivi nell\'header ' +
        code('notation: fractus;') + '. Vale per il singolo brano: in un libretto puoi alternare brani gregoriani e fratti.</p>' +

        '<h3>2. Cosa cambia rispetto al GABC ordinario</h3>' +
        '<ul>' +
        '<li><strong>Le maiuscole non formano più neumi.</strong> Nella notazione quadrata ' + code('(gFE)') + ' è un climacus; ' +
        'nel canto fratto diventa tre figure distinte: una brevis e due semibrevi.</li>' +
        '<li><strong>' + code('s') + ' e ' + code('o') + ' cambiano significato.</strong> Non indicano stropha e oriscus, ' +
        'ma aggiungono la cauda (minima) o cauda e codetta (semiminima).</li>' +
        '<li><strong>La virga è la longa.</strong> ' + code('gv') + ' si scrive come sempre; ' + code('Gv') +
        ' (maiuscola) è invece una losanga con cauda in giù.</li>' +
        '<li><strong>Le note quadrate restano legate.</strong> ' + code('(fg)') + ', ' + code('(gf)') +
        ' danno podatus e clivis come nei libri corali; le note mensurali invece vengono separate automaticamente.</li>' +
        '<li><strong>Legature oblique con ' + code('@') + '.</strong> ' + code('(d@c)') + ' unisce due note in una ' +
        'legatura obliqua; ' + code('s') + ' o ' + code('v') + ' sulla prima nota aggiungono la cauda a sinistra, in su o in giù. ' +
        'In Gregorio ' + code('@') + ' indica la fusione delle note, quindi il file resta leggibile.</li>' +
        '<li><strong>I segni di mensura vanno sul rigo.</strong> Il testo sopra il rigo ' + code('<alt>…</alt>') +
        ' seguito da ' + code('()') + ' con C, ¢, O, 3, C3… viene disegnato come segno di mensura.</li>' +
        '</ul>' +

        '<h3>3. Le figure</h3>' +
        '<table class="fractus-table"><thead><tr><th>Figura</th><th>GABC</th><th>Resa</th><th>Rispetto al solito</th></tr></thead>' +
        '<tbody>' + figRows + '</tbody></table>' +

        '<h3>4. Formule frequenti</h3>' +
        '<table class="fractus-table"><thead><tr><th>Formula</th><th>GABC</th><th>Resa</th></tr></thead>' +
        '<tbody>' + patRows + '</tbody></table>' +

        '<h3>5. Altri accorgimenti</h3>' +
        '<ul>' +
        '<li><strong>Iniziali rosse nel testo</strong> (come nelle stampe): ' + code('<c>E</c>t(f) in(g)') + '.</li>' +
        '<li><strong>Direzione della cauda delle minime</strong>: in <em>Stile della notazione</em> (sempre in su, come nelle ' +
        'edizioni a stampa, oppure secondo l\'altezza). ' + code('Gv') + ' dà sempre la cauda in giù.</li>' +
        '<li><strong>Custos obliquo</strong> e <strong>rigo rosso</strong>: in <em>Stile della notazione</em> e <em>Colori</em>.</li>' +
        '<li><strong>Compatibilità</strong>: il file resta GABC valido. Gregorio e gli altri editor mostreranno le stesse note ' +
        'in notazione quadrata (virga, stropha, oriscus, inclinatum).</li>' +
        '<li><strong>Limiti</strong>: la spaziatura non è proporzionale alla durata; non sono previste pause né note bianche.</li>' +
        '</ul>' +

        '<h3>6. Esempio da una fonte</h3>' +
        '<p>Credo, <em>Patrem omnipotentem</em>, dal Graduale stampato a Venezia da Giunta (1499-1500), f. CCCL.</p>' +
        '<pre class="fg-pre">' + escapeHtmlFr(FRACTUS_SOURCE_EXAMPLE) + '</pre>' +

        '<div class="bn-modal-actions">' +
        '<button class="bn-btn" id="fractus-example">Inserisci l\'esempio nell\'editor</button>' +
        '<button class="bn-btn primary" id="fractus-close">Chiudi</button></div>' +
        '</div></div>';

    var modal = $(html);
    function close() { modal.remove(); $(document).off('keydown.fractusguide'); }
    modal.on('click', '#fractus-close', close);
    modal.on('click', function(e) { if (e.target === modal[0]) close(); });
    $(document).on('keydown.fractusguide', function(e) { if (e.key === 'Escape') close(); });
    modal.on('click', '#fractus-example', function() {
        var ex = FRACTUS_SOURCE_EXAMPLE + '\n';
        close();
        loadGabcText(ex, 'credo-patrem-giunta.gabc');
    });
    $('body').append(modal);
    renderFractusGuideExamples(modal);
}

function escapeHtmlFr(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

$(function() {
    $('#lnkFractusGuide').on('click', function(e) { e.preventDefault(); showFractusGuide(); });
    $('#btnFractusGuide').on('click', function(e) { e.preventDefault(); showFractusGuide(); });
});
