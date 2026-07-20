// =========================================================
// BENEDICTUS GABC EDITOR 
// =========================================================

var ctxt = new exsurge.ChantContext();
var score;
var defaultFont = 'Palatino Linotype, Book Antiqua, Palatino, serif';

var userSettings = {
    scale: 1.4,
    spacing: 0.8,
    dropCapScale: 1.0,
    font: defaultFont,
    staffColor: '#000000',
    rubricColor: '#cc0000',
    dropCapColor: '#000000',  
    allVersesToOneLine: false,
    lyricSize: 17
};

// =========================================================
// ESTRAZIONE TESTO DAL GABC
// =========================================================

function extractTextFromGabc(gabc) {
    var lines = gabc.split('\n');
    var gabcBody = '';
    var foundSeparator = false;
    
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line === '%%') {
            foundSeparator = true;
            continue;
        }
        if (foundSeparator) {
            if (line) gabcBody += line + ' ';
        }
    }
    
    gabcBody = gabcBody.replace(/^\([a-z][b]?[0-9]\)\s*/i, '');
    
    var text = '';
    var depth = 0;
    
    for (var i = 0; i < gabcBody.length; i++) {
        var c = gabcBody[i];
        if (c === '(') {
            depth++;
        } else if (c === ')') {
            depth--;
        } else if (depth === 0) {
            text += c;
        }
    }
    
    text = text.replace(/\s+/g, ' ').trim();
    text = text.replace(/(\d+\.)/g, '\n$1 ');
    text = text.replace(/,(?!\s)/g, ', ');
    text = text.replace(/\.(?!\s)/g, '. ');
    text = text.replace(/:(?!\s)/g, ': ');
    text = text.replace(/;(?!\s)/g, '; ');
    
    return text.trim();
}

// =========================================================
// MOSTRA TESTO ESTRATTO
// =========================================================

function showCreditsModal() {
    var isDark = document.body.classList.contains('dark-mode');
    var modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center';

    var box = document.createElement('div');
    box.style.cssText = 'background:' + (isDark ? '#1e1e1e' : '#ffffff') + ';color:' + (isDark ? '#e0e0e0' : '#333333') + ';padding:35px 40px;border-radius:12px;max-width:480px;width:90%;box-shadow:0 8px 30px rgba(0,0,0,0.25);text-align:center;font-family:Garamond Premier Pro,Garamond,Georgia,serif';

    var title = document.createElement('p');
    title.textContent = 'Benedictus';
    title.style.cssText = 'font-size:1.6em;font-weight:bold;margin:0 0 18px 0;font-family:Garamond Premier Pro,Garamond,Georgia,serif';

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
    closeBtn.style.cssText = 'padding:9px 24px;cursor:pointer;background:#4a0e12;color:#fff;border:none;border-radius:5px;font-family:Garamond Premier Pro,Garamond,Georgia,serif;font-size:1em';
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
    title.style.cssText = 'margin-top:0;text-align:center;font-family:Garamond Premier Pro,Garamond,serif';
    
    var textArea = document.createElement('textarea');
    textArea.value = extractedText;
    textArea.readOnly = true;
    textArea.style.cssText = 'width:100%;min-height:400px;padding:10px;font-family:Garamond Premier Pro,Garamond,serif;font-size:20px;border:1px solid #ccc;border-radius:4px;background:' + 
                             (document.body.classList.contains('dark-mode') ? '#2d2d2d' : '#ffffff') + 
                             ';color:' + (document.body.classList.contains('dark-mode') ? '#e0e0e0' : '#333333');
    
    var closeBtn = document.createElement('button');
    closeBtn.textContent = 'Chiudi';
    closeBtn.style.cssText = 'margin:15px auto 0;padding:10px 20px;cursor:pointer;background:#4a0e12;color:#fff;border:none;border-radius:4px;font-family:Garamond Premier Pro,Garamond,serif;font-size:14px;display:block';
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
            
            var syllPattern = /([^\(\)]+?)(\([^\)]+\))/g;
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
// RENDERING PRINCIPALE
// =========================================================

