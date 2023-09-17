import PDFDocument from "pdfkit";

function formatDate(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function generateAccountStatementPDF({
  res,
  transactions,
  customerInfo,
  statementPeriod,
  initialBalance,
  endingBalance,
}) {
  const doc = new PDFDocument();
  doc.pipe(res);
  doc.fontSize(36).text("Seven Bank", 50, 20);
  doc.fontSize(14).text(`Nombre: ${customerInfo.fullName}`, 50, 60);
  doc.text(`Dirección: ${customerInfo.address}`, 50, 80);
  doc.text(`Periodo del estado de cuenta: ${statementPeriod}`, 50, 100);
  doc
    .fontSize(12)
    .text(`Saldo Inicial: ${initialBalance.toFixed(2)}`, 490, 120);
  const headers = [
    "Fecha",
    "ID",
    "Descripción",
    "Debitos",
    "Creditos",
    "Balance",
  ];
  const headerXPositions = [30, 100, 190, 330, 410, 490];
  doc.fontSize(12);
  headerXPositions.forEach((x, i) => {
    doc.text(headers[i], x, 180);
  });
  doc.moveTo(30, 200).lineTo(550, 200).stroke();
  let yPos = 220;
  const PAGE_MAX_Y = 720;

  for (const statement of transactions) {
    if (yPos > PAGE_MAX_Y) {
      doc.addPage();
      yPos = 220;
      headerXPositions.forEach((x, i) => {
        doc.text(headers[i], x, 180);
      });
      doc.moveTo(30, 200).lineTo(550, 200).stroke();
    }
    const row = [
      formatDate(statement.fecha),
      statement.transaccionId,
      statement.descripcion,
      statement.isOutgoing ? statement.monto.toFixed(2) : "0",
      statement.isOutgoing ? "0" : statement.monto.toFixed(2),
      statement.balance.toFixed(2),
    ];
    headerXPositions.forEach((x, i) => {
      doc.text(row[i], x, yPos);
    });
    yPos += 20;
    doc.moveTo(30, yPos).lineTo(550, yPos).stroke();
    yPos += 20;
  }

  doc
    .fontSize(12)
    .text(`Saldo Final: ${endingBalance.toFixed(2)}`, 490, yPos + 20);
  doc.end();
}
