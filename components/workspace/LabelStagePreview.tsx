"use client";

import { useMemo, CSSProperties } from "react";
import { FONT_PRESETS } from "@/lib/types";
import { CanvasElement, ElementStyle, backgroundCss } from "@/lib/canvasLayout";
import { Summary } from "./types";
import { ICON_COMPONENTS } from "./iconRegistry";

// Mirrors lib/artboard.ts's textDecorationCss()/renderTextBody() as React
// style objects/JSX instead of a raw CSS string, so the editor's on-canvas
// preview and the generated proof always agree on bold/italic/underline/
// align/line-height/letter-spacing/list/effect. boldDefault preserves the
// pre-existing hardcoded weight (productName was always bold) for elements
// saved before these fields existed, where style.bold is simply absent.
function textStyle(style: Pick<ElementStyle, "bold" | "italic" | "underline" | "textAlign" | "lineHeight" | "letterSpacing" | "textEffect">, boldDefault = false): CSSProperties {
  const bold = typeof style.bold === "boolean" ? style.bold : boldDefault;
  const css: CSSProperties = {
    fontWeight: bold ? 700 : 400,
    fontStyle: style.italic ? "italic" : undefined,
    textDecoration: style.underline ? "underline" : undefined,
    textAlign: style.textAlign ?? "left",
    lineHeight: style.lineHeight ?? 1.35,
    letterSpacing: style.letterSpacing ? `${style.letterSpacing}mm` : undefined,
  };
  if (style.textEffect === "shadow") css.textShadow = "1px 1px 0 rgba(0,0,0,0.35)";
  else if (style.textEffect === "outline") css.WebkitTextStroke = "0.5px #fff";
  return css;
}