function updatePreview() {
    var originalGabc = $("#editor").val().trim();
    var chantContainer = document.getElementById('chant-preview');
    chantContainer.innerHTML = '';
    
    if (!originalGabc) {
        chantContainer.innerHTML = '<p style="color:gray;">Inserisci notazione GABC per vedere l\'anteprima.</p>';
        return;
    }
    
    ctxt = new exsurge.ChantContext();
    
    var lines = originalGabc.split('\n');
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

    var finalGabc = headerLines.join('\n') + '\n%%\n' + bodyLines.join(' ');
    finalGabc = finalGabc.trim();

    if (userSettings.allVersesToOneLine) {
        finalGabc = allVersesToOneLine(finalGabc);
    }
    
    if (!finalGabc) {
        chantContainer.innerHTML = '<p style="color:gray;">Il GABC non contiene contenuto valido.</p>';
        return;
    }
    
    // Configurazione font
    ctxt.lyricTextFont = userSettings.font;
    ctxt.dropCapTextFont = userSettings.font;
    ctxt.annotationTextFont = userSettings.font;
    
    // Parametri fissi
    ctxt.staffInterval = 7;
    ctxt.glyphScaling = 0.07;
    ctxt.lyricTextSize = userSettings.lyricSize;
    ctxt.textStyles.lyric.size = userSettings.lyricSize;
    ctxt.annotationTextSize = 11;
    
    var initialStyleMatch = finalGabc.match(/initial-style:\s*(\d+)/);
    var initialStyle = initialStyleMatch ? parseInt(initialStyleMatch[1]) : 1;
    var baseDropCapSize = initialStyle === 0 ? 40 : (initialStyle === 2 ? 80 : 60);
    ctxt.dropCapTextSize = baseDropCapSize;
    
    // Spaziatura
    ctxt.intraNeumeSpacing = 10 * userSettings.spacing;    
    ctxt.minSpaceBetweenNeumes = 5 * userSettings.spacing;
    
    if (ctxt.doubleBarSpacing !== undefined) ctxt.doubleBarSpacing = 8;
    if (ctxt.spaceBetweenDoubleBar !== undefined) ctxt.spaceBetweenDoubleBar = 8;
    
    ctxt.staffLineWeight = 1;
    ctxt.dividerLineWeight = 1;
    ctxt.neumeLineWeight = 1;
    
    // Colori
    var neumeColor = document.body.classList.contains('dark-mode') ? '#ffffff' : '#000000';
    ctxt.neumeLineColor = neumeColor;
    ctxt.clefLineColor = neumeColor;
    ctxt.custoLineColor = neumeColor;
    ctxt.staffLineColor = userSettings.staffColor;
    ctxt.dividerLineColor = userSettings.staffColor;
    ctxt.lyricTextColor = neumeColor;
    ctxt.rubricColor = userSettings.rubricColor;
    ctxt.dropCapTextColor = userSettings.dropCapColor;
    
    try {
        var mappings = exsurge.Gabc.createMappingsFromSource(ctxt, finalGabc);
        
        if (!mappings || mappings.length === 0) {
            throw new Error("Nessun mapping creato dal GABC");
        }
        
        score = new exsurge.ChantScore(ctxt, mappings, true);
        
        var containerWidth = chantContainer.offsetWidth || 800;
        var renderWidth = containerWidth / userSettings.scale;
        
        score.performLayout(ctxt);
        score.layoutChantLines(ctxt, renderWidth, function() {
            try {
                var svgNode = score.createSvgNode(ctxt);
                
                // Correzioni visive
                adjustDoubleBarSpacing(svgNode);
                forceStaffLineColors(svgNode);
                
// ============================================
// SOLUZIONE ANNOTATION - POSIZIONAMENTO CORRETTO
// ============================================

var annotationMatches = finalGabc.match(/annotation:\s*(.+)/g);
if (annotationMatches && annotationMatches.length > 0) {
    var annotations = annotationMatches.map(function(match) {
        return match.replace('annotation:', '').replace(';', '').trim();
    });
    
    var dropCap = svgNode.querySelector('text.dropCap');
    if (dropCap) {
        // STEP 1: Ottieni coordinate originali
        var dropCapX = parseFloat(dropCap.getAttribute('x')) || 0;
        var dropCapY = parseFloat(dropCap.getAttribute('y')) || 0; 
        var dropCapFontSize = parseFloat(dropCap.getAttribute('font-size')) || 60;
        
        // STEP 2: Applica lo scale
        dropCap.style.transformOrigin = dropCapX + 'px ' + dropCapY + 'px';
        dropCap.style.transform = 'scale(' + userSettings.dropCapScale + ')';
        
        // Forza il reflow
        void dropCap.offsetHeight;
        
        // Gestione colore capolettera
        var dropCapColorToUse = userSettings.dropCapColor;
        if (dropCapColorToUse === '#000000' || dropCapColorToUse === '#ffffff') {
            dropCapColorToUse = neumeColor;
        }
        dropCap.setAttribute('fill', dropCapColorToUse);
        dropCap.style.fill = dropCapColorToUse;
        
        // STEP 3: CALCOLO CORRETTO POSIZIONE ANNOTATION
        
        var capHeight = dropCapFontSize * userSettings.dropCapScale * 0.75;
        var dropCapTop = dropCapY - capHeight;
        
        // Ottieni il bbox per calcolare il centro X
        var scaledBBox = dropCap.getBBox();
        var centerX = dropCapX + (scaledBBox.width * 0.5 * userSettings.dropCapScale);
        
        // Parametri annotation
        var annotationFontSize = 11;
        var lineHeight = 16;
        var topPadding = -30; 
        
        // STEP 4: Crea e posiziona le annotation
        for (var j = 0; j < annotations.length; j++) {
            var annotationText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            
            var yOffset = dropCapTop - topPadding - ((annotations.length - 1 - j) * lineHeight);
            
            annotationText.setAttribute('x', centerX);
            annotationText.setAttribute('y', yOffset);
            annotationText.setAttribute('text-anchor', 'middle');
            annotationText.setAttribute('font-family', userSettings.font);
            annotationText.setAttribute('font-size', annotationFontSize);
            
            annotationText.setAttribute('fill', userSettings.rubricColor);
            annotationText.style.fill = userSettings.rubricColor;
            
            annotationText.setAttribute('class', 'annotation');
            annotationText.textContent = annotations[j];
            
            svgNode.insertBefore(annotationText, svgNode.firstChild);
        }
        
        // ============================================
        // CORREZIONE VIEWBOX - ESPANSIONE INTELLIGENTE
        // ============================================
        
        var currentViewBox = svgNode.getAttribute('viewBox') || '';
        var viewBoxParts = currentViewBox.split(' ');
        
        if (viewBoxParts.length === 4) {
            var vbX = parseFloat(viewBoxParts[0]);
            var vbY = parseFloat(viewBoxParts[1]);
            var vbWidth = parseFloat(viewBoxParts[2]);
            var vbHeight = parseFloat(viewBoxParts[3]);
            
            // Calcola la Y minima delle annotation (la più in alto)
            var minAnnotationY = dropCapTop - topPadding - ((annotations.length - 1) * lineHeight) - annotationFontSize;
            
            // Se le annotation escono dal viewBox, espandilo
            if (minAnnotationY < vbY) {
                var padding = 10;
                var newVbY = minAnnotationY - padding;
                
                // Mantieni il bottom uguale
                var viewBoxEnd = vbY + vbHeight;
                var newVbHeight = viewBoxEnd - newVbY;
                
                svgNode.setAttribute('viewBox', vbX + ' ' + newVbY + ' ' + vbWidth + ' ' + newVbHeight);
                
                // Aggiusta l'altezza dell'SVG proporzionalmente
                var oldHeight = parseFloat(svgNode.getAttribute('height')) || vbHeight;
                var heightRatio = newVbHeight / vbHeight;
                svgNode.setAttribute('height', oldHeight * heightRatio);
            }
        }
    }
}
                
// ============================================
// APPLICAZIONE DROPCAP SCALE E COLORE 
// ============================================

// Se ci sono più capolettere (raro), applica lo stesso trattamento
var dropCapTexts = svgNode.querySelectorAll('text.dropCap');
for (var i = 0; i < dropCapTexts.length; i++) {
    var dropCap = dropCapTexts[i];
    
    // Salta il primo (già processato nella sezione annotation)
    if (i === 0 && annotationMatches && annotationMatches.length > 0) {
        continue;
    }
    
    var x = parseFloat(dropCap.getAttribute('x')) || 0;
    var y = parseFloat(dropCap.getAttribute('y')) || 0;
    
    dropCap.style.transformOrigin = x + 'px ' + y + 'px';
    dropCap.style.transform = 'scale(' + userSettings.dropCapScale + ')';
    
    // Gestione colore capolettera
    var dropCapColorToUse = userSettings.dropCapColor;
    if (dropCapColorToUse === '#000000' || dropCapColorToUse === '#ffffff') {
        dropCapColorToUse = neumeColor;
    }
    
    dropCap.setAttribute('fill', dropCapColorToUse);
    dropCap.style.fill = dropCapColorToUse;
}
                
                // ============================================
                // WRAPPER SCALATO
                // ============================================
                
                var originalWidth = parseFloat(svgNode.getAttribute('width')) || 714;
                var originalHeight = parseFloat(svgNode.getAttribute('height')) || 952;
                
                var scaledWidth = originalWidth * userSettings.scale;
                var scaledHeight = originalHeight * userSettings.scale;
                
                var wrapper = document.createElement('div');
                wrapper.style.cssText = 'width:' + scaledWidth + 'px;height:' + scaledHeight + 'px;position:relative;margin:0 auto;overflow:visible';
                
                svgNode.style.cssText = 'position:absolute;top:0;left:0;transform-origin:top left;transform:scale(' + userSettings.scale + ');width:' + originalWidth + 'px;height:' + originalHeight + 'px';
                
                wrapper.appendChild(svgNode);
                chantContainer.appendChild(wrapper);
                
            } catch(e) {
                console.error("Errore creazione SVG:", e);
                chantContainer.innerHTML = '<p style="color:red;">Errore nella creazione dell\'SVG: ' + e.message + '</p>';
            }
        });
        
    } catch (e) {
        console.error("Errore rendering:", e);
        chantContainer.innerHTML = '<p style="color:red;">Errore nel rendering del GABC: ' + e.message + '</p>';
    }
}

