// =========================================================
// BENEDICTUS GABC EDITOR
// =========================================================

var PX_PER_MM = 96 / 25.4;

var FONT_FAMILIES = {
    'EB Garamond':      { file: 'EBGaramond' },
    'Cardo':            { file: 'Cardo' },
    'Junicode':         { file: 'Junicode' },
    'Libertinus Serif': { file: 'LibertinusSerif' }
};

var PAPER_SIZES = {          // mm, verticale
    a4:     [210, 297],
    a5:     [148, 210],
    b5:     [176, 250],
    letter: [215.9, 279.4],
    legal:  [215.9, 355.6]
};

var userSettings = {
    scale: 1.4,
    spacing: 0.8,
    lineSpacing: 1.5,
    dropCapScale: 1.0,
    fontFamily: 'EB Garamond',
    staffColor: '#000000',
    rubricColor: '#cc0000',
    dropCapColor: '#000000',
    allVersesToOneLine: false,
    lyricSize: 17,
    titleSize: 24,
    // impaginazione
    pageView: true,
    paper: 'a4',
    orientation: 'portrait',
    marginTop: 20,
    marginBottom: 20,
    marginLeft: 18,
    marginRight: 18,
    pageNumbers: true,
    // intestazione stampata
    showTitle: true,
    showSubtitle: false,
    showOccasion: true,
    showCommentary: true,
    showSource: false,
    // stile della notazione
    custosStyle: 'standard',     // 'standard' | 'obliquo'
    minimaStems: 'up'            // 'up' | 'auto'
};

var lastFileName = null;     // nome dell'ultimo file importato
var lastRender = null;       // ultimo rendering valido (anteprima)

function fontStack(family) {
    return "'" + (family || userSettings.fontFamily) + "', serif";
}

// =========================================================
// HEADER GABC: PARSING E SERIALIZZAZIONE
// =========================================================
// Il documento viene scomposto in: voci dell'header (in ordine, comprese
// righe di commento e campi sconosciuti, che vengono conservati) e corpo.

var HEADER_ORDER = [
    'name', 'occasion', 'office-part', 'meter', 'mode', 'mode-modifier', 'mode-differentia',
    'annotation', 'commentary', 'author', 'arranger', 'date', 'book', 'manuscript',
    'manuscript-reference', 'manuscript-storage-place', 'language', 'transcriber',
    'transcription-date', 'gabc-copyright', 'score-copyright', 'initial-style',
    'centering-scheme', 'user-notes'
];

function parseGabc(src) {
    src = (src || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    var sep = src.match(/^%%[ \t]*$/m);
    if (!sep) {
        return { entries: [], body: src, hasSeparator: false };
    }
    var headerText = src.slice(0, sep.index);
    var body = src.slice(sep.index + sep[0].length).replace(/^\n/, '');
    var lines = headerText.split('\n');
    if (lines.length && lines[lines.length - 1] === '') lines.pop();

    var entries = [];
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var m = line.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
        if (!m || /^\s*%/.test(line)) {
            entries.push({ raw: line });
            continue;
        }
        var key = m[1].toLowerCase();
        var value = m[2];
        // valori su più righe: terminano con ';;'
        if (!/;\s*$/.test(value)) {
            var j = i + 1;
            while (j < lines.length && !/;;\s*$/.test(lines[j])) j++;
            if (j < lines.length) {
                value = [value].concat(lines.slice(i + 1, j + 1)).join('\n');
                i = j;
            }
        }
        value = value.replace(/;;?\s*$/, '').trim();
        entries.push({ key: key, value: value });
    }
    return { entries: entries, body: body, hasSeparator: true };
}

function serializeGabc(doc) {
    var out = [];
    for (var i = 0; i < doc.entries.length; i++) {
        var e = doc.entries[i];
        if (e.key) {
            out.push(e.key + ': ' + e.value + (e.value.indexOf('\n') >= 0 ? ';;' : ';'));
        } else {
            out.push(e.raw);
        }
    }
    out.push('%%');
    return out.join('\n') + '\n' + doc.body;
}

function headerGet(doc, key, index) {
    var n = 0;
    for (var i = 0; i < doc.entries.length; i++) {
        if (doc.entries[i].key === key) {
            if (n === (index || 0)) return doc.entries[i].value;
            n++;
        }
    }
    return '';
}

function headerGetAll(doc, key) {
    return doc.entries.filter(function(e) { return e.key === key; })
                      .map(function(e) { return e.value; });
}

function headerSet(doc, key, value, index) {
    index = index || 0;
    value = (value || '').replace(/;+\s*$/, '').trim();
    var n = 0, found = -1, lastSame = -1;
    for (var i = 0; i < doc.entries.length; i++) {
        if (doc.entries[i].key === key) {
            if (n === index) found = i;
            lastSame = i;
            n++;
        }
    }
    if (found >= 0) {
        if (value) doc.entries[found].value = value;
        else doc.entries.splice(found, 1);
        return;
    }
    if (!value) return;
    var entry = { key: key, value: value };
    if (lastSame >= 0) {                     // es. seconda annotation subito dopo la prima
        doc.entries.splice(lastSame + 1, 0, entry);
        return;
    }
    // inserimento rispettando l'ordine canonico dei campi
    var rank = HEADER_ORDER.indexOf(key);
    if (rank < 0) rank = HEADER_ORDER.length;
    for (var k = 0; k < doc.entries.length; k++) {
        var r = HEADER_ORDER.indexOf(doc.entries[k].key);
        if (doc.entries[k].key && r > rank) {
            doc.entries.splice(k, 0, entry);
            return;
        }
    }
    // dopo l'ultimo campo (prima di eventuali commenti finali)
    var pos = doc.entries.length;
    while (pos > 0 && !doc.entries[pos - 1].key) pos--;
    doc.entries.splice(pos, 0, entry);
}

// Corpo GABC pronto per il motore: senza commenti e su una riga
function bodyForEngine(body) {
    return body.split('\n')
        .map(function(l) { return l.trim(); })
        .filter(function(l) { return l && l.charAt(0) !== '%'; })
        .join(' ');
}

// =========================================================
// ANNOTAZIONI DA TIPO E MODO
// =========================================================

var OFFICE_PART_ABBR = {
    'antiphona': 'Ant.', 'antifona': 'Ant.',
    'responsorium': 'Resp.', 'responsorio': 'Resp.',
    'responsorium breve': 'R. br.', 'responsorio breve': 'R. br.',
    'hymnus': 'Hymn.', 'inno': 'Hymn.',
    'introitus': 'Intr.', 'introito': 'Intr.',
    'graduale': 'Grad.',
    'alleluia': 'Allel.',
    'tractus': 'Tract.', 'tratto': 'Tract.',
    'sequentia': 'Seq.', 'sequenza': 'Seq.',
    'offertorium': 'Offert.', 'offertorio': 'Offert.',
    'communio': 'Comm.', 'comunione': 'Comm.',
    'psalmus': 'Ps.', 'salmo': 'Ps.',
    'canticum': 'Cant.', 'cantico': 'Cant.',
    'versus': 'V.', 'versetto': 'V.'
};

function modeToRoman(mode) {
    var m = String(mode || '').trim().toLowerCase();
    var romans = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
    if (/^[1-8]$/.test(m)) return romans[parseInt(m, 10)];
    if (/^per/.test(m)) return 'Per.';
    if (/^irr/.test(m)) return 'Irr.';
    return String(mode || '').trim();
}

function officePartAbbr(part) {
    var p = String(part || '').trim();
    return OFFICE_PART_ABBR[p.toLowerCase()] || p;
}

// =========================================================
// ESTRAZIONE TESTO DAL GABC
// =========================================================

function extractTextFromGabc(gabc) {
    var doc = parseGabc(gabc);
    var gabcBody = bodyForEngine(doc.body);

    gabcBody = gabcBody.replace(/^\([a-z][b]?[0-9]\)\s*/i, '');

    var text = '';
    var depth = 0;
    for (var i = 0; i < gabcBody.length; i++) {
        var c = gabcBody[i];
        if (c === '(') depth++;
        else if (c === ')') depth = Math.max(0, depth - 1);
        else if (depth === 0) text += c;
    }

    // marcatori GABC: <sp>V/</sp>, <i>…</i>, <v>…</v>, {…}, ecc.
    text = text.replace(/<sp>\s*V\/\s*<\/sp>/gi, '℣')
               .replace(/<sp>\s*R\/\s*<\/sp>/gi, '℟')
               .replace(/<sp>\s*A\/\s*<\/sp>/gi, '℣')
               .replace(/<sp>\s*\+\s*<\/sp>/gi, '✠')
               .replace(/<v>[\s\S]*?<\/v>/gi, '')
               .replace(/<alt>[\s\S]*?<\/alt>/gi, '')
               .replace(/<\/?[a-z]+[^>]*>/gi, '')
               .replace(/[{}]/g, '');

    text = text.replace(/\s+/g, ' ').trim();
    text = text.replace(/(\d+\.)/g, '\n$1 ');
    text = text.replace(/,(?!\s)/g, ', ');
    text = text.replace(/\.(?!\s)/g, '. ');
    text = text.replace(/:(?!\s)/g, ': ');
    text = text.replace(/;(?!\s)/g, '; ');
    text = text.replace(/ +/g, ' ');

    return text.trim();
}

// =========================================================
// MOSTRA CREDITI E TESTO ESTRATTO
// =========================================================

function showCreditsModal() {
    var isDark = document.body.classList.contains('dark-mode');
    var modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center';

    var box = document.createElement('div');
    box.style.cssText = 'background:' + (isDark ? '#1e1e1e' : '#ffffff') + ';color:' + (isDark ? '#e0e0e0' : '#333333') + ';padding:35px 40px;border-radius:12px;max-width:480px;width:90%;box-shadow:0 8px 30px rgba(0,0,0,0.25);text-align:center;font-family:EB Garamond,Garamond,Georgia,serif';

    var title = document.createElement('p');
    title.textContent = 'Benedictus';
    title.style.cssText = 'font-size:1.6em;font-weight:bold;margin:0 0 18px 0;font-family:EB Garamond,Garamond,Georgia,serif';

    var body = document.createElement('p');
    body.style.cssText = 'font-size:1em;line-height:1.6;margin:0 0 18px 0';
    body.innerHTML = 'This utility was developed as a part of an Italian research programme:<br><br>'
        + '<em>MICHAEL – Multimedial Italian CHant ArchivE of Liturgical melodies and texts (14th–18th centuries)</em>, '
        + 'codice progetto 2022ZEATEY, CUP J53D23013710008, finanziato dall\'Unione europea – Next Generation EU.';

    var author = document.createElement('p');
    author.style.cssText = 'font-size:1em;margin:0 0 25px 0';
    author.innerHTML = '<a href="https://www.enricocorreggia.net" target="_blank" style="color:' + (isDark ? '#cc6666' : '#4a0e12') + ';text-decoration:none;">Enrico Correggia</a>';

    var closeBtn = document.createElement('button');
    closeBtn.textContent = 'Chiudi';
    closeBtn.style.cssText = 'padding:9px 24px;cursor:pointer;background:#4a0e12;color:#fff;border:none;border-radius:5px;font-family:EB Garamond,Garamond,Georgia,serif;font-size:1em';
    closeBtn.onclick = function() { document.body.removeChild(modal); };

    box.appendChild(title);
    box.appendChild(body);
    box.appendChild(author);
    box.appendChild(closeBtn);
    modal.appendChild(box);
    modal.onclick = function(e) { if (e.target === modal) document.body.removeChild(modal); };
    document.body.appendChild(modal);
}

