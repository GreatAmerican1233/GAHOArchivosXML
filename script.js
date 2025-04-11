document.getElementById('processButton').addEventListener('click', () => {
    const fileInput = document.getElementById('file');

    if (fileInput.files.length === 0) {
        alert('Por favor, selecciona un archivo XML.');
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function (event) {
        const xmlContent = event.target.result;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');

        // Punto #1: RFC del emisor
        let emisor = xmlDoc.getElementsByTagName('cfdi:Emisor')[0];
        let rfcEmisor = emisor?.getAttribute('Rfc') || '000000';
        if (rfcEmisor === 'ACM040107U93') {
            rfcEmisor = '001488';
        }

        // Punto #2: Número de tienda desde CENTROCOSTO
        let numeroTienda = '000000';
        const allNodes = xmlDoc.getElementsByTagName('*');
        for (let i = 0; i < allNodes.length; i++) {
            const node = allNodes[i];
            const centroCostoAttr = node.getAttribute('CENTROCOSTO');
            if (centroCostoAttr) {
                const match = centroCostoAttr.match(/(\d{4})-(\d{4})/);
                if (match) {
                    const parte1 = match[1].substring(2); // 42
                    const parte2 = match[2];              // 0039
                    numeroTienda = `${parte1}${parte2}`.padStart(6, '0');
                }
                break;
            }
        }

        // Punto #3 y #5: Fecha en formato MM/DD/YYYY
        const comprobante = xmlDoc.getElementsByTagName('cfdi:Comprobante')[0];
        const fechaOriginal = comprobante?.getAttribute('Fecha') || '';
        const fechaObj = new Date(fechaOriginal);
        const fechaFormateada = fechaObj.toLocaleDateString('en-US'); // MM/DD/YYYY
        const folio = comprobante?.getAttribute('Folio') || 'SIN_FOLIO';

        // Punto #6: SubTotal
        const subTotal = parseFloat(comprobante?.getAttribute('SubTotal') || '0').toFixed(2);

        // Punto #7: TotalImpuestosTrasladados
        let impuestosTrasladados = '0.00';
        const impuestosNodeList = xmlDoc.getElementsByTagName('*');
        for (let i = 0; i < impuestosNodeList.length; i++) {
            const node = impuestosNodeList[i];
            if (node.hasAttribute('TotalImpuestosTrasladados')) {
                impuestosTrasladados = node.getAttribute('TotalImpuestosTrasladados');
                break;
            }
        }

        // Punto #8: Buscar TARIFA y excluirlo del listado de productos
        let tarifaImporte = '';
        const conceptos = xmlDoc.getElementsByTagName('cfdi:Concepto');
        const detalles = [];

        for (let i = 0; i < conceptos.length; i++) {
            const concepto = conceptos[i];
            const noIdent = concepto.getAttribute('NoIdentificacion') || '000000';
            const cantidad = concepto.getAttribute('Cantidad') || '0.00';
            const valorUnitario = concepto.getAttribute('ValorUnitario') || '0.00';
            const importe = concepto.getAttribute('Importe') || '0.00';

            if (noIdent === 'TARIFA') {
                tarifaImporte = importe;
            } else {
                detalles.push(`D ${noIdent} N ${cantidad} ${valorUnitario} ${importe}`);
            }
        }

        // Punto #9: Descuento global
        let descuentoLinea = '';
        const condicionesPago = comprobante?.getAttribute('CondicionesDePago');
        const descuento = comprobante?.getAttribute('Descuento');
        const exportacion = comprobante?.getAttribute('Exportacion');

        if (condicionesPago && descuento && exportacion) {
            descuentoLinea = `-${parseFloat(descuento).toFixed(2)}`;
        }

        // Construcción de la cabecera con los puntos 6 y 7 + adicionales
        let cabecera = `H ${rfcEmisor.padStart(6, '0')} ${numeroTienda.padStart(6, '0')} ${fechaFormateada} ${folio} ${fechaFormateada} ${subTotal} IVA (TAX) ${impuestosTrasladados}`;
        if (tarifaImporte) {
            cabecera += ` DISTRIBUCION Y ALMACENAJE FLETE ${tarifaImporte}`;
        }
        if (descuentoLinea) {
            cabecera += ` DESCUENTOS DEL PROVEEDOR ${descuentoLinea}`;
        }

                // Armar el contenido final
        const contenidoFinal = [cabecera, ...detalles].join('\n');

        // Descargar archivo con nombre 009 + Folio
        const blob = new Blob([contenidoFinal], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `009${folio}.txt`;
        link.click();

    };

    reader.readAsText(file);
});
