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
- **Intestazione GABC completa**: modulo per i campi principali (`name`, `office-part`,
  `mode`, `mode-differentia`, `annotation`, `commentary`, `occasion`, `manuscript`,
  `manuscript-reference`, `manuscript-storage-place`, `transcriber`, `transcription-date`,
  `initial-style`, `user-notes`) sincronizzato con il testo; i campi non gestiti e i
  commenti vengono conservati. Annotazioni generabili da tipo e modo.
- **Intestazione stampata**: titolo, occasione, tipo e modo, commento (a destra) e fonte
  (a sinistra) sopra il primo rigo
- **Importa .gabc** (anche trascinando il file sull'editor), Copia e Scarica
- **Genera struttura GABC da testo**: sillabazione latina (pattern Hypher + regole
  liturgiche: *san-ctus*, *Chri-stus*, *ma-gnus*), stanghette dalla punteggiatura,
  numerazione delle strofe compatibile con "Raggruppa Strofe"
- **Canto fratto**: con `notation: fractus;` nell'intestazione le forme GABC vengono
  disegnate come figure mensurali: brevis `g`, longa `gv`, semibrevis `G`, minima `gs`/`Gs`,
  semiminima `go`/`Go`, punctum additionis `g.`, segni di mensura sul rigo con
  `<alt>C3</alt>()` (C, ¢, O, 3, C3, ¢3, 3/2…), rombo con gambo in giù `Gv`, rombi accostati
  `G!H`. Il file resta GABC valido; guida integrata
- **Stile della notazione**: custos obliquo delle stampe veneziane (es. Graduale Giunta,
  1499-1500) e direzione del gambo delle minime (sempre in su o secondo l'altezza)
- Controllo sintattico (parentesi non chiuse, chiave mancante) con riga e colonna
- Estrattore testo, raggruppamento strofe
- **Raccolta / Libretto**: più brani, testi (rubriche, versetti, orazioni) e interruzioni di
  pagina in un'unica raccolta riordinabile; frontespizio, indice automatico (in ordine o
  alfabetico), testatine, margini speculari, ogni brano su nuova pagina. Export in PDF
  vettoriale in ordine di lettura oppure **imposto per la stampa a libretto** (due pagine per
  foglio, fronte-retro, da piegare). La raccolta si salva come file `.benedictus` (JSON con i
  sorgenti GABC) ed è autosalvata nel browser
- **Impaginazione WYSIWYG**: formato (A4, A5, B5, Letter, Legal), orientamento, margini,
  interlinea tra i righi, numeri di pagina, suddivisione automatica in più pagine;
  a capo forzato con `(z)`
- Personalizzazione grafica: modalità scura, colore rigo/rubriche/capolettera,
  dimensione rigo e spaziatura note, dimensione testo, titolo e capolettera, font
- Esportazione in **PDF vettoriale** con font incorporati (pagine o ritagliato),
  **SVG** con font incorporati (pagine o ritagliato) e **PNG** a 300 dpi
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
├── collection.js             # raccolta, libretto, indice, imposizione
├── fractus.js                # canto fratto: figure mensurali e segni di mensura
├── style.css                 # stile e regole @font-face
├── exsurge.min.js             # motore di rendering della notazione gregoriana
├── jquery.min.js               │
├── jquery-ui-1.10.3.custom.min.js  │  librerie di supporto UI
├── jquery.hypher.js             │
├── patterns/la-hypher.js     # pattern di sillabazione latina
├── saveSvgAsPng.js            # esportazione PNG/SVG lato client
├── jspdf.umd.min.js            │  esportazione PDF
├── svg2pdf.umd.min.js          │  conversione SVG → PDF vettoriale
├── html2canvas.min.js          │
├── fonts/                     # font liberi (OFL) incorporati via @font-face
│   ├── pdf/                   # gli stessi font in base64, caricati solo per l'export
│   └── licenses/              # licenze SIL Open Font License
├── tools/build-pdf-fonts.py   # rigenera fonts/pdf/*.js dai file .ttf
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
| [svg2pdf.js](https://github.com/yWorks/svg2pdf.js) | 2.8.1 | MIT | PDF vettoriale da SVG |
| [html2canvas](https://github.com/niklasvh/html2canvas) | 1.4.1 | MIT | Rasterizzazione per l'export PNG/PDF |
| [saveSvgAsPng](https://github.com/exupero/saveSvgAsPng) | - | MIT | Esportazione SVG/PNG |

I font inclusi in `fonts/` sono tutti distribuiti con licenza
[SIL Open Font License 1.1](https://openfontlicense.org) (testi in `fonts/licenses/`)
e possono essere ridistribuiti liberamente, anche incorporati nei PDF:

| Font | Fonte |
|---|---|
| EB Garamond (predefinito) | [octaviopardo/EBGaramond12](https://github.com/octaviopardo/EBGaramond12) |
| Cardo | [Google Fonts](https://github.com/google/fonts/tree/main/ofl/cardo) |
| Junicode 2 | [psb1558/Junicode-font](https://github.com/psb1558/Junicode-font) |
| Libertinus Serif | [alerque/libertinus](https://github.com/alerque/libertinus) |

I file sono sottoinsiemi (latino, latino esteso, diacritici, punteggiatura, ℣ ℟ ✠) dei
font originali. Dopo aver sostituito un `.ttf`, eseguire `python3 tools/build-pdf-fonts.py`.

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