function showTextModal() {
    var gabc = $("#editor").val();
    var extractedText = extractTextFromGabc(gabc);
    
    var modal = document.createElement('div');
    modal.id = 'text-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center';
    
    var modalContent = document.createElement('div');
    modalContent.style.cssText = 'background:' + (document.body.classList.contains('dark-mode') ? '#1e1e1e' : '#ffffff') + 
                                 ';color:' + (document.body.classList.contains('dark-mode') ? '#e0e0e0' : '#333333') + 
                                 ';padding:30px;border-radius:8px;max-width:550px;width:90%;max-height:85%;overflow:auto;box-shadow:0 4px 20px rgba(0,0,0,0.3)';
    
    var title = document.createElement('h2');
    title.textContent = 'Testo Estratto dal GABC';
    title.style.cssText = 'margin-top:0;text-align:center;font-family:EB Garamond,Garamond,serif';
    
    var textArea = document.createElement('textarea');
    textArea.value = extractedText;
    textArea.readOnly = true;
    textArea.style.cssText = 'width:100%;min-height:400px;padding:10px;font-family:EB Garamond,Garamond,serif;font-size:20px;border:1px solid #ccc;border-radius:4px;background:' + 
                             (document.body.classList.contains('dark-mode') ? '#2d2d2d' : '#ffffff') + 
                             ';color:' + (document.body.classList.contains('dark-mode') ? '#e0e0e0' : '#333333');
    
    var closeBtn = document.createElement('button');
    closeBtn.textContent = 'Chiudi';
    closeBtn.style.cssText = 'margin:15px auto 0;padding:10px 20px;cursor:pointer;background:#4a0e12;color:#fff;border:none;border-radius:4px;font-family:EB Garamond,Garamond,serif;font-size:14px;display:block';
    closeBtn.onclick = function() { document.body.removeChild(modal); };
    
    modalContent.appendChild(title);
    modalContent.appendChild(textArea);
    modalContent.appendChild(closeBtn);
    modal.appendChild(modalContent);
    
    modal.onclick = function(e) {
        if (e.target === modal) document.body.removeChild(modal);
    };
    
    document.body.appendChild(modal);
}

// =========================================================
// RAGGRUPPA STROFE
// =========================================================

// =========================================================
// RAGGRUPPA STROFE
// =========================================================

function allVersesToOneLine(gabc) {
    var lines = gabc.split('\n');
    var headerLines = [];
    var bodyLines = [];
    var foundSeparator = false;
    
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line === '%%') {
            foundSeparator = true;
            continue;
        }
        if (!foundSeparator) {
            if (line.startsWith('annotation:') || line.startsWith('initial-style:')) {
                headerLines.push(line);
            }
        } else {
            if (line) bodyLines.push(line);
        }
    }
    
    var gabcBody = bodyLines.join(' ').trim();
    var clefMatch = gabcBody.match(/^\([a-z][b]?[0-9]\)\s*/i);
    var initialClef = clefMatch ? clefMatch[0].trim() : '';
    gabcBody = gabcBody.replace(/^\([a-z][b]?[0-9]\)\s*/i, '');
    
    var versePattern = /(\d+\.)\s*\(::?\)/g;
    var verseNumbers = [];
    var match;
    
    while ((match = versePattern.exec(gabcBody)) !== null) {
        verseNumbers.push(match[1]);
    }
    
    var verses = gabcBody.split(/\d+\.\s*\(::?\)/).filter(function(v) { 
        return v.trim().length > 0; 
    });
    
    if (verses.length <= 1) {
        gabcBody = gabcBody.replace(/\d+\.\s*\(::?\)/g, '').trim();
        return headerLines.join('\n') + '\n%%\n' + (initialClef ? initialClef + ' ' : '') + gabcBody;
    }
    
    var lastVerseIndex = verses.length - 1;
    var lastVerse = verses[lastVerseIndex].trim();
    var finalSection = '';
    
    var amenPattern = /\s*\(::?\)\s+(A\([^\)]+\)men\.\([^\)]+\)\s*\(::?\))\s*$/;
    var amenMatch = lastVerse.match(amenPattern);
    
    if (amenMatch) {
        finalSection = amenMatch[1];
        verses[lastVerseIndex] = lastVerse.replace(amenPattern, ' (::)').trim();
    }
    
    var versesData = [];
    
    for (var v = 0; v < verses.length; v++) {
        var verse = verses[v].trim();
        var syllables = [];
        var words = verse.split(/\s+/);
        
        for (var w = 0; w < words.length; w++) {
            var word = words[w];
            if (!word) continue;
            
            var syllPattern = /([^\(\)]+?)(\([^\)]*\))/g;
            var syllMatch;
            var wordSyllables = [];
            
            while ((syllMatch = syllPattern.exec(word)) !== null) {
                wordSyllables.push({
                    text: syllMatch[1],
                    notes: syllMatch[2],
                    isLastInWord: false
                });
            }
            
            if (wordSyllables.length > 0) {
                wordSyllables[wordSyllables.length - 1].isLastInWord = true;
            }
            
            syllables = syllables.concat(wordSyllables);
        }
        
        versesData.push(syllables);
    }
    
    var maxSyllables = 0;
    for (var v = 0; v < versesData.length; v++) {
        if (versesData[v].length > maxSyllables) {
            maxSyllables = versesData[v].length;
        }
    }
    
    var result = '';
    
    for (var i = 0; i < maxSyllables; i++) {
        var syllableGroup = [];
        var notes = '';
        var needSpace = false;
        
        for (var v = 0; v < versesData.length; v++) {
            if (i < versesData[v].length) {
                var syl = versesData[v][i];
                var text = syl.text;
                
                if (i === 0 && v >= 1 && verseNumbers[v - 1]) {
                    text = verseNumbers[v - 1] + ' ' + text;
                }
                
                syllableGroup.push(text);
                
                if (v === 0) {
                    notes = syl.notes;
                    needSpace = syl.isLastInWord;
                }
            }
        }
        
        if (syllableGroup.length > 0) {
    var parts = [];
    for (var s = 0; s < syllableGroup.length; s++) {
        if (s === 0) {
            parts.push(syllableGroup[s]);
        } else {
            var sylOfThisVerse = versesData[s][i];
            var thisNeedsSpace = sylOfThisVerse ? sylOfThisVerse.isLastInWord : needSpace;
            parts.push(syllableGroup[s] + (thisNeedsSpace ? ' ' : ''));
        }
    }
    result += parts.join('|') + notes;
    if (needSpace) result += ' ';
}
    }
    
    var finalResult = result.trim();
    
    if (initialClef) {
        finalResult = initialClef + ' ' + finalResult;
    }
    
    if (finalSection) {
        finalResult = finalResult.replace(/\s*\(::?\)\s*$/, '');
        finalResult += ' (::) ' + finalSection;
    }
    
    return headerLines.join('\n') + '\n%%\n' + finalResult;
}

// =========================================================
// MOTORE DI RENDERING
// =========================================================
// renderChant() produce l'SVG di Exsurge per uno "schema" di colori
// ('screen' = come a video, 'print' = per l'esportazione) e misura la
// posizione verticale di titoli e righi, così da poter impaginare.

var SVG_NS = 'http://www.w3.org/2000/svg';

function getMeasureHost() {
    var host = document.getElementById('bn-measure-host');
    if (!host) {
        host = document.createElement('div');
        host.id = 'bn-measure-host';
        host.setAttribute('aria-hidden', 'true');
        host.style.cssText = 'position:absolute;left:-100000px;top:0;width:4000px;visibility:hidden;pointer-events:none';
        document.body.appendChild(host);
    }
    return host;
}

function isDark() {
    return document.body.classList.contains('dark-mode');
}

function schemeColors(scheme) {
    var dark = scheme === 'screen' && isDark();
    var ink = dark ? '#ffffff' : '#000000';
    var staff = userSettings.staffColor;
    var dropCap = userSettings.dropCapColor;
    if (scheme === 'print') {
        if (staff.toLowerCase() === '#ffffff') staff = '#000000';
        if (dropCap.toLowerCase() === '#ffffff') dropCap = '#000000';
    } else {
        if (dropCap === '#000000' || dropCap === '#ffffff') dropCap = ink;
    }
    return {
        ink: ink,
        staff: staff,
        dropCap: dropCap,
        rubric: userSettings.rubricColor,
        background: dark ? '#1e1e1e' : '#ffffff'
    };
}

function loadFonts(family) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var f = "'" + family + "'";
    return Promise.all([
        document.fonts.load('16px ' + f),
        document.fonts.load('italic 16px ' + f),
        document.fonts.load('bold 16px ' + f)
    ]).catch(function() {});
}

// Geometria della pagina in px (96 dpi)
function pageGeometry() {
    var size = PAPER_SIZES[userSettings.paper] || PAPER_SIZES.a4;
    var wmm = size[0], hmm = size[1];
    if (userSettings.orientation === 'landscape') { var t = wmm; wmm = hmm; hmm = t; }
    var g = {
        wmm: wmm, hmm: hmm,
        width: wmm * PX_PER_MM,
        height: hmm * PX_PER_MM,
        top: userSettings.marginTop * PX_PER_MM,
        bottom: userSettings.marginBottom * PX_PER_MM,
        left: userSettings.marginLeft * PX_PER_MM,
        right: userSettings.marginRight * PX_PER_MM
    };
    g.contentWidth = Math.max(50, g.width - g.left - g.right);
    g.contentHeight = Math.max(50, g.height - g.top - g.bottom);
    return g;
}

// Larghezza di impaginazione (unità Exsurge) per l'anteprima corrente
function currentLayoutWidth() {
    if (userSettings.pageView) {
        return pageGeometry().contentWidth / userSettings.scale;
    }
    var container = document.getElementById('chant-preview');
    var w = (container && container.offsetWidth) || 800;
    return w / userSettings.scale;
}