// =========================================================
// UTILITY
// =========================================================

function forceStaffLineColors(svgNode) {
    var staffLines = svgNode.querySelectorAll('line.staffLine');
    for (var i = 0; i < staffLines.length; i++) {
        staffLines[i].setAttribute('stroke', userSettings.staffColor);
    }
    
    var dividerRects = svgNode.querySelectorAll('rect.dividerLine');
    for (var i = 0; i < dividerRects.length; i++) {
        dividerRects[i].setAttribute('fill', userSettings.staffColor);
    }

    var neumeColor = document.body.classList.contains('dark-mode') ? '#ffffff' : '#000000';
    var paths = svgNode.querySelectorAll('path');
    for (var i = 0; i < paths.length; i++) {
        paths[i].setAttribute('fill', neumeColor);
        paths[i].setAttribute('stroke', neumeColor);
    }
}

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
// HELPER: Applica DropCap Scale e Colori
// =========================================================

function applySvgDropCapScale(svgElement, forcePrintColors) {
    forcePrintColors = forcePrintColors || false;
    var dropCapTexts = svgElement.querySelectorAll('text.dropCap');
    
    for (var i = 0; i < dropCapTexts.length; i++) {
        var dropCap = dropCapTexts[i];
        
        // Applica scale al font-size
        var currentSize = parseFloat(dropCap.getAttribute('font-size')) || 60;
        var newSize = currentSize * userSettings.dropCapScale;
        dropCap.setAttribute('font-size', newSize);
        
        // Rimuovi transform CSS 
        dropCap.style.transform = '';
        dropCap.style.transformOrigin = '';
        
        // Gestione colore capolettera
        var dropCapColorToUse = userSettings.dropCapColor;
        
        if (forcePrintColors) {
            // Per stampa: se il colore è bianco (dark mode), usa nero
            if (dropCapColorToUse === '#ffffff') {
                dropCapColorToUse = '#000000';
            }
        } else {
            // Per preview: se è un colore di default, segui la dark mode
            var neumeColor = document.body.classList.contains('dark-mode') ? '#ffffff' : '#000000';
            if (dropCapColorToUse === '#000000' || dropCapColorToUse === '#ffffff') {
                dropCapColorToUse = neumeColor;
            }
        }
        
        dropCap.setAttribute('fill', dropCapColorToUse);
        dropCap.style.fill = dropCapColorToUse;
    }
}

