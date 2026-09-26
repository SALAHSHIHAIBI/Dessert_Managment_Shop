import 'server-only'

import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { CATEGORY_LABELS, formatDate } from '@/lib/format'
import { formatDirhams } from '@/lib/units'
import type { LoanReport } from '@/lib/loan-report'

// The PDF is the document that gets handed in, so it stays plain: a summary
// page, the itemised list, then the receipt photos as evidence.
const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, color: '#241a13' },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#7a6a5c', marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#241a13',
    fontSize: 11,
    fontWeight: 'bold',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#241a13',
    paddingBottom: 4,
    marginBottom: 2,
    fontWeight: 'bold',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#ebe3d8',
  },
  cellNo: { width: '5%' },
  cellDate: { width: '14%' },
  cellSupplier: { width: '23%' },
  cellCategory: { width: '15%' },
  cellDetails: { width: '25%', color: '#7a6a5c' },
  cellAmount: { width: '18%', textAlign: 'right' },
  receiptCaption: { fontSize: 8, color: '#7a6a5c', marginBottom: 4 },
  receiptImage: { maxWidth: '100%', maxHeight: 300, objectFit: 'contain', marginBottom: 12 },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    fontSize: 8,
    color: '#7a6a5c',
    textAlign: 'center',
  },
})

export type ReceiptImage = { purchaseIndex: number; date: Date; supplier: string; src: string }

export function LoanReportDocument({
  report,
  shopName,
  images,
}: {
  report: LoanReport
  shopName: string
  images: ReceiptImage[]
}) {
  const period = describePeriod(report)

  return (
    <Document title={`Purchase record — ${shopName}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Record of business purchases</Text>
        <Text style={styles.subtitle}>
          {shopName} · {period}
        </Text>

        <Text style={styles.sectionTitle}>Summary</Text>
        <View style={styles.summaryRow}>
          <Text>Purchases recorded</Text>
          <Text>{report.purchases.length}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text>Receipts attached</Text>
          <Text>{report.receiptCount}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text>Purchases without a receipt</Text>
          <Text>{report.missingReceiptCount}</Text>
        </View>

        <Text style={styles.sectionTitle}>By category</Text>
        {report.byCategory.map((row) => (
          <View key={row.category} style={styles.summaryRow}>
            <Text>
              {CATEGORY_LABELS[row.category]} ({row.count})
            </Text>
            <Text>{formatDirhams(row.totalDirhams)} LYD</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text>Total</Text>
          <Text>{formatDirhams(report.totalDirhams)} LYD</Text>
        </View>

        <Text style={styles.footer} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Itemised purchases</Text>
        <Text style={styles.subtitle}>{period}</Text>

        <View style={styles.tableHeader} fixed>
          <Text style={styles.cellNo}>#</Text>
          <Text style={styles.cellDate}>Date</Text>
          <Text style={styles.cellSupplier}>Supplier</Text>
          <Text style={styles.cellCategory}>Category</Text>
          <Text style={styles.cellDetails}>Details</Text>
          <Text style={styles.cellAmount}>Amount (LYD)</Text>
        </View>

        {report.purchases.map((purchase, index) => (
          <View key={purchase.id} style={styles.row} wrap={false}>
            <Text style={styles.cellNo}>{index + 1}</Text>
            <Text style={styles.cellDate}>{formatDate(purchase.date)}</Text>
            <Text style={styles.cellSupplier}>{purchase.supplierName ?? '—'}</Text>
            <Text style={styles.cellCategory}>{CATEGORY_LABELS[purchase.category]}</Text>
            <Text style={styles.cellDetails}>
              {purchase.items.length > 0
                ? purchase.items.map((item) => item.description).join(', ')
                : (purchase.notes ?? '')}
            </Text>
            <Text style={styles.cellAmount}>{formatDirhams(purchase.totalDirhams)}</Text>
          </View>
        ))}

        <View style={styles.totalRow}>
          <Text>Total</Text>
          <Text>{formatDirhams(report.totalDirhams)} LYD</Text>
        </View>

        <Text style={styles.footer} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>

      {images.length > 0 ? (
        <Page size="A4" style={styles.page}>
          <Text style={styles.title}>Receipts</Text>
          <Text style={styles.subtitle}>
            Numbered to match the itemised list above.
          </Text>
          {images.map((image, index) => (
            <View key={`${image.purchaseIndex}-${index}`} wrap={false}>
              <Text style={styles.receiptCaption}>
                #{image.purchaseIndex} · {formatDate(image.date)} · {image.supplier}
              </Text>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image takes no alt */}
              <Image src={image.src} style={styles.receiptImage} />
            </View>
          ))}
          <Text style={styles.footer} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
        </Page>
      ) : null}
    </Document>
  )
}

function describePeriod(report: LoanReport): string {
  const { from, to } = report.range
  if (from && to) return `${formatDate(from)} to ${formatDate(to)}`
  if (from) return `From ${formatDate(from)}`
  if (to) return `Up to ${formatDate(to)}`
  return 'All purchases on record'
}
