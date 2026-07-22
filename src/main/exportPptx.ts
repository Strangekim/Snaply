/** PPTX 생성기 — 이미지 슬라이드 프레젠테이션. 소유자: Architect.
 * PPTX는 OOXML zip이다. 의존성 없이 최소 파트(프레젠테이션/마스터/레이아웃/테마/슬라이드)를 직접 만든다.
 * 각 이미지는 16:9 슬라이드에 contain 맞춤으로 배치되고, 편집 가능한 그림 개체로 들어간다. */
import { createZip, type ZipEntry } from './zip'

/** 16:9 슬라이드 크기 (EMU) */
const SLIDE_W = 12192000
const SLIDE_H = 6858000
/** px → EMU (96dpi 기준) */
const EMU_PER_PX = 9525

export interface PptxImage {
  /** PNG 버퍼 */
  png: Buffer
  width: number
  height: number
  /** 슬라이드 하단 캡션 (선택) */
  caption?: string
}

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'

function escapeXml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function contentTypes(slideCount: number): string {
  const slides = Array.from(
    { length: slideCount },
    (_, i) =>
      `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
  ).join('')
  return (
    XML_DECL +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Default Extension="png" ContentType="image/png"/>' +
    '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
    '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>' +
    '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>' +
    '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
    slides +
    '</Types>'
  )
}

function rootRels(): string {
  return (
    XML_DECL +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>' +
    '</Relationships>'
  )
}

function presentationXml(slideCount: number): string {
  const ids = Array.from(
    { length: slideCount },
    (_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`
  ).join('')
  return (
    XML_DECL +
    '<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
    '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
    `<p:sldIdLst>${ids}</p:sldIdLst>` +
    `<p:sldSz cx="${SLIDE_W}" cy="${SLIDE_H}"/><p:notesSz cx="${SLIDE_H}" cy="${SLIDE_W}"/>` +
    '</p:presentation>'
  )
}

function presentationRels(slideCount: number): string {
  const slides = Array.from(
    { length: slideCount },
    (_, i) =>
      `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`
  ).join('')
  return (
    XML_DECL +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>' +
    slides +
    '</Relationships>'
  )
}

/** 최소 테마 — Pretendard/토스 그레이 계열 */
function themeXml(): string {
  return (
    XML_DECL +
    '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Snaply">' +
    '<a:themeElements>' +
    '<a:clrScheme name="Snaply"><a:dk1><a:srgbClr val="191F28"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>' +
    '<a:dk2><a:srgbClr val="333D4B"/></a:dk2><a:lt2><a:srgbClr val="F9FAFB"/></a:lt2>' +
    '<a:accent1><a:srgbClr val="3182F6"/></a:accent1><a:accent2><a:srgbClr val="00C471"/></a:accent2>' +
    '<a:accent3><a:srgbClr val="F04452"/></a:accent3><a:accent4><a:srgbClr val="FFC342"/></a:accent4>' +
    '<a:accent5><a:srgbClr val="6B7684"/></a:accent5><a:accent6><a:srgbClr val="D1D6DB"/></a:accent6>' +
    '<a:hlink><a:srgbClr val="3182F6"/></a:hlink><a:folHlink><a:srgbClr val="6B7684"/></a:folHlink></a:clrScheme>' +
    '<a:fontScheme name="Snaply"><a:majorFont><a:latin typeface="Pretendard"/><a:ea typeface="Pretendard"/><a:cs typeface=""/></a:majorFont>' +
    '<a:minorFont><a:latin typeface="Pretendard"/><a:ea typeface="Pretendard"/><a:cs typeface=""/></a:minorFont></a:fontScheme>' +
    '<a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst>' +
    '<a:lnStyleLst><a:ln><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst>' +
    '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>' +
    '<a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>' +
    '</a:themeElements></a:theme>'
  )
}

function slideMasterXml(): string {
  return (
    XML_DECL +
    '<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
    '<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>' +
    '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
    '</p:spTree></p:cSld>' +
    '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>' +
    '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>' +
    '</p:sldMaster>'
  )
}

function slideMasterRels(): string {
  return (
    XML_DECL +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>' +
    '</Relationships>'
  )
}

