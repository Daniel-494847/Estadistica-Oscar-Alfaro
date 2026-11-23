import { Injectable } from '@angular/core';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { AREAS_POR_DEFECTO, Area, GRADOS, Tipo, calcular, definir, gid, lineas, reprobadosDe, totales } from './config';

type Doc = { datos?: Record<string, any>; gestion?: string; lugar?: string } | null | undefined;

const FUENTE = 'Cambria';
const LINEA = { style: 'thin', color: { rgb: '000000' } };
const DOBLE = { style: 'double', color: { rgb: '000000' } };
const REJILLA = { top: LINEA, bottom: LINEA, left: LINEA, right: LINEA };

function borde(estilo: any, extra: any = {}) {
  return { ...estilo, border: { ...REJILLA, ...extra } };
}

const S: Record<string, any> = {
  titulo: { font: { name: FUENTE, sz: 14, bold: true }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } },
  grado: { font: { name: FUENTE, sz: 11, bold: true }, alignment: { horizontal: 'center', vertical: 'center' }, border: REJILLA, fill: { patternType: 'solid', fgColor: { rgb: 'D9E2F3' } } },
  grupo: { font: { name: FUENTE, sz: 10, bold: true }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: REJILLA, fill: { patternType: 'solid', fgColor: { rgb: 'BDD7EE' } } },
  area: { font: { name: FUENTE, sz: 9, bold: true }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: REJILLA, fill: { patternType: 'solid', fgColor: { rgb: 'D9E2F3' } } },
  col: { font: { name: FUENTE, sz: 9, bold: true }, alignment: { horizontal: 'center', vertical: 'center', textRotation: 90, wrapText: true }, border: REJILLA, fill: { patternType: 'solid', fgColor: { rgb: 'E2EFDA' } } },
  totalTit: { font: { name: FUENTE, sz: 10, bold: true }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: REJILLA, fill: { patternType: 'solid', fgColor: { rgb: 'FCE4D6' } } },
  celda: { font: { name: FUENTE, sz: 10 }, alignment: { horizontal: 'center', vertical: 'center' }, border: REJILLA },
  porcentaje: { font: { name: FUENTE, sz: 10, bold: true }, alignment: { horizontal: 'center', vertical: 'center' }, border: REJILLA },
  filaGrado: { font: { name: FUENTE, sz: 10, bold: true }, alignment: { horizontal: 'left', vertical: 'center' }, border: REJILLA },
  total: { font: { name: FUENTE, sz: 10, bold: true }, alignment: { horizontal: 'center', vertical: 'center' }, border: { ...REJILLA, top: DOBLE }, fill: { patternType: 'solid', fgColor: { rgb: 'FFF2CC' } } },
  totalEtiqueta: { font: { name: FUENTE, sz: 10, bold: true }, alignment: { horizontal: 'left', vertical: 'center' }, border: { ...REJILLA, top: DOBLE }, fill: { patternType: 'solid', fgColor: { rgb: 'FFF2CC' } } },
  pie: { font: { name: FUENTE, sz: 11, bold: true }, alignment: { horizontal: 'left', vertical: 'center' } },
  lugar: { font: { name: FUENTE, sz: 11, bold: true }, alignment: { horizontal: 'center', vertical: 'center' } },
};

interface Celda { v: string | number; s: any }

interface Matriz {
  titulos: string[];
  mat: Celda[][];
  merges: { s: { r: number; c: number }; e: { r: number; c: number } }[];
  ancho: number;
  pie: string[];
  anchos: number[];
  alturas: number[];
}