function buildSubtitle(doc) {
    var part = headerGet(doc, 'office-part');
    var mode = headerGet(doc, 'mode');
    var s = part;
    if (mode) {
        var roman = modeToRoman(mode);
        var diff = headerGet(doc, 'mode-differentia');
        s += (s ? ' · ' : '') + 'Modo ' + roman + (diff ? ' ' + diff : '');
    }
    return s;
}

function buildSourceLine(doc) {
    return ['manuscript-storage-place', 'manuscript', 'manuscript-reference']
        .map(function(k) { return headerGet(doc, k); })
        .filter(Boolean).join(', ');
}

function renderChant(gabcText, scheme, layoutWidth) {
    var family = userSettings.fontFamily;
    return loadFonts(family).then(function() {
        return new Promise(function(resolve, reject) {
            var doc = parseGabc(gabcText);
            var body = bodyForEngine(doc.body);
            if (!body) {
                reject(new Error('Il GABC non contiene note.'));
                return;
            }
            if (userSettings.allVersesToOneLine) {
                var grouped = allVersesToOneLine('%%\n' + body);
                body = grouped.slice(grouped.indexOf('%%\n') + 3);
            }

            var initialStyleRaw = headerGet(doc, 'initial-style');
            var initialStyle = initialStyleRaw === '' ? 1 : parseInt(initialStyleRaw, 10);
            if (isNaN(initialStyle)) initialStyle = 1;
            var colors = schemeColors(scheme);

            var ctxt = new exsurge.ChantContext();
            ctxt.textColor = colors.ink;
            ctxt.setFont(fontStack(family), userSettings.lyricSize);
            ctxt.lyricTextFont = fontStack(family);

            // Parametri fissi del rigo
            ctxt.staffInterval = 7;
            ctxt.glyphScaling = 0.07;
            ctxt.lyricTextSize = userSettings.lyricSize;

            var ts = ctxt.textStyles;
            ts.lyric.size = userSettings.lyricSize;
            ts.title.size = userSettings.titleSize;
            ts.subtitle.size = userSettings.titleSize * 0.62;
            ts.supertitle.size = userSettings.titleSize * 0.6;
            ts.leftRight.size = userSettings.lyricSize * 0.82;
            ts.annotation.size = userSettings.lyricSize * 0.66;
            var baseDropCap = initialStyle === 2 ? 80 : 60;
            ts.dropCap.size = baseDropCap * userSettings.dropCapScale;
            ts.dropCap.color = colors.dropCap;
            ctxt.dropCapTextSize = ts.dropCap.size;
            ctxt.annotationTextSize = ts.annotation.size;

            // Spaziatura
            ctxt.intraNeumeSpacing = 10 * userSettings.spacing;
            ctxt.minSpaceBetweenNeumes = 5 * userSettings.spacing;
            ctxt.spaceBetweenSystems = userSettings.lineSpacing;
            if (ctxt.doubleBarSpacing !== undefined) ctxt.doubleBarSpacing = 8;
            if (ctxt.spaceBetweenDoubleBar !== undefined) ctxt.spaceBetweenDoubleBar = 8;

            ctxt.staffLineWeight = 1;
            ctxt.dividerLineWeight = 1;
            ctxt.neumeLineWeight = 1;

            // Colori
            ctxt.neumeLineColor = colors.ink;
            ctxt.clefLineColor = colors.ink;
            ctxt.custoLineColor = colors.ink;
            ctxt.staffLineColor = colors.staff;
            ctxt.dividerLineColor = colors.staff;
            ctxt.lyricTextColor = colors.ink;
            ctxt.dropCapTextColor = colors.dropCap;
            if (ctxt.setRubricColor) ctxt.setRubricColor(colors.rubric);
            else ctxt.rubricColor = colors.rubric;

            // Canto fratto: le note mensurali di uno stesso gruppo diventano figure separate
            var fractus = typeof isFractusDoc === 'function' && isFractusDoc(doc);
            if (fractus) body = fractusPreprocess(body);
            var engineSrc = '%%\n' + body;

            var mappings = exsurge.Gabc.createMappingsFromSource(ctxt, engineSrc);
            if (!mappings || mappings.length === 0) {
                reject(new Error('Nessun elemento musicale riconosciuto nel GABC.'));
                return;
            }

            var score = new exsurge.ChantScore(ctxt, mappings, initialStyle !== 0);
            score.bnEngineBody = body;   // testo passato al motore (per il canto fratto)

            // Intestazione stampata (titoli Exsurge)
            if (score.titles) {
                var name = headerGet(doc, 'name');
                var occasion = headerGet(doc, 'occasion');
                var subtitle = buildSubtitle(doc);
                var commentary = headerGet(doc, 'commentary');
                var source = buildSourceLine(doc);
                if (userSettings.showOccasion && occasion) score.titles.setSupertitle(ctxt, occasion);
                if (userSettings.showTitle && name) score.titles.setTitle(ctxt, name);
                if (userSettings.showSubtitle && subtitle) score.titles.setSubtitle(ctxt, subtitle);
                if (userSettings.showCommentary && commentary) score.titles.setTextRight(ctxt, commentary);
                if (userSettings.showSource && source) score.titles.setTextLeft(ctxt, source);
            }

            score.performLayout(ctxt);
            score.layoutChantLines(ctxt, layoutWidth, function() {
                try {
                    var svg = score.createSvgNode(ctxt);
                    var result = postProcessSvg(svg, doc, scheme, colors, layoutWidth, initialStyle, fractus ? score : null);
                    result.lineCount = score.lines.length;
                    resolve(result);
                } catch (e) {
                    reject(e);
                }
            });
        });
    });
}

function translateY(el) {
    var t = el.transform && el.transform.baseVal && el.transform.baseVal.consolidate();
    return t ? t.matrix.f : 0;
}

function translateX(el) {
    var t = el.transform && el.transform.baseVal && el.transform.baseVal.consolidate();
    return t ? t.matrix.e : 0;
}

// <use>: href sia semplice (SVG2) sia xlink:href con prefisso (SVG 1.1, svg2pdf, Inkscape)
var XLINK_NS = 'http://www.w3.org/1999/xlink';
function normalizeUseHrefs(svg) {
    svg.querySelectorAll('use').forEach(function(u) {
        var href = u.getAttribute('href') || u.getAttributeNS(XLINK_NS, 'href');
        if (!href) return;
        u.removeAttributeNS(XLINK_NS, 'href');
        u.removeAttribute('href');
        u.setAttributeNS(XLINK_NS, 'xlink:href', href);
        u.setAttribute('href', href);
    });
}

// Exsurge a volte sposta una stanghetta che apre un rigo (es. "(::)" dopo un a capo)
// in mezzo alle note successive: la si riporta nello spazio che le era stato riservato.
function fixMisplacedDividers(svg) {
    svg.querySelectorAll('g.chantLine').forEach(function(line) {
        var groups = Array.prototype.filter.call(line.children, function(g) {
            return (g.getAttribute('class') || '').indexOf('ChantNotationElement') >= 0;
        });
        function notationBox(g) {
            var n = g.querySelector('g.Notations') || g;
            try { return n.getBBox(); } catch (e) { return null; }
        }
        groups.forEach(function(g, i) {
            if (!g.querySelector('rect.dividerLine') || i === 0 || i === groups.length - 1) return;
            var prev = groups[i - 1], next = groups[i + 1];
            var pb = notationBox(prev), nb = notationBox(next), bb = notationBox(g);
            if (!pb || !nb || !bb) return;
            var prevRight = translateX(prev) + pb.x + pb.width;
            var nextLeft = translateX(next) + nb.x;
            var tx = translateX(g);
            var center = tx + bb.x + bb.width / 2;
            if (nextLeft <= prevRight || (center > prevRight && center < nextLeft)) return;
            var target = (prevRight + nextLeft) / 2;
            g.setAttribute('transform', 'translate(' + (tx + target - center) + ',0)');
        });
    });
}

function postProcessSvg(svg, doc, scheme, colors, layoutWidth, initialStyle, fractusScore) {
    var host = getMeasureHost();
    host.innerHTML = '';
    host.appendChild(svg);

    adjustDoubleBarSpacing(svg);
    fixMisplacedDividers(svg);
    normalizeUseHrefs(svg);

    // Rigo e stanghette
    svg.querySelectorAll('line.staffLine').forEach(function(l) { l.setAttribute('stroke', colors.staff); });
    svg.querySelectorAll('rect.dividerLine').forEach(function(r) { r.setAttribute('fill', colors.staff); });
    // Note e chiavi
    svg.querySelectorAll('path').forEach(function(p) {
        p.setAttribute('fill', colors.ink);
        p.setAttribute('stroke', colors.ink);
    });

    // Figure mensurali del canto fratto
    if (fractusScore && typeof applyFractus === 'function') applyFractus(svg, fractusScore, colors, 7);
    if (typeof applyCustosStyle === 'function') applyCustosStyle(svg, colors);

    // Annotazioni sopra il capolettera, nel sistema di coordinate del primo rigo
    var annotations = headerGetAll(doc, 'annotation').filter(Boolean).slice(0, 2);
    var firstLine = svg.querySelector('g.chantLine');
    if (annotations.length && firstLine) {
        var staffG = firstLine.querySelector('g.staffLines') || firstLine;
        var sb = staffG.getBBox();
        var dropCap = firstLine.querySelector('text.dropCap');
        var cx;
        if (dropCap) {
            var db = dropCap.getBBox();
            cx = db.x + db.width / 2;
        } else {
            cx = sb.x + 12;
        }
        var size = userSettings.lyricSize * 0.66;
        var lineH = size * 1.15;
        for (var j = 0; j < annotations.length; j++) {
            var t = document.createElementNS(SVG_NS, 'text');
            var y = sb.y - 4 - (annotations.length - 1 - j) * lineH;
            t.setAttribute('x', cx);
            t.setAttribute('y', y);
            t.setAttribute('text-anchor', dropCap ? 'middle' : 'start');
            t.setAttribute('class', 'annotation bn-annotation');
            t.setAttribute('font-family', fontStack());
            t.setAttribute('font-size', size);
            t.setAttribute('fill', colors.rubric);
            t.textContent = annotations[j];
            firstLine.appendChild(t);
        }
        // evita la sovrapposizione con la riga "fonte" (textLeft) dei titoli
        var titlesG = svg.querySelector('g.Titles');
        var textLeft = titlesG && titlesG.querySelector('text.textLeft');
        if (textLeft) {
            var annTop = translateY(firstLine) + firstLine.querySelector('text.bn-annotation').getBBox().y;
            var tlBottom = translateY(titlesG) + textLeft.getBBox().y + textLeft.getBBox().height;
            var overlap = tlBottom + 3 - annTop;
            if (overlap > 0) {
                titlesG.setAttribute('transform', 'translate(' + translateX(titlesG) + ',' + (translateY(titlesG) - overlap) + ')');
            }
        }
    }

    // Stili in linea: niente CSS globale (evita conflitti tra anteprima ed export)
    inlineSvgStyles(svg, colors);

    // Misure: titoli e righi, in coordinate dell'SVG (non scalate)
    var items = [];
    var titles = svg.querySelector('g.Titles');
    if (titles && titles.childNodes.length) {
        var tb = titles.getBBox();
        if (tb.height > 0) {
            var ty = translateY(titles);
            items.push({ type: 'titles', keepWithNext: true, el: titles, top: ty + tb.y, bottom: ty + tb.y + tb.height });
        }
    }
    var minX = 0, maxX = layoutWidth;
    svg.querySelectorAll('g.chantLine').forEach(function(line, idx) {
        var b = line.getBBox();
        var y0 = translateY(line), x0 = translateX(line);
        items.push({ type: 'line', index: idx, el: line, top: y0 + b.y, bottom: y0 + b.y + b.height });
        minX = Math.min(minX, x0 + b.x);
        maxX = Math.max(maxX, x0 + b.x + b.width);
    });
    if (titles) {
        titles.querySelectorAll('text').forEach(function(t) {
            var b = t.getBBox();
            minX = Math.min(minX, b.x);
            maxX = Math.max(maxX, b.x + b.width);
        });
    }

    var top = items.length ? items[0].top : 0;
    var bottom = items.length ? items[items.length - 1].bottom : 0;
    items.forEach(function(it) { top = Math.min(top, it.top); bottom = Math.max(bottom, it.bottom); });

    // Marca gli elementi per poterli ritrovare nei cloni
    items.forEach(function(it, k) { it.el.setAttribute('data-bn-item', k); });

    svg.parentNode.removeChild(svg);

    return {
        svg: svg,
        scheme: scheme,
        colors: colors,
        items: items,
        bbox: { x: minX, y: top, width: maxX - minX, height: bottom - top },
        layoutWidth: layoutWidth,
        doc: doc
    };
}