// =========================================================
// HELPER: Applica Colori alle Annotation
// =========================================================

function applyAnnotationColors(svgElement, forcePrintColors) {
    var annotations = svgElement.querySelectorAll('text.annotation');
    
    for (var i = 0; i < annotations.length; i++) {
        var annotationColor = userSettings.rubricColor;
        
        // Per stampa: se il colore è troppo scuro, mantienilo
        // (le rubriche rosse vanno bene anche in stampa)
        
        annotations[i].setAttribute('fill', annotationColor);
        annotations[i].style.fill = annotationColor;
    }
}

// =========================================================
// HELPER: Incorpora Stili Inline
// =========================================================

function inlineStyles(svgElement) {
    var elements = svgElement.querySelectorAll('*');
    
    for (var i = 0; i < elements.length; i++) {
        var el = elements[i];
        try {
            var computedStyle = window.getComputedStyle(el);
            
            if (computedStyle.fontFamily) {
                el.setAttribute('font-family', computedStyle.fontFamily);
            }
            if (computedStyle.fill && computedStyle.fill !== 'none') {
                el.setAttribute('fill', computedStyle.fill);
            }
            if (computedStyle.stroke && computedStyle.stroke !== 'none') {
                el.setAttribute('stroke', computedStyle.stroke);
            }
            if (computedStyle.fontSize) {
                el.setAttribute('font-size', computedStyle.fontSize);
            }
            if (computedStyle.fontWeight && computedStyle.fontWeight !== 'normal') {
                el.setAttribute('font-weight', computedStyle.fontWeight);
            }
        } catch (e) {
            // Ignora errori su elementi non stilizzabili
        }
    }
}

