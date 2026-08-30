// pdf-parse's package root (index.js) has a debug-mode side effect that
// breaks once bundled into a Netlify Function — see the import comment in
// app/api/admin/review/[id]/compliance-check/route.ts. This mirrors
// @types/pdf-parse's own declaration for the inner implementation module
// that route imports instead.
declare module "pdf-parse/lib/pdf-parse.js" {
  import PdfParse = require("pdf-parse");
  export = PdfParse;
}