// Copia gli stili calcolati negli attributi e rimuove i <style> di Exsurge
function inlineSvgStyles(svg, colors) {
    var family = fontStack();
    svg.querySelectorAll('text, tspan').forEach(function(el) {
        var cs = window.getComputedStyle(el);
        var isAnnotation = el.classList && el.classList.contains('bn-annotation');
        var fill = cs.fill;
        if (!isAnnotation && fill && fill !== 'none') el.setAttribute('fill', fill);
        el.setAttribute('font-family', family);
        if (cs.fontSize) el.setAttribute('font-size', parseFloat(cs.fontSize));
        if (cs.fontStyle && cs.fontStyle !== 'normal') el.setAttribute('font-style', cs.fontStyle);
        var w = cs.fontWeight;
        if (w && w !== 'normal' && w !== '400') el.setAttribute('font-weight', parseInt(w, 10) >= 600 ? 'bold' : 'normal');
        if (cs.textDecorationLine && cs.textDecorationLine !== 'none') el.setAttribute('text-decoration', cs.textDecorationLine);
        el.style.cssText = '';
    });
    svg.querySelectorAll('text.dropCap').forEach(function(el) {
        el.setAttribute('fill', colors.dropCap);
    });
    svg.querySelectorAll('style').forEach(function(s) { s.parentNode.removeChild(s); });
    svg.removeAttribute('class');
}

// ---------------------------------------------------------
// IMPAGINAZIONE
// ---------------------------------------------------------

// Impagina in sequenza uno o più "flussi" (brani o blocchi di testo).
// Ogni pagina contiene delle "fette": porzioni contigue di un flusso.
// Il titolo resta sempre unito al primo rigo che lo segue.
function paginateFlow(results, geom, opts) {
    opts = opts || {};
    var avail = geom.contentHeight / userSettings.scale;
    var gap = opts.gap || 0;
    var pages = [];
    var page = null;
    function newPage() { page = { slices: [], used: 0 }; pages.push(page); }

    results.forEach(function(r) {
        if (r.pageBreak) { if (page && page.slices.length) page = null; return; }
        if (opts.newPagePerPiece && page && page.slices.length) page = null;

        var units = [];
        for (var i = 0; i < r.items.length; i++) {
            var it = r.items[i];
            if (it.keepWithNext && i + 1 < r.items.length) {
                var nx = r.items[i + 1];
                units.push({ items: [it, nx], top: Math.min(it.top, nx.top), bottom: Math.max(it.bottom, nx.bottom) });
                i++;
            } else {
                units.push({ items: [it], top: it.top, bottom: it.bottom });
            }
        }

        var slice = null;
        units.forEach(function(u) {
            if (!page) newPage();
            var h = u.bottom - u.top;
            if (slice && slice.page === page) {
                var end = slice.y + (u.bottom - slice.start);
                if (end <= avail + 0.01) {
                    slice.items = slice.items.concat(u.items);
                    page.used = Math.max(page.used, end);
                    return;
                }
                newPage();
            } else if (page.slices.length && page.used + gap + h > avail) {
                newPage();
            }
            var y = page.slices.length ? page.used + gap : 0;
            slice = { result: r, items: u.items.slice(), start: u.top, y: y, page: page };
            page.slices.push(slice);
            page.used = y + h;
        });
    });
    return pages.filter(function(p) { return p.slices.length; });
}

// Compatibilità: impaginazione di un singolo brano
function paginate(result, geom) {
    return paginateFlow([result], geom);
}

// Clona il contenuto dell'SVG tenendo solo gli elementi indicati
function cloneContent(result, keepItems) {
    var keep = {};
    keepItems.forEach(function(it) { keep[result.items.indexOf(it)] = true; });
    var clone = result.svg.cloneNode(true);
    clone.querySelectorAll('[data-bn-item]').forEach(function(el) {
        if (!keep[el.getAttribute('data-bn-item')]) el.parentNode.removeChild(el);
    });
    var g = document.createElementNS(SVG_NS, 'g');
    while (clone.firstChild) g.appendChild(clone.firstChild);
    return g;
}

function createSvgRoot(width, height, viewBox) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('xmlns', SVG_NS);
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', viewBox);
    return svg;
}

function svgText(x, y, text, attrs) {
    var t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('x', x);
    t.setAttribute('y', y);
    t.setAttribute('font-family', fontStack());
    Object.keys(attrs || {}).forEach(function(k) { t.setAttribute(k, attrs[k]); });
    t.textContent = text;
    return t;
}

function svgRect(x, y, w, h, fill) {
    var r = document.createElementNS(SVG_NS, 'rect');
    r.setAttribute('x', x); r.setAttribute('y', y);
    r.setAttribute('width', w); r.setAttribute('height', h);
    r.setAttribute('fill', fill);
    return r;
}

// Margine sinistro effettivo: con margini speculari le pagine pari (verso)
// hanno il margine esterno a sinistra
function pageLeftMargin(geom, pageNumber, mirrored) {
    if (mirrored && pageNumber % 2 === 0) return geom.right;
    return geom.left;
}

// extras: { colors, number (null = nascosto), mirrored, head: testo della testatina }
function buildPageSvg(page, index, total, geom, extras) {
    extras = extras || {};
    var colors = extras.colors || (page.slices.length ? page.slices[0].result.colors : schemeColors('print'));
    var number = extras.hasOwnProperty('number') ? extras.number
               : (userSettings.pageNumbers && total > 1 ? index + 1 : null);
    var physical = extras.physical || index + 1;
    var left = pageLeftMargin(geom, physical, extras.mirrored);

    var svg = createSvgRoot(geom.width, geom.height, '0 0 ' + geom.width + ' ' + geom.height);
    svg.setAttribute('class', 'bn-page');
    svg.appendChild(svgRect(0, 0, geom.width, geom.height, colors.background));

    (page.slices || []).forEach(function(sl) {
        var g = document.createElementNS(SVG_NS, 'g');
        g.setAttribute('transform',
            'translate(' + left + ',' + geom.top + ') scale(' + userSettings.scale + ') translate(0,' + (sl.y - sl.start) + ')');
        g.appendChild(cloneContent(sl.result, sl.items));
        svg.appendChild(g);
    });

    var small = Math.max(9, userSettings.lyricSize * 0.7);
    var outerRight = physical % 2 === 1 || !extras.mirrored;   // recto: lato esterno = destra

    if (extras.head) {
        var hy = Math.max(geom.top * 0.55, small + 4);
        var hx, anchor;
        if (extras.mirrored) {
            hx = outerRight ? left + geom.contentWidth : left;
            anchor = outerRight ? 'end' : 'start';
        } else {
            hx = left + geom.contentWidth / 2; anchor = 'middle';
        }
        svg.appendChild(svgText(hx, hy, extras.head, {
            'text-anchor': anchor, 'font-size': small, 'font-style': 'italic', fill: colors.ink
        }));
    }

    if (number !== null && number !== undefined) {
        var ny = geom.height - Math.max(geom.bottom / 2, 14);
        var nx, nanchor;
        if (extras.mirrored) {
            nx = outerRight ? left + geom.contentWidth : left;
            nanchor = outerRight ? 'end' : 'start';
        } else {
            nx = geom.width / 2; nanchor = 'middle';
        }
        svg.appendChild(svgText(nx, ny, String(number), {
            'text-anchor': nanchor, 'font-size': Math.max(10, small), fill: colors.ink
        }));
    }
    return svg;
}

function buildCroppedSvg(result, padding) {
    padding = padding === undefined ? 10 : padding;
    var s = userSettings.scale;
    var b = result.bbox;
    var vx = b.x - padding, vy = b.y - padding;
    var vw = b.width + padding * 2, vh = b.height + padding * 2;
    var svg = createSvgRoot(vw * s, vh * s, vx + ' ' + vy + ' ' + vw + ' ' + vh);
    var bg = document.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('x', vx); bg.setAttribute('y', vy);
    bg.setAttribute('width', vw); bg.setAttribute('height', vh);
    bg.setAttribute('fill', result.colors.background);
    svg.appendChild(bg);
    svg.appendChild(cloneContent(result, result.items));
    return svg;
}

// =========================================================
// CONTROLLO SINTATTICO MINIMO
// =========================================================

function lineColAt(text, index) {
    var before = text.slice(0, index).split('\n');
    return { line: before.length, col: before[before.length - 1].length + 1 };
}