// =========================================================
// HELPER: Crea SVG Wrapper Sicuro
// =========================================================

function createSafeWrapper(svg, padding, forcePrintColors) {
    padding = padding || 0;
    forcePrintColors = forcePrintColors || false;
    
    // Ottieni dimensioni
    var bbox = svg.getBBox();
    var contentWidth = bbox.width + (padding * 2);
    var contentHeight = bbox.height + (padding * 2);
    
    // Crea wrapper SVG
    var svgWrapper = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgWrapper.setAttribute('width', contentWidth);
    svgWrapper.setAttribute('height', contentHeight);
    svgWrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    
    // Sfondo: SEMPRE BIANCO per export stampa
    var bgColor = forcePrintColors ? '#ffffff' : 
                  (document.body.classList.contains('dark-mode') ? '#121212' : '#ffffff');
    
    var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', contentWidth);
    rect.setAttribute('height', contentHeight);
    rect.setAttribute('fill', bgColor);
    svgWrapper.appendChild(rect);
    
    // Gruppo con contenuto
    var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    if (padding > 0) {
        g.setAttribute('transform', 'translate(' + padding + ', ' + padding + ')');
    }
    
    var svgClone = svg.cloneNode(true);
    
    // Correzione colori per stampa
    if (forcePrintColors) {
        // Note e chiavi: SEMPRE NERE
        var paths = svgClone.querySelectorAll('path');
        for (var i = 0; i < paths.length; i++) {
            paths[i].setAttribute('stroke', '#000000');
            paths[i].setAttribute('fill', '#000000');
        }
        
        // Testo lirico: SEMPRE NERO
        var texts = svgClone.querySelectorAll('text:not(.dropCap):not(.annotation)');
        for (var i = 0; i < texts.length; i++) {
            texts[i].setAttribute('fill', '#000000');
        }
        
        // Rigo: usa colore personalizzato (o nero se default dark mode)
        var staffColor = userSettings.staffColor;
        if (staffColor === '#ffffff') {
            staffColor = '#000000'; // Se era bianco (dark mode), diventa nero
        }
        
        var staffLines = svgClone.querySelectorAll('line.staffLine');
        for (var i = 0; i < staffLines.length; i++) {
            staffLines[i].setAttribute('stroke', staffColor);
        }
        
        var dividerRects = svgClone.querySelectorAll('rect.dividerLine');
        for (var i = 0; i < dividerRects.length; i++) {
            dividerRects[i].setAttribute('fill', staffColor);
        }
    }
    
    // Applica dropcap scale e colori
    applySvgDropCapScale(svgClone, forcePrintColors);
    
    // Applica colori annotation
    applyAnnotationColors(svgClone, forcePrintColors);
    
    // Copia contenuto nel gruppo
    while (svgClone.firstChild) {
        g.appendChild(svgClone.firstChild);
    }
    svgWrapper.appendChild(g);
    
    // Incorpora stili inline
    inlineStyles(svgWrapper);
    
    return {
        wrapper: svgWrapper,
        width: contentWidth,
        height: contentHeight
    };
}

// =========================================================
// HELPER: Converti SVG in Immagine
// =========================================================

function svgToImage(svgWrapper, callback) {
    var serializer = new XMLSerializer();
    var svgString = serializer.serializeToString(svgWrapper);
    var svgBlob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
    var url = URL.createObjectURL(svgBlob);
    var img = new Image();
    
    img.onerror = function() {
        URL.revokeObjectURL(url);
        alert('Errore nel caricamento dell\'immagine SVG.');
        if (callback) callback(null);
    };
    
    img.onload = function() {
        URL.revokeObjectURL(url);
        if (callback) callback(img);
    };
    
    img.src = url;
}

// =========================================================
// HELPER: Crea Canvas da Immagine
// =========================================================