function slideLayoutXml(): string {
  return (
    XML_DECL +
    '<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank">' +
    '<p:cSld name="빈 화면"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
    '</p:spTree></p:cSld><p:clrMapOvr><a:overrideClrMapping bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:clrMapOvr></p:sldLayout>'
  )
}

function slideLayoutRels(): string {
  return (
    XML_DECL +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>' +
    '</Relationships>'
  )
}

/** 이미지를 슬라이드에 contain 맞춤 (여백 5%) */
function fitImage(width: number, height: number, hasCaption: boolean): { x: number; y: number; w: number; h: number } {
  const margin = 0.05
  const availW = SLIDE_W * (1 - margin * 2)
  const availH = SLIDE_H * (1 - margin * 2) - (hasCaption ? 700000 : 0)
  const imgW = width * EMU_PER_PX
  const imgH = height * EMU_PER_PX
  const scale = Math.min(availW / imgW, availH / imgH, 1)
  const w = Math.round(imgW * scale)
  const h = Math.round(imgH * scale)
  return { x: Math.round((SLIDE_W - w) / 2), y: Math.round((SLIDE_H * (1 - margin * 2) - (hasCaption ? 700000 : 0) - h) / 2 + SLIDE_H * margin), w, h }
}

function slideXml(img: PptxImage, index: number): string {
  const pos = fitImage(img.width, img.height, !!img.caption)
  const caption = img.caption
    ? '<p:sp><p:nvSpPr><p:cNvPr id="3" name="캡션"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>' +
      `<p:spPr><a:xfrm><a:off x="609600" y="${SLIDE_H - 800000}"/><a:ext cx="${SLIDE_W - 1219200}" cy="600000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>` +
      '<p:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r>' +
      '<a:rPr lang="ko-KR" sz="1400"><a:solidFill><a:srgbClr val="6B7684"/></a:solidFill></a:rPr>' +
      `<a:t>${escapeXml(img.caption)}</a:t></a:r></a:p></p:txBody></p:sp>`
    : ''
  return (
    XML_DECL +
    '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
    '<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>' +
    `<p:pic><p:nvPicPr><p:cNvPr id="2" name="캡처 ${index + 1}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>` +
    '<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>' +
    `<p:spPr><a:xfrm><a:off x="${pos.x}" y="${pos.y}"/><a:ext cx="${pos.w}" cy="${pos.h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>` +
    caption +
    '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>'
  )
}

function slideRels(index: number): string {
  return (
    XML_DECL +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>' +
    `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${index + 1}.png"/>` +
    '</Relationships>'
  )
}

/** 이미지 배열 → PPTX 버퍼 */
export function buildPptx(images: PptxImage[], now = new Date()): Buffer {
  if (images.length === 0) throw new Error('내보낼 이미지가 없어요.')
  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', data: Buffer.from(contentTypes(images.length), 'utf-8') },
    { name: '_rels/.rels', data: Buffer.from(rootRels(), 'utf-8') },
    { name: 'ppt/presentation.xml', data: Buffer.from(presentationXml(images.length), 'utf-8') },
    { name: 'ppt/_rels/presentation.xml.rels', data: Buffer.from(presentationRels(images.length), 'utf-8') },
    { name: 'ppt/theme/theme1.xml', data: Buffer.from(themeXml(), 'utf-8') },
    { name: 'ppt/slideMasters/slideMaster1.xml', data: Buffer.from(slideMasterXml(), 'utf-8') },
    { name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: Buffer.from(slideMasterRels(), 'utf-8') },
    { name: 'ppt/slideLayouts/slideLayout1.xml', data: Buffer.from(slideLayoutXml(), 'utf-8') },
    { name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: Buffer.from(slideLayoutRels(), 'utf-8') }
  ]
  images.forEach((img, i) => {
    entries.push({ name: `ppt/slides/slide${i + 1}.xml`, data: Buffer.from(slideXml(img, i), 'utf-8') })
    entries.push({ name: `ppt/slides/_rels/slide${i + 1}.xml.rels`, data: Buffer.from(slideRels(i), 'utf-8') })
    entries.push({ name: `ppt/media/image${i + 1}.png`, data: img.png })
  })
  return createZip(entries, now)
}