function renderBody(text: string, listStyle?: ElementStyle["listStyle"]) {
  if (listStyle === "bullet" || listStyle === "number") {
    const items = (text || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (items.length === 0) return <p style={{ margin: 0 }}>—</p>;
    const Tag = listStyle === "bullet" ? "ul" : "ol";
    return (
      <Tag style={{ margin: 0, paddingLeft: 16 }}>
        {items.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </Tag>
    );
  }
  return <p style={{ margin: 0 }}>{text || "—"}</p>;
}

interface Props {
  summary: Summary;
  elements: CanvasElement[];
  logoUrl: string | null;
  imageUrls?: Record<string, string>;
  maxWidth?: number;
}

// A free, instant, client-side rendering of the CURRENT saved layout — no
// server round-trip, no revision spent. Distinct from the official
// server-rendered proof (app/api/workspace/[token]/generate/route.ts),
// which is the exact, watermarked artifact actually submitted for staff
// review and still requires a deliberate "Generate artwork" click. This is
// an approximation (same field data, same positions, but simplified DOM
// instead of Puppeteer/Chromium) good enough to confirm "does my saved
// design look right" without touching the revision cap.
export default function LabelStagePreview({ summary, elements, logoUrl, imageUrls = {}, maxWidth = 480 }: Props) {
  const template = summary.templates.find((t) => t.id === summary.order.selectedTemplateId) ?? summary.templates[0];

  const { stageW, stageH, scale } = useMemo(() => {
    if (!template) return { stageW: maxWidth, stageH: maxWidth, scale: 1 };
    const widthMm = template.trim_width_mm + template.bleed_mm * 2;
    const heightMm = template.trim_height_mm + template.bleed_mm * 2;
    const s = maxWidth / widthMm;
    return { stageW: widthMm * s, stageH: heightMm * s, scale: s };
  }, [template, maxWidth]);

  if (!template) return null;

  const theme = summary.order.theme;

  return (
    <div
      className="canvas-stage"
      style={{
        width: stageW,
        height: stageH,
        margin: 0,
        background: theme ? backgroundCss(theme) : "#fff",
      }}
    >
      {elements.map((el, i) => (
        <div
          key={el.id}
          style={{
            position: "absolute",
            left: `${el.x}%`,
            top: `${el.y}%`,
            width: `${el.w}%`,
            height: `${el.h}%`,
            zIndex: i,
            overflow: "hidden",
          }}
        >
          <ElementPreview el={el} scale={scale} summary={summary} logoUrl={logoUrl} imageUrls={imageUrls} />
        </div>
      ))}
    </div>
  );
}

export function ElementPreview({
  el,
  scale,
  summary,
  logoUrl,
  imageUrls = {},
}: {
  el: CanvasElement;
  scale: number;
  summary: Summary;
  logoUrl: string | null;
  imageUrls?: Record<string, string>;
}) {
  const { order, regulatory, panel } = summary;
  const family = (fontId: string, kind: "heading" | "body") => (FONT_PRESETS.find((f) => f.id === fontId) ?? FONT_PRESETS[0])[kind];
  const px = (mm: number) => Math.max(8, mm * scale * 2.2); // approximate on-screen text size

  switch (el.type) {
    case "photo":
      return (
        <div style={{ width: "100%", height: "100%", background: "#f1efe8", borderRadius: 4, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: `${el.imagePosition.x}% ${el.imagePosition.y}%`,
                transform: `scale(${el.imagePosition.scale})`,
              }}
            />
          ) : (
            <span className="field-hint">Logo</span>
          )}
        </div>
      );
    case "icon": {
      const Icon = ICON_COMPONENTS[el.iconId];
      return (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: el.color }}>
          <Icon size="80%" />
        </div>
      );
    }
    case "image": {
      const url = imageUrls[el.assetId];
      return url ? (
        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div style={{ width: "100%", height: "100%", background: "#f1efe8", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span className="field-hint">Image</span>
        </div>
      );
    }
    case "productName":
      return (
        <p style={{ margin: 0, fontFamily: family(el.style.fontId, "heading"), fontSize: px(el.style.fontSize), color: el.style.color, overflow: "hidden", ...textStyle(el.style, true) }}>
          {order.displayName || order.productName || "Product Name"}
        </p>
      );
    case "tagline":
      return (
        <p style={{ margin: 0, fontFamily: family(el.style.fontId, "body"), fontSize: px(el.style.fontSize), color: el.style.color, overflow: "hidden", ...textStyle(el.style) }}>
          {order.marketingTagline || ""}
        </p>
      );
    case "claims":
      return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, overflow: "hidden" }}>
          {(regulatory?.claims || "")
            .split(",")
            .filter((c) => c.trim())
            .map((c, i) => (
              <span
                key={i}
                style={{
                  fontFamily: family(el.style.fontId, "body"),
                  fontSize: px(el.style.fontSize) * 0.8,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  padding: "2px 8px",
                  borderRadius: 12,
                  background: (el as any).style.badgeColor,
                  color: el.style.color,
                }}
              >
                {c.trim()}
              </span>
            ))}
        </div>
      );
    case "ingredients":
      return (
        <div style={{ fontFamily: family(el.style.fontId, "body"), fontSize: px(el.style.fontSize), color: el.style.color, overflow: "hidden" }}>
          <p style={{ margin: 0, fontFamily: family(el.style.fontId, "heading"), fontWeight: 700 }}>Ingredients</p>
          <div style={textStyle(el.style)}>{renderBody(regulatory?.ingredients || "", el.style.listStyle)}</div>
        </div>
      );
    case "statutoryMarks":
      return (
        <div style={{ fontFamily: family(el.style.fontId, "body"), fontSize: px(el.style.fontSize), color: el.style.color, overflow: "hidden" }}>
          <p style={{ margin: 0, fontFamily: family(el.style.fontId, "heading"), fontWeight: 700 }}>Description</p>
          <div style={textStyle(el.style)}>{renderBody(regulatory?.statutory_marks || "", el.style.listStyle)}</div>
        </div>
      );
    case "nutritionPanel": {
      const heading = panel?.panel_style === "supplement_facts" ? "Supplement Facts" : panel?.panel_style === "nutrition_facts" ? "Nutrition Facts" : "";
      return (
        <div style={{ fontFamily: family(el.style.fontId, "body"), fontSize: px(el.style.fontSize), color: el.style.color, overflow: "hidden", lineHeight: 1.3 }}>
          {heading && <p style={{ margin: 0, fontFamily: family(el.style.fontId, "heading"), fontWeight: 700 }}>{heading}</p>}
          {(panel?.field_schema ?? []).map((f) => {
            const v = regulatory?.nutrition_panel?.[f.key];
            if (!v) return null;
            return (
              <div key={f.key} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #e2e5ea" }}>
                <span>{f.label}</span>
                <span>{v}</span>
              </div>
            );
          })}
        </div>
      );
    }
    case "footer":
      return (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: family(el.style.fontId, "body"),
            fontSize: px(el.style.fontSize) * 0.85,
            color: el.style.color,
            overflow: "hidden",
            borderTop: "1px solid #e2e5ea",
            paddingTop: 2,
            ...textStyle(el.style),
          }}
        >
          <div>
            Batch: {regulatory?.batch_code || "—"} SKU: {order.skuCode}
          </div>
        </div>
      );
    case "text":
      return (
        <div style={{ fontFamily: family(el.style.fontId, "body"), fontSize: px(el.style.fontSize), color: el.style.color, overflow: "hidden", whiteSpace: "pre-wrap", ...textStyle(el.style) }}>
          {el.style.listStyle && el.style.listStyle !== "none" ? renderBody(el.content, el.style.listStyle) : el.content}
        </div>
      );
    default:
      return null;
  }
}