function imageToCanvas(img, width, height) {
    var scale = 2; // Alta qualità
    var canvas = document.createElement('canvas');
    canvas.width = Math.floor(width * scale);
    canvas.height = Math.floor(height * scale);
    
    var ctx = canvas.getContext('2d');
    if (!ctx) {
        alert('Impossibile creare canvas 2D.');
        return null;
    }
    
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    
    return canvas;
}

// =========================================================
// EXPORT PNG A4 (CON PADDING)
// =========================================================

function exportPNG() {
    var svg = document.querySelector('#chant-preview svg');
    if (!svg) {
        alert('Nessuna anteprima da esportare!');
        return;
    }
    
    var result = createSafeWrapper(svg, 75, true);
    if (!result) return;
    
    svgToImage(result.wrapper, function(img) {
        if (!img) return;
        
        var canvas = imageToCanvas(img, result.width, result.height);
        if (!canvas) return;
        
        try {
            var dataUrl = canvas.toDataURL('image/png');
            if (!dataUrl || dataUrl === 'data:,') {
                throw new Error('Canvas vuoto');
            }
            
            var link = document.createElement('a');
            link.download = 'chant-a4.png';
            link.href = dataUrl;
            link.click();
        } catch (e) {
            alert('Errore nella generazione del PNG: ' + e.message);
        }
    });
}

// =========================================================
// EXPORT PNG RITAGLIATO
// =========================================================

function exportPNGCropped() {
    var svg = document.querySelector('#chant-preview svg');
    if (!svg) {
        alert('Nessuna anteprima da esportare!');
        return;
    }
    
    var result = createSafeWrapper(svg, 0, true);
    if (!result) return;
    
    svgToImage(result.wrapper, function(img) {
        if (!img) return;
        
        var canvas = imageToCanvas(img, result.width, result.height);
        if (!canvas) return;
        
        try {
            var dataUrl = canvas.toDataURL('image/png');
            if (!dataUrl || dataUrl === 'data:,') {
                throw new Error('Canvas vuoto');
            }
            
            var link = document.createElement('a');
            link.download = 'chant-cropped.png';
            link.href = dataUrl;
            link.click();
        } catch (e) {
            alert('Errore nella generazione del PNG: ' + e.message);
        }
    });
}

// =========================================================
// EXPORT SVG A4
// =========================================================

function exportSVG() {
    var svg = document.querySelector('#chant-preview svg');
    if (!svg) {
        alert('Nessuna anteprima da esportare!');
        return;
    }
    
    var svgClone = svg.cloneNode(true);
    
    // Applica scale e colori al capolettera
    applySvgDropCapScale(svgClone, false);
    
    // Applica colori alle annotation
    applyAnnotationColors(svgClone, false);
    
    // Crea wrapper A4
    var svgWrapper = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgWrapper.setAttribute('width', '210mm');
    svgWrapper.setAttribute('height', '297mm');
    svgWrapper.setAttribute('viewBox', '0 0 794 1123');
    svgWrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    
    var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('fill', document.body.classList.contains('dark-mode') ? '#121212' : '#ffffff');
    svgWrapper.appendChild(rect);
    
    var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', 'translate(75, 75)');
    g.appendChild(svgClone);
    svgWrapper.appendChild(g);
    
    var serializer = new XMLSerializer();
    var svgString = serializer.serializeToString(svgWrapper);
    var blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'chant-a4.svg';
    a.click();
    URL.revokeObjectURL(url);
}

// =========================================================
// EXPORT SVG RITAGLIATO
// =========================================================

function exportSVGCropped() {
    var svg = document.querySelector('#chant-preview svg');
    if (!svg) {
        alert('Nessuna anteprima da esportare!');
        return;
    }
    
    var svgClone = svg.cloneNode(true);
    
    // Applica scale e colori
    applySvgDropCapScale(svgClone, false);
    applyAnnotationColors(svgClone, false);
    
    var serializer = new XMLSerializer();
    var svgString = serializer.serializeToString(svgClone);
    var blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'chant-cropped.svg';
    a.click();
    URL.revokeObjectURL(url);
}

// =========================================================
// EXPORT PDF A4 - SCALA AUTOMATICA (FIXED)
// =========================================================

