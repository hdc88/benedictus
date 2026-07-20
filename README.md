# Benedictus - GABC Chant Editor

Editor web per la trascrizione e l'impaginazione del canto detto gregoriano in notazione
quadrata, a partire da sorgenti in formato [GABC](http://gregorio-project.github.io/gabc/index.html).
Permette di modificare in tempo reale testo e notazione, personalizzare
l'aspetto grafico (colori, dimensioni, font) ed esportare il risultato in
PNG, SVG e PDF.

Progetto sviluppato da **Enrico Correggia** all'interno del progetto PRIN 2022 MICHAEL – Multimedial Italian CHant ArchivE of Liturgical melodies and texts (14th-18th centuries), Libera Università di Bolzano, Università Cattolica del Sacro Cuore - Brescia, Università degli Studi di Trento (2025).

## Indice

- [Funzionalità](#funzionalità)
- [Utilizzo](#utilizzo)
- [Struttura del progetto](#struttura-del-progetto)
- [Librerie di terze parti](#librerie-di-terze-parti)
- [Distribuzione offline (Tauri)](#distribuzione-offline-tauri)
- [Licenza](#licenza)
- [Citazione](#citazione)

## Funzionalità

- Editor GABC con anteprima live della notazione musicale (motore [Exsurge](https://github.com/frmspencer/exsurge))
- Estrattore testo
- Raggruppamento strofe
- Personalizzazione grafica: modalità scura, colore rigo/rubriche/capolettera,
  dimensione rigo e spaziatura note, dimensione e font del testo
- Esportazione in **PNG** (intera pagina o ritagliata), **SVG** e **PDF** (A4 o ritagliato)
- Funziona interamente **offline**, senza dipendenze da servizi esterni o CDN

## Utilizzo

Non è richiesta alcuna installazione o build: il progetto è un'applicazione
web statica.

1. Scarica o clona il repository
2. Apri `transcriber.html` in un browser moderno (Chrome, Firefox, Edge)

Il programma verrà comunque distribuito come eseguibile nel portale del progetto.

## Struttura del progetto

```
├── transcriber.html          # pagina principale dell'applicazione
├── app.js                    # logica dell'editor e dell'interfaccia
├── style.css                 # stile e regole @font-face
├── exsurge.min.js             # motore di rendering della notazione gregoriana
├── jquery.min.js               │
├── jquery-ui-1.10.3.custom.min.js  │  librerie di supporto UI
├── jquery.hypher.js             │
├── patterns/la-hypher.js     # pattern di sillabazione latina
├── saveSvgAsPng.js            # esportazione PNG/SVG lato client
├── jspdf.umd.min.js            │  esportazione PDF
├── html2canvas.min.js          │
├── fonts/                     # font incorporati via @font-face (offline-first)
├── icona.png / Benedictus.png # icone e logo dell'applicazione
```

## Librerie di terze parti

Il progetto include localmente le seguenti librerie open source, ciascuna
soggetta alla propria licenza originale:

| Libreria | Versione | Licenza | Utilizzo |
|---|---|---|---|
| [Exsurge](https://github.com/frmspencer/exsurge) | - | MIT | Rendering della notazione musicale gregoriana |
| [jQuery](https://jquery.com/) | 1.7 | MIT | Manipolazione DOM |
| [jQuery UI](https://jqueryui.com/) | 1.10.3 | MIT | Componenti UI |
| [Hypher](https://github.com/bramstein/hypher) (`jquery.hypher.js`) | - | BSD-2-Clause | Sillabazione automatica |
| [jsPDF](https://github.com/parallax/jsPDF) | 2.5.1 | MIT | Esportazione PDF |
| [html2canvas](https://github.com/niklasvh/html2canvas) | 1.4.1 | MIT | Rasterizzazione per l'export PNG/PDF |
| [saveSvgAsPng](https://github.com/exupero/saveSvgAsPng) | - | MIT | Esportazione SVG/PNG |

I font inclusi in `fonts/` (Garamond, Book Antiqua, Times New Roman, Arial,
Palatino) sono font di sistema ridistribuiti per garantire una resa grafica
coerente su qualunque piattaforma; verificane i termini di ridistribuzione
prima di un uso commerciale.

## Distribuzione offline (Tauri)

Tutte le dipendenze sono incluse localmente (nessuna chiamata a CDN esterni),
per cui l'applicazione è pronta per essere impacchettata come eseguibile
desktop tramite [Tauri](https://tauri.app/) senza richiedere connessione a
Internet in fase di esecuzione.

## Licenza

Il codice originale di questo progetto è distribuito con licenza **MIT** -
vedi il file [`LICENSE`](./LICENSE).

Le librerie di terze parti incluse nel repository mantengono le proprie
licenze originali, elencate nella tabella sopra.

## Citazione

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.21461835.svg)](https://doi.org/10.5281/zenodo.21461835)
Correggia, E. (2025). Benedictus - GABC Chant Editor [Software]. 
Disponibile su: https://github.com/hdc88/benedictus