function checkGabcSyntax(src) {
    var doc = parseGabc(src);
    if (!doc.hasSeparator) {
        return 'Manca la riga "%%" che separa l\'intestazione dal corpo del brano.';
    }
    var offset = src.replace(/^﻿/, '').replace(/\r\n?/g, '\n').length - doc.body.length;
    var body = doc.body;
    var depth = 0, openAt = -1;
    for (var i = 0; i < body.length; i++) {
        var c = body[i];
        if (c === '%' && (i === 0 || body[i - 1] === '\n')) {     // riga di commento
            while (i < body.length && body[i] !== '\n') i++;
            continue;
        }
        if (c === '(') {
            if (depth > 0) {
                var p1 = lineColAt(src, offset + openAt);
                return 'Parentesi "(" non chiusa (riga ' + p1.line + ', col. ' + p1.col + ').';
            }
            depth = 1; openAt = i;
        } else if (c === ')') {
            if (depth === 0) {
                var p2 = lineColAt(src, offset + i);
                return 'Parentesi ")" senza apertura (riga ' + p2.line + ', col. ' + p2.col + ').';
            }
            depth = 0;
        }
    }
    if (depth > 0) {
        var p3 = lineColAt(src, offset + openAt);
        return 'Parentesi "(" non chiusa (riga ' + p3.line + ', col. ' + p3.col + ').';
    }
    var first = bodyForEngine(body).match(/\(([^)]*)\)/);
    if (first && !/^[cf]b?[1-5]$/i.test(first[1].trim())) {
        return 'Il brano dovrebbe iniziare con una chiave, es. (c4) o (f3).';
    }
    return null;
}

function setStatus(msg, isError) {
    var el = document.getElementById('gabc-status');
    if (!el) return;
    el.textContent = msg || '';
    el.className = isError ? 'error' : 'ok';
}

// =========================================================
// ANTEPRIMA
// =========================================================

var renderToken = 0;
var renderTimer = null;

function schedulePreview(delay) {
    clearTimeout(renderTimer);
    if (delay === undefined) {
        // il libretto intero è più pesante da ridisegnare
        delay = (typeof collectionPreviewActive === 'function' && collectionPreviewActive()) ? 700 : 250;
    }
    renderTimer = setTimeout(updatePreview, delay);
}

function updatePreview() {
    var src = $('#editor').val();
    var container = document.getElementById('chant-preview');
    syncHeaderForm();

    // Raccolta: il brano attivo segue l'editor; in modalità libretto si mostra l'intero libretto
    if (typeof collectionOnEditorChange === 'function') collectionOnEditorChange(src);
    if (typeof collectionPreviewActive === 'function' && collectionPreviewActive()) {
        var err = src.trim() ? checkGabcSyntax(src) : null;
        if (err) setStatus('Attenzione (brano attivo): ' + err, true);
        updateCollectionPreview(++renderToken);
        return;
    }

    if (!src.trim()) {
        container.className = 'clickable';
        container.innerHTML = '<p style="color:gray;">Inserisci notazione GABC per vedere l\'anteprima.</p>';
        setStatus('');
        lastRender = null;
        return;
    }

    var syntaxError = checkGabcSyntax(src);
    var token = ++renderToken;
    var layoutWidth = currentLayoutWidth();

    renderChant(src, 'screen', layoutWidth).then(function(result) {
        if (token !== renderToken) return;
        lastRender = result;
        drawPreview(result, container);
        if (syntaxError) setStatus('Attenzione: ' + syntaxError, true);
    }).catch(function(e) {
        if (token !== renderToken) return;
        console.error('Errore rendering:', e);
        var msg = syntaxError || e.message || String(e);
        setStatus('Errore: ' + msg + (lastRender ? ' (mostrata l\'ultima anteprima valida)' : ''), true);
        if (!lastRender) {
            container.innerHTML = '<p style="color:#c62828;">Errore nel rendering del GABC: ' + $('<div>').text(msg).html() + '</p>';
        }
    });
}

function drawPreview(result, container) {
    container.innerHTML = '';
    var info = '';
    if (userSettings.pageView) {
        container.className = 'clickable page-mode';
        var geom = pageGeometry();
        var pages = paginate(result, geom);
        pages.forEach(function(page, i) {
            var sheet = document.createElement('div');
            sheet.className = 'page-sheet';
            sheet.style.maxWidth = geom.width + 'px';
            sheet.appendChild(buildPageSvg(page, i, pages.length, geom));
            container.appendChild(sheet);
            if (pages.length > 1) {
                var lbl = document.createElement('div');
                lbl.className = 'page-label';
                lbl.textContent = 'pagina ' + (i + 1) + ' di ' + pages.length;
                container.appendChild(lbl);
            }
        });
        info = result.lineCount + (result.lineCount === 1 ? ' rigo' : ' righi') + ' · ' +
               pages.length + (pages.length === 1 ? ' pagina ' : ' pagine ') +
               userSettings.paper.toUpperCase() + (userSettings.orientation === 'landscape' ? ' orizz.' : '');
        $('#page-info').text(info);
    } else {
        container.className = 'clickable';
        var svg = buildCroppedSvg(result, 6);
        svg.style.maxWidth = '100%';
        svg.style.height = 'auto';
        container.appendChild(svg);
        info = result.lineCount + (result.lineCount === 1 ? ' rigo' : ' righi');
        $('#page-info').text('');
    }
    setStatus('✓ ' + info, false);
}

// =========================================================
// UTILITY
// =========================================================

function adjustDoubleBarSpacing(svgNode) {
    var allRects = svgNode.querySelectorAll('rect.dividerLine');
    var dividers = [];
    
    for (var i = 0; i < allRects.length; i++) {
        var rect = allRects[i];
        var x = parseFloat(rect.getAttribute('x'));
        var y = parseFloat(rect.getAttribute('y'));
        var width = parseFloat(rect.getAttribute('width'));
        var height = parseFloat(rect.getAttribute('height'));
        
        if (height >= 28) {
            dividers.push({ element: rect, x: x, y: y, width: width, height: height });
        }
    }
    
    var i = 0;
    while (i < dividers.length - 1) {
        var bar1 = dividers[i];
        var bar2 = dividers[i + 1];
        var distance = bar2.x - bar1.x;
        var sameHeight = Math.abs(bar1.y - bar2.y) < 2 && Math.abs(bar1.height - bar2.height) < 2;
        
        if (distance > 5 && distance < 30 && sameHeight) {
            var midpoint = bar1.x + distance / 2;
            var newDistance = 3;
            
            bar1.element.setAttribute('x', midpoint - newDistance / 2);
            bar2.element.setAttribute('x', midpoint + newDistance / 2);
            i += 2;
        } else {
            i++;
        }
    }
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    
    if (document.body.classList.contains('dark-mode')) {
        if (userSettings.staffColor === '#000000') {
            userSettings.staffColor = '#ffffff';
            $('#inputStaffColor').val('#ffffff');
        }
        if (userSettings.rubricColor === '#cc0000') {
            userSettings.rubricColor = '#970e0e';
            $('#inputRubricColor').val('#970e0e');
        }
        if (userSettings.dropCapColor === '#000000') {
            userSettings.dropCapColor = '#ffffff';
            $('#inputDropCapColor').val('#ffffff');
        }
    } else {
        if (userSettings.staffColor === '#ffffff') {
            userSettings.staffColor = '#000000';
            $('#inputStaffColor').val('#000000');
        }
        if (userSettings.rubricColor === '#970e0e') {
            userSettings.rubricColor = '#cc0000';
            $('#inputRubricColor').val('#cc0000');
        }
        if (userSettings.dropCapColor === '#ffffff') {
            userSettings.dropCapColor = '#000000';
            $('#inputDropCapColor').val('#000000');
        }
    }
    
    updatePreview();
}

// =========================================================
// ESPORTAZIONE
// =========================================================

function showBusy(msg) {
    var t = document.getElementById('busy-toast');
    if (!t) {
        t = document.createElement('div');
        t.id = 'busy-toast';
        document.body.appendChild(t);
    }
    if (msg) { t.textContent = msg; t.style.display = 'block'; }
    else t.style.display = 'none';
}

function exportBaseName() {
    var doc = parseGabc($('#editor').val());
    var name = headerGet(doc, 'name') || (lastFileName ? lastFileName.replace(/\.[^.]+$/, '') : 'chant');
    var slug = name.normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[æÆ]/g, 'ae').replace(/[œŒ]/g, 'oe')
        .replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
    return slug || 'chant';
}

function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function() { URL.revokeObjectURL(url); }, 2000);
}

// Rendering con colori di stampa, alla stessa larghezza dell'anteprima
function renderForExport() {
    var src = $('#editor').val();
    if (!src.trim()) return Promise.reject(new Error('Nessuna anteprima da esportare!'));
    return renderChant(src, 'print', currentLayoutWidth());
}

function renderPagesForExport() {
    var src = $('#editor').val();
    if (!src.trim()) return Promise.reject(new Error('Nessuna anteprima da esportare!'));
    var geom = pageGeometry();
    return renderChant(src, 'print', geom.contentWidth / userSettings.scale).then(function(result) {
        var pages = paginate(result, geom);
        return {
            result: result,
            geom: geom,
            svgs: pages.map(function(p, i) { return buildPageSvg(p, i, pages.length, geom); })
        };
    });
}

function exportError(e) {
    showBusy(null);
    console.error(e);
    alert('Errore durante l\'esportazione: ' + (e && e.message ? e.message : e));
}

// ---------------------------------------------------------
// Font: caricamento dei dati (base64) per PDF e incorporamento
// ---------------------------------------------------------

var pdfFontPromises = {};

function loadFontData(family) {
    var info = FONT_FAMILIES[family];
    if (!info) return Promise.reject(new Error('Font sconosciuto: ' + family));
    window.BENEDICTUS_PDF_FONTS = window.BENEDICTUS_PDF_FONTS || {};
    if (window.BENEDICTUS_PDF_FONTS[family]) return Promise.resolve(window.BENEDICTUS_PDF_FONTS[family]);
    if (!pdfFontPromises[family]) {
        // <script> invece di fetch(): funziona anche aprendo il file con file://
        pdfFontPromises[family] = new Promise(function(resolve, reject) {
            var s = document.createElement('script');
            s.src = 'fonts/pdf/' + info.file + '.js';
            s.onload = function() {
                var data = window.BENEDICTUS_PDF_FONTS[family];
                if (data) resolve(data); else reject(new Error('Dati del font non validi: ' + family));
            };
            s.onerror = function() {
                delete pdfFontPromises[family];
                reject(new Error('Impossibile caricare fonts/pdf/' + info.file + '.js'));
            };
            document.head.appendChild(s);
        });
    }
    return pdfFontPromises[family];
}

var FONT_STYLE_FALLBACK = {
    normal: ['normal'],
    italic: ['italic', 'normal'],
    bold: ['bold', 'normal'],
    bolditalic: ['bolditalic', 'bold', 'italic', 'normal']
};

function registerPdfFonts(pdf, family, data) {
    Object.keys(FONT_STYLE_FALLBACK).forEach(function(style) {
        var src = FONT_STYLE_FALLBACK[style].filter(function(s) { return data[s]; })[0];
        if (!src) return;
        var vfsName = data.file + '-' + src + '.ttf';
        if (!pdf.existsFileInVFS || !pdf.existsFileInVFS(vfsName)) {
            pdf.addFileToVFS(vfsName, data[src]);
        }
        pdf.addFont(vfsName, family, style);
    });
}