function exportPDF() {
    if (typeof jspdf === 'undefined') {
        alert('Libreria jsPDF non disponibile');
        return;
    }
    
    var svg = document.querySelector('#chant-preview svg');
    if (!svg) {
        alert('Nessuna anteprima da esportare!');
        return;
    }

    // 1. Crea un'immagine ad alta risoluzione dall'SVG
    var result = createSafeWrapper(svg, 0, true);
    if (!result) return;
    
    svgToImage(result.wrapper, function(img) {
        if (!img) return;
        
        // Converti in canvas per ottenere i dati immagine
        var canvas = imageToCanvas(img, result.width, result.height);
        if (!canvas) return;
        
        try {
            var imgData = canvas.toDataURL('image/png');
            
            // 2. Impostazioni Pagina A4 (mm)
            var pdfWidth = 210;
            var pdfHeight = 297;
            var marginX = 15; 
            var marginY = 15; 
            
            var availableWidth = pdfWidth - (marginX * 2);
            var availableHeight = pdfHeight - (marginY * 2);
            
            // 3. Calcolo Proporzioni (Scale to Fit)
            var imgRatio = result.width / result.height;
            var pageRatio = availableWidth / availableHeight;
            
            var finalWidth, finalHeight;
            
            if (imgRatio > pageRatio) {
                // L'immagine è più larga rispetto al foglio: vincola la larghezza
                finalWidth = availableWidth;
                finalHeight = finalWidth / imgRatio;
            } else {
                // L'immagine è più alta rispetto al foglio: vincola l'altezza             
                finalHeight = availableHeight;
                finalWidth = finalHeight * imgRatio;
            }
            
            // 4. Centratura Orizzontale
            var xPos = marginX + (availableWidth - finalWidth) / 2;
            
            // 5. Generazione PDF
            var pdf = new jspdf.jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });
            
            // Aggiunge l'immagine scalata 
            pdf.addImage(imgData, 'PNG', xPos, marginY, finalWidth, finalHeight);
            pdf.save('chant-a4.pdf');
            
        } catch (e) {
            console.error('Errore:', e);
            alert('Errore durante la generazione del PDF: ' + e.message);
        }
    });
}

// =========================================================
// EXPORT PDF RITAGLIATO
// =========================================================

function exportPDFCropped() {
    if (typeof jspdf === 'undefined') {
        alert('Libreria jsPDF non disponibile');
        return;
    }
    
    var svg = document.querySelector('#chant-preview svg');
    if (!svg) {
        alert('Nessuna anteprima da esportare!');
        return;
    }
    
    var result = createSafeWrapper(svg, 0, true);
    if (!result) return;
    
    svgToImage(result.wrapper, function(img) {
        if (!img) return;
        
        var canvas = imageToCanvas(img, result.width, result.height);
        if (!canvas) return;
        
        try {
            var imgData = canvas.toDataURL('image/png');
            if (!imgData || imgData === 'data:,') {
                throw new Error('Canvas vuoto');
            }
            
            var pdfWidth = result.width * 0.264583;
            var pdfHeight = result.height * 0.264583;
            
            var pdf = new jspdf.jsPDF({
                orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
                unit: 'mm',
                format: [pdfWidth, pdfHeight]
            });
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save('chant-cropped.pdf');
        } catch (e) {
            alert('Errore nella generazione del PDF: ' + e.message);
        }
    });
}


// =========================================================
// UTILITY: Copia GABC
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

// =========================================================
// UTILITY: Download GABC
// =========================================================