// Dibujo minimalista para incrustar el escudo en cada hoja del Excel.
const DIBUJO = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
<xdr:oneCellAnchor><xdr:from><xdr:col>8</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
<xdr:ext cx="600000" cy="600000"/><xdr:pic>
<xdr:nvPicPr><xdr:cNvPr id="1" name="Escudo"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>
<xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>
<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="600000" cy="600000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>
</xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>`;

@Injectable({ providedIn: 'root' })
export class ExportService {

  private celda(v: any, s: any): Celda {
    return { v: v == null ? '' : v, s };
  }

  private matriz(tipo: Tipo, t: number, d: Doc, areas: Area[] = AREAS_POR_DEFECTO, ue?: string) {
    const df = definir(tipo, t, false, areas);
    const cols = [...df.cols, ...df.total];
    const n = df.nArea;
    const sub = n > 1;
    const H = sub ? 3 : 2;
    const ancho = cols.length + 1;

    const filas = GRADOS.map(g => calcular(cols, d?.datos?.[gid(g)] ?? {}));
    const tt = totales(cols, filas);

    const mat: Celda[][] = Array.from({ length: H }, () => Array(ancho).fill(null).map(() => this.celda('', S.celda)));
    const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
    const vertical = (c: { titulo: string }) => this.celda(c.titulo, S.col);

    mat[0][0] = this.celda('GRADOS', S.grado);
    merges.push({ s: { r: 0, c: 0 }, e: { r: H - 1, c: 0 } });

    let idx = 1;
    for (const campo of df.campos) {
      const ini = idx;
      for (const area of campo.areas) {
        const ai = idx;
        mat[1][ai] = this.celda(area.nombre, sub ? S.area : S.col);
        if (n > 1) merges.push({ s: { r: 1, c: ai }, e: { r: 1, c: ai + n - 1 } });
        idx += n;
      }
      mat[0][ini] = this.celda(campo.nombre, S.grupo);
      merges.push({ s: { r: 0, c: ini }, e: { r: 0, c: idx - 1 } });
    }

    if (sub) {
      mat[0][idx] = this.celda('TOTALES:', S.totalTit);
      merges.push({ s: { r: 0, c: idx }, e: { r: 1, c: idx + df.total.length - 1 } });
      df.total.forEach((c, j) => { mat[2][idx + j] = vertical(c); });
      cols.slice(0, -df.total.length).forEach((c, j) => { mat[2][j + 1] = vertical(c); });
    } else {
      df.total.forEach((c, j) => {
        mat[0][idx + j] = this.celda(c.titulo, { ...S.col, alignment: { ...S.col.alignment, textRotation: 90 } });
        merges.push({ s: { r: 0, c: idx + j }, e: { r: 1, c: idx + j } });
      });
    }

    GRADOS.forEach((g, i) => {
      mat.push([this.celda(g, S.filaGrado), ...cols.map(c =>
        this.celda(filas[i][c.key], c.titulo === '%' ? S.porcentaje : S.celda))]);
    });
    mat.push([this.celda('TOTALES', S.totalEtiqueta), ...cols.map(c =>
      this.celda(tt[c.key], S.total))]);

    const ultima = mat.length - 1;
    mat[0].forEach((_, c) => { mat[0][c] = { ...mat[0][c], s: borde(mat[0][c].s, { top: DOBLE }) }; });
    if (sub) {
      mat[2].forEach((_, c) => { mat[2][c] = { ...mat[2][c], s: borde(mat[2][c].s, { top: DOBLE }) }; });
    } else {
      mat[1].forEach((_, c) => { mat[1][c] = { ...mat[1][c], s: borde(mat[1][c].s, { top: DOBLE }) }; });
    }
    mat.forEach((fila, r) => {
      fila[0] = { ...fila[0], s: borde(fila[0].s, { left: DOBLE }) };
      fila[ancho - 1] = { ...fila[ancho - 1], s: borde(fila[ancho - 1].s, { right: DOBLE }) };
      if (r === ultima) fila.forEach((_, c) => { fila[c] = { ...fila[c], s: borde(fila[c].s, { bottom: DOBLE }) }; });
    });

    const titulos = lineas(tipo, t, d?.gestion ?? '2026', ue);
    const pie: string[] = [];
    if (tipo === 'temas') pie.push(`PORCENTAJE DE TEMAS AVANZADOS: ${tt['t_pct'] ?? ''}`);
    if (tipo === 'promret') {
      pie.push(`PORCENTAJE DE PROMOVIDOS: ${tt['t_pp'] ?? ''}`);
      pie.push(`PORCENTAJE DE RETENIDOS: ${tt['t_pr'] ?? ''}`);
    }
    if (tipo === 'promedio') pie.push(`PROMEDIO: ${tt['prom'] ?? ''}`);
    if (d?.lugar) pie.push(d.lugar);

    const anchos = [12, ...cols.map(c => (c.titulo === '%' ? 10 : c.key === 'crit' ? 24 : 15))];
    // Alturas calculadas para que ningún encabezado se salga de su celda.
    const largoArea = Math.max(0, ...df.campos.flatMap(c => c.areas.map(a => a.nombre.length)));
    const largoGrupo = Math.max(0, ...df.campos.map(c => c.nombre.length));
    const altoGrupo = Math.min(56, Math.max(26, Math.ceil(largoGrupo / 38) * 14 + 8));
    const altoArea = Math.min(72, Math.max(34, Math.ceil(largoArea / 30) * 16 + 10));
    const altoCols = sub ? (tipo === 'promret' ? 150 : 120)
      : Math.max(110, Math.ceil(largoArea / 12) * 14 + 20);
    const alturas: number[] = titulos.map((_, i) => i === 0 ? 30 : 23);
    alturas.push(altoGrupo, sub ? altoArea : altoCols);
    if (sub) alturas.push(altoCols);
    for (let i = 0; i < GRADOS.length + 1; i++) alturas.push(22);
    pie.forEach((_, i) => alturas.push(i === pie.length - 1 && d?.lugar ? 23 : 25));

    return { titulos, mat, merges, ancho, pie, anchos, alturas };
  }

  /** Segunda hoja del cuadro de promovidos/retenidos: una fila por estudiante y una columna por área. */
  private matrizReprobados(t: number, d: Doc, areas: Area[] = AREAS_POR_DEFECTO, ue?: string): Matriz {
    const gestion = d?.gestion ?? '2026';
    const ord = ['PRIMER', 'SEGUNDO', 'TERCER'][t - 1];
    const base = lineas('promret', t, gestion, ue);
    const titulos = [`REGISTRO DE ESTUDIANTES REPROBADOS POR GRADO · ${ord} TRIMESTRE GESTIÓN ${gestion}`, ...base.slice(1)];
    const ids = areas.map(a => a.id);
    const ancho = ids.length + 2; // N°, estudiante y una columna por área
    const cabecera = {
      ...S.celda,
      font: { ...S.celda.font, bold: true },
      alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
    };
    const izquierda = { ...S.celda, alignment: { horizontal: 'left' as const, vertical: 'center' as const } };
    const seccion = { ...S.grupo, alignment: { horizontal: 'left' as const, vertical: 'center' as const } };

    const mat: Celda[][] = [[
      this.celda('N°', cabecera),
      this.celda('APELLIDOS Y NOMBRES', cabecera),
      ...areas.map(a => this.celda(a.nombre, cabecera)),
    ]];
    const merges: Matriz['merges'] = [];
    const alturas: number[] = [46];
    const grados = GRADOS
      .map(g => ({ g, filas: reprobadosDe(d?.datos?.[gid(g)]) }))
      .filter(x => x.filas.length);

    for (const { g, filas } of grados) {
      const r = mat.length;
      mat.push([this.celda(`GRADO ${g}`, seccion), ...Array.from({ length: ancho - 1 }, () => this.celda('', seccion))]);
      merges.push({ s: { r, c: 0 }, e: { r, c: ancho - 1 } });
      alturas.push(23);
      for (const f of filas) {
        mat.push([
          this.celda('', S.celda),
          this.celda(f.nombre, izquierda),
          ...ids.map(id => this.celda(f.notas[id] ?? '', S.celda)),
        ]);
        alturas.push(21);
      }
    }

    if (!grados.length) {
      const r = mat.length;
      mat.push([this.celda('Sin estudiantes reprobados registrados en este trimestre.', S.celda),
        ...Array.from({ length: ancho - 1 }, () => this.celda('', S.celda))]);
      merges.push({ s: { r, c: 0 }, e: { r, c: ancho - 1 } });
      alturas.push(23);
    }

    const ultima = mat.length - 1;
    mat[0].forEach((_, c) => { mat[0][c] = { ...mat[0][c], s: borde(mat[0][c].s, { top: DOBLE }) }; });
    mat.forEach((fila, r) => {
      fila[0] = { ...fila[0], s: borde(fila[0].s, { left: DOBLE }) };
      fila[ancho - 1] = { ...fila[ancho - 1], s: borde(fila[ancho - 1].s, { right: DOBLE }) };
      if (r === ultima) fila.forEach((_, c) => { fila[c] = { ...fila[c], s: borde(fila[c].s, { bottom: DOBLE }) }; });
    });

    const pie = d?.lugar ? [d.lugar] : [];
    if (pie.length) alturas.push(23);
    return { titulos, mat, merges, ancho, pie, anchos: [9, 52, ...areas.map(() => 16)], alturas };
  }

  private hoja(XLSX: any, tipo: Tipo, t: number, d: Doc, nombre: string, areas?: Area[], ue?: string, matriz?: Matriz) {
    const m = matriz ?? this.matriz(tipo, t, d, areas, ue);
    const filas: any[][] = [];
    const merges: any[] = [];

    m.titulos.forEach((txt, i) => {
      const r = Array(m.ancho).fill('');
      r[0] = this.celda(txt, { ...S.titulo, font: { ...S.titulo.font, sz: i === 0 ? 14 : 10 } });
      merges.push({ s: { r: i, c: 0 }, e: { r: i, c: m.ancho - 1 } });
      filas.push(r);
    });

    const off = m.titulos.length;
    m.mat.forEach(f => filas.push(f.map(c => this.celda(c.v, c.s))));
    m.merges.forEach(x => merges.push({ s: { r: x.s.r + off, c: x.s.c }, e: { r: x.e.r + off, c: x.e.c } }));

    m.pie.forEach((txt, i) => {
      const r = Array(m.ancho).fill('');
      r[0] = this.celda(txt, i === m.pie.length - 1 && d?.lugar ? S.lugar : S.pie);
      merges.push({ s: { r: off + m.mat.length + i, c: 0 }, e: { r: off + m.mat.length + i, c: m.ancho - 1 } });
      filas.push(r);
    });

    const ws = XLSX.utils.aoa_to_sheet(filas);
    ws['!merges'] = merges;
    ws['!cols'] = m.anchos.map(w => ({ wch: w }));
    ws['!rows'] = m.alturas.map(h => ({ hpt: h }));
    ws['!margins'] = { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.15, footer: 0.15 };
    ws.name = nombre.substring(0, 31);
    return ws;
  }

  // xlsx-js-style no escribe la configuración de impresión: se agrega al XML del libro.
  private guardar(XLSX: any, wb: any, nombre: string, escudo?: string) {
    const raw = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBuffer);
    const zip = unzipSync(bytes);
    for (const key of Object.keys(zip)) {
      if (!/^xl\/worksheets\/sheet\d+\.xml$/.test(key)) continue;
      let xml = strFromU8(zip[key]);
      const pagina =
        '<pageSetup paperSize="1" orientation="landscape" fitToWidth="1" fitToHeight="0"/>';
      if (!/<sheetPr\b/.test(xml)) {
        xml = xml.replace(/<worksheet\b[^>]*>/, m => m + '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>');
      }
      // Orden exigido por el esquema: printOptions -> pageMargins -> pageSetup -> ignoredErrors.
      if (/<pageMargins\b/.test(xml)) {
        xml = xml.replace('<pageMargins', '<printOptions horizontalCentered="1"/><pageMargins');
        xml = xml.replace(/(<pageMargins\b[^>]*\/>)/, '$1' + pagina);
      } else {
        xml = xml.replace('</worksheet>', '<printOptions horizontalCentered="1"/>' + pagina + '</worksheet>');
      }
      zip[key] = strToU8(xml);
    }

    // xlsx-js-style no escribe imágenes: se agrega el escudo como parte de dibujo del XML.
    if (escudo && /^data:image\/(png|jpeg);base64,/i.test(escudo)) {
      const ext = /data:image\/png/i.test(escudo) ? 'png' : 'jpeg';
      const bin = atob(escudo.slice(escudo.indexOf(',') + 1));
      const img = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) img[i] = bin.charCodeAt(i);
      zip[`xl/media/image1.${ext}`] = img;

      const hojas = Object.keys(zip).filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k));
      hojas.forEach((key, i) => {
        const n = i + 1;
        zip[`xl/drawings/drawing${n}.xml`] = strToU8(DIBUJO.replace('name="Escudo"', `name="Escudo${n}"`));
        const rel = `<Relationship Id="rIdEscudo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${n}.xml"/>`;
        const rels = `xl/worksheets/_rels/sheet${n}.xml.rels`;
        zip[rels] = strToU8(zip[rels]
          ? strFromU8(zip[rels]).replace('</Relationships>', rel + '</Relationships>')
          : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rel}</Relationships>`);
        let xml = strFromU8(zip[key]);
        if (!/xmlns:r=/.test(xml)) {
          xml = xml.replace('<worksheet ', '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');
        }
        zip[key] = strToU8(xml.replace('</worksheet>', '<drawing r:id="rIdEscudo"/></worksheet>'));
      });

      const ct = '[Content_Types].xml';
      let tipos = strFromU8(zip[ct]);
      if (!new RegExp(`Extension="${ext}"`).test(tipos)) {
        tipos = tipos.replace(/<Types\b[^>]*>/, m => m + `<Default Extension="${ext}" ContentType="image/${ext}"/>`);
      }
      const overrides = hojas.map((_, i) =>
        `<Override PartName="/xl/drawings/drawing${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`).join('');
      zip[ct] = strToU8(tipos.replace('</Types>', overrides + '</Types>'));
    }

    const blob = new Blob([zipSync(zip) as any], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async exportarExcelTodo(leer: (id: string) => Promise<any>, areas?: Area[], ue?: string, escudo?: string) {
    const XLSX = await import('xlsx-js-style');
    const wb = XLSX.utils.book_new();
    const nombres: Record<string, string> = { temas: 'T. AVANZ', promret: 'PROM Y RET', promedio: 'PROM' };
    for (const tp of ['temas', 'promret', 'promedio'] as Tipo[]) {
      for (const t of [1, 2, 3]) {
        const nombre = `${nombres[tp]} ${t}º TRIM`;
        const d = await leer(`${tp}_${t}`).catch(() => null);
        XLSX.utils.book_append_sheet(wb, this.hoja(XLSX, tp, t, d, nombre, areas, ue), nombre);
        if (tp === 'promret') {
          const nombreR = `REPROBADOS ${t}º TRIM`;
          const hojaR = this.hoja(XLSX, tp, t, d, nombreR, areas, ue, this.matrizReprobados(t, d, areas, ue));
          XLSX.utils.book_append_sheet(wb, hojaR, nombreR);
        }
      }
    }
    this.guardar(XLSX, wb, 'registro-estadistico.xlsx', escudo);
  }

  async exportarExcelUno(tipo: Tipo, t: number, d: Doc, areas?: Area[], ue?: string, escudo?: string) {
    const XLSX = await import('xlsx-js-style');
    const wb = XLSX.utils.book_new();
    const nombre = `${tipo} ${t}º TRIM`;
    XLSX.utils.book_append_sheet(wb, this.hoja(XLSX, tipo, t, d, nombre, areas, ue), nombre);
    if (tipo === 'promret') {
      const nombreR = `REPROBADOS ${t}º TRIM`;
      const hojaR = this.hoja(XLSX, tipo, t, d, nombreR, areas, ue, this.matrizReprobados(t, d, areas, ue));
      XLSX.utils.book_append_sheet(wb, hojaR, nombreR);
    }
    this.guardar(XLSX, wb, `cuadros-${tipo}-${t}trim.xlsx`, escudo);
  }
}