// Incorpora il font (base64) nell'SVG: necessario per PNG e per SVG portabili
function embedFontsInSvg(svg, family, data) {
    var used = { normal: true };
    svg.querySelectorAll('text, tspan').forEach(function(el) {
        var it = el.getAttribute('font-style') === 'italic';
        var bd = el.getAttribute('font-weight') === 'bold';
        used[(bd ? 'bold' : '') + (it ? 'italic' : '') || 'normal'] = true;
    });
    var css = '';
    Object.keys(used).forEach(function(style) {
        var src = FONT_STYLE_FALLBACK[style].filter(function(s) { return data[s]; })[0];
        if (!src) return;
        css += "@font-face{font-family:'" + family + "';" +
               'font-style:' + (style.indexOf('italic') >= 0 ? 'italic' : 'normal') + ';' +
               'font-weight:' + (style.indexOf('bold') === 0 ? 'bold' : 'normal') + ';' +
               'src:url(data:font/ttf;base64,' + data[src] + ") format('truetype');}";
    });
    var defs = document.createElementNS(SVG_NS, 'defs');
    var style = document.createElementNS(SVG_NS, 'style');
    style.setAttribute('type', 'text/css');
    style.textContent = css;
    defs.appendChild(style);
    svg.insertBefore(defs, svg.firstChild);
}

function serializeSvg(svg) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' +
           new XMLSerializer().serializeToString(svg);
}

// ---------------------------------------------------------
// PNG
// ---------------------------------------------------------

function svgToPngBlob(svg, pixelRatio) {
    pixelRatio = pixelRatio || 3;
    var w = parseFloat(svg.getAttribute('width'));
    var h = parseFloat(svg.getAttribute('height'));
    return new Promise(function(resolve, reject) {
        var url = URL.createObjectURL(new Blob([serializeSvg(svg)], { type: 'image/svg+xml;charset=utf-8' }));
        var img = new Image();
        img.onerror = function() { URL.revokeObjectURL(url); reject(new Error('Rasterizzazione SVG non riuscita')); };
        img.onload = function() {
            // breve attesa: i font incorporati devono essere decodificati
            setTimeout(function() {
                var canvas = document.createElement('canvas');
                canvas.width = Math.round(w * pixelRatio);
                canvas.height = Math.round(h * pixelRatio);
                var ctx = canvas.getContext('2d');
                ctx.scale(pixelRatio, pixelRatio);
                ctx.drawImage(img, 0, 0, w, h);
                URL.revokeObjectURL(url);
                canvas.toBlob(function(blob) {
                    if (blob) resolve(blob); else reject(new Error('Canvas vuoto'));
                }, 'image/png');
            }, 150);
        };
        img.src = url;
    });
}

function exportPNG() {
    showBusy('Esportazione PNG…');
    var family = userSettings.fontFamily;
    Promise.all([renderPagesForExport(), loadFontData(family)]).then(function(r) {
        var out = r[0], data = r[1], base = exportBaseName();
        var chain = Promise.resolve();
        out.svgs.forEach(function(svg, i) {
            chain = chain.then(function() {
                embedFontsInSvg(svg, family, data);
                return svgToPngBlob(svg, 300 / 96).then(function(blob) {
                    downloadBlob(blob, base + (out.svgs.length > 1 ? '-p' + (i + 1) : '') + '.png');
                });
            });
        });
        return chain;
    }).then(function() { showBusy(null); }).catch(exportError);
}

function exportPNGCropped() {
    showBusy('Esportazione PNG…');
    var family = userSettings.fontFamily;
    Promise.all([renderForExport(), loadFontData(family)]).then(function(r) {
        var svg = buildCroppedSvg(r[0], 10);
        embedFontsInSvg(svg, family, r[1]);
        return svgToPngBlob(svg, 3).then(function(blob) {
            downloadBlob(blob, exportBaseName() + '-ritagliato.png');
        });
    }).then(function() { showBusy(null); }).catch(exportError);
}

// ---------------------------------------------------------
// SVG
// ---------------------------------------------------------

function exportSVG() {
    showBusy('Esportazione SVG…');
    var family = userSettings.fontFamily;
    Promise.all([renderPagesForExport(), loadFontData(family)]).then(function(r) {
        var out = r[0], base = exportBaseName();
        out.svgs.forEach(function(svg, i) {
            svg.setAttribute('width', out.geom.wmm + 'mm');
            svg.setAttribute('height', out.geom.hmm + 'mm');
            embedFontsInSvg(svg, family, r[1]);
            downloadBlob(new Blob([serializeSvg(svg)], { type: 'image/svg+xml;charset=utf-8' }),
                         base + (out.svgs.length > 1 ? '-p' + (i + 1) : '') + '.svg');
        });
        showBusy(null);
    }).catch(exportError);
}

function exportSVGCropped() {
    showBusy('Esportazione SVG…');
    var family = userSettings.fontFamily;
    Promise.all([renderForExport(), loadFontData(family)]).then(function(r) {
        var svg = buildCroppedSvg(r[0], 10);
        embedFontsInSvg(svg, family, r[1]);
        downloadBlob(new Blob([serializeSvg(svg)], { type: 'image/svg+xml;charset=utf-8' }),
                     exportBaseName() + '-ritagliato.svg');
        showBusy(null);
    }).catch(exportError);
}

// ---------------------------------------------------------
// PDF VETTORIALE (jsPDF + svg2pdf.js, font incorporati)
// ---------------------------------------------------------

function pdfAvailable() {
    if (typeof jspdf === 'undefined' || !jspdf.jsPDF) {
        alert('Libreria jsPDF non disponibile');
        return false;
    }
    if (typeof jspdf.jsPDF.API.svg !== 'function' && typeof svg2pdf === 'undefined') {
        alert('Libreria svg2pdf non disponibile');
        return false;
    }
    return true;
}

function drawSvgOnPdf(pdf, svg, x, y, w, h) {
    var host = getMeasureHost();
    host.appendChild(svg);
    var p = typeof pdf.svg === 'function'
        ? pdf.svg(svg, { x: x, y: y, width: w, height: h })
        : svg2pdf.svg2pdf(svg, pdf, { x: x, y: y, width: w, height: h });
    return Promise.resolve(p).then(function() {
        host.removeChild(svg);
    }, function(e) {
        host.removeChild(svg);
        throw e;
    });
}

// Nota: svg2pdf gestisce correttamente i <use> (neumi) solo con unità 'pt'
var PT_PER_MM = 72 / 25.4;

function newPdf(wmm, hmm) {
    return new jspdf.jsPDF({
        orientation: wmm > hmm ? 'landscape' : 'portrait',
        unit: 'pt',
        format: [wmm * PT_PER_MM, hmm * PT_PER_MM],
        compress: true
    });
}

function setPdfProperties(pdf) {
    var doc = parseGabc($('#editor').val());
    pdf.setProperties({
        title: headerGet(doc, 'name') || 'Benedictus',
        subject: [headerGet(doc, 'office-part'), headerGet(doc, 'commentary')].filter(Boolean).join(' – '),
        author: headerGet(doc, 'transcriber') || '',
        creator: 'Benedictus - GABC Chant Editor'
    });
}

function exportPDF() {
    if (!pdfAvailable()) return;
    showBusy('Generazione PDF vettoriale…');
    var family = userSettings.fontFamily;
    Promise.all([renderPagesForExport(), loadFontData(family)]).then(function(r) {
        var out = r[0], geom = out.geom;
        var pdf = newPdf(geom.wmm, geom.hmm);
        registerPdfFonts(pdf, family, r[1]);
        setPdfProperties(pdf);
        var chain = Promise.resolve();
        out.svgs.forEach(function(svg, i) {
            chain = chain.then(function() {
                if (i > 0) pdf.addPage([geom.wmm * PT_PER_MM, geom.hmm * PT_PER_MM], geom.wmm > geom.hmm ? 'landscape' : 'portrait');
                return drawSvgOnPdf(pdf, svg, 0, 0, geom.wmm * PT_PER_MM, geom.hmm * PT_PER_MM);
            });
        });
        return chain.then(function() {
            pdf.save(exportBaseName() + '.pdf');
            showBusy(null);
        });
    }).catch(exportError);
}

function exportPDFCropped() {
    if (!pdfAvailable()) return;
    showBusy('Generazione PDF vettoriale…');
    var family = userSettings.fontFamily;
    Promise.all([renderForExport(), loadFontData(family)]).then(function(r) {
        var svg = buildCroppedSvg(r[0], 10);
        var wmm = parseFloat(svg.getAttribute('width')) / PX_PER_MM;
        var hmm = parseFloat(svg.getAttribute('height')) / PX_PER_MM;
        var pdf = newPdf(wmm, hmm);
        registerPdfFonts(pdf, family, r[1]);
        setPdfProperties(pdf);
        return drawSvgOnPdf(pdf, svg, 0, 0, wmm * PT_PER_MM, hmm * PT_PER_MM).then(function() {
            pdf.save(exportBaseName() + '-ritagliato.pdf');
            showBusy(null);
        });
    }).catch(exportError);
}

// =========================================================
// GABC: COPIA, SCARICA, IMPORTA
// =========================================================

function copyGabcToClipboard() {
    var gabc = $("#editor").val();
    navigator.clipboard.writeText(gabc).then(function() {
        alert('GABC copiato negli appunti!');
    }).catch(function() {
        var textarea = document.createElement('textarea');
        textarea.value = gabc;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('GABC copiato!');
    });
}

function downloadGabcFile() {
    var gabc = $("#editor").val();
    downloadBlob(new Blob([gabc], { type: 'text/plain;charset=utf-8' }), exportBaseName() + '.gabc');
}

function loadGabcText(text, fileName) {
    text = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
    var current = $('#editor').val();
    if (current.trim() && current !== text &&
        !confirm('Sostituire il GABC attuale con "' + fileName + '"?\nLe modifiche non salvate andranno perse.')) {
        return;
    }
    lastFileName = fileName;
    $('#editor').val(text);
    lastRender = null;
    updatePreview();
}

function importGabcFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function() { loadGabcText(String(reader.result), file.name); };
    reader.onerror = function() { alert('Impossibile leggere il file ' + file.name); };
    reader.readAsText(file, 'UTF-8');
}

// =========================================================
// INTESTAZIONE: SINCRONIZZAZIONE MODULO <-> GABC
// =========================================================

var KNOWN_FORM_KEYS = {};

