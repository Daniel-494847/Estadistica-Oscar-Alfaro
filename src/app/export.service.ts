import { Injectable } from '@angular/core';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { GRADOS, Tipo, calcular, definir, gid, lineas, totales } from './config';

type Doc = { datos?: Record<string, any>; gestion?: string; lugar?: string } | null | undefined;

const FUENTE = 'Cambria';
const LINEA = { style: 'thin', color: { rgb: '000000' } };
const DOBLE = { style: 'double', color: { rgb: '000000' } };
const REJILLA = { top: LINEA, bottom: LINEA, left: LINEA, right: LINEA };

function borde(estilo: any, extra: any = {}) {
  return { ...estilo, border: { ...REJILLA, ...extra } };
}

const S: Record<string, any> = {
  titulo: { font: { name: FUENTE, sz: 12, bold: true }, alignment: { horizontal: 'center', vertical: 'center' } },
  grado: { font: { name: FUENTE, sz: 10, bold: true }, alignment: { horizontal: 'center', vertical: 'center' }, border: REJILLA, fill: { patternType: 'solid', fgColor: { rgb: 'D9E2F3' } } },
  grupo: { font: { name: FUENTE, sz: 10, bold: true }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: REJILLA, fill: { patternType: 'solid', fgColor: { rgb: 'BDD7EE' } } },
  area: { font: { name: FUENTE, sz: 9, bold: true }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: REJILLA, fill: { patternType: 'solid', fgColor: { rgb: 'D9E2F3' } } },
  col: { font: { name: FUENTE, sz: 8, bold: true }, alignment: { horizontal: 'center', vertical: 'center', textRotation: 90 }, border: REJILLA, fill: { patternType: 'solid', fgColor: { rgb: 'E2EFDA' } } },
  totalTit: { font: { name: FUENTE, sz: 10, bold: true }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: REJILLA, fill: { patternType: 'solid', fgColor: { rgb: 'FCE4D6' } } },
  celda: { font: { name: FUENTE, sz: 9 }, alignment: { horizontal: 'center', vertical: 'center' }, border: REJILLA },
  porcentaje: { font: { name: FUENTE, sz: 9, bold: true }, alignment: { horizontal: 'center', vertical: 'center' }, border: REJILLA },
  filaGrado: { font: { name: FUENTE, sz: 9, bold: true }, alignment: { horizontal: 'left', vertical: 'center' }, border: REJILLA },
  total: { font: { name: FUENTE, sz: 9, bold: true }, alignment: { horizontal: 'center', vertical: 'center' }, border: { ...REJILLA, top: DOBLE }, fill: { patternType: 'solid', fgColor: { rgb: 'FFF2CC' } } },
  totalEtiqueta: { font: { name: FUENTE, sz: 9, bold: true }, alignment: { horizontal: 'left', vertical: 'center' }, border: { ...REJILLA, top: DOBLE }, fill: { patternType: 'solid', fgColor: { rgb: 'FFF2CC' } } },
  pie: { font: { name: FUENTE, sz: 10, bold: true }, alignment: { horizontal: 'left', vertical: 'center' } },
  lugar: { font: { name: FUENTE, sz: 10, bold: true }, alignment: { horizontal: 'center', vertical: 'center' } },
};

interface Celda { v: string | number; s: any }

@Injectable({ providedIn: 'root' })
export class ExportService {

  private celda(v: any, s: any): Celda {
    return { v: v == null ? '' : v, s };
  }

  private matriz(tipo: Tipo, t: number, d: Doc) {
    const df = definir(tipo, t);
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

    const titulos = lineas(tipo, t, d?.gestion ?? '2026');
    const pie: string[] = [];
    if (tipo === 'temas') pie.push(`PORCENTAJE DE TEMAS AVANZADOS: ${tt['t_pct'] ?? ''}`);
    if (tipo === 'promret') {
      pie.push(`PORCENTAJE DE PROMOVIDOS: ${tt['t_pp'] ?? ''}`);
      pie.push(`PORCENTAJE DE RETENIDOS: ${tt['t_pr'] ?? ''}`);
    }
    if (tipo === 'promedio') pie.push(`PROMEDIO: ${tt['prom'] ?? ''}`);
    if (d?.lugar) pie.push(d.lugar);

    const anchos = [11, ...cols.map(c => (c.titulo === '%' ? 9 : c.key === 'crit' ? 22 : 13))];
    const alturas: number[] = titulos.map((_, i) => i === 0 ? 24 : 18);
    alturas.push(26, sub ? 34 : (tipo === 'promret' ? 140 : 110));
    if (sub) alturas.push(tipo === 'promret' ? 150 : 120);
    for (let i = 0; i < GRADOS.length + 1; i++) alturas.push(19);
    pie.forEach((_, i) => alturas.push(i === pie.length - 1 && d?.lugar ? 20 : 22));

    return { titulos, mat, merges, ancho, pie, anchos, alturas };
  }

  private hoja(XLSX: any, tipo: Tipo, t: number, d: Doc, nombre: string) {
    const m = this.matriz(tipo, t, d);
    const filas: any[][] = [];
    const merges: any[] = [];

    m.titulos.forEach((txt, i) => {
      const r = Array(m.ancho).fill('');
      r[0] = this.celda(txt, { ...S.titulo, font: { ...S.titulo.font, sz: i === 0 ? 12 : 9 } });
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
  private guardar(XLSX: any, wb: any, nombre: string) {
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
    const blob = new Blob([zipSync(zip) as any], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async exportarExcelTodo(leer: (id: string) => Promise<any>) {
    const XLSX = await import('xlsx-js-style');
    const wb = XLSX.utils.book_new();
    const nombres: Record<string, string> = { temas: 'T. AVANZ', promret: 'PROM Y RET', promedio: 'PROM' };
    for (const tp of ['temas', 'promret', 'promedio'] as Tipo[]) {
      for (const t of [1, 2, 3]) {
        const nombre = `${nombres[tp]} ${t}º TRIM`;
        const d = await leer(`${tp}_${t}`).catch(() => null);
        XLSX.utils.book_append_sheet(wb, this.hoja(XLSX, tp, t, d, nombre), nombre);
      }
    }
    this.guardar(XLSX, wb, 'registro-estadistico.xlsx');
  }

  async exportarExcelUno(tipo: Tipo, t: number, d: Doc) {
    const XLSX = await import('xlsx-js-style');
    const wb = XLSX.utils.book_new();
    const nombre = `${tipo} ${t}º TRIM`;
    XLSX.utils.book_append_sheet(wb, this.hoja(XLSX, tipo, t, d, nombre), nombre);
    this.guardar(XLSX, wb, `cuadros-${tipo}-${t}trim.xlsx`);
  }
}