function downloadGabcFile() {
    var gabc = $("#editor").val();
    var blob = new Blob([gabc], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'chant.gabc';
    a.click();
    URL.revokeObjectURL(url);
}

// =========================================================
// INIZIALIZZAZIONE
// =========================================================

$(function() {
    var defaultGabc = 'annotation: Hymnus;\n' +
                     'annotation: II;\n' +
                     'initial-style: 1;\n' +
                     '%%\n' +
                     '(f3) UT(e) que(f)ant(h) la(fg)xis(f) (,) re(f)so(f)ná(e)re(f) fi(g)bris(g) (;) Mi(g!hwi)ra(g) ge(f)stó(ge)rum(f) (,) fá(h)mu(i)li(j) tu(i)ó(hf)rum,(f) (:) Sol(iji)ve(hg) pol(h)lú(i)ti(f) (,) lá(j)bi(i)i(j) re(hi)á(j)tum,(j) (,) San(ih)cte(gf) Jo(e)án(g)nes.(f) \n' +
                     '2.(::) Nún(e)ti(f)us(h) cel(fg)so(f) (,) vé(f)ni(f)ens(e) O(f)lým(g)po,(g) (;) Te(g!hwi) pa(g)tri(f) ma(ge)gnum(f) (,) fo(h)re(i) na(j)sci(i)tú(hf)rum,(f) (:) No(iji)men,(hg) et(h) vi(i)tae(f) (,) sé(j)ri(i)em(j) ge(hi)rén(j)dae(j) (,) Or(ih)di(gf)ne(e) pro(g)mit.(f) \n' +
                     '3.(::) Il(e)le(f) pro(h)mís(fg)si(f) (,) dú(f)bi(f)us(e) su(f)pér(g)ni,(g) (;) Pér(g!hwi)di(g)dit(f) prom(ge)ptae(f) (,) mó(h)du(i)los(j) lo(i)qué(hf)lae:(f) (:) Sed(iji) re(hg)for(h)má(i)sti(f) (,) gé(j)ni(i)tus(j) pe(hi)rém(j)ptae(j) (,) Or(ih)ga(gf)na(e) vo(g)cis.(f) \n' +
                     '4.(::) Ven(e)tris(f) ob(h)strú(fg)so(f) (,) ré(f)cu(f)bans(e) cu(f)bí(g)li(g) (;) Sén(g!hwi)se(g)ras(f) Re(ge)gem(f) (,) thá(h)la(i)mo(j) ma(i)nén(hf)tem:(f) (:) Hinc(iji) pa(hg)rens(h) na(i)ti(f) (,) mé(j)ri(i)tis(j) u(hi)tér(j)que(j) (,) Ab(ih)di(gf)ta(e) pan(g)dit.(f) \n' +
                     '5.(::) Sit(e) de(f)cus(h) Pa(fg)tri,(f) (,) ge(f)ni(f)taé(e)que(f) Pro(g)li,(g) (;) Et(g!hwi) ti(g)bi(f) com(ge)par(f) (,) u(h)tri(i)ús(j)que(i) vir(hf)tus,(f) (:) Spí(iji)ri(hg)tus(h) sem(i)per,(f) (,) De(j)us(i) u(j)nus,(hi) om(j)ni(j) (,) Tém(ih)po(gf)ris(e) ae(g)vo.(f) (::) \n' +
                     'A(fgf)men.(ef) (::)';

                     
    $("#editor").val(defaultGabc);
    
    $('#editor').on('input', updatePreview);
    $('#lnkShowText').on('click', function(e) { e.preventDefault(); showTextModal(); });
    $('#lnkCredits').on('click', function(e) { e.preventDefault(); showCreditsModal(); });
    $('#dark-mode-toggle').on('change', toggleDarkMode);
    $('#inputStaffColor').on('change', function() { userSettings.staffColor = $(this).val(); updatePreview(); });
    $('#inputRubricColor').on('change', function() { userSettings.rubricColor = $(this).val(); updatePreview(); });
    $('#inputDropCapColor').on('change', function() { userSettings.dropCapColor = $(this).val(); updatePreview(); });
    $('#scaleSlider').on('input', function() { userSettings.scale = parseFloat($(this).val()); $('#scaleVal').text(userSettings.scale.toFixed(1)); updatePreview(); });
    $('#spacingSlider').on('input', function() { userSettings.spacing = parseFloat($(this).val()); $('#spacingVal').text(userSettings.spacing.toFixed(1)); updatePreview(); });
    $('#dropCapSlider').on('input', function() { userSettings.dropCapScale = parseFloat($(this).val()); $('#dropCapVal').text(userSettings.dropCapScale.toFixed(1)); updatePreview(); });
    $('#lyricSizeSlider').on('input', function() { userSettings.lyricSize = parseInt($(this).val()); $('#lyricSizeVal').text(userSettings.lyricSize); updatePreview(); });
    $('#text-font').on('change', function() { var selectedFont = $(this).val(); userSettings.font = selectedFont + ', serif'; document.body.setAttribute('data-font', selectedFont); updatePreview(); });
    $('#group-verses-toggle').on('change', function() { userSettings.allVersesToOneLine = $(this).is(':checked'); updatePreview(); });
    $('#lnkCopyGabc').on('click', function(e) { e.preventDefault(); copyGabcToClipboard(); });
    $('#lnkDownloadGabc').on('click', function(e) { e.preventDefault(); downloadGabcFile(); });
    $('#export-png-full').on('click', exportPNG);
    $('#export-png-cropped').on('click', exportPNGCropped);
    $('#export-svg-full').on('click', exportSVG);
    $('#export-svg-cropped').on('click', exportSVGCropped);
    $('#export-pdf-full').on('click', exportPDF);
    $('#export-pdf-cropped').on('click', exportPDFCropped);
    
    setTimeout(updatePreview, 500);
});