function syncHeaderForm() {
    var doc = parseGabc($('#editor').val());
    $('#header-panel [data-header]').each(function() {
        if (this === document.activeElement) return;
        var key = this.getAttribute('data-header');
        var idx = parseInt(this.getAttribute('data-index') || '0', 10);
        var v = headerGet(doc, key, idx);
        if (this.tagName === 'SELECT') {
            var has = $(this).find('option').filter(function() { return this.value === v; }).length;
            if (!has && v) $(this).append($('<option>').val(v).text(v));
        }
        if ($(this).val() !== v) $(this).val(v);
    });
    var others = [];
    doc.entries.forEach(function(e) {
        if (e.key && !KNOWN_FORM_KEYS[e.key] && others.indexOf(e.key) < 0) others.push(e.key);
    });
    $('#header-extra-info').text(others.length ? 'Altri campi conservati: ' + others.join(', ') : '');
}

function onHeaderFieldChange() {
    var key = this.getAttribute('data-header');
    var idx = parseInt(this.getAttribute('data-index') || '0', 10);
    var doc = parseGabc($('#editor').val());
    if (key === 'annotation' && idx === 1 && !headerGet(doc, 'annotation', 0) && $(this).val()) {
        idx = 0;  // non lasciare buchi: la seconda annotazione diventa la prima
    }
    headerSet(doc, key, $(this).val(), idx);
    if (!doc.hasSeparator) {
        doc.body = $('#editor').val();
        doc.hasSeparator = true;
    }
    $('#editor').val(serializeGabc(doc));
    schedulePreview();
}

function autoAnnotations() {
    var doc = parseGabc($('#editor').val());
    var part = headerGet(doc, 'office-part');
    var mode = headerGet(doc, 'mode');
    if (!part && !mode) {
        alert('Compila prima "Tipo" (office-part) e/o "Modo" (mode).');
        return;
    }
    var a1 = officePartAbbr(part);
    var a2 = mode ? modeToRoman(mode) : '';
    var diff = headerGet(doc, 'mode-differentia');
    if (a2 && diff) a2 += ' ' + diff;
    // rimuove le annotazioni esistenti e scrive le nuove
    doc.entries = doc.entries.filter(function(e) { return e.key !== 'annotation'; });
    if (a1) headerSet(doc, 'annotation', a1, 0);
    if (a2) headerSet(doc, 'annotation', a2, a1 ? 1 : 0);
    $('#editor').val(serializeGabc(doc));
    updatePreview();
}

// =========================================================
// SCHELETRO GABC DA TESTO
// =========================================================
// Sillabazione latina: pattern Hypher (la) + regole della tradizione
// liturgica (gruppi consonantici che possono iniziare sillaba: san-ctus,
// Chri-stus, ma-gnus) e dittonghi ae/oe.

var LATIN_ONSETS = [
    'scr', 'spl', 'spr', 'str', 'chr', 'phr', 'thr', 'chl', 'phl',
    'bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'pl', 'pr', 'tr',
    'ch', 'ph', 'th', 'rh', 'gn', 'ct', 'pt', 'ps', 'sc', 'sp', 'st', 'qu', 'gu'
];

var LATIN_VOWELS = 'aeiouyáéíóúýàèìòùäëïöüÿæœǽâêîôûAEIOUYÁÉÍÓÚÝÀÈÌÒÙÄËÏÖÜÆŒǼÂÊÎÔÛ';

function isLatinVowel(ch) { return LATIN_VOWELS.indexOf(ch) >= 0; }

function trailingConsonants(s) {
    var i = s.length;
    while (i > 0 && !isLatinVowel(s[i - 1])) i--;
    return s.slice(i);
}

function leadingConsonants(s) {
    var i = 0;
    while (i < s.length && !isLatinVowel(s[i])) i++;
    return s.slice(0, i);
}

function syllabifyLatin(word, opts) {
    var hy = window.Hypher && Hypher.languages && Hypher.languages.la;
    var syls = hy ? hy.hyphenate(word) : [word];
    if (syls.length < 2) return syls;

    if (opts.liturgical) {
        for (var i = 0; i < syls.length - 1; i++) {
            var left = syls[i], right = syls[i + 1];
            var tail = trailingConsonants(left);
            if (!tail || tail.length === left.length) continue;
            var cluster = (tail + leadingConsonants(right)).toLowerCase();
            var nextLead = leadingConsonants(right).length;
            // l'attacco più lungo ammesso al termine del gruppo consonantico
            var onset = '';
            for (var k = 0; k < LATIN_ONSETS.length; k++) {
                var o = LATIN_ONSETS[k];
                if (cluster.length >= o.length && cluster.slice(-o.length) === o && o.length > onset.length) onset = o;
            }
            var move = onset ? onset.length - nextLead : 0;
            if (move > 0 && move < left.length && move <= tail.length) {
                syls[i] = left.slice(0, left.length - move);
                syls[i + 1] = left.slice(left.length - move) + right;
            }
        }
    }
    if (opts.diphthongs) {
        for (var j = 0; j < syls.length - 1; j++) {
            var a = syls[j].slice(-1).toLowerCase(), b = syls[j + 1].toLowerCase();
            // solo "sa-e-cu-lum" → "sae-cu-lum"; "Is-ra-el" resta invariato
            if ((a === 'a' || a === 'o') && b.charAt(0) === 'e' && trailingConsonants(b).length === b.length - 1 &&
                (b.length === 1 || j + 1 < syls.length - 1)) {
                syls[j] = syls[j] + syls[j + 1];
                syls.splice(j + 1, 1);
                j--;
            }
        }
    }
    return syls.filter(Boolean);
}

var BAR_FOR_PUNCT = { ',': '(,)', ';': '(;)', ':': '(:)', '.': '(:)', '?': '(:)', '!': '(:)' };

