from __future__ import annotations

import json
import re
import zipfile
from pathlib import Path


ROOT = Path(r"C:\VENTA-DE-PASAJES")
OUT = ROOT / "services" / "report-service" / "docs" / "plantillas" / "mejoras"
INVOICE = ROOT / "services" / "report-service" / "src" / "test" / "resources" / "docx4j" / "invoice-opendope.docx"
HEADERS = ROOT / "services" / "report-service" / "src" / "test" / "resources" / "docx4j" / "Headers.docx"
STORE_ID = "{8B049945-9DFE-4726-9DE9-CF5691E53858}"


def read_zip(path: Path) -> dict[str, bytes]:
    with zipfile.ZipFile(path) as archive:
        return {info.filename: archive.read(info.filename) for info in archive.infolist()}


def write_zip(path: Path, entries: dict[str, bytes]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, value in entries.items():
            archive.writestr(name, value)


def xml(value: str) -> bytes:
    return value.strip().encode("utf-8")


def replace_entry(entries: dict[str, bytes], name: str, value: str) -> None:
    entries[name] = xml(value)


NESTED_DOCUMENT = """
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Prueba OpenDoPE con arrays anidados</w:t></w:r></w:p>
    <w:p><w:r><w:t>Cliente: </w:t></w:r><w:sdt><w:sdtPr><w:tag w:val="od:xpath=x1"/><w:dataBinding w:xpath="/invoice[1]/customer[1]/name[1]" w:storeItemID="{8B049945-9DFE-4726-9DE9-CF5691E53858}"/><w:text/></w:sdtPr><w:sdtContent><w:r><w:t>Cliente</w:t></w:r></w:sdtContent></w:sdt></w:p>
    <w:tbl>
      <w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/></w:tblPr>
      <w:tblGrid><w:gridCol w:w="3000"/><w:gridCol w:w="2000"/><w:gridCol w:w="4500"/></w:tblGrid>
      <w:tr><w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Viaje</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Precio</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Pasajeros</w:t></w:r></w:p></w:tc></w:tr>
      <w:sdt><w:sdtPr><w:tag w:val="od:repeat=x2&amp;od:finish=t_r"/></w:sdtPr><w:sdtContent><w:tr>
        <w:sdt><w:sdtPr><w:tag w:val="od:xpath=x3"/><w:dataBinding w:xpath="/invoice[1]/items/item[1]/name" w:storeItemID="{8B049945-9DFE-4726-9DE9-CF5691E53858}"/><w:text/></w:sdtPr><w:sdtContent><w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Viaje</w:t></w:r></w:p></w:tc></w:sdtContent></w:sdt>
        <w:sdt><w:sdtPr><w:tag w:val="od:xpath=x4"/><w:dataBinding w:xpath="/invoice[1]/items/item[1]/price" w:storeItemID="{8B049945-9DFE-4726-9DE9-CF5691E53858}"/><w:text/></w:sdtPr><w:sdtContent><w:tc><w:p><w:r><w:t>Precio</w:t></w:r></w:p></w:tc></w:sdtContent></w:sdt>
        <w:tc><w:p><w:r><w:t>Pasajeros:</w:t></w:r></w:p><w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/></w:tblPr><w:tblGrid><w:gridCol w:w="4500"/></w:tblGrid><w:tr><w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Nombre</w:t></w:r></w:p></w:tc></w:tr><w:sdt><w:sdtPr><w:tag w:val="od:repeat=x7&amp;od:finish=t_r"/></w:sdtPr><w:sdtContent><w:tr><w:sdt><w:sdtPr><w:tag w:val="od:xpath=x8"/><w:dataBinding w:xpath="/invoice[1]/items/item[1]/passengers/item/name" w:storeItemID="{8B049945-9DFE-4726-9DE9-CF5691E53858}"/><w:text/></w:sdtPr><w:sdtContent><w:tc><w:p><w:r><w:rPr><w:i/></w:rPr><w:t>Pasajero</w:t></w:r></w:p></w:tc></w:sdtContent></w:sdt></w:tr></w:sdtContent></w:sdt></w:tbl></w:tc>
      </w:tr></w:sdtContent></w:sdt>
    </w:tbl>
    <w:sdt><w:sdtPr><w:tag w:val="od:condition=c5&amp;od:finish=t_c"/></w:sdtPr><w:sdtContent><w:p><w:r><w:rPr><w:color w:val="008000"/></w:rPr><w:t>CONDICION VERDADERA: el servicio esta confirmado.</w:t></w:r></w:p></w:sdtContent></w:sdt>
    <w:sdt><w:sdtPr><w:tag w:val="od:condition=c6"/></w:sdtPr><w:sdtContent><w:p><w:r><w:rPr><w:color w:val="C00000"/></w:rPr><w:t>CONDICION FALSA: este texto se oculta cuando wantspam es falso.</w:t></w:r></w:p></w:sdtContent></w:sdt>
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>
"""


NESTED_DATA = """
<?xml version="1.0" encoding="UTF-8" standalone="yes"?><invoice>
  <customer><name>Maria Gonzalez</name></customer>
  <items>
    <item><name>Quito - Guayaquil</name><price>18.50</price><passengers><item><name>Maria Gonzalez</name></item><item><name>Carlos Ruiz</name></item></passengers></item>
    <item><name>Guayaquil - Cuenca</name><price>14.75</price><passengers><item><name>Elena Torres</name></item><item><name>Jose Mena</name></item><item><name>Lucia Vera</name></item></passengers></item>
  </items>
  <misc><includeBankDetails>true</includeBankDetails><wantspam>false</wantspam></misc>
</invoice>
"""


NESTED_XPATHS = f"""
<?xml version="1.0" encoding="UTF-8" standalone="yes"?><ns15:xpaths xmlns:ns15="http://opendope.org/xpaths">
  <ns15:xpath id="x1"><ns15:dataBinding storeItemID="{STORE_ID}" xpath="/invoice[1]/customer[1]/name[1]"/></ns15:xpath>
  <ns15:xpath id="x2"><ns15:dataBinding storeItemID="{STORE_ID}" xpath="/invoice[1]/items/item"/></ns15:xpath>
  <ns15:xpath id="x3"><ns15:dataBinding storeItemID="{STORE_ID}" xpath="/invoice[1]/items/item[1]/name"/></ns15:xpath>
  <ns15:xpath id="x4"><ns15:dataBinding storeItemID="{STORE_ID}" xpath="/invoice[1]/items/item[1]/price"/></ns15:xpath>
  <ns15:xpath id="x5"><ns15:dataBinding storeItemID="{STORE_ID}" xpath="/invoice[1]/misc/includeBankDetails"/></ns15:xpath>
  <ns15:xpath id="x6"><ns15:dataBinding storeItemID="{STORE_ID}" xpath="/invoice[1]/misc/wantspam"/></ns15:xpath>
  <ns15:xpath id="x7"><ns15:dataBinding storeItemID="{STORE_ID}" xpath="/invoice[1]/items/item/passengers/item"/></ns15:xpath>
  <ns15:xpath id="x8"><ns15:dataBinding storeItemID="{STORE_ID}" xpath="/invoice[1]/items/item[1]/passengers/item/name"/></ns15:xpath>
</ns15:xpaths>
"""


CONDITIONS = """
<?xml version="1.0" encoding="UTF-8" standalone="yes"?><ns16:conditions xmlns:ns16="http://opendope.org/conditions">
  <ns16:condition id="c5"><ns16:xpathref id="x5"/></ns16:condition>
  <ns16:condition id="c6"><ns16:xpathref id="x6"/></ns16:condition>
</ns16:conditions>
"""


def make_nested() -> None:
    entries = read_zip(INVOICE)
    replace_entry(entries, "word/document.xml", NESTED_DOCUMENT)
    replace_entry(entries, "customXml/item3.xml", NESTED_DATA)
    replace_entry(entries, "customXml/item4.xml", NESTED_XPATHS)
    replace_entry(entries, "customXml/item1.xml", CONDITIONS)
    write_zip(OUT / "opendope-arrays-condicionales.docx", entries)


def sdt(xpath_id: str, value_path: str, fallback: str) -> str:
    return f"<w:sdt><w:sdtPr><w:tag w:val=\"od:xpath={xpath_id}\"/><w:dataBinding w:xpath=\"{value_path}\" w:storeItemID=\"{STORE_ID}\"/><w:text/></w:sdtPr><w:sdtContent><w:r><w:t>{fallback}</w:t></w:r></w:sdtContent></w:sdt>"


def header_part(xpath_id: str, path: str, fallback: str) -> str:
    return f"<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><w:hdr xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>{fallback}: </w:t></w:r>{sdt(xpath_id, path, fallback)}</w:p></w:hdr>"


def footer_part(xpath_id: str, path: str, fallback: str) -> str:
    return f"<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><w:ftr xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:p><w:r><w:t>{fallback}: </w:t></w:r>{sdt(xpath_id, path, fallback)}</w:p></w:ftr>"


HEADER_PATHS = {
    1: "/report[1]/sections[1]/item[1]/headerDefault[1]",
    2: "/report[1]/sections[1]/item[1]/firstHeader[1]",
    3: "/report[1]/sections[1]/item[2]/headerDefault[1]",
    4: "/report[1]/sections[1]/item[2]/firstHeader[1]",
    5: "/report[1]/sections[1]/item[3]/headerEven[1]",
    6: "/report[1]/sections[1]/item[3]/headerDefault[1]",
}
FOOTER_PATHS = {
    1: "/report[1]/sections[1]/item[1]/footerDefault[1]",
    2: "/report[1]/sections[1]/item[2]/footerDefault[1]",
    3: "/report[1]/sections[1]/item[3]/footerEven[1]",
    4: "/report[1]/sections[1]/item[1]/firstFooter[1]",
    5: "/report[1]/sections[1]/item[2]/firstFooter[1]",
    6: "/report[1]/sections[1]/item[3]/footerDefaultSecond[1]",
}


def opendope_xpaths() -> str:
    entries = []
    for prefix, paths in (("h", HEADER_PATHS), ("f", FOOTER_PATHS)):
        for index, path in paths.items():
            entries.append(f'<ns15:xpath id="{prefix}{index}"><ns15:dataBinding storeItemID="{STORE_ID}" xpath="{path}"/></ns15:xpath>')
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><ns15:xpaths xmlns:ns15="http://opendope.org/xpaths">' + "".join(entries) + "</ns15:xpaths>"


def sections_document() -> str:
    def section(refs: str) -> str:
        return f"<w:p><w:pPr><w:sectPr>{refs}<w:pgSz w:w=\"11906\" w:h=\"16838\"/><w:pgMar w:top=\"1440\" w:right=\"1440\" w:bottom=\"1440\" w:left=\"1440\"/></w:sectPr></w:pPr></w:p>"

    first = "<w:headerReference w:type=\"default\" r:id=\"rId7\"/><w:headerReference w:type=\"first\" r:id=\"rId8\"/><w:footerReference w:type=\"default\" r:id=\"rId16\"/><w:footerReference w:type=\"first\" r:id=\"rId19\"/><w:titlePg/>"
    second = "<w:headerReference w:type=\"default\" r:id=\"rId10\"/><w:headerReference w:type=\"first\" r:id=\"rId11\"/><w:footerReference w:type=\"default\" r:id=\"rId17\"/><w:footerReference w:type=\"first\" r:id=\"rId20\"/><w:titlePg/>"
    third = "<w:headerReference w:type=\"even\" r:id=\"rId12\"/><w:headerReference w:type=\"default\" r:id=\"rId13\"/><w:footerReference w:type=\"even\" r:id=\"rId18\"/><w:footerReference w:type=\"default\" r:id=\"rId21\"/>"
    return f"""
    <?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>
    <w:document xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\" xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body>
      <w:p><w:pPr><w:pStyle w:val=\"Title\"/></w:pPr><w:r><w:t>OpenDoPE por secciones</w:t></w:r></w:p><w:p><w:r><w:t>Seccion uno</w:t></w:r></w:p>{section(first)}
      <w:p><w:r><w:t>Seccion dos</w:t></w:r></w:p>{section(second)}
      <w:p><w:r><w:t>Seccion tres</w:t></w:r></w:p>{section(third)}
    </w:body></w:document>
    """


def header_footer_data() -> str:
    sections = [
        {"headerDefault": "Encabezado seccion 1", "firstHeader": "Primera pagina seccion 1", "footerDefault": "Pie seccion 1", "firstFooter": "Primer pie seccion 1"},
        {"headerDefault": "Encabezado seccion 2", "firstHeader": "Primera pagina seccion 2", "footerDefault": "Pie seccion 2", "firstFooter": "Primer pie seccion 2"},
        {"headerEven": "Encabezado par seccion 3", "headerDefault": "Encabezado impar seccion 3", "footerEven": "Pie par seccion 3", "footerDefaultSecond": "Pie impar seccion 3"},
    ]
    return "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?><report><sections>" + "".join(
        "<section>" + "".join(f"<{key}>{value}</{key}>" for key, value in section.items()) + "</section>" for section in sections
    ) + "</sections></report>"


def append_relationships(value: str) -> str:
    additions = "".join(
        f"<Relationship Id=\"rId{15 + index}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer\" Target=\"footer{index}.xml\"/>"
        for index in range(1, 7)
    )
    custom = "".join(
        f"<Relationship Id=\"rId{21 + index}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml\" Target=\"../customXml/item{index}.xml\"/>"
        for index in range(1, 5)
    )
    return value.replace("</Relationships>", additions + custom + "</Relationships>")


def append_content_types(value: str) -> str:
    footers = "".join(
        f"<Override PartName=\"/word/footer{index}.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml\"/>"
        for index in range(1, 7)
    )
    custom = "".join(
        f"<Override PartName=\"/customXml/itemProps{index}.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.customXmlProperties+xml\"/>"
        for index in range(1, 5)
    )
    return value.replace("</Types>", footers + custom + "</Types>")


def make_headers_footers() -> None:
    entries = read_zip(HEADERS)
    invoice_entries = read_zip(INVOICE)
    for name, value in invoice_entries.items():
        if name.startswith("customXml/"):
            entries[name] = value
    replace_entry(entries, "word/document.xml", sections_document())
    replace_entry(entries, "customXml/item3.xml", header_footer_data())
    replace_entry(entries, "customXml/item4.xml", opendope_xpaths())
    replace_entry(entries, "customXml/item1.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><ns16:conditions xmlns:ns16="http://opendope.org/conditions"/>')
    for index, path in HEADER_PATHS.items(): replace_entry(entries, f"word/header{index}.xml", header_part(f"h{index}", path, f"Header {index}"))
    for index, path in FOOTER_PATHS.items(): replace_entry(entries, f"word/footer{index}.xml", footer_part(f"f{index}", path, f"Footer {index}"))
    rels = entries["word/_rels/document.xml.rels"].decode("utf-8")
    replace_entry(entries, "word/_rels/document.xml.rels", append_relationships(rels))
    content_types = entries["[Content_Types].xml"].decode("utf-8")
    replace_entry(entries, "[Content_Types].xml", append_content_types(content_types))
    write_zip(OUT / "opendope-headers-footers-secciones.docx", entries)


LEGACY_DOCUMENT = """
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
  <w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>Filas legacy con formato preservado</w:t></w:r></w:p>
  <w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/></w:tblPr><w:tblGrid><w:gridCol w:w="3000"/><w:gridCol w:w="6000"/></w:tblGrid>
    <w:tr><w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Zona</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Descripcion</w:t></w:r></w:p></w:tc></w:tr>
    <w:tr><w:tc><w:p><w:r><w:t>&lt;jt:forEach items=&quot;${ cambios }&quot; var=&quot;cambio&quot;&gt;</w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>${cambio.</w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>zona}</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:rPr><w:i/></w:rPr><w:t>${cambio.des</w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>cripcion}&lt;/jt:forEach&gt;</w:t></w:r></w:p></w:tc></w:tr>
  </w:tbl><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
</w:body></w:document>
"""


def make_legacy() -> None:
    entries = read_zip(INVOICE)
    replace_entry(entries, "word/document.xml", LEGACY_DOCUMENT)
    write_zip(OUT / "legacy-filas-formato.docx", entries)


def payload(data: dict, file_name: str, code: str, version: int = 1) -> dict:
    return {"data": data, "fileName": file_name, "outputFormat": "DOCX", "templateCode": code, "templateVersion": version}


def write_json(name: str, value: dict) -> None:
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    make_nested()
    make_headers_footers()
    make_legacy()
    write_json("opendope-arrays-condicionales-true.json", payload({"customer": {"name": "Maria Gonzalez"}, "items": [{"name": "Quito - Guayaquil", "price": "18.50", "passengers": [{"name": "Maria Gonzalez"}, {"name": "Carlos Ruiz"}]}, {"name": "Guayaquil - Cuenca", "price": "14.75", "passengers": [{"name": "Elena Torres"}, {"name": "Jose Mena"}, {"name": "Lucia Vera"}]}], "misc": {"includeBankDetails": True, "wantspam": False}}, "resultado-arrays-condicionales-true.docx", "OPENDOPE_ARRAYS_CONDICIONALES", 1))
    write_json("opendope-arrays-condicionales-false.json", payload({"customer": {"name": "Maria Gonzalez"}, "items": [{"name": "Quito - Guayaquil", "price": "18.50", "passengers": [{"name": "Maria Gonzalez"}, {"name": "Carlos Ruiz"}]}, {"name": "Guayaquil - Cuenca", "price": "14.75", "passengers": [{"name": "Elena Torres"}, {"name": "Jose Mena"}, {"name": "Lucia Vera"}]}], "misc": {"includeBankDetails": False, "wantspam": True}}, "resultado-arrays-condicionales-false.docx", "OPENDOPE_ARRAYS_CONDICIONALES", 1))
    write_json("opendope-headers-footers-secciones.json", payload({"sections": [{"headerDefault": "Encabezado seccion 1", "firstHeader": "Primera pagina seccion 1", "footerDefault": "Pie seccion 1", "firstFooter": "Primer pie seccion 1"}, {"headerDefault": "Encabezado seccion 2", "firstHeader": "Primera pagina seccion 2", "footerDefault": "Pie seccion 2", "firstFooter": "Primer pie seccion 2"}, {"headerEven": "Encabezado par seccion 3", "headerDefault": "Encabezado impar seccion 3", "footerEven": "Pie par seccion 3", "footerDefaultSecond": "Pie impar seccion 3"}]}, "resultado-headers-footers-secciones.docx", "OPENDOPE_HEADERS_FOOTERS_SECCIONES", 1))
    write_json("legacy-filas-formato.json", payload({"cambios": [{"zona": "Norte", "descripcion": "Ajuste de frecuencia en la ruta Quito - Ibarra"}, {"zona": "Sur", "descripcion": "Nueva salida nocturna para Loja"}, {"zona": "Centro", "descripcion": "Mantenimiento programado en Ambato"}]}, "resultado-legacy-filas-formato.docx", "LEGACY_FILAS_FORMATO", 1))


if __name__ == "__main__":
    main()