function textToGabcSkeleton(text, opts) {
    var note = opts.note || '';
    text = text.replace(/\r\n?/g, '\n').trim();
    if (!text) return '';

    // strofe: separate da righe vuote o numerate "1.", "2." a inizio riga
    var strophes = text.split(/\n\s*\n/);
    if (strophes.length === 1 && /^\s*\d+\.\s/m.test(text)) {
        strophes = text.split(/\n(?=\s*\d+\.\s)/);
    }
    strophes = strophes.map(function(s) { return s.replace(/^\s*\d+\.\s*/, '').replace(/\s+/g, ' ').trim(); })
                       .filter(Boolean);

    // "Amen" finale come sezione a sé
    var amen = false;
    if (strophes.length > 1 && /^amen[.!]?$/i.test(strophes[strophes.length - 1])) {
        amen = true;
        strophes.pop();
    }

    var firstWordDone = false;
    function wordToGabc(token) {
        // segni speciali isolati
        if (/^(\*+|†|✠|\+)$/.test(token)) return token + '()';
        if (/^(℣|℟|V\/|R\/)\.?$/.test(token)) {
            var sp = /^(℣|V\/)/.test(token) ? 'V/' : 'R/';
            return '<sp>' + sp + '</sp>.()';
        }
        var m = token.match(/^([^\p{L}]*)([\p{L}\p{M}'’]+)([^\p{L}]*)$/u);
        if (!m) return token + '(' + note + ')';
        var lead = m[1], word = m[2], trail = m[3];
        if (opts.upperFirst && !firstWordDone) word = word.toUpperCase();
        firstWordDone = true;
        var syls = syllabifyLatin(word, opts);
        var out = syls.map(function(s, i) {
            return (i === 0 ? lead : '') + s + (i === syls.length - 1 ? trail : '') + '(' + note + ')';
        }).join('');
        if (opts.bars) {
            var p = trail.replace(/[^,;:.?!]/g, '').slice(-1);
            if (p && BAR_FOR_PUNCT[p]) out += ' ' + BAR_FOR_PUNCT[p];
        }
        return out;
    }

    var parts = strophes.map(function(s, idx) {
        var words = s.split(' ').map(wordToGabc).join(' ');
        // la fine della strofa riceve la doppia stanghetta (o il numero della successiva)
        words = words.replace(/\s*\((?:,|;|:)\)\s*$/, '');
        var isLast = idx === strophes.length - 1;
        if (opts.numberVerses && strophes.length > 1) {
            var prefix = idx > 0 ? (idx + 1) + '.(::) ' : '';
            return prefix + words + (isLast ? ' (::)' : '');
        }
        return words + ' (::)';
    });

    var out = '(' + opts.clef + ') ' + parts.join('\n');
    if (amen) out += '\nA(' + note + ')men.(' + note + ') (::)';
    return out;
}

function showSkeletonModal() {
    var modal = $(
        '<div class="bn-modal" role="dialog" aria-modal="true">' +
          '<div class="bn-modal-box">' +
            '<h2>Genera struttura GABC da testo</h2>' +
            '<p class="sub">Incolla il testo latino: verrà sillabato e trasformato in uno scheletro GABC da completare con le note. ' +
            'Separa le strofe con una riga vuota (o numerale "1.", "2."…). Gli accenti scritti (á, é, í…) sono conservati.</p>' +
            '<textarea id="skel-input" spellcheck="false" placeholder="Ut queant laxis resonáre fibris&#10;Mira gestórum fámuli tuórum,&#10;Solve pollúti lábii reátum,&#10;Sancte Joánnes.&#10;&#10;Núntius celso véniens Olýmpo…"></textarea>' +
            '<div class="skel-options">' +
              '<label>Chiave <select id="skel-clef">' +
                ['c4', 'c3', 'c2', 'c1', 'f4', 'f3', 'f2', 'cb3', 'cb4'].map(function(c) {
                    return '<option value="' + c + '">' + c + '</option>';
                }).join('') + '</select></label>' +
              '<label>Note segnaposto <select id="skel-note">' +
                '<option value="">vuote ( )</option><option value="f">f</option><option value="g">g</option>' +
                '<option value="h">h</option><option value="i">i</option><option value="j">j</option></select></label>' +
              '<label><input type="checkbox" id="skel-bars" checked> Stanghette dalla punteggiatura</label>' +
              '<label><input type="checkbox" id="skel-upper" checked> Prima parola in maiuscolo</label>' +
              '<label><input type="checkbox" id="skel-number" checked> Numera le strofe (2., 3.…)</label>' +
              '<label><input type="checkbox" id="skel-liturgical" checked> Sillabazione liturgica (san-ctus, Chri-stus)</label>' +
              '<label><input type="checkbox" id="skel-diph" checked> Dittonghi ae / oe uniti</label>' +
            '</div>' +
            '<label for="skel-output" style="font-weight:600">Anteprima GABC (modificabile)</label>' +
            '<textarea id="skel-output" class="mono" spellcheck="false"></textarea>' +
            '<div class="bn-modal-actions">' +
              '<button class="bn-btn" id="skel-cancel">Annulla</button>' +
              '<button class="bn-btn" id="skel-append">Aggiungi in coda</button>' +
              '<button class="bn-btn primary" id="skel-replace">Sostituisci il corpo</button>' +
            '</div>' +
          '</div>' +
        '</div>');

    function opts() {
        return {
            clef: modal.find('#skel-clef').val(),
            note: modal.find('#skel-note').val(),
            bars: modal.find('#skel-bars').is(':checked'),
            upperFirst: modal.find('#skel-upper').is(':checked'),
            numberVerses: modal.find('#skel-number').is(':checked'),
            liturgical: modal.find('#skel-liturgical').is(':checked'),
            diphthongs: modal.find('#skel-diph').is(':checked')
        };
    }
    function regenerate() {
        var out = textToGabcSkeleton(modal.find('#skel-input').val(), opts());
        modal.find('#skel-output').val(out);
        modal.find('#skel-append, #skel-replace').prop('disabled', !out);
    }
    function close() { modal.remove(); }
    function apply(mode) {
        var skeleton = modal.find('#skel-output').val().trim();
        if (!skeleton) return;
        var doc = parseGabc($('#editor').val());
        if (!doc.hasSeparator) {
            doc = { entries: [], body: mode === 'append' ? doc.body : '', hasSeparator: true };
        }
        if (mode === 'replace') {
            if (bodyForEngine(doc.body) && !confirm('Sostituire il corpo attuale del brano? L\'intestazione viene mantenuta.')) return;
            doc.body = skeleton + '\n';
        } else {
            // in coda: la chiave iniziale dello scheletro non serve
            var tail = bodyForEngine(doc.body) ? skeleton.replace(/^\([cf]b?[1-5]\)\s*/, '') : skeleton;
            doc.body = doc.body.replace(/\s*$/, '\n') + tail + '\n';
        }
        $('#editor').val(serializeGabc(doc));
        close();
        updatePreview();
    }

    modal.on('input change', '#skel-input, .skel-options input, .skel-options select', regenerate);
    modal.on('click', '#skel-cancel', close);
    modal.on('click', '#skel-replace', function() { apply('replace'); });
    modal.on('click', '#skel-append', function() { apply('append'); });
    modal.on('click', function(e) { if (e.target === modal[0]) close(); });
    $(document).one('keydown.skel', function(e) { if (e.key === 'Escape') close(); });

    $('body').append(modal);
    regenerate();
    modal.find('#skel-input').focus();
}

// =========================================================
// INIZIALIZZAZIONE
// =========================================================

$(function() {
    var defaultGabc = 'name: Ut queant laxis;\n' +
                     'office-part: Hymnus;\n' +
                     'mode: 2;\n' +
                     'annotation: Hymnus;\n' +
                     'annotation: II;\n' +
                     'occasion: In Nativitate S. Ioannis Baptistae;\n' +
                     'commentary: Paulus Diaconus;\n' +
                     'initial-style: 1;\n' +
                     '%%\n' +
                     '(f3) UT(e) que(f)ant(h) la(fg)xis(f) (,) re(f)so(f)ná(e)re(f) fi(g)bris(g) (;) Mi(g!hwi)ra(g) ge(f)stó(ge)rum(f) (,) fá(h)mu(i)li(j) tu(i)ó(hf)rum,(f) (:) Sol(iji)ve(hg) pol(h)lú(i)ti(f) (,) lá(j)bi(i)i(j) re(hi)á(j)tum,(j) (,) San(ih)cte(gf) Jo(e)án(g)nes.(f) \n' +
                     '2.(::) Nún(e)ti(f)us(h) cel(fg)so(f) (,) vé(f)ni(f)ens(e) O(f)lým(g)po,(g) (;) Te(g!hwi) pa(g)tri(f) ma(ge)gnum(f) (,) fo(h)re(i) na(j)sci(i)tú(hf)rum,(f) (:) No(iji)men,(hg) et(h) vi(i)tae(f) (,) sé(j)ri(i)em(j) ge(hi)rén(j)dae(j) (,) Or(ih)di(gf)ne(e) pro(g)mit.(f) \n' +
                     '3.(::) Il(e)le(f) pro(h)mís(fg)si(f) (,) dú(f)bi(f)us(e) su(f)pér(g)ni,(g) (;) Pér(g!hwi)di(g)dit(f) prom(ge)ptae(f) (,) mó(h)du(i)los(j) lo(i)qué(hf)lae:(f) (:) Sed(iji) re(hg)for(h)má(i)sti(f) (,) gé(j)ni(i)tus(j) pe(hi)rém(j)ptae(j) (,) Or(ih)ga(gf)na(e) vo(g)cis.(f) \n' +
                     '4.(::) Ven(e)tris(f) ob(h)strú(fg)so(f) (,) ré(f)cu(f)bans(e) cu(f)bí(g)li(g) (;) Sén(g!hwi)se(g)ras(f) Re(ge)gem(f) (,) thá(h)la(i)mo(j) ma(i)nén(hf)tem:(f) (:) Hinc(iji) pa(hg)rens(h) na(i)ti(f) (,) mé(j)ri(i)tis(j) u(hi)tér(j)que(j) (,) Ab(ih)di(gf)ta(e) pan(g)dit.(f) \n' +
                     '5.(::) Sit(e) de(f)cus(h) Pa(fg)tri,(f) (,) ge(f)ni(f)taé(e)que(f) Pro(g)li,(g) (;) Et(g!hwi) ti(g)bi(f) com(ge)par(f) (,) u(h)tri(i)ús(j)que(i) vir(hf)tus,(f) (:) Spí(iji)ri(hg)tus(h) sem(i)per,(f) (,) De(j)us(i) u(j)nus,(hi) om(j)ni(j) (,) Tém(ih)po(gf)ris(e) ae(g)vo.(f) (::) \n' +
                     'A(fgf)men.(ef) (::)';

    $('#header-panel [data-header]').each(function() {
        KNOWN_FORM_KEYS[this.getAttribute('data-header')] = true;
    });

    $("#editor").val(defaultGabc);

    // Editor e intestazione
    $('#editor').on('input', function() { schedulePreview(); });
    $('#header-panel').on('input change', '[data-header]', onHeaderFieldChange);
    $('#lnkAutoAnnotation').on('click', function(e) { e.preventDefault(); autoAnnotations(); });

    // Link rapidi
    $('#lnkShowText').on('click', function(e) { e.preventDefault(); showTextModal(); });
    $('#lnkCredits').on('click', function(e) { e.preventDefault(); showCreditsModal(); });
    $('#lnkCopyGabc').on('click', function(e) { e.preventDefault(); copyGabcToClipboard(); });
    $('#lnkDownloadGabc').on('click', function(e) { e.preventDefault(); downloadGabcFile(); });
    $('#lnkImportGabc').on('click', function(e) { e.preventDefault(); $('#gabc-file-input').val('').trigger('click'); });
    $('#gabc-file-input').on('change', function() { importGabcFile(this.files && this.files[0]); });
    $('#lnkSkeleton').on('click', function(e) { e.preventDefault(); showSkeletonModal(); });

    // Trascina un file .gabc sull'editor
    $('#editor').on('dragover', function(e) { e.preventDefault(); })
                .on('drop', function(e) {
                    var files = e.originalEvent.dataTransfer && e.originalEvent.dataTransfer.files;
                    if (files && files.length) { e.preventDefault(); importGabcFile(files[0]); }
                });

    // Aspetto
    $('#dark-mode-toggle').on('change', toggleDarkMode);
    $('#inputStaffColor').on('change', function() { userSettings.staffColor = $(this).val(); updatePreview(); });
    $('#inputRubricColor').on('change', function() { userSettings.rubricColor = $(this).val(); updatePreview(); });
    $('#inputDropCapColor').on('change', function() { userSettings.dropCapColor = $(this).val(); updatePreview(); });

    function bindSlider(sel, key, label, parse, digits) {
        $(sel).on('input', function() {
            userSettings[key] = parse($(this).val());
            $(label).text(digits === undefined ? userSettings[key] : userSettings[key].toFixed(digits));
            schedulePreview(120);
        });
    }
    bindSlider('#scaleSlider', 'scale', '#scaleVal', parseFloat, 1);
    bindSlider('#spacingSlider', 'spacing', '#spacingVal', parseFloat, 1);
    bindSlider('#lineSpacingSlider', 'lineSpacing', '#lineSpacingVal', parseFloat, 2);
    bindSlider('#dropCapSlider', 'dropCapScale', '#dropCapVal', parseFloat, 1);
    bindSlider('#lyricSizeSlider', 'lyricSize', '#lyricSizeVal', function(v) { return parseInt(v, 10); });
    bindSlider('#titleSizeSlider', 'titleSize', '#titleSizeVal', function(v) { return parseInt(v, 10); });

    $('#custos-style').on('change', function() { userSettings.custosStyle = $(this).val(); updatePreview(); });
    $('#minima-stems').on('change', function() { userSettings.minimaStems = $(this).val(); updatePreview(); });
    $('#text-font').on('change', function() {
        userSettings.fontFamily = $(this).val();
        updatePreview();
    });
    $('#group-verses-toggle').on('change', function() { userSettings.allVersesToOneLine = $(this).is(':checked'); updatePreview(); });

    // Impaginazione
    $('#page-view-toggle').on('change', function() { userSettings.pageView = $(this).is(':checked'); updatePreview(); });
    $('#paper-size').on('change', function() { userSettings.paper = $(this).val(); updatePreview(); });
    $('#paper-orientation').on('change', function() { userSettings.orientation = $(this).val(); updatePreview(); });
    $('#page-numbers-toggle').on('change', function() { userSettings.pageNumbers = $(this).is(':checked'); updatePreview(); });
    [['#margin-top', 'marginTop'], ['#margin-bottom', 'marginBottom'],
     ['#margin-left', 'marginLeft'], ['#margin-right', 'marginRight']].forEach(function(m) {
        $(m[0]).on('input change', function() {
            var v = parseFloat($(this).val());
            if (!isNaN(v) && v >= 0 && v <= 80) { userSettings[m[1]] = v; schedulePreview(); }
        });
    });

    // Intestazione stampata
    [['#show-title', 'showTitle'], ['#show-subtitle', 'showSubtitle'], ['#show-occasion', 'showOccasion'],
     ['#show-commentary', 'showCommentary'], ['#show-source', 'showSource']].forEach(function(c) {
        $(c[0]).on('change', function() { userSettings[c[1]] = $(this).is(':checked'); updatePreview(); });
    });

    // Esportazione
    $('#export-png-full').on('click', exportPNG);
    $('#export-png-cropped').on('click', exportPNGCropped);
    $('#export-svg-full').on('click', exportSVG);
    $('#export-svg-cropped').on('click', exportSVGCropped);
    $('#export-pdf-full').on('click', exportPDF);
    $('#export-pdf-cropped').on('click', exportPDFCropped);

    // In modalità continua la larghezza dipende dalla finestra
    $(window).on('resize', function() { if (!userSettings.pageView) schedulePreview(200); });

    updatePreview();
});
